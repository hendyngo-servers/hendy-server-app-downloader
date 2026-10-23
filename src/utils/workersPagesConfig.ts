/**
 * Production deployment helpers. These values describe the checked-in architecture,
 * not proof that a Cloudflare account, custom domain, code signature, or security audit is configured.
 */
import type { CloudflareWorkersPagesConfig, SecurityAuditReport, DomainRouteSetting } from "../types/index.ts";

export function getDefaultDeploymentConfig(): CloudflareWorkersPagesConfig {
  const routes: DomainRouteSetting[] = [
    {
      id: "route-admin", subdomain: "admin", domain: "configure-after-deploy",
      targetView: "studio", purpose: "Giao diện Studio; mọi thao tác nhạy cảm được kiểm soát tại API backend",
      dnsType: "CNAME", dnsTarget: "chưa cấu hình", status: "pending",
      sslStatus: "provisioning", accessControl: "Internal Token Auth", apiManaged: false
    },
    {
      id: "route-downloads", subdomain: "downloads", domain: "configure-after-deploy",
      targetView: "downloads", purpose: "Cổng tải chỉ hiển thị artifact thuộc release đã xuất bản",
      dnsType: "CNAME", dnsTarget: "chưa cấu hình", status: "pending",
      sslStatus: "provisioning", accessControl: "Public Edge CDN", apiManaged: false
    }
  ];
  return {
    accountName: "cấu hình trong Cloudflare Dashboard",
    projectName: "hendy-server-app-downloader",
    pagesBranch: "main",
    pagesDomain: "sẽ có sau khi tạo Pages project",
    workersRoute: "worker/index.ts — static assets + native API",
    r2Bucket: "hendy-server-app-artifacts",
    kvNamespace: "không dùng — metadata lưu trong Cloudflare D1",
    githubRepoUrl: "https://github.com/hendyngo-servers/hendy-server-app-downloader",
    apiEndpoint: "/api/v1/admin/domain-routes",
    apiKeyProtected: true,
    routes
  };
}

export function getSecurityAuditReport(): SecurityAuditReport {
  return {
    sourceCodeExposureRisk: "Chưa được đo bằng kiểm thử bảo mật độc lập",
    sourceEncryption: "Never store secrets in source; use GitHub Actions Secrets and Cloudflare encrypted Worker secrets",
    interfaceIsolation: "Portal and Admin have distinct HTML/React entries; hostname routing is separate from mandatory API session authorization",
    binaryStripping: "Chưa thực hiện trong web build; chỉ áp dụng nếu quy trình native build hỗ trợ",
    apiGatewayProtection: "Bearer sessions, hashed tokens in D1, expiry and per-IP login throttling",
    distributionStorage: "Cloudflare D1 metadata + private Cloudflare R2 object storage"
  };
}

function safeToml(value: string): string {
  return String(value || "").replace(/["\r\n]/g, "").slice(0, 120);
}

/** Generates the full-stack Cloudflare Worker configuration template. */
export function generateWranglerConfig(config: CloudflareWorkersPagesConfig): string {
  const project = safeToml(config.projectName || "hendy-server-app-downloader");
  const bucket = safeToml(config.r2Bucket || "hendy-server-app-artifacts");
  return [
    "# Cloudflare Workers: static assets + native API + D1 + R2.",
    'name = "' + project + '"',
    'main = "worker/index.ts"',
    'compatibility_date = "2026-10-23"',
    "",
    "[assets]",
    'directory = "./dist"',
    'binding = "ASSETS"',
    'run_worker_first = ["/*"]',
    "",
    "[[d1_databases]]",
    'binding = "DB"',
    'database_name = "hendy-server-app-store"',
    'database_id = "REPLACE_WITH_D1_UUID"',
    'migrations_dir = "migrations/d1"',
    "",
    "[[r2_buckets]]",
    'binding = "ARTIFACTS"',
    'bucket_name = "' + bucket + '"',
    ""
  ].join("\n");
}

export function generatePagesFunctionsRoute(): string {
  return [
    "/** Cloudflare Pages Function using D1 and R2 bindings; no origin backend. */",
    'import { dispatchApi, type CloudflareEnv } from "../../worker/api-core";',
    "interface Context { request: Request; env: CloudflareEnv; }",
    "export async function onRequest(context: Context): Promise<Response> {",
    "  return dispatchApi(context.request, context.env);",
    "}",
    ""
  ].join("\n");
}

export function generateGitHubWorkflowYaml(config: CloudflareWorkersPagesConfig): string {
  const project = safeToml(config.projectName || "hendy-server-app-downloader");
  const branch = safeToml(config.pagesBranch || "main");
  return [
    "name: Validate and deploy Hendy Server App Store to Cloudflare",
    "",
    "on:",
    "  pull_request:",
    "    branches: [main]",
    "  push:",
    "    branches: [main]",
    "  workflow_dispatch:",
    "",
    "permissions:",
    "  contents: read",
    "",
    "jobs:",
    "  build-and-check:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 22",
    "      - run: npm install",
    "      - run: npm run lint",
    "      - run: npm run build",
    "      - run: npm run test:api",
    "",
    "  deploy-cloudflare-pages:",
    "    if: github.event_name == 'workflow_dispatch' || (github.event_name == 'push' && github.ref == 'refs/heads/" + branch + "' && vars.CLOUDFLARE_DEPLOY_ENABLED == 'true')",
    "    needs: build-and-check",
    "    runs-on: ubuntu-latest",
    "    steps:",
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 22",
    "      - run: npm install",
    "      - run: npm run build",
    "      - uses: cloudflare/wrangler-action@v4",
    "        with:",
    "          apiToken: " + "$" + "{{ secrets.CLOUDFLARE_API_TOKEN }}",
    "          accountId: " + "$" + "{{ secrets.CLOUDFLARE_ACCOUNT_ID }}",
    "          command: pages deploy dist --project-name=" + project + " --branch=" + branch,
    "",
    "# Cloudflare provisions D1/R2 and handles API requests; DNS/custom domains and TLS are configured separately.",
    ""
  ].join("\n");
}

export interface DirectoryNode {
  name: string;
  type: "file" | "directory";
  path: string;
  size?: string;
  description?: string;
  children?: DirectoryNode[];
}

export function getWorkersPagesDirectoryTree(): DirectoryNode {
  return {
    name: "hendy-server-app-downloader",
    type: "directory",
    path: "/",
    children: [
      {
        name: ".github", type: "directory", path: "/.github", children: [
          {
            name: "workflows", type: "directory", path: "/.github/workflows", children: [
              { name: "ci-deploy.yml", type: "file", path: "/.github/workflows/ci-deploy.yml", description: "Type-check, build và deploy Pages sau push main" }
            ]
          }
        ]
      },
      {
        name: "functions", type: "directory", path: "/functions", children: [
          {
            name: "api", type: "directory", path: "/functions/api", children: [
              { name: "[[path]].ts", type: "file", path: "/functions/api/[[path]].ts", description: "Cloudflare-native API using D1 and R2 bindings" }
            ]
          }
        ]
      },
      { name: "migrations", type: "directory", path: "/migrations", children: [
        { name: "0001_init.sql", type: "file", path: "/migrations/d1/0001_init.sql", description: "Cloudflare D1 schema for metadata, sessions and audit" }
      ] },
      
      
      { name: "wrangler.toml", type: "file", path: "/wrangler.toml", description: "Cấu hình Cloudflare Pages; không chứa resource ID giả hoặc secret" },
      { name: "src/client/portal/DownloadPortal.tsx", type: "file", path: "/src/client/portal/DownloadPortal.tsx", description: "Public Portal entry" },
      { name: "src/client/admin/AdminPanelPlus.tsx", type: "file", path: "/src/client/admin/AdminPanelPlus.tsx", description: "Admin Control Center entry" },
      { name: "README.md", type: "file", path: "/README.md", description: "Cloudflare-only configuration, secrets, deployment and smoke checks" }
    ]
  };
}

export function generateSystemArchitectureMarkdown(config: CloudflareWorkersPagesConfig): string {
  return [
    "# Hendy Server App Store — Cloudflare-only architecture",
    "",
    "Browser",
    "   | HTTPS",
    "   v",
    "Cloudflare Worker (Assets + native API) OR Cloudflare Pages + Pages Functions",
    "   |                           |",
    "   v                           v",
    "Cloudflare D1 metadata       Cloudflare R2 private artifact bucket",
    "   |                           |",
    "   +----- authenticated publishing / verified downloads -----+",
    "",
    "## Current template",
    "- Repository: " + config.githubRepoUrl,
    "- Cloudflare project: " + config.projectName + " (branch " + config.pagesBranch + ")",
    "- Metadata and sessions: D1; binaries: R2 bucket " + config.r2Bucket,
    "- API: " + config.apiEndpoint + " (Bearer session required)",
    "",
    "## Security and operational notes",
    "- Admin API validates sessions; a separate hostname or hidden link is not authorization.",
    "- Public catalog contains published releases and registered artifacts only.",
    "- SHA-256 checks byte integrity; it does not prove an installer was digitally signed.",
    "- D1/R2 provisioning, runtime secrets, DNS and TLS must be confirmed in Cloudflare; example domains are not live configuration.",
    ""
  ].join("\n");
}
