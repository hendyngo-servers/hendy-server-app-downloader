/**
 * Pages host router. Separate multipage entries are selected by hostname;
 * requests for assets continue through Pages' static asset resolver.
 */
interface Env { BACKEND_ORIGIN?: string; }
interface Context { request: Request; env: Env; next: (request?: Request) => Promise<Response>; }
type DomainView = "admin" | "downloads";
interface RouteCacheValue { view: DomainView; expiresAt: number; }
const cache = new Map<string, RouteCacheValue>();

function validBackendOrigin(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return null;
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    return url;
  } catch { return null; }
}

async function resolveDomain(hostname: string, env: Env): Promise<DomainView> {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  const cached = cache.get(host);
  if (cached && cached.expiresAt > Date.now()) return cached.view;
  const backend = validBackendOrigin(env.BACKEND_ORIGIN);
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
    cache.set(host, { view, expiresAt: Date.now() + 20_000 });
    if (cache.size > 500) {
      const now = Date.now();
      for (const [key, item] of cache) if (item.expiresAt <= now) cache.delete(key);
    }
    return view;
  } catch {
    // Fail to the public surface if the routing API is temporarily unavailable.
    return "downloads";
  }
}

export async function onRequest(context: Context): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // API functions have their own explicit functions/api/[[path]].ts route.
  if (pathname === "/api" || pathname.startsWith("/api/")) return next(request);

  const pageRequest = pathname === "/" || pathname === "/index.html" || pathname === "/admin.html" ||
    !pathname.split("/").pop()?.includes(".");
  if (!pageRequest) return next(request);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const view = await resolveDomain(url.hostname, env);
  if (pathname === "/admin.html" && view !== "admin") {
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }

  const rewritten = new URL(url.toString());
  rewritten.pathname = view === "admin" ? "/admin.html" : "/index.html";
  rewritten.search = "";
  const response = await next(new Request(rewritten.toString(), request));
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (view === "admin") {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    headers.set("Cache-Control", "no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
