# Hendy Server App Store — Cloudflare-only

Hendy Server App Store separates the public software portal and administrator console into two independent React/Vite entry points, with a shared API and data layer. The runtime uses **Cloudflare Workers or Cloudflare Pages Functions + D1 + R2**. No Render service, Node/Express origin, PostgreSQL server, or external API backend is required.

## Architecture

- **Portal:** `dist/index.html` — public catalog containing only explicitly published releases with real artifacts.
- **Admin:** `dist/admin.html` — private control center. Every administrative API request requires a valid Bearer session.
- **Shared API:** `worker/api-core.ts` — runs the same API implementation in Workers and Pages Functions.
- **Metadata and sessions:** Cloudflare D1 binding `DB`.
- **Installers and release files:** private-by-default Cloudflare R2 bucket binding `ARTIFACTS`; downloads are streamed through the Worker only after checking that the corresponding release is published.
- **Hostname routing:** D1 `domain_routes` plus optional hostname variables. The API stores Portal/Admin mappings. A dedicated Shared API hostname returns a service descriptor at `/` and the API under `/api/v1/*`.

## Choose a Cloudflare deployment target

### Option A — Cloudflare Workers (recommended)

The root `wrangler.toml` deploys static assets and the API together as a single Worker:

```bash
npm install
npm run lint
npm run build
npm run db:migrate:local
npx wrangler@4.152.0 dev --config=wrangler.toml
```

Deploy production through **GitHub → Actions → Deploy Hendy Server App Store to Cloudflare → Run workflow → workers**. Or configure Cloudflare Workers Builds to use `npm install && npm run build` and `npx wrangler deploy` after the D1 resource ID and runtime secrets have been set.

### Option B — Cloudflare Pages

The Pages project uses `dist` as its build output. The Pages Functions under `functions/` call `worker/api-core.ts` directly and use D1/R2 bindings; there is no `BACKEND_ORIGIN` proxy.

Run **GitHub → Actions → Deploy Hendy Server App Store to Cloudflare → Run workflow → pages**. Attach the Portal, Admin and Shared hostnames to the Pages project after deployment.

### Deploy both

Select `both` from the same GitHub Actions workflow only when you intend to publish both a full-stack Worker and a Pages project. The API runs in each target independently but can use the same D1/R2 resources. Keep the Worker/Pages hostnames distinct or attach each hostname to only the intended target.

## One-time GitHub setup

Open [Settings → Secrets and variables → Actions](https://github.com/hendyngo-servers/hendy-server-app-downloader/settings/secrets/actions).

Required repository **secrets**:

| Name | Purpose |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Token allowed to create D1/R2 resources, manage Worker scripts/Pages, apply migrations and set runtime secrets |
| `CLOUDFLARE_ACCOUNT_ID` | Target Cloudflare account ID |
| `ADMIN_USERNAME` | Administrator login username |
| `ADMIN_PASSWORD` | Long random administrator password |

Optional repository **variables**:

| Name | Example | Purpose |
|---|---|---|
| `CLOUDFLARE_DEPLOY_ENABLED` | `true` | Enables automatic deployment after pushes to `main`; manual workflow runs work without this switch |
| `CLOUDFLARE_TARGET` | `workers` | Automatic target: `workers`, `pages`, or `both` |
| `ADMIN_DISPLAY_NAME` | `Hendy Administrator` | Display name after login |
| `ADMIN_DOMAIN` | `admin.example.com` | Admin hostname only, no scheme/path |
| `PUBLIC_DOWNLOAD_DOMAIN` | `downloads.example.com` | Portal hostname only, no scheme/path |
| `SHARED_API_DOMAIN` | `api.example.com` | Optional dedicated Shared API hostname |

The deployment workflow automatically ensures the D1 database `hendy-server-app-store` and R2 bucket `hendy-server-app-artifacts` exist, updates the generated **non-secret** D1 UUID in Wrangler config, applies D1 migrations, configures Worker/Pages runtime secrets and deploys the selected target. The Cloudflare API token is only read from GitHub Secrets; it is never written into the repository. Give the token only the account-level permissions needed for D1, R2, Workers, Pages and secrets.

The workflow may commit the generated D1 UUID back to `main`; this UUID identifies the database and is not an authentication secret. The D1 ID placeholder in a fresh checkout is replaced during the first authorized deployment. If deploying manually outside the workflow, create the database, replace `database_id` in both `wrangler.toml` and `wrangler.pages.toml`, create the R2 bucket, then run migrations.

## Database and object storage

- D1 schema: `migrations/d1/0001_init.sql`.
- R2 bucket name: `hendy-server-app-artifacts`.
- D1 binding: `DB`.
- R2 binding: `ARTIFACTS`.
- Local D1 migration: `npm run db:migrate:local`.
- Remote D1 migration: `npm run db:migrate:remote` (requires Cloudflare authentication and a real D1 UUID).

R2 S3 credentials are not used by this code path. The Worker calls the R2 binding directly; do not create or store an access-key ID or secret key for the application runtime. Keep the bucket private and apply the migration before the first production request. Uploads via the multipart API are capped at 50 MiB by default. The direct-upload ticket API currently accepts a PUT through the Worker as well, with the same configured size cap. The SHA-256 checksum is calculated from the received bytes. A checksum does not assert that an installer has been digitally code-signed.

## Portal / Admin / Shared hostnames

These are examples only, not preconfigured live domains:

| Module | Example | Expected behaviour |
|---|---|---|
| Portal | `downloads.example.com` | Public Store UI |
| Admin | `admin.example.com` | Admin Control Center; sign-in required |
| Shared API | `api.example.com` | JSON service descriptor at `/`, health at `/healthz`, API under `/api/v1/*` |

Host routing maps the Portal and Admin UI to distinct HTML entries. The Shared hostname is configured with `SHARED_API_DOMAIN`; it is intentionally not a third React interface. A hostname by itself is not an authorization boundary — administrative endpoints still check the session token.

**DNS/custom domain attachment and TLS are provider-side actions.** After deployment, open the Cloudflare Worker or Pages project, attach the appropriate custom hostnames, and follow the DNS/TLS setup prompts in the Cloudflare Dashboard. The workflow deploys code and provisions D1/R2, but does not automatically claim or configure domains that are not attached to the project.

## API endpoints

- `GET /healthz`
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
- `GET /api/v1/public/apps`, `GET /api/v1/public/manifest.json`
- `GET /api/v1/public/domain-routes`, `GET /api/v1/public/domain-route?host=...`
- `GET/PUT /api/v1/admin/domain-routes` (Bearer authentication required)
- `GET /api/v1/admin/projects`, `PUT /api/v1/admin/projects/:id`, `PATCH /api/v1/admin/projects/:id/files/:fileId`
- `POST /api/v1/admin/upload-artifact`, `POST /api/v1/admin/artifact-upload-url`, `PUT /api/v1/admin/artifact-upload/:ticketId`, `POST /api/v1/admin/register-artifact`
- `GET /api/v1/downloads/artifacts/:filename` (only published release artifacts are downloadable)

## CI, tests and releases

Pull requests and pushes to `main` run type-checking, the separate-entry frontend check, local D1/R2 Worker API smoke tests and Wrangler dry-runs through `.github/workflows/ci-deploy.yml`. Production deployment is managed solely by `.github/workflows/deploy-cloudflare.yml`.

The release workflow `.github/workflows/build-and-publish-release.yml` packages the source and web build. Windows installers and Android APKs are included only when real packages are supplied under `release-assets/windows/` or `release-assets/android/`; this repository does not manufacture native installers without a native build project.

## Security checklist

- Use new, unique administrator credentials; store them only in GitHub Secrets/Cloudflare secrets.
- If a password previously committed to a sample environment file was ever used, rotate it.
- Rotate any previously exposed Cloudflare API token before deploying.
- Never put passwords or API tokens into `wrangler.toml`, source files or client-side `VITE_*` variables.
- Admin APIs require an unexpired Bearer session. Public routes expose published release metadata only.
- Verify custom-domain TLS and review backup/export needs for D1/R2 before relying on the service for production data.
