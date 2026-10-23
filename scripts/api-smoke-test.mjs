import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.API_SMOKE_PORT || 3187);
const origin = "http://127.0.0.1:" + port;
const childEnv = {
  ...process.env,
  NODE_ENV: "development",
  PORT: String(port),
  ADMIN_USERNAME: "ci-admin",
  ADMIN_PASSWORD: "ci-only-test-password",
  ADMIN_DISPLAY_NAME: "CI Test Admin",
  DATABASE_URL: "",
  R2_ACCOUNT_ID: "",
  R2_ACCESS_KEY_ID: "",
  R2_SECRET_ACCESS_KEY: "",
  R2_BUCKET_NAME: ""
};
// Spawn the TypeScript runtime directly so terminating the test also terminates the API process.
const child = spawn(process.execPath, ["node_modules/tsx/dist/cli.mjs", "server.ts"], {
  env: childEnv,
  stdio: ["ignore", "pipe", "pipe"]
});

let logs = "";
let exitCode = null;
child.stdout.on("data", chunk => { logs = (logs + chunk.toString()).slice(-8000); });
child.stderr.on("data", chunk => { logs = (logs + chunk.toString()).slice(-8000); });
child.on("exit", code => { exitCode = code; });

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function jsonRequest(path, init) {
  const response = await fetch(origin + path, init);
  let data = {};
  try { data = await response.json(); } catch { /* handled by assertion */ }
  return { response, data };
}
async function waitForHealth() {
  const deadline = Date.now() + 25000;
  while (Date.now() < deadline) {
    if (exitCode !== null) throw new Error("API server exited early with code " + exitCode);
    try {
      const { response, data } = await jsonRequest("/healthz", { signal: AbortSignal.timeout(1000) });
      if (response.ok && data.status === "ok") return;
    } catch { /* server is still starting */ }
    await delay(300);
  }
  throw new Error("API server did not become healthy within 25 seconds");
}

async function main() {
  await waitForHealth();

  const unauthorized = await jsonRequest("/api/v1/admin/projects");
  assert(unauthorized.response.status === 401, "Admin projects endpoint must return 401 without a bearer token.");

  const invalidLogin = await jsonRequest("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "wrong-user", password: "wrong-password" })
  });
  assert(invalidLogin.response.status === 401, "Invalid admin credentials must be rejected.");

  const login = await jsonRequest("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: childEnv.ADMIN_USERNAME, password: childEnv.ADMIN_PASSWORD })
  });
  assert(login.response.ok && login.data.success && typeof login.data.token === "string", "Valid admin login must return a bearer token.");

  const token = login.data.token;
  const projects = await jsonRequest("/api/v1/admin/projects", {
    headers: { Authorization: "Bearer " + token }
  });
  assert(projects.response.ok && Array.isArray(projects.data.projects) && projects.data.projects.length > 0,
    "Authenticated admin must be able to read seeded project templates.");

  const publicApps = await jsonRequest("/api/v1/public/apps");
  assert(publicApps.response.ok && Array.isArray(publicApps.data.apps) && publicApps.data.apps.length === 0,
    "Public portal must not expose sample projects as published downloadable apps.");

  const publicRoutes = await jsonRequest("/api/v1/public/domain-routes");
  assert(publicRoutes.response.ok && publicRoutes.data.success && Array.isArray(publicRoutes.data.routes),
    "Public domain route list must return a safe route array.");

  const resolvedPublic = await jsonRequest("/api/v1/public/domain-route?host=store.example.test");
  assert(resolvedPublic.response.ok && resolvedPublic.data.targetView === "downloads",
    "Unknown domains must resolve to the public entry point by default.");

  const protectedDomainRoutes = await jsonRequest("/api/v1/admin/domain-routes");
  assert(protectedDomainRoutes.response.status === 401,
    "Admin domain route settings must require a bearer token.");

  const saveRoutes = await jsonRequest("/api/v1/admin/domain-routes", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ adminDomain: "admin.example.test", publicDomain: "store.example.test" })
  });
  assert(saveRoutes.response.ok && saveRoutes.data.success && saveRoutes.data.routes.length === 2,
    "Authenticated admins must be able to persist two distinct host routes.");

  const resolveAdmin = await jsonRequest("/api/v1/public/domain-route?host=admin.example.test");
  assert(resolveAdmin.response.ok && resolveAdmin.data.targetView === "admin",
    "The hostname resolver must select the admin entry for its configured hostname.");

  const duplicateRoutes = await jsonRequest("/api/v1/admin/domain-routes", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ adminDomain: "same.example.test", publicDomain: "same.example.test" })
  });
  assert(duplicateRoutes.response.status === 400,
    "Admin and public routes must reject duplicate hostnames.");

  const logout = await jsonRequest("/api/v1/auth/logout", {
    method: "POST",
    headers: { Authorization: "Bearer " + token }
  });
  assert(logout.response.ok && logout.data.success, "Logout should revoke the bearer session.");

  const expired = await jsonRequest("/api/v1/auth/me", {
    headers: { Authorization: "Bearer " + token }
  });
  assert(expired.response.status === 401, "A logged-out token must no longer authenticate.");

  console.log("API smoke tests passed: health, auth, public release filtering, authenticated domain-route save, duplicate-host validation, hostname resolution, logout revocation.");
}

try {
  await main();
} catch (error) {
  console.error("API smoke tests failed:", error instanceof Error ? error.message : String(error));
  console.error("Server output:\n" + logs);
  process.exitCode = 1;
} finally {
  child.kill("SIGTERM");
  await Promise.race([
    new Promise(resolve => child.once("exit", resolve)),
    delay(2000)
  ]);
  if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
}
