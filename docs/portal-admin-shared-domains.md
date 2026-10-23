# Portal / Admin / Shared domain routing

The app has two separate web interfaces and one shared API/data layer. **Shared is not a third React UI**: it is the common API, typed models, store client, integrity modal and publish modal under `src/client/shared/`.

## Recommended hostnames

Use three subdomains of a domain you control. These are examples only; replace them with your real domain.

| Module | Example hostname | What opens there |
|---|---|---|
| Public Portal | `tai-ve.example.com` | Public Store entry `dist/index.html` |
| Admin Control Center | `quan-tri.example.com` | Admin entry `dist/admin.html`; login remains required |
| Shared API | `api.example.com` | API gateway; `/` returns a service descriptor, `/api/v1/*` forwards to the Render API |

## Required settings

### Render Web Service

Set these environment variables in Render (do not commit secrets):

- `ADMIN_DOMAIN=quan-tri.example.com`
- `PUBLIC_DOWNLOAD_DOMAIN=tai-ve.example.com`
- `SHARED_API_DOMAIN=api.example.com`
- `DATABASE_URL`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and R2 credentials as required by the service.

The hostname mapping API persists Portal/Admin routes in PostgreSQL. The Shared API hostname is an edge-routing setting, not a third row in the Portal/Admin UI mapping table.

### GitHub Actions secrets

Under **Settings → Secrets and variables → Actions → Secrets**, configure:

- `CLOUDFLARE_API_TOKEN`: a newly rotated token with permission to deploy Workers and Pages.
- `CLOUDFLARE_ACCOUNT_ID`: the target Cloudflare account ID.
- `RENDER_BACKEND_ORIGIN`: the Render service origin, e.g. `https://your-service.onrender.com`.
- `SHARED_API_DOMAIN`: optional hostname such as `api.example.com` (hostname only, no scheme or path).

The existing `ci-deploy.yml` remains the automatic deployment workflow for pushes to `main` when repository variable `CLOUDFLARE_DEPLOY_ENABLED=true`. The new `deploy-cloudflare.yml` is a manual redeploy/target-selection workflow under Actions. Both require the secrets above. Set `SHARED_API_DOMAIN` as a Worker variable and Pages Functions variable too if deploying through Cloudflare's dashboard rather than Actions.

## DNS and TLS

Deploying code does **not** create DNS records or bind custom domains automatically. In Cloudflare, attach all three hostnames to the correct Pages project/Worker and follow the provider's DNS/TLS prompts. If using Render for the public frontend, attach Portal/Admin hostnames to the Render service and add the corresponding DNS records at the authoritative DNS provider. For the Shared API hostname, attach it to the API gateway/Worker or the Render service that proxies `/api/*`.

Do not expose admin-only endpoints without authentication. The hostname is only a routing selector, not an authorization boundary. Admin APIs must continue to enforce Bearer-session authentication.

## Verify after deployment

- `https://tai-ve.example.com/` renders the public store.
- `https://quan-tri.example.com/` renders the admin control center and requires login.
- `https://api.example.com/` returns JSON identifying the Shared API service.
- `https://api.example.com/healthz` checks the backend health.
- `https://api.example.com/api/v1/public/apps` returns published apps.
- `https://api.example.com/api/v1/admin/projects` without a valid session must return HTTP 401.

The GitHub release workflow can publish the source and web build. It attaches Windows `.exe/.msi` and Android `.apk` packages only if real packages are provided in `release-assets/windows/` and `release-assets/android/`. This repository does not currently contain native Windows or Android build projects, so the workflow must not invent those binaries.
