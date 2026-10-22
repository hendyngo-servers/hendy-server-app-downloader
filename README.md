# Hendy Server App Downloader

React/Vite app with two areas: a public download portal and an admin Studio. The Express backend stores metadata in PostgreSQL and binaries in private Cloudflare R2 rather than relying on the web-service filesystem.

## Architecture

- Cloudflare Workers can serve the Vite SPA from `dist/` and route `/api/*` through `worker/index.ts`. The root `wrangler.toml` is configured for the `npx wrangler deploy` command shown in Cloudflare Workers Builds.
- Cloudflare Pages is also supported; its separate `wrangler.pages.toml` configuration works with Pages Functions and `wrangler pages deploy`.
- The optional standalone API gateway Worker uses `wrangler.worker.toml`.
- Render runs the Express/Node API. PostgreSQL stores metadata, sessions and audit logs; R2 stores the actual binaries.
- The Node/Express server is **not executed directly inside Workers**. The Cloudflare entry points serve static assets and forward API requests to the reachable Render backend, which remains responsible for authentication, publishing and downloads.

## 1. PostgreSQL and R2 setup

1. Create a PostgreSQL database with TLS-enabled access. A Render PostgreSQL database or an external provider can be used; review the provider's retention and backup policy. Render Free Postgres expires after 30 days and has no backups; use it only for temporary tests, not as the only production database.
2. Create a private R2 bucket, for example `hendy-server-app-artifacts`.
3. Create R2 S3 API credentials scoped to the required bucket. Never commit keys or expose them in `VITE_*` frontend variables.
4. If browser direct uploads are used, configure R2 CORS for the actual Pages origin and PUT method. The multipart endpoint is limited to 50 MiB by default. Direct upload URLs expire after 15 minutes and the backend re-reads the object to calculate SHA-256 before registering metadata. See `infra/r2-cors.example.json` and replace the placeholder origin with your exact Pages origin before applying the bucket CORS policy.

## 2. Deploy the API backend on Render

Create a Web Service from this repository. `render.yaml` defines the build/start commands and variables that must be supplied separately.

Set these values in the Render Dashboard:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | TLS-enabled PostgreSQL connection string |
| `ADMIN_USERNAME` | A unique admin username |
| `ADMIN_PASSWORD` | A long random password, stored as a secret |
| `R2_ACCOUNT_ID` | Cloudflare Account ID |
| `R2_ACCESS_KEY_ID` | R2 S3 access key |
| `R2_SECRET_ACCESS_KEY` | R2 S3 secret key |
| `R2_BUCKET_NAME` | R2 bucket name |
| `MAX_UPLOAD_BYTES` | `52428800` (50 MiB multipart limit) |

Set `ADMIN_PASSWORD` before the first production start. There are no default credentials in the backend. Production startup fails if PostgreSQL, R2, or admin credentials are missing.

After deployment, test `https://YOUR-RENDER-SERVICE.onrender.com/healthz`. Render Free web services spin down after 15 minutes without inbound traffic, and the next request can take about one minute to start. Use Free only for hobby/preview environments, and do not rely on a Free PostgreSQL instance as the only copy of production data.

## 3. Configure GitHub Actions secrets

Open the repository's **Settings → Secrets and variables → Actions**.

Add these **repository secrets**:

| Secret | Value |
|---|---|
| `CLOUDFLARE_API_TOKEN` | A newly rotated Cloudflare API token, stored only in GitHub Secrets |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account ID |
| `RENDER_BACKEND_ORIGIN` | The exact HTTPS origin of the deployed Render service, such as `https://your-service.onrender.com` |

`RENDER_BACKEND_ORIGIN` must be an origin only: no `/api` path, query, fragment or credentials. The workflow validates this value and securely prepares a temporary secret file which it deletes after use. It configures `BACKEND_ORIGIN` for Pages Functions, the full-stack Worker, and the standalone API gateway automatically.

The Cloudflare API token must be scoped to the target account with permission to edit/deploy **Cloudflare Pages** and **Workers Scripts**. Never place the API token or R2 credentials in source code, chat, frontend variables or committed files.

If deploying through Cloudflare's built-in **Workers Builds** integration, keep the build command `npm install && npm run build` and deploy command `npx wrangler deploy`. The root `wrangler.toml` now defines the `worker/index.ts` entry point and `dist/` assets. In that mode, set `BACKEND_ORIGIN` under the Worker project's Variables and Secrets. Avoid running two deployment systems against the same Worker unless you intentionally want both to publish sequentially.

Add a **repository variable** named `CLOUDFLARE_DEPLOY_ENABLED` with exact value `true` only after the Pages project exists and the three secrets above are set. Leave it unset or set to `false` to run CI checks without deploying. The workflow can deploy on pushes to `main` and by manually selecting **Actions → Build and deploy Hendy Server App Downloader → Run workflow** on `main`.

## 4. Deploy Cloudflare Workers or Pages

1. **Workers deployment (matches the logged command `npx wrangler deploy`):** the root `wrangler.toml` defines `main = "worker/index.ts"` and `assets.directory = "./dist"`, so the Worker and Vite SPA deploy together. Keep the Cloudflare build command `npm install && npm run build` and deploy command `npx wrangler deploy`.
2. In Cloudflare Worker Settings → Variables and Secrets, set `BACKEND_ORIGIN` to the HTTPS origin of the Render API when deploying through the Cloudflare Git integration. Wrangler routes `/api/*` through the Worker first, while static frontend routes are served from the assets directory and fall back to `index.html`.
3. **Pages deployment (separate option):** use build command `npm install && npm run build` and output directory `dist`. The Pages Functions handler `functions/api/[[path]].ts` proxies API requests. GitHub Actions explicitly uses `wrangler.pages.toml` for Pages commands so the root Worker configuration is not mistaken for a Pages config.
4. After the GitHub secrets and `CLOUDFLARE_DEPLOY_ENABLED=true` variable are ready, GitHub Actions can deploy the combined SPA Worker, the Pages project and the optional standalone API gateway `hendy-server-app-downloader-api`. Check the deployed Pages/Worker URL and test `/api/v1/public/apps`; the Render backend must be reachable and the required database and R2 variables must already be set.

Do not commit Wrangler configs containing database IDs, R2 secrets, admin passwords or API tokens. The two public config files declare the deployment shape only.

## 5. Releases and artifacts

- Multipart upload: `POST /api/v1/admin/upload-artifact` with a Bearer token and form fields `file`, `projectSlug`, `version`, `platform`, `format` and `arch`. The maximum is controlled by `MAX_UPLOAD_BYTES`.
- Large packages: call `POST /api/v1/admin/artifact-upload-url` with JSON metadata, PUT the raw bytes to `uploadUrl`, then call `POST /api/v1/admin/register-artifact` with `ticketId`. The ticket is bound to the creating admin session and expires after 15 minutes.
- Upload creates or updates a draft; it does not automatically publish a release. The public portal shows a release only when `published` is true and actual stored artifacts exist.
- SHA-256 is calculated from uploaded/stored bytes. The verified flag means the checksum was computed on the server; it does not assert that an executable has a vendor code signature. The backend does not fabricate `signatureInfo` values.
- Project edits persist through `PUT /api/v1/admin/projects/:id`. Admin endpoints require an unexpired Bearer session. Login attempts are rate-limited, random tokens are issued, and only token hashes are stored in PostgreSQL.

## 6. Smoke checks

Run locally:

    npm install
    npm run lint
    npm run test:api
    npm run build

Check after deployment:

    curl -i https://YOUR-RENDER-SERVICE.onrender.com/healthz
    curl -i https://YOUR-RENDER-SERVICE.onrender.com/api/v1/public/apps
    curl -i https://hendy-server-app-downloader.pages.dev/api/v1/public/apps

An unauthenticated request to `/api/v1/admin/projects` must return 401. The public apps endpoint only returns applications with published releases and real uploaded artifacts.

## Limitations and notes

- Do not store important data or binary packages on Render web-service disk; it is not a durable storage layer.
- Cloudflare Pages Functions and the standalone Worker are gateways, not a migration of the Express API. Running the full API solely on Workers requires a separate adapter using Workers-compatible storage bindings and a data migration.
- The repository does not manufacture real application installers. Only real binaries uploaded by an administrator can become release artifacts.
