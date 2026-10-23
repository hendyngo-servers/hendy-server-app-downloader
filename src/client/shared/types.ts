/** Shared strict types for the Store/Admin client layer. */
export type {
  ArchType,
  BuildArtifact,
  CloudflareWorkersPagesConfig,
  DomainRouteSetting,
  ProjectTemplate,
  ReleaseChannel,
  ReleaseVersion,
  TargetPlatform
} from "../../types/index.ts";

export type DomainTargetView = "admin" | "downloads";
export interface DomainRouteRecord {
  hostname: string;
  targetView: DomainTargetView;
  enabled: boolean;
  updatedAt?: string;
}
export interface DomainRoutesResponse {
  success: boolean;
  routes: DomainRouteRecord[];
}
export interface PublicAppsResponse {
  success: boolean;
  apps: import("../../types/index.ts").ProjectTemplate[];
}
export interface ApiErrorResponse {
  success?: false;
  code?: string;
  error?: string;
}
