-- Cloudflare D1 schema for Hendy Server App Store.
-- Apply with: npx wrangler d1 migrations apply hendy-server-app-store --remote
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL,
  version TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS artifacts_slug_version_idx ON artifacts (slug, version);
CREATE INDEX IF NOT EXISTS artifacts_filename_idx ON artifacts (filename);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS admin_sessions_expiry_idx ON admin_sessions (expires_at);
CREATE TABLE IF NOT EXISTS upload_tickets (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  slug TEXT NOT NULL,
  version TEXT NOT NULL,
  filename TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  format TEXT NOT NULL,
  arch TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  uploaded INTEGER NOT NULL DEFAULT 0,
  size_bytes INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS domain_routes (
  hostname TEXT PRIMARY KEY,
  target_view TEXT NOT NULL CHECK (target_view IN ('admin', 'downloads')),
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS domain_routes_view_idx ON domain_routes (target_view, enabled);
CREATE TABLE IF NOT EXISTS login_attempts (
  ip TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  attempts INTEGER NOT NULL
);
