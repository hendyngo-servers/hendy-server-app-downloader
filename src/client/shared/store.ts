import type { DomainRouteRecord, DomainRoutesResponse, PublicAppsResponse } from "./types.ts";

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

type RequestOptions = Omit<RequestInit, "headers"> & { headers?: HeadersInit; token?: string | null };

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const { token: _token, ...init } = options;
  const response = await fetch(path, { ...init, headers, credentials: "same-origin" });
  const text = await response.text();
  let payload: unknown = {};
  if (text) {
    try { payload = JSON.parse(text); }
    catch { payload = { error: text.slice(0, 300) }; }
  }

  if (!response.ok) {
    const errorPayload = payload as { error?: string; code?: string };
    throw new ApiRequestError(
      errorPayload.error || `API request failed (HTTP ${response.status}).`,
      response.status,
      errorPayload.code
    );
  }
  return payload as T;
}

export async function loadPublicApps(): Promise<PublicAppsResponse> {
  return apiRequest<PublicAppsResponse>("/api/v1/public/apps");
}

export async function loadPublicDomainRoutes(): Promise<DomainRoutesResponse> {
  return apiRequest<DomainRoutesResponse>("/api/v1/public/domain-routes");
}

export async function loadAdminDomainRoutes(token: string): Promise<DomainRoutesResponse> {
  return apiRequest<DomainRoutesResponse>("/api/v1/admin/domain-routes", { token });
}

export async function saveAdminDomainRoutes(
  token: string,
  input: { adminDomain: string; publicDomain: string }
): Promise<DomainRoutesResponse & { note?: string }> {
  return apiRequest<DomainRoutesResponse & { note?: string }>("/api/v1/admin/domain-routes", {
    method: "PUT",
    token,
    body: JSON.stringify(input)
  });
}

export function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export function hostnameToUrl(hostname: string): string {
  const host = normalizeHostname(hostname);
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return `http://${host}`;
  return `https://${host}`;
}

export function routeFor(routes: DomainRouteRecord[], targetView: DomainRouteRecord["targetView"]): DomainRouteRecord | undefined {
  return routes.find(route => route.targetView === targetView && route.enabled && Boolean(route.hostname));
}
