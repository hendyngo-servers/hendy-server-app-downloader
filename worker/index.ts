import { dispatchApi, isSharedApiHost, jsonResponse, resolveDomainView, type CloudflareEnv } from "./api-core";

interface AssetsBinding { fetch(request: Request): Promise<Response>; }
interface Env extends CloudflareEnv { ASSETS?: AssetsBinding; }

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
function isHtmlNavigation(path: string): boolean {
  return path === "/" || path === "/index.html" || path === "/admin.html" || path === "/admin" ||
    !path.split("/").pop()?.includes(".");
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");

    if (path === "/healthz" || path === "/api" || path.startsWith("/api/")) {
      return withSecurityHeaders(await dispatchApi(request, env), path.startsWith("/api/v1/admin/"));
    }

    if (isSharedApiHost(host, env)) {
      if (path === "/" || path === "/index.html") return sharedDescriptor();
      if (path === "/admin.html" || path === "/admin") return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store" } });
      if (path === "/favicon.svg") return env.ASSETS ? withSecurityHeaders(await env.ASSETS.fetch(request)) : new Response(null, { status: 404 });
      return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }

    if (!env.ASSETS) {
      return jsonResponse({ success: false, code: "ASSETS_NOT_CONFIGURED", error: "Static asset binding ASSETS chưa được cấu hình." }, 503);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
    }

    if (!isHtmlNavigation(path)) return withSecurityHeaders(await env.ASSETS.fetch(request));

    const view = await resolveDomainView(host, env);
    if ((path === "/admin.html" || path === "/admin") && view !== "admin") {
      return new Response("Not Found", { status: 404, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    }

    const assetUrl = new URL(url.toString());
    assetUrl.pathname = view === "admin" ? "/admin.html" : "/index.html";
    assetUrl.search = "";
    const assetRequest = new Request(assetUrl.toString(), request);
    return withSecurityHeaders(await env.ASSETS.fetch(assetRequest), view === "admin");
  }
};
