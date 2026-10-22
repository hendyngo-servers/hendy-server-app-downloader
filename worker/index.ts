/**
 * Standalone Cloudflare Worker API gateway.
 * Configure BACKEND_ORIGIN as a Worker secret/variable in the Cloudflare dashboard.
 * Authorization and business rules remain in the Render API.
 */
interface Env {
  BACKEND_ORIGIN?: string;
}

async function proxy(request: Request, env: Env): Promise<Response> {
  const originValue = env.BACKEND_ORIGIN;
  if (!originValue) {
    return Response.json({
      success: false,
      code: "BACKEND_ORIGIN_NOT_CONFIGURED",
      error: "Set BACKEND_ORIGIN in the Worker settings before serving requests."
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  let backend: URL;
  try {
    backend = new URL(originValue);
    if (backend.protocol !== "https:" && backend.hostname !== "localhost" && backend.hostname !== "127.0.0.1") {
      throw new Error("HTTPS required");
    }
  } catch {
    return Response.json({ success: false, error: "Invalid BACKEND_ORIGIN; HTTPS is required." }, {
      status: 500,
      headers: { "Cache-Control": "no-store" }
    });
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
    return new Response(upstream.body, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers
    });
  } catch {
    return Response.json({ success: false, code: "BACKEND_UNAVAILABLE" }, {
      status: 502,
      headers: { "Cache-Control": "no-store" }
    });
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return proxy(request, env);
  }
};
