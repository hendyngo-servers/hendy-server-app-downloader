/**
 * Cloudflare Pages Functions edge gateway.
 * Configure BACKEND_ORIGIN in Pages > Settings > Variables and Secrets
 * to point at the public origin of the Render web service.
 */
interface Env {
  BACKEND_ORIGIN?: string;
}
interface Context {
  request: Request;
  env: Env;
}
export async function onRequest(context: Context): Promise<Response> {
  const originValue = context.env.BACKEND_ORIGIN;
  if (!originValue) {
    return Response.json({
      success: false,
      code: "BACKEND_ORIGIN_NOT_CONFIGURED",
      error: "Chưa cấu hình BACKEND_ORIGIN trong Cloudflare Pages."
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  let backend: URL;
  try {
    backend = new URL(originValue);
    if (backend.protocol !== "https:" && backend.hostname !== "localhost" && backend.hostname !== "127.0.0.1") {
      throw new Error("BACKEND_ORIGIN must use HTTPS");
    }
  } catch {
    return Response.json({
      success: false,
      code: "INVALID_BACKEND_ORIGIN",
      error: "BACKEND_ORIGIN phải là URL hợp lệ và dùng HTTPS."
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
  const incoming = new URL(context.request.url);
  const target = new URL(backend.toString());
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  try {
    const upstream = new Request(target.toString(), context.request);
    const response = await fetch(upstream);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  } catch {
    return Response.json({
      success: false,
      code: "BACKEND_UNAVAILABLE",
      error: "Không thể kết nối API backend. Kiểm tra dịch vụ Render và BACKEND_ORIGIN."
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}
