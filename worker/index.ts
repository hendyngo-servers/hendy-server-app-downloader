/**
 * Cloudflare Worker frontend/API entrypoint.
 *
 * The root wrangler.toml deploys the Vite SPA from ./dist and routes /api/*
 * through this Worker. wrangler.worker.toml reuses the same handler without
 * an ASSETS binding as a standalone API gateway.
 */
interface AssetsBinding {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  BACKEND_ORIGIN?: string;
  ASSETS?: AssetsBinding;
}

async function proxy(request: Request, env: Env): Promise<Response> {
  const originValue = env.BACKEND_ORIGIN;
  if (!originValue) {
    return Response.json({
      success: false,
      code: "BACKEND_ORIGIN_NOT_CONFIGURED",
      error: "Set BACKEND_ORIGIN in the Worker settings before serving API requests."
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  let backend: URL;
  try {
    backend = new URL(originValue);
    if (
      backend.protocol !== "https:" &&
      backend.hostname !== "localhost" &&
      backend.hostname !== "127.0.0.1"
    ) {
      throw new Error("HTTPS required");
    }
  } catch {
    return Response.json({
      success: false,
      code: "INVALID_BACKEND_ORIGIN",
      error: "BACKEND_ORIGIN must be a valid HTTPS origin."
    }, { status: 500, headers: { "Cache-Control": "no-store" } });
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
    return Response.json({
      success: false,
      code: "BACKEND_UNAVAILABLE",
      error: "Could not reach the API backend."
    }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
}

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    const pathname = new URL(request.url).pathname;

    // When this Worker also hosts static assets, let unmatched non-API routes
    // resolve through the assets binding (including the configured SPA shell).
    if (env.ASSETS && !pathname.startsWith("/api/")) {
      return env.ASSETS.fetch(request);
    }

    // Without ASSETS this handler remains a standalone API gateway.
    return proxy(request, env);
  }
};
