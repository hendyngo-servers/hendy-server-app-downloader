/**
 * Production API for Hendy Server App Downloader.
 * Runtime: Node.js on Render. Cloudflare Pages Functions proxy /api/* to this service.
 * Persistent data: PostgreSQL metadata + private Cloudflare R2 object storage.
 */
import express, { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import multer from "multer";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { Pool } from "pg";
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createServer as createViteServer } from "vite";
import { SAMPLE_PROJECTS } from "./src/utils/sampleProjects.ts";
import type { BuildArtifact, ProjectTemplate, TargetPlatform, ArchType } from "./src/types/index.ts";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const MAX_UPLOAD_BYTES = Math.max(1, Number(process.env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024));
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "";
const app = express();

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.PG_POOL_MAX || 5),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    })
  : null;

const s3 = process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME
  ? new S3Client({
      region: "auto",
      endpoint: "https://" + process.env.R2_ACCOUNT_ID + ".r2.cloudflarestorage.com",
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
      }
    })
  : null;

// In-memory stores are for local development only. Production fails closed without DB + R2.
const localProjects = new Map<string, ProjectTemplate>();
const localArtifacts = new Map<string, { data: StoredArtifact; bytes: Buffer }>();
const localSessions = new Map<string, StoredSession>();
const localUploadTickets = new Map<string, UploadTicket>();

interface StoredSession { username: string; name: string; expiresAt: number; }
interface StoredArtifact extends BuildArtifact {
  slug: string; version: string; objectKey: string; contentType: string;
}
interface UploadTicket {
  id: string; username: string; slug: string; version: string; filename: string;
  objectKey: string; platform: TargetPlatform; format: string; arch: ArchType; expiresAt: number;
}
interface UploadInput {
  projectSlug: string; version: string; originalFilename: string;
  platform: TargetPlatform; format: string; arch: ArchType;
}

const allowedPlatforms = new Set<TargetPlatform>(["windows", "macos", "linux", "android", "ios", "web"]);
const allowedArchitectures = new Set<ArchType>(["x86_64", "arm64", "universal", "wasm", "any"]);

function sha256(value: string | Buffer): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}
function safeFilename(value: string): string {
  const base = path.basename(String(value || "")).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "").slice(0, 160);
  return base || "artifact.bin";
}
function cleanSlug(value: string): string {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
}
function cleanVersion(value: string): string {
  return String(value || "").trim().replace(/^v/i, "").replace(/[^0-9a-zA-Z.+_-]/g, "").slice(0, 60);
}
function jsonValue<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
function cloneProject(project: ProjectTemplate): ProjectTemplate {
  return JSON.parse(JSON.stringify(project)) as ProjectTemplate;
}
function sanitizeSeed(project: ProjectTemplate): ProjectTemplate {
  const copy = cloneProject(project);
  // Examples are editable templates, not real releases or signed binaries.
  copy.releases = (copy.releases || []).map(release => ({ ...release, published: false, artifacts: [] }));
  if (copy.storeMeta) {
    copy.storeMeta = { ...copy.storeMeta, rating: 0, reviewCount: 0, downloadsCount: "0", reviews: [] };
  }
  return copy;
}
function secretEquals(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function validateUploadInput(body: Record<string, unknown>): UploadInput | null {
  const projectSlug = cleanSlug(String(body.projectSlug || ""));
  const version = cleanVersion(String(body.version || ""));
  const originalFilename = safeFilename(String(body.filename || body.originalFilename || ""));
  const platform = String(body.platform || "") as TargetPlatform;
  const arch = String(body.arch || "x86_64") as ArchType;
  const format = String(body.format || path.extname(originalFilename));
  if (!projectSlug || !version || !originalFilename || !allowedPlatforms.has(platform) || !allowedArchitectures.has(arch)) return null;
  if (!format.startsWith(".") || format.length > 20) return null;
  return { projectSlug, version, originalFilename, platform, format, arch };
}
function contentTypeFor(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const types: Record<string, string> = {
    ".exe": "application/vnd.microsoft.portable-executable", ".msi": "application/x-msi",
    ".dmg": "application/x-apple-diskimage", ".pkg": "application/octet-stream",
    ".appimage": "application/octet-stream", ".deb": "application/vnd.debian.binary-package",
    ".apk": "application/vnd.android.package-archive", ".ipa": "application/octet-stream",
    ".wasm": "application/wasm", ".zip": "application/zip", ".gz": "application/gzip",
    ".tar": "application/x-tar", ".pdf": "application/pdf"
  };
  return types[ext] || "application/octet-stream";
}
function versionMatches(a: string, b: string): boolean {
  return cleanVersion(a) === cleanVersion(b);
}
function getBearerToken(req: Request): string {
  const header = req.headers.authorization;
  return header && header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
async function audit(username: string, action: string, detail: Record<string, unknown>, req?: Request): Promise<void> {
  if (!pool) return;
  try {
    await pool.query(
      "INSERT INTO audit_logs (username, action, details, ip_address) VALUES ($1, $2, $3::jsonb, $4)",
      [username, action, JSON.stringify(detail), req?.ip || null]
    );
  } catch (error) {
    console.error("Audit write failed:", error instanceof Error ? error.message : "unknown error");
  }
}
async function ensureSchema(): Promise<void> {
  if (!pool) return;
  const schema = [
    "CREATE TABLE IF NOT EXISTS apps (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, data JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    "CREATE TABLE IF NOT EXISTS artifacts (id TEXT PRIMARY KEY, filename TEXT NOT NULL, slug TEXT NOT NULL, version TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, sha256 TEXT NOT NULL, size_bytes BIGINT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS artifacts_slug_version_idx ON artifacts (slug, version)",
    "CREATE INDEX IF NOT EXISTS artifacts_filename_idx ON artifacts (filename)",
    "CREATE TABLE IF NOT EXISTS admin_sessions (token_hash TEXT PRIMARY KEY, username TEXT NOT NULL, name TEXT NOT NULL, expires_at BIGINT NOT NULL, created_at BIGINT NOT NULL)",
    "CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions (expires_at)",
    "CREATE TABLE IF NOT EXISTS upload_tickets (id TEXT PRIMARY KEY, username TEXT NOT NULL, slug TEXT NOT NULL, version TEXT NOT NULL, filename TEXT NOT NULL, object_key TEXT NOT NULL UNIQUE, platform TEXT NOT NULL, format TEXT NOT NULL, arch TEXT NOT NULL, expires_at BIGINT NOT NULL)",
    "CREATE TABLE IF NOT EXISTS audit_logs (id BIGSERIAL PRIMARY KEY, username TEXT NOT NULL, action TEXT NOT NULL, details JSONB NOT NULL DEFAULT '{}'::jsonb, ip_address TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())"
  ].join(";\n");
  await pool.query(schema);
  const countResult = await pool.query("SELECT COUNT(*)::int AS count FROM apps");
  if (Number(countResult.rows[0].count) === 0) {
    for (const sample of SAMPLE_PROJECTS) {
      const project = sanitizeSeed(sample);
      await pool.query(
        "INSERT INTO apps (id, slug, data) VALUES ($1, $2, $3::jsonb) ON CONFLICT (id) DO NOTHING",
        [project.id, project.slug, JSON.stringify(project)]
      );
    }
  }
}
async function getProjects(): Promise<ProjectTemplate[]> {
  if (pool) {
    const result = await pool.query("SELECT data FROM apps ORDER BY data->>'name' ASC");
    return result.rows.map(row => jsonValue<ProjectTemplate>(row.data));
  }
  if (localProjects.size === 0) {
    for (const sample of SAMPLE_PROJECTS) {
      const project = sanitizeSeed(sample);
      localProjects.set(project.id, project);
    }
  }
  return [...localProjects.values()].map(cloneProject);
}
async function getProjectById(id: string): Promise<ProjectTemplate | null> {
  if (pool) {
    const result = await pool.query("SELECT data FROM apps WHERE id = $1", [id]);
    return result.rowCount ? jsonValue<ProjectTemplate>(result.rows[0].data) : null;
  }
  const project = localProjects.get(id);
  return project ? cloneProject(project) : null;
}
async function getProjectBySlug(slug: string): Promise<ProjectTemplate | null> {
  if (pool) {
    const result = await pool.query("SELECT data FROM apps WHERE slug = $1", [slug]);
    return result.rowCount ? jsonValue<ProjectTemplate>(result.rows[0].data) : null;
  }
  const project = [...localProjects.values()].find(item => item.slug === slug);
  return project ? cloneProject(project) : null;
}
async function saveProject(project: ProjectTemplate): Promise<void> {
  if (pool) {
    await pool.query(
      "INSERT INTO apps (id, slug, data, updated_at) VALUES ($1, $2, $3::jsonb, NOW()) ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, data = EXCLUDED.data, updated_at = NOW()",
      [project.id, project.slug, JSON.stringify(project)]
    );
  } else {
    localProjects.set(project.id, cloneProject(project));
  }
}
async function getAllStoredArtifacts(): Promise<StoredArtifact[]> {
  if (pool) {
    const result = await pool.query("SELECT data FROM artifacts ORDER BY created_at DESC");
    return result.rows.map(row => jsonValue<StoredArtifact>(row.data));
  }
  return [...localArtifacts.values()].map(item => item.data);
}
async function getArtifactsForSlug(slug: string): Promise<StoredArtifact[]> {
  return (await getAllStoredArtifacts()).filter(item => item.slug === slug);
}
async function findArtifactByFilename(filename: string): Promise<StoredArtifact | null> {
  if (pool) {
    const result = await pool.query("SELECT data FROM artifacts WHERE filename = $1 ORDER BY created_at DESC LIMIT 1", [filename]);
    return result.rowCount ? jsonValue<StoredArtifact>(result.rows[0].data) : null;
  }
  return localArtifacts.get(filename)?.data || null;
}
async function storeArtifactMetadata(input: UploadInput, objectKey: string, sizeBytes: number, checksum: string): Promise<BuildArtifact> {
  const project = await getProjectBySlug(input.projectSlug);
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  const version = cleanVersion(input.version);
  const filename = path.posix.basename(objectKey);
  const now = new Date().toISOString();
  const type = contentTypeFor(filename);
  const artifact: BuildArtifact = {
    id: "art-" + crypto.randomUUID(),
    platform: input.platform,
    format: input.format,
    arch: input.arch,
    filename,
    sizeBytes,
    sha256: checksum,
    downloadUrl: "/api/v1/downloads/artifacts/" + encodeURIComponent(filename),
    createdAt: now,
    // SHA-256 is calculated from the stored bytes; this is not a claim of vendor code-signing.
    verified: true
  };
  const stored: StoredArtifact = { ...artifact, slug: input.projectSlug, version, objectKey, contentType: type };
  if (pool) {
    await pool.query(
      "INSERT INTO artifacts (id, filename, slug, version, object_key, sha256, size_bytes, data) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)",
      [stored.id, stored.filename, stored.slug, stored.version, stored.objectKey, stored.sha256, stored.sizeBytes, JSON.stringify(stored)]
    );
  } else {
    if (localArtifacts.has(filename)) throw new Error("DUPLICATE_ARTIFACT_FILENAME");
    localArtifacts.set(filename, { data: stored, bytes: Buffer.alloc(0) });
  }
  const updated = cloneProject(project);
  const releases = updated.releases || [];
  let index = releases.findIndex(release => versionMatches(release.version, version) || versionMatches(release.tag, version));
  if (index < 0) {
    const tag = "v" + version;
    releases.unshift({
      version: tag, tag, releaseDate: now, channel: "stable", title: tag,
      changelog: ["Bản nháp được tạo khi tải lên artifact."], artifacts: [], published: false
    });
    index = 0;
  }
  const release = releases[index];
  // Uploads stage a draft. Publishing must be an explicit later admin action.
  releases[index] = { ...release, published: false, artifacts: [...(release.artifacts || []).filter(item => item.filename !== filename), artifact] };
  updated.releases = releases;
  await saveProject(updated);
  return artifact;
}
async function hydrateProject(project: ProjectTemplate, publicOnly: boolean): Promise<ProjectTemplate> {
  const copy = cloneProject(project);
  const artifacts = await getArtifactsForSlug(project.slug);
  copy.releases = (copy.releases || []).map(release => {
    const realArtifacts = artifacts.filter(item => versionMatches(item.version, release.version) || versionMatches(item.version, release.tag));
    return {
      ...release,
      artifacts: realArtifacts.map(item => ({
        id: item.id, platform: item.platform, format: item.format, arch: item.arch, filename: item.filename,
        sizeBytes: item.sizeBytes, sha256: item.sha256, downloadUrl: item.downloadUrl, createdAt: item.createdAt, verified: item.verified
      } as BuildArtifact))
    };
  });
  if (publicOnly) {
    copy.files = [];
    copy.releases = copy.releases.filter(release => release.published && release.artifacts.length > 0);
    if (copy.releases.length > 0) copy.currentVersion = copy.releases[0].version;
  }
  return copy;
}
async function getTicket(id: string): Promise<UploadTicket | null> {
  if (pool) {
    const result = await pool.query("SELECT id, username, slug, version, filename, object_key, platform, format, arch, expires_at FROM upload_tickets WHERE id = $1", [id]);
    if (!result.rowCount) return null;
    const row = result.rows[0];
    return {
      id: row.id, username: row.username, slug: row.slug, version: row.version, filename: row.filename,
      objectKey: row.object_key, platform: row.platform, format: row.format, arch: row.arch, expiresAt: Number(row.expires_at)
    };
  }
  return localUploadTickets.get(id) || null;
}
async function saveTicket(ticket: UploadTicket): Promise<void> {
  if (pool) {
    await pool.query(
      "INSERT INTO upload_tickets (id, username, slug, version, filename, object_key, platform, format, arch, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",
      [ticket.id, ticket.username, ticket.slug, ticket.version, ticket.filename, ticket.objectKey, ticket.platform, ticket.format, ticket.arch, ticket.expiresAt]
    );
  } else localUploadTickets.set(ticket.id, ticket);
}
async function deleteTicket(id: string): Promise<void> {
  if (pool) await pool.query("DELETE FROM upload_tickets WHERE id = $1", [id]);
  else localUploadTickets.delete(id);
}
async function getSession(token: string): Promise<StoredSession | null> {
  if (!token) return null;
  const tokenHash = sha256(token);
  if (pool) {
    const result = await pool.query("SELECT username, name, expires_at FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
    if (!result.rowCount) return null;
    const row = result.rows[0];
    if (Number(row.expires_at) <= Date.now()) {
      await pool.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
      return null;
    }
    return { username: row.username, name: row.name, expiresAt: Number(row.expires_at) };
  }
  const session = localSessions.get(tokenHash);
  if (!session || session.expiresAt <= Date.now()) {
    localSessions.delete(tokenHash);
    return null;
  }
  return session;
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { success: false, error: "Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút." }
});

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(express.json({ limit: "8mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));
app.get("/healthz", (_req, res) => res.status(200).json({ status: "ok", service: "hendy-server-app-downloader" }));

function requireAdminAuth(req: Request, res: Response, next: NextFunction): void {
  getSession(getBearerToken(req)).then(session => {
    if (!session) {
      res.status(401).json({ success: false, code: "UNAUTHORIZED", error: "Phiên quản trị không hợp lệ hoặc đã hết hạn." });
      return;
    }
    (req as Request & { adminSession?: StoredSession }).adminSession = session;
    next();
  }).catch(next);
}

app.post("/api/v1/auth/login", loginLimiter, async (req, res, next) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    const expectedUsername = process.env.ADMIN_USERNAME || "";
    const expectedPassword = process.env.ADMIN_PASSWORD || "";
    if (!expectedUsername || !expectedPassword) {
      res.status(503).json({ success: false, code: "AUTH_NOT_CONFIGURED", error: "Máy chủ chưa cấu hình ADMIN_USERNAME và ADMIN_PASSWORD." });
      return;
    }
    if (!secretEquals(username, expectedUsername) || !secretEquals(password, expectedPassword)) {
      await audit(username || "unknown", "auth.login.failed", { outcome: "rejected" }, req);
      res.status(401).json({ success: false, code: "INVALID_CREDENTIALS", error: "Tên đăng nhập hoặc mật khẩu không chính xác." });
      return;
    }
    const token = crypto.randomBytes(32).toString("base64url");
    const tokenHash = sha256(token);
    const session: StoredSession = {
      username,
      name: process.env.ADMIN_DISPLAY_NAME || "Quản trị viên",
      expiresAt: Date.now() + SESSION_TTL_MS
    };
    if (pool) {
      await pool.query(
        "INSERT INTO admin_sessions (token_hash, username, name, expires_at, created_at) VALUES ($1,$2,$3,$4,$5)",
        [tokenHash, session.username, session.name, session.expiresAt, Date.now()]
      );
    } else localSessions.set(tokenHash, session);
    await audit(username, "auth.login.success", {}, req);
    res.json({ success: true, token, user: { username: session.username, name: session.name, role: "admin" }, expiresAt: new Date(session.expiresAt).toISOString() });
  } catch (error) { next(error); }
});
app.post("/api/v1/auth/logout", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (token) {
      const tokenHash = sha256(token);
      if (pool) await pool.query("DELETE FROM admin_sessions WHERE token_hash = $1", [tokenHash]);
      else localSessions.delete(tokenHash);
    }
    res.json({ success: true });
  } catch (error) { next(error); }
});
app.get("/api/v1/auth/me", async (req, res, next) => {
  try {
    const session = await getSession(getBearerToken(req));
    if (!session) {
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, user: { username: session.username, name: session.name, role: "admin" } });
  } catch (error) { next(error); }
});

app.get("/api/v1/public/apps", async (_req, res, next) => {
  try {
    const projects = await getProjects();
    const appsList: ProjectTemplate[] = [];
    for (const project of projects) {
      const hydrated = await hydrateProject(project, true);
      if (hydrated.releases.length > 0) appsList.push(hydrated);
    }
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({ success: true, count: appsList.length, apps: appsList });
  } catch (error) { next(error); }
});
app.get("/api/v1/admin/manifest.json", requireAdminAuth, async (_req, res, next) => {
  try {
    const projects = await getProjects();
    const apps: Record<string, unknown> = {};
    let totalArtifacts = 0;
    let totalSizeBytes = 0;
    for (const project of projects) {
      const artifacts = await getArtifactsForSlug(project.slug);
      totalArtifacts += artifacts.length;
      totalSizeBytes += artifacts.reduce((sum, item) => sum + item.sizeBytes, 0);
      apps[project.slug] = {
        schemaVersion: "1.0.0",
        generatedAt: new Date().toISOString(),
        repository: "Hendy Server App Downloader",
        app: {
          id: project.id, name: project.name, slug: project.slug,
          latestVersion: project.currentVersion, publisher: project.publisher
        },
        artifacts: artifacts.map(item => ({
          id: item.id, filename: item.filename, version: item.version,
          platform: item.platform, format: item.format, arch: item.arch,
          sizeBytes: item.sizeBytes, url: item.downloadUrl, sha256: item.sha256,
          uploadedAt: item.createdAt, contentType: item.contentType,
          verified: item.verified, published: (project.releases || []).some(release =>
            Boolean(release.published) && (versionMatches(release.version, item.version) || versionMatches(release.tag, item.version))
          )
        }))
      };
    }
    res.setHeader("Cache-Control", "no-store");
    res.json({
      success: true, schemaVersion: "1.0.0", generatedAt: new Date().toISOString(),
      repositoryId: "hendy-server-app-downloader", repositoryName: "Hendy Server App Downloader",
      totalArtifacts, totalSizeBytes, apps
    });
  } catch (error) { next(error); }
});

app.get("/api/v1/public/manifest.json", async (_req, res, next) => {
  try {
    const projects = await getProjects();
    const apps: Record<string, unknown> = {};
    let totalArtifacts = 0;
    let totalSizeBytes = 0;
    for (const project of projects) {
      const hydrated = await hydrateProject(project, true);
      if (!hydrated.releases.length) continue;
      const artifacts = hydrated.releases.flatMap(release => release.artifacts);
      totalArtifacts += artifacts.length;
      totalSizeBytes += artifacts.reduce((sum, item) => sum + item.sizeBytes, 0);
      apps[hydrated.slug] = {
        schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), repository: "Hendy Server App Downloader",
        app: { id: hydrated.id, name: hydrated.name, slug: hydrated.slug, latestVersion: hydrated.currentVersion, publisher: hydrated.publisher },
        artifacts: artifacts.map(item => ({
          id: item.id, filename: item.filename,
          version: hydrated.releases.find(release => release.artifacts.some(artifact => artifact.id === item.id))?.version || hydrated.currentVersion,
          platform: item.platform, format: item.format, arch: item.arch, sizeBytes: item.sizeBytes,
          url: item.downloadUrl, sha256: item.sha256, uploadedAt: item.createdAt, contentType: contentTypeFor(item.filename), verified: item.verified
        }))
      };
    }
    res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300");
    res.json({
      schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), repositoryId: "hendy-server-app-downloader",
      repositoryName: "Hendy Server App Downloader", totalArtifacts, totalSizeBytes, apps
    });
  } catch (error) { next(error); }
});
app.get("/api/v1/public/apps/:slug/manifest", async (req, res, next) => {
  try {
    const project = await getProjectBySlug(cleanSlug(req.params.slug));
    if (!project) {
      res.status(404).json({ success: false, error: "Không tìm thấy ứng dụng." });
      return;
    }
    const hydrated = await hydrateProject(project, true);
    if (!hydrated.releases.length) {
      res.status(404).json({ success: false, error: "Ứng dụng chưa có bản phát hành công khai." });
      return;
    }
    const artifacts = hydrated.releases.flatMap(release => release.artifacts.map(item => ({
      id: item.id, filename: item.filename, version: release.version, platform: item.platform, format: item.format,
      arch: item.arch, sizeBytes: item.sizeBytes, url: item.downloadUrl, sha256: item.sha256,
      uploadedAt: item.createdAt, contentType: contentTypeFor(item.filename), verified: item.verified
    })));
    res.json({ success: true, manifest: {
      schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), repository: "Hendy Server App Downloader",
      app: { id: hydrated.id, name: hydrated.name, slug: hydrated.slug, latestVersion: hydrated.currentVersion, publisher: hydrated.publisher },
      artifacts
    } });
  } catch (error) { next(error); }
});

app.get("/api/v1/downloads/artifacts/:filename", async (req, res, next) => {
  try {
    const filename = safeFilename(req.params.filename);
    const artifact = await findArtifactByFilename(filename);
    if (!artifact) {
      res.status(404).json({ success: false, error: "Không tìm thấy tệp phát hành." });
      return;
    }
    const ownerProject = await getProjectBySlug(artifact.slug);
    const publiclyPublished = Boolean(ownerProject?.releases?.some(release =>
      release.published && (versionMatches(release.version, artifact.version) || versionMatches(release.tag, artifact.version))
    ));
    if (!publiclyPublished) {
      res.status(404).json({ success: false, error: "Bản phát hành chưa được công khai." });
      return;
    }
    if (s3) {
      const url = await getSignedUrl(s3, new GetObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: artifact.objectKey,
        ResponseContentType: artifact.contentType,
        ResponseContentDisposition: "attachment; filename=\"" + filename.replace(/["\\]/g, "_") + "\""
      }), { expiresIn: 300 });
      res.setHeader("Cache-Control", "no-store");
      res.redirect(302, url);
      return;
    }
    const local = localArtifacts.get(filename);
    if (!local || local.bytes.length === 0) {
      res.status(404).json({ success: false, error: "Tệp không có trong bộ nhớ local; hãy tải lên lại ở môi trường phát triển." });
      return;
    }
    res.setHeader("Content-Type", artifact.contentType);
    res.setHeader("Content-Length", local.bytes.length);
    res.setHeader("Content-Disposition", "attachment; filename=\"" + filename.replace(/["\\]/g, "_") + "\"");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.end(local.bytes);
  } catch (error) { next(error); }
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 12 } });
async function persistUploadedBuffer(input: UploadInput, bytes: Buffer, username: string, req: Request): Promise<BuildArtifact> {
  if (!(await getProjectBySlug(input.projectSlug))) throw new Error("PROJECT_NOT_FOUND");
  const version = cleanVersion(input.version);
  const safeOriginal = safeFilename(input.originalFilename);
  const filename = input.projectSlug + "-v" + version + "-" + crypto.randomBytes(4).toString("hex") + "-" + safeOriginal;
  const objectKey = input.projectSlug + "/" + version + "/" + filename;
  const checksum = sha256(bytes);
  const type = contentTypeFor(filename);
  if (s3) {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: objectKey, Body: bytes, ContentLength: bytes.length,
      ContentType: type, ContentDisposition: "attachment; filename=\"" + filename.replace(/["\\]/g, "_") + "\"",
      Metadata: { sha256: checksum, slug: input.projectSlug, version }
    }));
  }
  const artifact = await storeArtifactMetadata({ ...input, version, originalFilename: filename }, objectKey, bytes.length, checksum);
  if (!s3) {
    const local = localArtifacts.get(artifact.filename);
    if (local) local.bytes = bytes;
  }
  await audit(username, "artifact.upload", { slug: input.projectSlug, version, filename: artifact.filename, sizeBytes: bytes.length, sha256: checksum }, req);
  return artifact;
}
app.post("/api/v1/admin/upload-artifact", requireAdminAuth, upload.single("file"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ success: false, error: "Thiếu tệp tải lên." });
      return;
    }
    const input = validateUploadInput({
      ...req.body, filename: file.originalname,
      platform: req.body.platform || inferPlatformFromFilename(file.originalname)
    });
    if (!input) {
      res.status(400).json({ success: false, error: "projectSlug, version, platform, format hoặc arch không hợp lệ." });
      return;
    }
    const session = (req as Request & { adminSession?: StoredSession }).adminSession;
    const artifact = await persistUploadedBuffer(input, file.buffer, session?.username || "admin", req);
    res.status(201).json({ success: true, artifact, calculatedSha256: artifact.sha256, directDownloadUrl: artifact.downloadUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "PROJECT_NOT_FOUND") {
      res.status(404).json({ success: false, error: "Không tìm thấy dự án. Chọn đúng slug trước khi tải lên." });
      return;
    }
    if (error instanceof Error && error.message === "DUPLICATE_ARTIFACT_FILENAME") {
      res.status(409).json({ success: false, error: "Tên tệp đã tồn tại; vui lòng tải lại." });
      return;
    }
    next(error);
  }
});

// Large packages can be uploaded directly to private R2; the backend hashes the stored bytes before registering them.
app.post("/api/v1/admin/artifact-upload-url", requireAdminAuth, async (req, res, next) => {
  try {
    if (!s3 || !pool) {
      res.status(501).json({ success: false, error: "Direct upload yêu cầu cấu hình R2 và PostgreSQL." });
      return;
    }
    const input = validateUploadInput(req.body || {});
    if (!input) {
      res.status(400).json({ success: false, error: "Thông tin ứng dụng, phiên bản hoặc tệp không hợp lệ." });
      return;
    }
    if (!(await getProjectBySlug(input.projectSlug))) {
      res.status(404).json({ success: false, error: "Không tìm thấy dự án." });
      return;
    }
    const version = cleanVersion(input.version);
    const filename = input.projectSlug + "-v" + version + "-" + crypto.randomBytes(4).toString("hex") + "-" + input.originalFilename;
    const objectKey = input.projectSlug + "/" + version + "/" + filename;
    const ticketId = crypto.randomUUID();
    const session = (req as Request & { adminSession?: StoredSession }).adminSession;
    const ticket: UploadTicket = {
      id: ticketId, username: session?.username || "admin", slug: input.projectSlug, version,
      filename, objectKey, platform: input.platform, format: input.format, arch: input.arch,
      expiresAt: Date.now() + 15 * 60 * 1000
    };
    await saveTicket(ticket);
    // Signed PUT intentionally does not sign Content-Type or custom metadata, so browsers can upload
    // without having to reproduce SDK-specific canonical headers. The DB ticket controls registration.
    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
      Bucket: R2_BUCKET_NAME, Key: objectKey
    }), { expiresIn: 900 });
    res.status(201).json({ success: true, ticketId, filename, objectKey, uploadUrl, method: "PUT", expiresIn: 900 });
  } catch (error) { next(error); }
});
app.post("/api/v1/admin/register-artifact", requireAdminAuth, async (req, res, next) => {
  try {
    if (!s3 || !pool) {
      res.status(501).json({ success: false, error: "Đăng ký direct upload yêu cầu R2 và PostgreSQL." });
      return;
    }
    const ticket = await getTicket(String(req.body?.ticketId || ""));
    const session = (req as Request & { adminSession?: StoredSession }).adminSession;
    if (!ticket || ticket.username !== session?.username || ticket.expiresAt < Date.now()) {
      res.status(400).json({ success: false, error: "Phiếu tải lên đã hết hạn hoặc không hợp lệ." });
      return;
    }
    const head = await s3.send(new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: ticket.objectKey }));
    if (!head.ContentLength || head.ContentLength <= 0) {
      res.status(400).json({ success: false, error: "Tệp R2 không tồn tại hoặc có dung lượng bằng 0." });
      return;
    }
    const object = await s3.send(new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: ticket.objectKey }));
    if (!object.Body) {
      res.status(400).json({ success: false, error: "Không đọc được tệp đã tải lên." });
      return;
    }
    const hash = crypto.createHash("sha256");
    let size = 0;
    for await (const chunk of object.Body as AsyncIterable<Uint8Array>) {
      hash.update(chunk);
      size += chunk.byteLength;
    }
    if (size !== head.ContentLength) throw new Error("ARTIFACT_SIZE_MISMATCH");
    const artifact = await storeArtifactMetadata({
      projectSlug: ticket.slug, version: ticket.version, originalFilename: ticket.filename,
      platform: ticket.platform, format: ticket.format, arch: ticket.arch
    }, ticket.objectKey, size, hash.digest("hex"));
    await deleteTicket(ticket.id);
    await audit(ticket.username, "artifact.register", { filename: artifact.filename, sizeBytes: size, sha256: artifact.sha256 }, req);
    res.status(201).json({ success: true, artifact, calculatedSha256: artifact.sha256 });
  } catch (error) { next(error); }
});

app.post("/api/v1/admin/generate-manifest", requireAdminAuth, async (_req, res, next) => {
  try {
    const projects = await getProjects();
    const apps: Record<string, unknown> = {};
    let totalArtifacts = 0;
    let totalSizeBytes = 0;
    for (const project of projects) {
      const hydrated = await hydrateProject(project, true);
      if (!hydrated.releases.length) continue;
      const artifacts = hydrated.releases.flatMap(release => release.artifacts);
      totalArtifacts += artifacts.length;
      totalSizeBytes += artifacts.reduce((sum, item) => sum + item.sizeBytes, 0);
      apps[hydrated.slug] = {
        schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), repository: "Hendy Server App Downloader",
        app: { id: hydrated.id, name: hydrated.name, slug: hydrated.slug, latestVersion: hydrated.currentVersion, publisher: hydrated.publisher },
        artifacts
      };
    }
    res.json({ success: true, manifest: {
      schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), repositoryId: "hendy-server-app-downloader",
      repositoryName: "Hendy Server App Downloader", totalArtifacts, totalSizeBytes, apps
    } });
  } catch (error) { next(error); }
});
app.get("/api/v1/admin/projects", requireAdminAuth, async (_req, res, next) => {
  try {
    const projects = await getProjects();
    const hydrated: ProjectTemplate[] = [];
    for (const project of projects) hydrated.push(await hydrateProject(project, false));
    res.json({ success: true, projects: hydrated });
  } catch (error) { next(error); }
});
app.patch("/api/v1/admin/projects/:id/files/:fileId", requireAdminAuth, async (req, res, next) => {
  try {
    const project = await getProjectById(String(req.params.id));
    if (!project) {
      res.status(404).json({ success: false, error: "Không tìm thấy dự án." });
      return;
    }
    if (typeof req.body?.content !== "string" || req.body.content.length > 2 * 1024 * 1024) {
      res.status(400).json({ success: false, error: "Nội dung tệp phải là chuỗi và tối đa 2 MiB." });
      return;
    }
    const fileId = String(req.params.fileId);
    let found = false;
    const files = (project.files || []).map(file => {
      if (file.id !== fileId) return file;
      found = true;
      return { ...file, content: req.body.content };
    });
    if (!found) {
      res.status(404).json({ success: false, error: "Không tìm thấy tệp trong dự án." });
      return;
    }
    await saveProject({ ...project, files });
    const session = (req as Request & { adminSession?: StoredSession }).adminSession;
    await audit(session?.username || "admin", "project.file.update", { projectId: project.id, fileId }, req);
    res.json({ success: true, projectId: project.id, fileId });
  } catch (error) { next(error); }
});

app.put("/api/v1/admin/projects/:id", requireAdminAuth, async (req, res, next) => {
  try {
    const projectId = String(req.params.id);
    const current = await getProjectById(projectId);
    if (!current) {
      res.status(404).json({ success: false, error: "Không tìm thấy dự án." });
      return;
    }
    if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
      res.status(400).json({ success: false, error: "Payload dự án không hợp lệ." });
      return;
    }
    const incoming = req.body as Partial<ProjectTemplate>;
    const updated = {
      ...current, ...incoming, id: current.id, slug: current.slug,
      files: Array.isArray(incoming.files) ? incoming.files : current.files,
      releases: Array.isArray(incoming.releases) ? incoming.releases : current.releases
    } as ProjectTemplate;
    const realArtifacts = await getArtifactsForSlug(current.slug);
    updated.releases = (updated.releases || []).map(release => {
      const validArtifacts = realArtifacts
        .filter(item => versionMatches(item.version, release.version) || versionMatches(item.version, release.tag))
        .map(item => ({
          id: item.id, platform: item.platform, format: item.format, arch: item.arch, filename: item.filename,
          sizeBytes: item.sizeBytes, sha256: item.sha256, downloadUrl: item.downloadUrl, createdAt: item.createdAt, verified: item.verified
        } as BuildArtifact));
      return { ...release, artifacts: validArtifacts, published: Boolean(release.published && validArtifacts.length > 0) };
    });
    await saveProject(updated);
    const session = (req as Request & { adminSession?: StoredSession }).adminSession;
    await audit(session?.username || "admin", "project.update", { projectId, slug: updated.slug }, req);
    res.json({ success: true, project: await hydrateProject(updated, false) });
  } catch (error) { next(error); }
});
app.get("/api/v1/admin/audit-logs", requireAdminAuth, async (_req, res, next) => {
  try {
    if (!pool) {
      res.json({ success: true, logs: [] });
      return;
    }
    const result = await pool.query("SELECT id, username, action, details, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 100");
    res.json({ success: true, logs: result.rows });
  } catch (error) { next(error); }
});
app.get("/api/v1/domains", (_req, res) => {
  const adminDomain = process.env.ADMIN_DOMAIN || "";
  const downloadsDomain = process.env.PUBLIC_DOWNLOAD_DOMAIN || "";
  res.json({ success: true, routes: [
    {
      id: "route-admin", subdomain: adminDomain ? adminDomain.split(".")[0] : "admin",
      domain: adminDomain.split(".").slice(1).join(".") || "", targetView: "studio",
      purpose: "Giao diện quản trị, yêu cầu đăng nhập ở API máy chủ",
      dnsType: "CNAME", dnsTarget: "", status: adminDomain ? "pending" : "provisioning",
      sslStatus: "provisioning", accessControl: "Internal Token Auth", apiManaged: false
    },
    {
      id: "route-downloads", subdomain: downloadsDomain ? downloadsDomain.split(".")[0] : "downloads",
      domain: downloadsDomain.split(".").slice(1).join(".") || "", targetView: "downloads",
      purpose: "Cổng tải công khai chỉ hiển thị bản phát hành đã xuất bản và có artifact thật",
      dnsType: "CNAME", dnsTarget: "", status: downloadsDomain ? "pending" : "provisioning",
      sslStatus: "provisioning", accessControl: "Public Edge CDN", apiManaged: false
    }
  ] });
});

app.use("/api", (_req, res) => res.status(404).json({ success: false, error: "API endpoint không tồn tại." }));

async function startServer(): Promise<void> {
  if (IS_PRODUCTION) {
    const missing = [
      !pool ? "DATABASE_URL" : "",
      !s3 ? "R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY/R2_BUCKET_NAME" : "",
      !process.env.ADMIN_USERNAME ? "ADMIN_USERNAME" : "",
      !process.env.ADMIN_PASSWORD ? "ADMIN_PASSWORD" : ""
    ].filter(Boolean);
    if (missing.length) throw new Error("Thiếu biến môi trường production bắt buộc: " + missing.join(", "));
    await ensureSchema();
  } else if (pool) {
    await ensureSchema();
  } else {
    for (const sample of SAMPLE_PROJECTS) {
      const project = sanitizeSeed(sample);
      localProjects.set(project.id, project);
    }
  }

  if (!IS_PRODUCTION) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(ROOT, "dist"), { index: false, maxAge: "1h" }));
    app.get("*", (_req, res) => res.sendFile(path.resolve(ROOT, "dist", "index.html")));
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ success: false, error: "Tệp vượt giới hạn upload multipart. Với tệp lớn hãy dùng direct R2 upload." });
      return;
    }
    if (error instanceof Error && error.message === "ARTIFACT_SIZE_MISMATCH") {
      res.status(400).json({ success: false, error: "Dung lượng tệp không khớp; artifact chưa được đăng ký." });
      return;
    }
    console.error("Request error:", error instanceof Error ? error.message : "unknown error");
    res.status(500).json({ success: false, error: "Lỗi máy chủ nội bộ." });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log("Hendy Server App Downloader listening on port " + PORT);
    console.log("Persistent metadata: " + (pool ? "PostgreSQL" : "local memory (development only)"));
    console.log("Artifact storage: " + (s3 ? "Cloudflare R2" : "local memory (development only)"));
  });
}
startServer().catch(error => {
  console.error("Startup refused:", error instanceof Error ? error.message : error);
  process.exit(1);
});

function inferPlatformFromFilename(filename: string): TargetPlatform {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".exe") || lower.endsWith(".msi") || lower.includes("win")) return "windows";
  if (lower.endsWith(".dmg") || lower.endsWith(".pkg") || lower.includes("mac")) return "macos";
  if (lower.endsWith(".apk") || lower.includes("android")) return "android";
  if (lower.endsWith(".ipa") || lower.includes("ios")) return "ios";
  if (lower.endsWith(".wasm")) return "web";
  return "linux";
}
