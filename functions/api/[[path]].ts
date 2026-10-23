import { dispatchApi, type CloudflareEnv } from "../../worker/api-core";

interface Context { request: Request; env: CloudflareEnv; }
export async function onRequest(context: Context): Promise<Response> {
  return dispatchApi(context.request, context.env);
}
