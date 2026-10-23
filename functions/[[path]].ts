import { dispatchApi, isSharedApiHost, jsonResponse, resolveDomainView, type CloudflareEnv } from "../worker/api-core";

interface Context {
  request: Request;
  env: CloudflareEnv;
  next: (request?: Request) => Promise<Response>;
}
function withSecurityHeaders(response: Response, admin = false): Response {
  const headers = new Headers(response.headers);
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("X-Frame-Options", "SAMEORIGIN");
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  if (admin) {
    headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    headers.set("Cache-Control", "no-store");
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function sharedDescriptor(): Response {
  return jsonResponse({
    service: "Hendy Shared API",
    status: "online",
    apiBase: "/api/v1",
    health: "/healthz",
    storage: ["Cloudflare D1", "Cloudflare R2"],
    modules: {
      portal: "Public software store",
      admin: "Private admin console; authentication required",
      shared: "Shared API, metadata, sessions and artifact storage"
    }
  }, 200, { "Cache-Control": "no-store" });
}
export async function onRequest(context: Context): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;
  const host = url.hostname.toLowerCase().replace(/\.$/, "");

  if (path === "/healthz") return withSecurityHeaders(await dispatchApi(request, env));
  if (path === "/api" || path.startsWith("/api/")) return next(request);

  if (isSharedApiHost(host, env)) {
    if (path === "/" || path === "/index.html") return sharedDescriptor();
    if (path === "/admin.html" || path === "/admin") return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }

  const pageRequest = path === "/" || path === "/index.html" || path === "/admin.html" || path === "/admin" ||
    !path.split("/").pop()?.includes(".");
  if (!pageRequest) return next(request);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  }

  const view = await resolveDomainView(host, env);
  if ((path === "/admin.html" || path === "/admin") && view !== "admin") {
    return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
  const rewritten = new URL(url.toString());
  rewritten.pathname = view === "admin" ? "/admin.html" : "/index.html";
  rewritten.search = "";
  const response = await next(new Request(rewritten.toString(), request));
  return withSecurityHeaders(response, view === "admin");
}
