/**
 * Multi-host static entry router + API gateway for ForgeOS.
 *
 * Public Store and Admin Control Center have separate HTML/React entry points.
 * Host-to-entry mappings come from the authenticated domain-routing API; optional
 * Worker vars can bootstrap a domain before API mappings are configured.
 */
interface AssetsBinding { fetch(request: Request): Promise<Response>; }
interface Env {
  BACKEND_ORIGIN?: string;
  ADMIN_DOMAIN?: string;
  PUBLIC_DOWNLOAD_DOMAIN?: string;
  PUBLIC_STORE_DOMAIN?: string;
  SHARED_API_DOMAIN?: string;
  ASSETS?: AssetsBinding;
}
type DomainView = "admin" | "downloads";
interface CachedRoute { view: DomainView; expiresAt: number; }
const routeCache = new Map<string, CachedRoute>();
const ROUTE_CACHE_MS = 20_000;

function normalizedHost(value: string | undefined): string {
  return String(value || "").trim().toLowerCase().replace(/\.$/, "");
}
function backendUrl(env: Env): URL | null {
  if (!env.BACKEND_ORIGIN) return null;
  try {
    const url = new URL(env.BACKEND_ORIGIN);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
    return url;
  } catch { return null; }
}
function isAdminHost(host: string, env: Env): boolean {
  return Boolean(env.ADMIN_DOMAIN && normalizedHost(env.ADMIN_DOMAIN) === host);
}
function isPublicHost(host: string, env: Env): boolean {
  const configured = env.PUBLIC_DOWNLOAD_DOMAIN || env.PUBLIC_STORE_DOMAIN;
  return Boolean(configured && normalizedHost(configured) === host);
}
async function resolveDomainView(host: string, env: Env): Promise<DomainView> {
  if (isAdminHost(host, env)) return "admin";
  if (isPublicHost(host, env)) return "downloads";

  const cached = routeCache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.view;
  const backend = backendUrl(env);
  if (!backend) return "downloads";

  try {
    const endpoint = new URL("/api/v1/public/domain-route", backend);
    endpoint.searchParams.set("host", host);
    const response = await fetch(endpoint.toString(), {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) return "downloads";
    const data = await response.json() as { success?: boolean; targetView?: string };
    const view: DomainView = data.success && data.targetView === "admin" ? "admin" : "downloads";
    routeCache.set(host, { view, expiresAt: Date.now() + ROUTE_CACHE_MS });
    if (routeCache.size > 500) {
      const now = Date.now();
      for (const [key, value] of routeCache) if (value.expiresAt <= now) routeCache.delete(key);
    }
    return view;
  } catch {
    // Fail closed to the public bundle when the routing API is unreachable.
    return "downloads";
  }
}

async function proxyToBackend(request: Request, env: Env): Promise<Response> {
  const backend = backendUrl(env);
  if (!backend) {
    return Response.json({
      success: false,
      code: env.BACKEND_ORIGIN ? "INVALID_BACKEND_ORIGIN" : "BACKEND_ORIGIN_NOT_CONFIGURED",
      error: "Configure BACKEND_ORIGIN with a valid HTTPS Render backend URL."
    }, { status: env.BACKEND_ORIGIN ? 500 : 503, headers: { "Cache-Control": "no-store" } });
  }
  const incoming = new URL(request.url);
  const target = new URL(backend.toString());
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  try {
    const upstream = await fetch(new Request(target.toString(), request));
    const headers = new Headers(upstream.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
  } catch {
    return Response.json({
      success: false,
      code: "BACKEND_UNAVAILABLE",
      error: "Could not reach the API backend. Check Render health and BACKEND_ORIGIN."
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

function withSecurityHeaders(response: Response, admin: boolean): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  if (admin) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    headers.set("Cache-Control", "no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const host = normalizedHost(url.hostname);
    const sharedHost = Boolean(env.SHARED_API_DOMAIN && normalizedHost(env.SHARED_API_DOMAIN) === host);

    if (path === "/healthz" || path === "/api" || path.startsWith("/api/")) {
      return proxyToBackend(request, env);
    }
    if (sharedHost) {
      if (request.method !== "GET" && request.method !== "HEAD") {
        return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
      }
      if (path === "/" || path === "/index.html") {
        return Response.json({
          service: "Hendy Shared API",
          status: "online",
          apiBase: "/api/v1",
          health: "/healthz",
          modules: { portal: "public store UI", admin: "admin UI (authentication required)", shared: "shared API and data services" }
        }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
      }
      return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    if (!env.ASSETS) return proxyToBackend(request, env);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    // Host routing only runs for HTML/SPA navigation. Hashed JS/CSS/images are served
    // directly by the Assets binding and remain cacheable at the edge.
    const pageRequest = path === "/" || path === "/index.html" || path === "/admin.html" ||
      !path.split("/").pop()?.includes(".");
    if (!pageRequest) return withSecurityHeaders(await env.ASSETS.fetch(request), false);

    const view = await resolveDomainView(host, env);
    if (path === "/admin.html" && view !== "admin") {
      return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }
    const assetPath = view === "admin" ? "/admin.html" : "/index.html";
    const assetUrl = new URL(url.toString());
    assetUrl.pathname = assetPath;
    assetUrl.search = "";
    const assetRequest = new Request(assetUrl.toString(), request);
    return withSecurityHeaders(await env.ASSETS.fetch(assetRequest), view === "admin");
  }
};
