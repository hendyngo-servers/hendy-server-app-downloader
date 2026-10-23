-- Persistent metadata for Render deployments (PostgreSQL).
-- server.ts also applies these idempotent statements at startup.
CREATE TABLE IF NOT EXISTS apps (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS artifacts (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  slug TEXT NOT NULL,
  version TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL,
  size_bytes BIGINT NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS artifacts_slug_version_idx ON artifacts (slug, version);
CREATE INDEX IF NOT EXISTS artifacts_filename_idx ON artifacts (filename);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  name TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  created_at BIGINT NOT NULL
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
  expires_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  action TEXT NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS domain_routes (
  hostname TEXT PRIMARY KEY,
  target_view TEXT NOT NULL CHECK (target_view IN ('admin', 'downloads')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_by TEXT NOT NULL DEFAULT 'system',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS domain_routes_view_idx ON domain_routes (target_view, enabled);
