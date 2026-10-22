# Hendy Server App Downloader

React/Vite app with two areas: a public download portal and an admin Studio. The Express backend now stores metadata in PostgreSQL and binaries in private Cloudflare R2 rather than relying on the web service filesystem.

## Architecture

- Render Free runs the Express/Node API and can also serve the built frontend.
- PostgreSQL stores project metadata, artifact metadata, admin sessions, upload tickets, and audit logs.
- A private Cloudflare R2 bucket stores binaries. The API generates short-lived signed download URLs; the bucket itself does not need public access.
- Cloudflare Pages + Pages Functions (Workers runtime) serve the static UI and proxy /api/* to the Render backend, so the frontend can continue using relative API paths.

The Express backend uses Node APIs and is not simply executed unchanged inside Workers. Pages Functions and the optional standalone Worker are edge gateways; Render remains the single API origin, avoiding split-brain metadata stores.

## 1. PostgreSQL and R2 setup

1. Create a PostgreSQL database with TLS-enabled access. A Render PostgreSQL database or an external provider can be used; review the provider's retention and backup policy.
2. Create a private R2 bucket, for example hendy-server-app-artifacts.
3. Create R2 S3 API credentials scoped to the required bucket. Never commit keys or expose them in VITE_* frontend variables.
4. If browser direct uploads are used, configure R2 CORS for the actual Pages origin and PUT method. The multipart endpoint is limited to 50 MiB by default. Direct upload URLs expire after 15 minutes and the backend re-reads the object to calculate SHA-256 before registering metadata. See `infra/r2-cors.example.json` and replace the placeholder origin with your exact Pages origin before applying the bucket CORS policy.

## 2. Deploy Render Free

Create a Web Service from this repository. render.yaml defines build/start commands and declares environment values that must be supplied separately.

Set these values in the Render Dashboard:

| Variable | Value |
|---|---|
| NODE_ENV | production |
| DATABASE_URL | TLS-enabled PostgreSQL connection string |
| ADMIN_USERNAME | A unique admin username |
| ADMIN_PASSWORD | A long random password, stored as a secret |
| R2_ACCOUNT_ID | Cloudflare Account ID |
| R2_ACCESS_KEY_ID | R2 S3 access key |
| R2_SECRET_ACCESS_KEY | R2 S3 secret key |
| R2_BUCKET_NAME | R2 bucket name |
| MAX_UPLOAD_BYTES | 52428800 (50 MiB multipart limit) |

Set ADMIN_PASSWORD before the first production start. There are no default credentials in the backend. Production startup fails if PostgreSQL, R2, or admin credentials are missing.

After deployment, check https://YOUR-RENDER-SERVICE.onrender.com/healthz. Expected response: a JSON status of ok. Render Free services may cold-start after inactivity, so the first request can be slower.

## 3. Deploy Cloudflare Pages + Functions

1. Create Pages project hendy-server-app-downloader, connect this repository and use branch main. Build command: npm install && npm run build. Output directory: dist.
2. Under Pages Settings, Variables and Secrets, Production, set BACKEND_ORIGIN to the exact HTTPS origin of the Render service, for example https://your-service.onrender.com. Do not append /api or a trailing slash.
3. Add the same BACKEND_ORIGIN variable to Preview if preview deployments should work. functions/api/[[path]].ts proxies /api/* requests and disables edge caching for API responses.
4. For GitHub Actions deploy, create repository secrets CLOUDFLARE_API_TOKEN with Pages deploy permission and CLOUDFLARE_ACCOUNT_ID. The workflow deploys Pages after a successful build on main. Render auto-deploy should be enabled for the same branch.

Do not commit a wrangler configuration containing database IDs, R2 secrets, or admin passwords. wrangler.toml contains only public Pages configuration.

## 4. Releases and artifacts

- Multipart upload: POST /api/v1/admin/upload-artifact with a Bearer token and form fields file, projectSlug, version, platform, format, and arch. The maximum is controlled by MAX_UPLOAD_BYTES.
- Large packages: call POST /api/v1/admin/artifact-upload-url with JSON metadata, PUT the raw bytes to uploadUrl, then call POST /api/v1/admin/register-artifact with ticketId. The ticket is bound to the creating admin session and expires after 15 minutes.
- Upload creates or updates a draft; it does not automatically publish a release. The public portal shows a release only when published is true and actual stored artifacts exist.
- SHA-256 is calculated from uploaded/stored bytes. The verified flag means the checksum was computed on the server; it does not assert that an executable has a vendor code signature. The backend no longer fabricates signatureInfo values.
- Project edits persist through PUT /api/v1/admin/projects/:id. Admin endpoints require an unexpired Bearer session. Login attempts are rate-limited, random tokens are issued, and only token hashes are stored in PostgreSQL.

## 5. Smoke checks

Run locally:

    npm install
    npm run lint
    npm run build

Check after deployment:

    curl -i https://YOUR-RENDER-SERVICE.onrender.com/healthz
    curl -i https://YOUR-RENDER-SERVICE.onrender.com/api/v1/public/apps
    curl -i https://YOUR-PAGES-PROJECT.pages.dev/api/v1/public/apps

An unauthenticated request to /api/v1/admin/projects must return 401. The public apps endpoint only returns applications with published releases and real uploaded artifacts.

## Limitations and notes

- Do not store important data or binary packages on Render web-service disk; it is not a durable storage layer.
- Cloudflare Pages Functions here are a gateway, not a port of Express. Running an independent API fully on Workers requires a separate adapter using D1/R2 bindings and a data migration.
- The repository does not manufacture real application installers. Only real binaries uploaded by an administrator can become release artifacts.
