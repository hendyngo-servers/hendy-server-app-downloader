import { SAMPLE_PROJECTS } from "../src/utils/sampleProjects";
import type { BuildArtifact, ProjectTemplate, TargetPlatform, ArchType } from "../src/types/index";

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[]; success?: boolean }>;
  run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
}
interface D1Database {
  prepare(query: string): D1Statement;
  batch<T = unknown>(statements: D1Statement[]): Promise<T[]>;
}
interface R2Object {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpMetadata?: { contentType?: string; contentDisposition?: string; cacheControl?: string };
  customMetadata?: Record<string, string>;
}
interface R2Bucket {
  put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream, options?: {
    httpMetadata?: { contentType?: string; contentDisposition?: string; cacheControl?: string };
    customMetadata?: Record<string, string>;
  }): Promise<unknown>;
  get(key: string): Promise<R2Object | null>;
  head(key: string): Promise<{ size: number } | null>;
  delete(key: string): Promise<void>;
}
export interface CloudflareEnv {
  DB?: D1Database;
  ARTIFACTS?: R2Bucket;
  ADMIN_USERNAME?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_DISPLAY_NAME?: string;
  ADMIN_DOMAIN?: string;
  PUBLIC_DOWNLOAD_DOMAIN?: string;
  PUBLIC_STORE_DOMAIN?: string;
  SHARED_API_DOMAIN?: string;
  MAX_UPLOAD_BYTES?: string;
}
type DomainTargetView = "admin" | "downloads";
interface DomainRouteRecord { hostname: string; targetView: DomainTargetView; enabled: boolean; updatedAt: string; }
interface StoredSession { username: string; name: string; expiresAt: number; }
interface StoredArtifact extends BuildArtifact { slug: string; version: string; objectKey: string; contentType: string; }
interface UploadInput { projectSlug: string; version: string; originalFilename: string; platform: TargetPlatform; format: string; arch: ArchType; }
interface UploadTicket { id: string; username: string; slug: string; version: string; filename: string; objectKey: string; platform: TargetPlatform; format: string; arch: ArchType; expiresAt: number; uploaded: boolean; sizeBytes: number; }
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const UPLOAD_TICKET_TTL_MS = 15 * 60 * 1000;
const allowedPlatforms = new Set<TargetPlatform>(["windows", "macos", "linux", "android", "ios", "web"]);
const allowedArchitectures = new Set<ArchType>(["x86_64", "arm64", "universal", "wasm", "any"]);

export function jsonResponse(data: unknown, status = 200, headers?: HeadersInit): Response {
  const outputHeaders = new Headers(headers);
  outputHeaders.set("Content-Type", "application/json; charset=utf-8");
  outputHeaders.set("X-Content-Type-Options", "nosniff");
  outputHeaders.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (!outputHeaders.has("Cache-Control")) outputHeaders.set("Cache-Control", "no-store");
  return new Response(JSON.stringify(data), { status, headers: outputHeaders });
}
function failure(error: string, status: number, code?: string): Response {
  return jsonResponse({ success: false, error, ...(code ? { code } : {}) }, status);
}
function dbFor(env: CloudflareEnv): D1Database {
  if (!env.DB) throw new Error("D1_NOT_CONFIGURED");
  return env.DB;
}
function bucketFor(env: CloudflareEnv): R2Bucket {
  if (!env.ARTIFACTS) throw new Error("R2_NOT_CONFIGURED");
  return env.ARTIFACTS;
}
function parseJson<T>(value: unknown): T {
  return (typeof value === "string" ? JSON.parse(value) : value) as T;
}
function cloneProject(project: ProjectTemplate): ProjectTemplate {
  return JSON.parse(JSON.stringify(project)) as ProjectTemplate;
}
function sanitizeSeed(project: ProjectTemplate): ProjectTemplate {
  const copy = cloneProject(project);
  copy.releases = (copy.releases || []).map(release => ({ ...release, published: false, artifacts: [] }));
  if (copy.storeMeta) copy.storeMeta = { ...copy.storeMeta, rating: 0, reviewCount: 0, downloadsCount: "0", reviews: [] };
  return copy;
}
function cleanSlug(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 80);
}
function cleanVersion(value: unknown): string {
  return String(value || "").trim().replace(/^v/i, "").replace(/[^0-9a-zA-Z.+_-]/g, "").slice(0, 60);
}
function safeFilename(value: unknown): string {
  const base = String(value || "").split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "").slice(0, 160) || "";
  return base || "artifact.bin";
}
export function normalizeHostname(value: unknown): string | null {
  const input = String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").split(/[/?#]/, 1)[0].replace(/\.$/, "");
  if (!input || input.length > 253 || input.includes(":") || input.includes("*")) return null;
  const labels = input.split(".");
  if (labels.some(label => !label || label.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(label))) return null;
  return input;
}
function envDomainRoutes(env: CloudflareEnv): DomainRouteRecord[] {
  const now = new Date().toISOString();
  const routes: DomainRouteRecord[] = [];
  const admin = normalizeHostname(env.ADMIN_DOMAIN);
  const store = normalizeHostname(env.PUBLIC_DOWNLOAD_DOMAIN || env.PUBLIC_STORE_DOMAIN);
  if (admin) routes.push({ hostname: admin, targetView: "admin", enabled: true, updatedAt: now });
  if (store && store !== admin) routes.push({ hostname: store, targetView: "downloads", enabled: true, updatedAt: now });
  return routes;
}
export async function listDomainRoutes(env: CloudflareEnv): Promise<DomainRouteRecord[]> {
  const db = env.DB;
  if (!db) return envDomainRoutes(env);
  const result = await db.prepare("SELECT hostname, target_view, enabled, updated_at FROM domain_routes ORDER BY target_view ASC").all<{
    hostname: string; target_view: DomainTargetView; enabled: number; updated_at: string;
  }>();
  const routes = result.results.map(row => ({
    hostname: row.hostname,
    targetView: row.target_view,
    enabled: Boolean(row.enabled),
    updatedAt: row.updated_at
  }));
  for (const fallback of envDomainRoutes(env)) {
    if (!routes.some(route => route.hostname === fallback.hostname || route.targetView === fallback.targetView)) {
      await db.prepare("INSERT OR IGNORE INTO domain_routes (hostname, target_view, enabled, updated_by, updated_at) VALUES (?, ?, 1, 'environment', ?)").bind(fallback.hostname, fallback.targetView, fallback.updatedAt).run();
      routes.push(fallback);
    }
  }
  return routes;
}
export async function resolveDomainView(host: string, env: CloudflareEnv): Promise<DomainTargetView> {
  const hostname = normalizeHostname(host);
  if (!hostname) return "downloads";
  const routes = await listDomainRoutes(env);
  return routes.find(route => route.hostname === hostname && route.enabled)?.targetView || "downloads";
}
export function isSharedApiHost(host: string, env: CloudflareEnv): boolean {
  const expected = normalizeHostname(env.SHARED_API_DOMAIN);
  return Boolean(expected && normalizeHostname(host) === expected);
}
async function ensureSeedProjects(db: D1Database): Promise<void> {
  const existing = await db.prepare("SELECT id FROM apps LIMIT 1").first<{ id: string }>();
  if (existing) return;
  const statements = SAMPLE_PROJECTS.map(seed => {
    const project = sanitizeSeed(seed);
    return db.prepare("INSERT OR IGNORE INTO apps (id, slug, data, updated_at) VALUES (?, ?, ?, ?)").bind(
      project.id, cleanSlug(project.slug), JSON.stringify(project), Date.now()
    );
  });
  if (statements.length) await db.batch(statements);
}
async function getProjects(env: CloudflareEnv): Promise<ProjectTemplate[]> {
  const db = dbFor(env);
  await ensureSeedProjects(db);
  const rows = await db.prepare("SELECT data FROM apps ORDER BY slug ASC").all<{ data: string }>();
  return rows.results.map(row => parseJson<ProjectTemplate>(row.data));
}
async function getProjectById(env: CloudflareEnv, id: string): Promise<ProjectTemplate | null> {
  const db = dbFor(env);
  await ensureSeedProjects(db);
  const row = await db.prepare("SELECT data FROM apps WHERE id = ?").bind(id).first<{ data: string }>();
  return row ? parseJson<ProjectTemplate>(row.data) : null;
}
async function getProjectBySlug(env: CloudflareEnv, slug: string): Promise<ProjectTemplate | null> {
  const db = dbFor(env);
  await ensureSeedProjects(db);
  const row = await db.prepare("SELECT data FROM apps WHERE slug = ?").bind(slug).first<{ data: string }>();
  return row ? parseJson<ProjectTemplate>(row.data) : null;
}
async function saveProject(env: CloudflareEnv, project: ProjectTemplate): Promise<void> {
  const db = dbFor(env);
  await db.prepare("INSERT INTO apps (id, slug, data, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET slug=excluded.slug, data=excluded.data, updated_at=excluded.updated_at")
    .bind(project.id, cleanSlug(project.slug), JSON.stringify(project), Date.now()).run();
}
async function getArtifactsForSlug(env: CloudflareEnv, slug: string): Promise<StoredArtifact[]> {
  const db = dbFor(env);
  const rows = await db.prepare("SELECT data FROM artifacts WHERE slug = ? ORDER BY created_at DESC").bind(slug).all<{ data: string }>();
  return rows.results.map(row => parseJson<StoredArtifact>(row.data));
}
async function getAllArtifacts(env: CloudflareEnv): Promise<StoredArtifact[]> {
  const db = dbFor(env);
  const rows = await db.prepare("SELECT data FROM artifacts ORDER BY created_at DESC").all<{ data: string }>();
  return rows.results.map(row => parseJson<StoredArtifact>(row.data));
}
async function findArtifactByFilename(env: CloudflareEnv, filename: string): Promise<StoredArtifact | null> {
  const db = dbFor(env);
  const row = await db.prepare("SELECT data FROM artifacts WHERE filename = ? ORDER BY created_at DESC LIMIT 1").bind(filename).first<{ data: string }>();
  return row ? parseJson<StoredArtifact>(row.data) : null;
}
function versionMatches(a: unknown, b: unknown): boolean { return cleanVersion(a) === cleanVersion(b); }
function contentTypeFor(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop() || "";
  const types: Record<string, string> = {
    exe: "application/vnd.microsoft.portable-executable", msi: "application/x-msi",
    dmg: "application/x-apple-diskimage", pkg: "application/octet-stream",
    appimage: "application/octet-stream", deb: "application/vnd.debian.binary-package",
    apk: "application/vnd.android.package-archive", ipa: "application/octet-stream",
    wasm: "application/wasm", zip: "application/zip", gz: "application/gzip",
    tar: "application/x-tar", pdf: "application/pdf"
  };
  return types[ext] || "application/octet-stream";
}
function inferPlatform(filename: string): TargetPlatform {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".exe") || lower.endsWith(".msi") || lower.includes("win")) return "windows";
  if (lower.endsWith(".dmg") || lower.endsWith(".pkg") || lower.includes("mac")) return "macos";
  if (lower.endsWith(".apk") || lower.includes("android")) return "android";
  if (lower.endsWith(".ipa") || lower.includes("ios")) return "ios";
  if (lower.endsWith(".wasm")) return "web";
  return "linux";
}
function validateUploadInput(body: Record<string, unknown>): UploadInput | null {
  const projectSlug = cleanSlug(body.projectSlug);
  const version = cleanVersion(body.version);
  const originalFilename = safeFilename(body.filename || body.originalFilename);
  const platform = String(body.platform || "") as TargetPlatform;
  const arch = String(body.arch || "x86_64") as ArchType;
  const format = String(body.format || ("." + (originalFilename.split(".").pop() || "bin")));
  if (!projectSlug || !version || !originalFilename || !allowedPlatforms.has(platform) || !allowedArchitectures.has(arch)) return null;
  if (!format.startsWith(".") || format.length > 20) return null;
  return { projectSlug, version, originalFilename, platform, format, arch };
}
async function sha256Hex(bytes: ArrayBuffer | Uint8Array): Promise<string> {
  const input = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const digest = await crypto.subtle.digest("SHA-256", input);
  return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, "0")).join("");
}
function randomToken(size = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  let raw = "";
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function tokenHash(token: string): Promise<string> { return sha256Hex(new TextEncoder().encode(token)); }
function safeEqual(a: string, b: string): boolean {
  let mismatch = a.length ^ b.length;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return mismatch === 0;
}
function bearer(request: Request): string {
  const header = request.headers.get("Authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}
async function getSession(env: CloudflareEnv, token: string): Promise<StoredSession | null> {
  if (!token) return null;
  const db = dbFor(env);
  const hashed = await tokenHash(token);
  const row = await db.prepare("SELECT username, name, expires_at FROM admin_sessions WHERE token_hash = ?").bind(hashed)
    .first<{ username: string; name: string; expires_at: number }>();
  if (!row) return null;
  if (Number(row.expires_at) <= Date.now()) {
    await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(hashed).run();
    return null;
  }
  return { username: row.username, name: row.name, expiresAt: Number(row.expires_at) };
}
async function audit(env: CloudflareEnv, username: string, action: string, detail: Record<string, unknown>, request: Request): Promise<void> {
  if (!env.DB) return;
  try {
    await env.DB.prepare("INSERT INTO audit_logs (username, action, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(username, action, JSON.stringify(detail), request.headers.get("CF-Connecting-IP") || null, Date.now()).run();
  } catch { /* Audit failure must not hide the primary API response. */ }
}
async function canAttemptLogin(db: D1Database, ip: string): Promise<boolean> {
  const now = Date.now();
  const result = await db.prepare(
    "INSERT INTO login_attempts (ip, window_start, attempts) VALUES (?, ?, 1) " +
    "ON CONFLICT(ip) DO UPDATE SET " +
    "attempts = CASE WHEN login_attempts.window_start + 900000 <= excluded.window_start THEN 1 ELSE login_attempts.attempts + 1 END, " +
    "window_start = CASE WHEN login_attempts.window_start + 900000 <= excluded.window_start THEN excluded.window_start ELSE login_attempts.window_start END " +
    "RETURNING attempts"
  ).bind(ip, now).first<{ attempts: number }>();
  return Number(result?.attempts || 0) <= 10;
}
async function hydrateProject(env: CloudflareEnv, project: ProjectTemplate, publicOnly: boolean): Promise<ProjectTemplate> {
  const copy = cloneProject(project);
  const artifacts = await getArtifactsForSlug(env, project.slug);
  copy.releases = (copy.releases || []).map(release => ({
    ...release,
    artifacts: artifacts.filter(item => versionMatches(item.version, release.version) || versionMatches(item.version, release.tag))
      .map(item => ({
        id: item.id, platform: item.platform, format: item.format, arch: item.arch, filename: item.filename,
        sizeBytes: item.sizeBytes, sha256: item.sha256, downloadUrl: item.downloadUrl, createdAt: item.createdAt, verified: item.verified
      } as BuildArtifact))
  }));
  if (publicOnly) {
    copy.files = [];
    copy.releases = copy.releases.filter(release => release.published && release.artifacts.length > 0);
    if (copy.releases.length > 0) copy.currentVersion = copy.releases[0].version;
  }
  return copy;
}
async function createArtifactRecord(env: CloudflareEnv, input: UploadInput, filename: string, objectKey: string, sizeBytes: number, checksum: string): Promise<BuildArtifact> {
  const project = await getProjectBySlug(env, input.projectSlug);
  if (!project) throw new Error("PROJECT_NOT_FOUND");
  const db = dbFor(env);
  const now = new Date().toISOString();
  const contentType = contentTypeFor(filename);
  const artifact: BuildArtifact = {
    id: "art-" + crypto.randomUUID(), platform: input.platform, format: input.format, arch: input.arch,
    filename, sizeBytes, sha256: checksum,
    downloadUrl: "/api/v1/downloads/artifacts/" + encodeURIComponent(filename),
    createdAt: now, verified: true
  };
  const stored: StoredArtifact = { ...artifact, slug: input.projectSlug, version: cleanVersion(input.version), objectKey, contentType };
  await db.prepare("INSERT INTO artifacts (id, filename, slug, version, object_key, sha256, size_bytes, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .bind(stored.id, stored.filename, stored.slug, stored.version, stored.objectKey, stored.sha256, stored.sizeBytes, JSON.stringify(stored), Date.now()).run();
  const updated = cloneProject(project);
  const releases = updated.releases || [];
  let index = releases.findIndex(release => versionMatches(release.version, stored.version) || versionMatches(release.tag, stored.version));
  if (index < 0) {
    const tag = "v" + stored.version;
    releases.unshift({ version: tag, tag, releaseDate: now, channel: "stable", title: tag, changelog: ["Bản nháp được tạo khi tải lên artifact."], artifacts: [], published: false });
    index = 0;
  }
  releases[index] = { ...releases[index], published: false, artifacts: [...(releases[index].artifacts || []).filter(item => item.filename !== filename), artifact] };
  updated.releases = releases;
  await saveProject(env, updated);
  return artifact;
}
async function persistUploadedBuffer(env: CloudflareEnv, input: UploadInput, bytes: ArrayBuffer, username: string, request: Request): Promise<BuildArtifact> {
  const bucket = bucketFor(env);
  const filename = input.projectSlug + "-v" + input.version + "-" + crypto.randomUUID().slice(0, 8) + "-" + safeFilename(input.originalFilename);
  const objectKey = input.projectSlug + "/" + input.version + "/" + filename;
  const checksum = await sha256Hex(bytes);
  const contentType = contentTypeFor(filename);
  await bucket.put(objectKey, bytes, {
    httpMetadata: { contentType, contentDisposition: "attachment; filename=\"" + filename.replace(/["\\]/g, "_") + "\"" },
    customMetadata: { sha256: checksum, slug: input.projectSlug, version: input.version }
  });
  try {
    const artifact = await createArtifactRecord(env, input, filename, objectKey, bytes.byteLength, checksum);
    await audit(env, username, "artifact.upload", { slug: input.projectSlug, version: input.version, filename, sizeBytes: bytes.byteLength, sha256: checksum }, request);
    return artifact;
  } catch (error) {
    await bucket.delete(objectKey).catch(() => {});
    throw error;
  }
}
async function getTicket(env: CloudflareEnv, id: string): Promise<UploadTicket | null> {
  const row = await dbFor(env).prepare("SELECT id, username, slug, version, filename, object_key, platform, format, arch, expires_at, uploaded, size_bytes FROM upload_tickets WHERE id = ?")
    .bind(id).first<Record<string, unknown>>();
  if (!row) return null;
  return {
    id: String(row.id), username: String(row.username), slug: String(row.slug), version: String(row.version),
    filename: String(row.filename), objectKey: String(row.object_key), platform: String(row.platform) as TargetPlatform,
    format: String(row.format), arch: String(row.arch) as ArchType, expiresAt: Number(row.expires_at),
    uploaded: Boolean(row.uploaded), sizeBytes: Number(row.size_bytes || 0)
  };
}
async function handleUploadUrl(request: Request, env: CloudflareEnv, session: StoredSession): Promise<Response> {
  const data = await request.json().catch(() => ({})) as Record<string, unknown>;
  const input = validateUploadInput(data);
  if (!input) return failure("Thông tin ứng dụng, phiên bản hoặc tệp không hợp lệ.", 400);
  if (!(await getProjectBySlug(env, input.projectSlug))) return failure("Không tìm thấy dự án.", 404);
  const id = crypto.randomUUID();
  const filename = input.projectSlug + "-v" + input.version + "-" + crypto.randomUUID().slice(0, 8) + "-" + input.originalFilename;
  const objectKey = input.projectSlug + "/" + input.version + "/" + filename;
  const expiresAt = Date.now() + UPLOAD_TICKET_TTL_MS;
  await dbFor(env).prepare("INSERT INTO upload_tickets (id, username, slug, version, filename, object_key, platform, format, arch, expires_at, uploaded, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)")
    .bind(id, session.username, input.projectSlug, input.version, filename, objectKey, input.platform, input.format, input.arch, expiresAt).run();
  const uploadUrl = new URL("/api/v1/admin/artifact-upload/" + encodeURIComponent(id), request.url).toString();
  return jsonResponse({ success: true, ticketId: id, filename, objectKey, uploadUrl, method: "PUT", expiresIn: 900 }, 201);
}
async function handleDirectUpload(request: Request, env: CloudflareEnv, ticketId: string, session: StoredSession): Promise<Response> {
  const ticket = await getTicket(env, ticketId);
  if (!ticket || ticket.username !== session.username || ticket.expiresAt <= Date.now()) return failure("Phiếu tải lên đã hết hạn hoặc không hợp lệ.", 400, "INVALID_UPLOAD_TICKET");
  if (request.method !== "PUT") return failure("Phương thức không được hỗ trợ.", 405, "METHOD_NOT_ALLOWED");
  const bytes = await request.arrayBuffer();
  const maxBytes = Number(env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024);
  if (bytes.byteLength <= 0 || bytes.byteLength > maxBytes) return failure("Tệp rỗng hoặc vượt giới hạn tải lên hiện tại.", 413, "UPLOAD_TOO_LARGE");
  await bucketFor(env).put(ticket.objectKey, bytes, { httpMetadata: { contentType: contentTypeFor(ticket.filename) } });
  await dbFor(env).prepare("UPDATE upload_tickets SET uploaded = 1, size_bytes = ? WHERE id = ?").bind(bytes.byteLength, ticket.id).run();
  return jsonResponse({ success: true, uploaded: true, sizeBytes: bytes.byteLength });
}
async function handleRegisterArtifact(request: Request, env: CloudflareEnv, session: StoredSession): Promise<Response> {
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const ticket = await getTicket(env, String(body.ticketId || ""));
  if (!ticket || ticket.username !== session.username || ticket.expiresAt <= Date.now() || !ticket.uploaded) return failure("Phiếu tải lên hết hạn, chưa tải xong hoặc không hợp lệ.", 400);
  const object = await bucketFor(env).get(ticket.objectKey);
  if (!object) return failure("Không tìm thấy tệp trong R2.", 400);
  const bytes = await new Response(object.body).arrayBuffer();
  if (bytes.byteLength !== ticket.sizeBytes || bytes.byteLength <= 0) return failure("Kích thước tệp không khớp.", 400, "ARTIFACT_SIZE_MISMATCH");
  const checksum = await sha256Hex(bytes);
  const input: UploadInput = {
    projectSlug: ticket.slug, version: ticket.version, originalFilename: ticket.filename,
    platform: ticket.platform, format: ticket.format, arch: ticket.arch
  };
  const artifact = await createArtifactRecord(env, input, ticket.filename, ticket.objectKey, bytes.byteLength, checksum);
  await dbFor(env).prepare("DELETE FROM upload_tickets WHERE id = ?").bind(ticket.id).run();
  await audit(env, session.username, "artifact.register", { filename: artifact.filename, sizeBytes: bytes.byteLength, sha256: checksum }, request);
  return jsonResponse({ success: true, artifact, calculatedSha256: checksum }, 201);
}
function manifestEntry(project: ProjectTemplate, artifacts: StoredArtifact[]): Record<string, unknown> {
  return {
    schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), repository: "Hendy Server App Store",
    app: { id: project.id, name: project.name, slug: project.slug, latestVersion: project.currentVersion, publisher: project.publisher },
    artifacts: artifacts.map(item => ({
      id: item.id, filename: item.filename, version: item.version, platform: item.platform, format: item.format,
      arch: item.arch, sizeBytes: item.sizeBytes, url: item.downloadUrl, sha256: item.sha256,
      uploadedAt: item.createdAt, contentType: item.contentType, verified: item.verified
    }))
  };
}
export async function dispatchApi(request: Request, env: CloudflareEnv): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  try {
    if (path === "/healthz" && (method === "GET" || method === "HEAD")) {
      return jsonResponse({ status: "ok", service: "hendy-server-app-store", databaseConfigured: Boolean(env.DB), artifactStorageConfigured: Boolean(env.ARTIFACTS) });
    }
    if (!path.startsWith("/api/")) return failure("API endpoint không tồn tại.", 404, "NOT_FOUND");
    const db = env.DB ? env.DB : null;

    if (path === "/api/v1/auth/login" && method === "POST") {
      if (!db) return failure("Chưa gắn Cloudflare D1. Tạo database rồi cấu hình binding DB.", 503, "D1_NOT_CONFIGURED");
      const attemptsAllowed = await canAttemptLogin(db, ip);
      if (!attemptsAllowed) return failure("Quá nhiều lần đăng nhập. Vui lòng thử lại sau 15 phút.", 429, "RATE_LIMITED");
      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) return failure("Chưa cấu hình secret ADMIN_USERNAME và ADMIN_PASSWORD.", 503, "AUTH_NOT_CONFIGURED");
      if (!safeEqual(username, env.ADMIN_USERNAME) || !safeEqual(password, env.ADMIN_PASSWORD)) {
        await audit(env, username || "unknown", "auth.login.failed", { outcome: "rejected" }, request);
        return failure("Tên đăng nhập hoặc mật khẩu không chính xác.", 401, "INVALID_CREDENTIALS");
      }
      const token = randomToken();
      const tokenDigest = await tokenHash(token);
      const expiresAt = Date.now() + SESSION_TTL_MS;
      const displayName = env.ADMIN_DISPLAY_NAME || "Quản trị viên";
      await db.prepare("INSERT INTO admin_sessions (token_hash, username, name, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
        .bind(tokenDigest, username, displayName, expiresAt, Date.now()).run();
      await db.prepare("DELETE FROM login_attempts WHERE ip = ?").bind(ip).run();
      await audit(env, username, "auth.login.success", {}, request);
      return jsonResponse({ success: true, token, user: { username, name: displayName, role: "admin" }, expiresAt: new Date(expiresAt).toISOString() });
    }
    if (path === "/api/v1/auth/logout" && method === "POST") {
      const token = bearer(request);
      if (token && db) await db.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await tokenHash(token)).run();
      return jsonResponse({ success: true });
    }
    if (path === "/api/v1/auth/me" && method === "GET") {
      const session = await getSession(env, bearer(request)).catch(() => null);
      if (!session) return jsonResponse({ authenticated: false }, 401);
      return jsonResponse({ authenticated: true, user: { username: session.username, name: session.name, role: "admin" } });
    }

    if (path.startsWith("/api/v1/admin/")) {
      const session = await getSession(env, bearer(request)).catch(() => null);
      if (!session) return failure("Phiên quản trị không hợp lệ hoặc đã hết hạn.", 401, "UNAUTHORIZED");
      if (path === "/api/v1/admin/domain-routes" && method === "GET") return jsonResponse({ success: true, routes: await listDomainRoutes(env) });
      if (path === "/api/v1/admin/domain-routes" && method === "PUT") {
        const body = await request.json().catch(() => ({})) as Record<string, unknown>;
        const adminDomain = normalizeHostname(body.adminDomain);
        const publicDomain = normalizeHostname(body.publicDomain);
        const sharedDomain = normalizeHostname(env.SHARED_API_DOMAIN);
        if (!adminDomain || !publicDomain) return failure("Mỗi hostname phải là tên miền hợp lệ, không chứa scheme, đường dẫn, wildcard hoặc port.", 400, "INVALID_HOSTNAME");
        if (adminDomain === publicDomain || (sharedDomain && (adminDomain === sharedDomain || publicDomain === sharedDomain))) {
          return failure("Hostname Portal, Admin và Shared phải khác nhau.", 400, "DUPLICATE_HOSTNAME");
        }
        const now = new Date().toISOString();
        const routes = [
          { hostname: adminDomain, targetView: "admin" as const },
          { hostname: publicDomain, targetView: "downloads" as const }
        ];
        const statements: D1Statement[] = [
          dbFor(env).prepare("DELETE FROM domain_routes")
        ];
        for (const route of routes) statements.push(
          dbFor(env).prepare("INSERT INTO domain_routes (hostname, target_view, enabled, updated_by, updated_at) VALUES (?, ?, 1, ?, ?)")
            .bind(route.hostname, route.targetView, session.username, now)
        );
        await dbFor(env).batch(statements);
        await audit(env, session.username, "domain.routes.update", { adminDomain, publicDomain }, request);
        return jsonResponse({ success: true, routes: routes.map(route => ({ ...route, enabled: true, updatedAt: now })), note: "Đã lưu định tuyến trong Cloudflare D1. DNS và custom domain/TLS cần được gắn trong Cloudflare Dashboard." });
      }
      if (path === "/api/v1/admin/projects" && method === "GET") {
        const projects = await Promise.all((await getProjects(env)).map(project => hydrateProject(env, project, false)));
        return jsonResponse({ success: true, projects });
      }
      if (path === "/api/v1/admin/manifest.json" && method === "GET") {
        const projects = await getProjects(env);
        const apps: Record<string, unknown> = {};
        let totalArtifacts = 0, totalSizeBytes = 0;
        for (const project of projects) {
          const artifacts = await getArtifactsForSlug(env, project.slug);
          totalArtifacts += artifacts.length;
          totalSizeBytes += artifacts.reduce((sum, item) => sum + item.sizeBytes, 0);
          apps[project.slug] = { ...manifestEntry(project, artifacts), app: { id: project.id, name: project.name, slug: project.slug, latestVersion: project.currentVersion, publisher: project.publisher }, artifacts: artifacts.map(item => ({ id: item.id, filename: item.filename, version: item.version, platform: item.platform, format: item.format, arch: item.arch, sizeBytes: item.sizeBytes, url: item.downloadUrl, sha256: item.sha256, uploadedAt: item.createdAt, contentType: item.contentType, verified: item.verified, published: (project.releases || []).some(release => release.published && (versionMatches(release.version, item.version) || versionMatches(release.tag, item.version))) })) };
        }
        return jsonResponse({ success: true, schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), repositoryId: "hendy-server-app-store", repositoryName: "Hendy Server App Store", totalArtifacts, totalSizeBytes, apps });
      }
      if (path === "/api/v1/admin/generate-manifest" && method === "POST") {
        const projects = await getProjects(env);
        const apps: Record<string, unknown> = {};
        let totalArtifacts = 0, totalSizeBytes = 0;
        for (const project of projects) {
          const hydrated = await hydrateProject(env, project, true);
          if (!hydrated.releases.length) continue;
          const artifacts = hydrated.releases.flatMap(release => release.artifacts);
          totalArtifacts += artifacts.length;
          totalSizeBytes += artifacts.reduce((sum, item) => sum + item.sizeBytes, 0);
          apps[hydrated.slug] = manifestEntry(hydrated, artifacts.map(item => ({ ...item, version: hydrated.releases.find(release => release.artifacts.some(a => a.id === item.id))?.version || hydrated.currentVersion } as StoredArtifact)));
        }
        return jsonResponse({ success: true, manifest: { schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), repositoryId: "hendy-server-app-store", repositoryName: "Hendy Server App Store", totalArtifacts, totalSizeBytes, apps } });
      }
      if (path === "/api/v1/admin/audit-logs" && method === "GET") {
        const result = await dbFor(env).prepare("SELECT id, username, action, details, ip_address, created_at FROM audit_logs ORDER BY id DESC LIMIT 100").all<Record<string, unknown>>();
        return jsonResponse({ success: true, logs: result.results.map(row => ({ ...row, details: parseJson(row.details), created_at: new Date(Number(row.created_at)).toISOString() })) });
      }
      if (path === "/api/v1/admin/upload-artifact" && method === "POST") {
        if (!env.ARTIFACTS) return failure("Chưa gắn Cloudflare R2 bucket ARTIFACTS.", 503, "R2_NOT_CONFIGURED");
        const form = await request.formData();
        const fileEntry = form.get("file");
        if (!(fileEntry instanceof File)) return failure("Thiếu tệp tải lên.", 400);
        const max = Math.max(1, Number(env.MAX_UPLOAD_BYTES || 50 * 1024 * 1024));
        if (fileEntry.size <= 0 || fileEntry.size > max) return failure("Tệp rỗng hoặc vượt giới hạn upload multipart.", 413, "UPLOAD_TOO_LARGE");
        const input = validateUploadInput({
          projectSlug: form.get("projectSlug"), version: form.get("version"), filename: fileEntry.name,
          platform: form.get("platform") || inferPlatform(fileEntry.name), format: form.get("format"),
          arch: form.get("arch") || "x86_64"
        });
        if (!input) return failure("projectSlug, version, platform, format hoặc arch không hợp lệ.", 400);
        const artifact = await persistUploadedBuffer(env, input, await fileEntry.arrayBuffer(), session.username, request);
        return jsonResponse({ success: true, artifact, calculatedSha256: artifact.sha256, directDownloadUrl: artifact.downloadUrl }, 201);
      }
      if (path === "/api/v1/admin/artifact-upload-url" && method === "POST") return await handleUploadUrl(request, env, session);
      const directUploadMatch = path.match(/^\/api\/v1\/admin\/artifact-upload\/([a-f0-9-]{36})$/i);
      if (directUploadMatch && method === "PUT") return await handleDirectUpload(request, env, directUploadMatch[1], session);
      if (path === "/api/v1/admin/register-artifact" && method === "POST") return await handleRegisterArtifact(request, env, session);
      const filePatch = path.match(/^\/api\/v1\/admin\/projects\/([^/]+)\/files\/([^/]+)$/);
      if (filePatch && method === "PATCH") {
        const projectId = decodeURIComponent(filePatch[1]);
        const fileId = decodeURIComponent(filePatch[2]);
        const body = await request.json().catch(() => ({})) as Record<string, unknown>;
        if (typeof body.content !== "string") return failure("Nội dung tệp không hợp lệ.", 400);
        const project = await getProjectById(env, projectId);
        if (!project) return failure("Không tìm thấy dự án.", 404);
        let found = false;
        project.files = project.files.map(file => {
          if (file.id !== fileId) return file;
          found = true;
          return { ...file, content: body.content };
        });
        if (!found) return failure("Không tìm thấy tệp nguồn.", 404);
        await saveProject(env, project);
        await audit(env, session.username, "project.file.update", { projectId, fileId }, request);
        return jsonResponse({ success: true, project: await hydrateProject(env, project, false) });
      }
      const projectMatch = path.match(/^\/api\/v1\/admin\/projects\/([^/]+)$/);
      if (projectMatch && method === "PUT") {
        const projectId = decodeURIComponent(projectMatch[1]);
        const incoming = await request.json().catch(() => null) as ProjectTemplate | null;
        if (!incoming || typeof incoming !== "object" || !Array.isArray(incoming.files) || !Array.isArray(incoming.releases)) return failure("Dữ liệu dự án không hợp lệ.", 400);
        const current = await getProjectById(env, projectId);
        if (!current) return failure("Không tìm thấy dự án.", 404);
        const updated = { ...current, ...incoming, id: current.id, slug: cleanSlug(incoming.slug), name: String(incoming.name || current.name).slice(0, 180) } as ProjectTemplate;
        if (!updated.slug) return failure("Slug dự án không hợp lệ.", 400);
        const artifacts = await getArtifactsForSlug(env, current.slug);
        updated.releases = incoming.releases.map(release => {
          const realArtifacts = artifacts.filter(item => versionMatches(item.version, release.version) || versionMatches(item.version, release.tag));
          return { ...release, artifacts: realArtifacts.map(item => ({ id: item.id, platform: item.platform, format: item.format, arch: item.arch, filename: item.filename, sizeBytes: item.sizeBytes, sha256: item.sha256, downloadUrl: item.downloadUrl, createdAt: item.createdAt, verified: item.verified } as BuildArtifact)), published: Boolean(release.published && realArtifacts.length > 0) };
        });
        await saveProject(env, updated);
        await audit(env, session.username, "project.update", { projectId, slug: updated.slug }, request);
        return jsonResponse({ success: true, project: await hydrateProject(env, updated, false) });
      }
      return failure("Admin API endpoint không tồn tại.", 404, "NOT_FOUND");
    }

    if (path === "/api/v1/public/apps" && method === "GET") {
      const list: ProjectTemplate[] = [];
      for (const project of await getProjects(env)) {
        const hydrated = await hydrateProject(env, project, true);
        if (hydrated.releases.length) list.push(hydrated);
      }
      return jsonResponse({ success: true, count: list.length, apps: list }, 200, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300", "Content-Type": "application/json; charset=utf-8" });
    }
    if (path === "/api/v1/public/domain-routes" && method === "GET") {
      return jsonResponse({ success: true, routes: (await listDomainRoutes(env)).filter(route => route.enabled) });
    }
    if (path === "/api/v1/public/domain-route" && method === "GET") {
      const hostname = normalizeHostname(url.searchParams.get("host") || url.hostname);
      if (!hostname) return failure("Hostname không hợp lệ.", 400, "INVALID_HOSTNAME");
      const route = (await listDomainRoutes(env)).find(item => item.hostname === hostname && item.enabled);
      return jsonResponse({ success: true, hostname, targetView: route?.targetView || "downloads", configured: Boolean(route), enabled: route?.enabled ?? true });
    }
    if (path === "/api/v1/domains" && method === "GET") {
      const routes = await listDomainRoutes(env);
      return jsonResponse({ success: true, routes: routes.map(route => {
        const labels = route.hostname.split(".");
        const admin = route.targetView === "admin";
        return {
          id: admin ? "route-admin" : "route-downloads", hostname: route.hostname,
          subdomain: labels.length > 1 ? labels[0] : route.hostname, domain: labels.length > 1 ? labels.slice(1).join(".") : "",
          targetView: admin ? "studio" : "downloads",
          purpose: admin ? "Admin Control Center; authentication required." : "Public Store; published releases only.",
          dnsType: "CNAME", dnsTarget: "", status: "pending", sslStatus: "provisioning",
          accessControl: admin ? "Internal Token Auth" : "Public Edge CDN", apiManaged: true, enabled: route.enabled, updatedAt: route.updatedAt
        };
      }) });
    }
    if (path === "/api/v1/public/manifest.json" && method === "GET") {
      const apps: Record<string, unknown> = {};
      let totalArtifacts = 0, totalSizeBytes = 0;
      for (const project of await getProjects(env)) {
        const hydrated = await hydrateProject(env, project, true);
        if (!hydrated.releases.length) continue;
        const artifacts = hydrated.releases.flatMap(release => release.artifacts);
        totalArtifacts += artifacts.length;
        totalSizeBytes += artifacts.reduce((sum, item) => sum + item.sizeBytes, 0);
        apps[hydrated.slug] = manifestEntry(hydrated, artifacts.map(item => ({ ...item, version: hydrated.releases.find(release => release.artifacts.some(a => a.id === item.id))?.version || hydrated.currentVersion } as StoredArtifact)));
      }
      return jsonResponse({ schemaVersion: "1.0.0", generatedAt: new Date().toISOString(), repositoryId: "hendy-server-app-store", repositoryName: "Hendy Server App Store", totalArtifacts, totalSizeBytes, apps }, 200, { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" });
    }
    const appManifest = path.match(/^\/api\/v1\/public\/apps\/([^/]+)\/manifest$/);
    if (appManifest && method === "GET") {
      const project = await getProjectBySlug(env, cleanSlug(decodeURIComponent(appManifest[1])));
      if (!project) return failure("Không tìm thấy ứng dụng.", 404);
      const hydrated = await hydrateProject(env, project, true);
      if (!hydrated.releases.length) return failure("Ứng dụng chưa có bản phát hành công khai.", 404);
      const artifacts = hydrated.releases.flatMap(release => release.artifacts.map(item => ({ ...item, version: release.version })));
      return jsonResponse({ success: true, manifest: { ...manifestEntry(hydrated, artifacts as StoredArtifact[]), artifacts: artifacts.map(item => ({ id: item.id, filename: item.filename, version: item.version, platform: item.platform, format: item.format, arch: item.arch, sizeBytes: item.sizeBytes, url: item.downloadUrl, sha256: item.sha256, uploadedAt: item.createdAt, contentType: contentTypeFor(item.filename), verified: item.verified })) } });
    }
    const downloadMatch = path.match(/^\/api\/v1\/downloads\/artifacts\/([^/]+)$/);
    if (downloadMatch && (method === "GET" || method === "HEAD")) {
      const filename = safeFilename(decodeURIComponent(downloadMatch[1]));
      const artifact = await findArtifactByFilename(env, filename);
      if (!artifact) return failure("Không tìm thấy tệp phát hành.", 404);
      const owner = await getProjectBySlug(env, artifact.slug);
      const published = Boolean(owner?.releases?.some(release => release.published && (versionMatches(release.version, artifact.version) || versionMatches(release.tag, artifact.version))));
      if (!published) return failure("Bản phát hành chưa được công khai.", 404);
      const object = await bucketFor(env).get(artifact.objectKey);
      if (!object) return failure("Tệp chưa có trong Cloudflare R2.", 404);
      const headers = new Headers({
        "Content-Type": artifact.contentType || contentTypeFor(filename),
        "Content-Length": String(object.size),
        "Content-Disposition": "attachment; filename=\"" + filename.replace(/["\\]/g, "_") + "\"",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=60"
      });
      return new Response(method === "HEAD" ? null : object.body, { status: 200, headers });
    }
    return failure("API endpoint không tồn tại.", 404, "NOT_FOUND");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "D1_NOT_CONFIGURED") return failure("Chưa gắn Cloudflare D1. Tạo database và cấu hình binding DB.", 503, "D1_NOT_CONFIGURED");
    if (message === "R2_NOT_CONFIGURED") return failure("Chưa gắn Cloudflare R2 bucket ARTIFACTS.", 503, "R2_NOT_CONFIGURED");
    if (message === "PROJECT_NOT_FOUND") return failure("Không tìm thấy dự án. Chọn đúng slug trước khi tải lên.", 404, "PROJECT_NOT_FOUND");
    if (message.includes("UNIQUE constraint failed: artifacts.filename") || message.includes("UNIQUE constraint failed: artifacts.object_key")) return failure("Tên tệp đã tồn tại; vui lòng tải lại.", 409, "DUPLICATE_ARTIFACT_FILENAME");
    if (message.includes("UNIQUE constraint failed: apps.slug")) return failure("Slug ứng dụng đã được sử dụng.", 409, "DUPLICATE_PROJECT_SLUG");
    console.error("Cloudflare API error:", message);
    return failure("Lỗi nội bộ Cloudflare API.", 500, "INTERNAL_ERROR");
  }
}
