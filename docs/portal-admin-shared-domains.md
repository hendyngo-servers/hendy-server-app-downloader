# Portal / Admin / Shared — Cloudflare-only domains

Hendy Server App Store runs entirely on Cloudflare. Both deployment options use `worker/api-core.ts` and Cloudflare bindings: D1 for metadata/sessions and R2 for installer artifacts.

## Recommended hostnames

Use three hostnames from a domain you control. These names are examples only.

| Module | Example hostname | Behaviour |
|---|---|---|
| Public Portal | `downloads.example.com` | Serves `dist/index.html` |
| Admin Control Center | `admin.example.com` | Serves `dist/admin.html`; login and protected API endpoints required |
| Shared API | `api.example.com` | JSON descriptor at `/`, health at `/healthz`, endpoints under `/api/v1/*` |

Shared is the shared API/data layer, not a third React frontend.

## Required GitHub Actions secrets

- `CLOUDFLARE_API_TOKEN`: scoped to the account for D1 database, R2 bucket, Workers/Pages deployment, migrations and runtime secrets.
- `CLOUDFLARE_ACCOUNT_ID`: target Cloudflare account ID.
- `ADMIN_USERNAME`: non-default administrator username.
- `ADMIN_PASSWORD`: long random password, never committed to source.

Optional repository variables are `CLOUDFLARE_TARGET=workers|pages|both`, `ADMIN_DISPLAY_NAME`, `ADMIN_DOMAIN`, `PUBLIC_DOWNLOAD_DOMAIN`, and `SHARED_API_DOMAIN`.

## Deploy

1. Open **Actions → Deploy Hendy Server App Store to Cloudflare → Run workflow**.
2. Select `workers` for a single full-stack Worker (recommended), `pages` for Pages + Pages Functions, or `both` only when you need to operate both.
3. The workflow checks/creates D1 `hendy-server-app-store` and R2 `hendy-server-app-artifacts`, writes the D1 UUID to both Wrangler configs, runs `migrations/d1/0001_init.sql`, writes runtime secrets and deploys the chosen target.
4. After configuring the required secrets, pushes to `main` deploy automatically. Set `CLOUDFLARE_TARGET` to `workers`, `pages` or `both`; when unset, automatic deployments default to Workers.
5. Review the Actions result. A successful code deployment does not prove that external custom-domain names are attached or DNS/TLS is active.

## DNS and TLS

After the Worker or Pages project exists, attach each hostname under the Cloudflare custom-domain settings for the correct project. Follow the DNS and certificate instructions shown in Cloudflare Dashboard. Do not direct every hostname at both the Worker and Pages project at once.

Set the hostname variables as plain hostnames only, without a scheme, port or path:

- `ADMIN_DOMAIN=admin.example.com`
- `PUBLIC_DOWNLOAD_DOMAIN=downloads.example.com`
- `SHARED_API_DOMAIN=api.example.com`

The Admin and Portal hostname mappings are stored in D1 by the protected `PUT /api/v1/admin/domain-routes` endpoint. The Shared API host is selected by `SHARED_API_DOMAIN` and is not stored as an extra UI route. Administrative API calls remain protected by Bearer session authentication; hiding the admin link or using a separate domain does not replace authorization.

## Verify

- Portal: `https://downloads.example.com/`
- Admin: `https://admin.example.com/`
- Shared service descriptor: `https://api.example.com/`
- Health: `https://api.example.com/healthz`
- Published catalog: `https://api.example.com/api/v1/public/apps`
- Unauthenticated admin API request must return HTTP 401.

## Data model

- D1: `migrations/d1/0001_init.sql`
- D1 binding: `DB`
- R2 bucket: `hendy-server-app-artifacts`
- R2 binding: `ARTIFACTS`

The application uses the R2 binding directly; no S3 API keys are required at runtime. The CI smoke test applies the D1 migration locally and exercises auth, route mappings, upload/checksum, publish filtering, download bytes and logout revocation.
