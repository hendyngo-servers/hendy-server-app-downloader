import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.API_SMOKE_PORT || 3187);
const origin = "http://127.0.0.1:" + port;
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
let logs = "";
let child;
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
async function jsonRequest(path, init) {
  const response = await fetch(origin + path, { ...init, signal: init?.signal || AbortSignal.timeout(10000) });
  let data = {};
  try { data = await response.json(); } catch { /* checked below */ }
  return { response, data };
}
function runCommand(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(npx, args, { stdio: ["ignore", "pipe", "pipe"], env: process.env });
    let output = "";
    const watchdog = setTimeout(() => {
      output += "\\nCommand watchdog expired after 45 seconds; terminating child process.";
      proc.kill("SIGKILL");
    }, 45000);
    proc.stdout.on("data", chunk => { output = (output + chunk.toString()).slice(-12000); });
    proc.stderr.on("data", chunk => { output = (output + chunk.toString()).slice(-12000); });
    proc.on("error", error => { clearTimeout(watchdog); reject(error); });
    proc.on("exit", code => {
      clearTimeout(watchdog);
      code === 0 ? resolve(output) : reject(new Error("Command failed: npx " + args.join(" ") + "\\n" + output));
    });
  });
}
async function main() {
  console.log("Applying D1 migrations to local Wrangler storage...");
  const migrationOutput = await runCommand(["--yes", "wrangler@4.152.0", "d1", "migrations", "apply", "hendy-server-app-store", "--local", "--config=wrangler.toml", "--yes"]);
  console.log(migrationOutput.slice(-3000));
  console.log("Starting local Cloudflare Worker...");
  child = spawn(npx, [
    "--yes", "wrangler@4.152.0", "dev", "--local", "--config=wrangler.toml",
    "--ip", "127.0.0.1", "--port", String(port),
    "--var", "ADMIN_USERNAME:ci-admin",
    "--var", "ADMIN_PASSWORD:ci-only-test-password",
    "--var", "ADMIN_DISPLAY_NAME:CI-Test-Admin",
    "--var", "SHARED_API_DOMAIN:shared.example.test"
  ], { stdio: ["ignore", "pipe", "pipe"], env: process.env });
  child.stdout.on("data", chunk => { logs = (logs + chunk.toString()).slice(-12000); });
  child.stderr.on("data", chunk => { logs = (logs + chunk.toString()).slice(-12000); });

  const deadline = Date.now() + 45000;
  let healthy = false;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error("Wrangler dev exited early with code " + child.exitCode + "\n" + logs);
    try {
      const { response, data } = await jsonRequest("/healthz", { signal: AbortSignal.timeout(1200) });
      if (response.ok && data.status === "ok" && data.databaseConfigured && data.artifactStorageConfigured) {
        healthy = true;
        break;
      }
    } catch { /* wait for startup */ }
    await delay(400);
  }
  assert(healthy, "Cloudflare Worker did not become healthy with local D1/R2 bindings.\n" + logs);

  const unauthorized = await jsonRequest("/api/v1/admin/projects");
  assert(unauthorized.response.status === 401, "Admin API must reject requests without a Bearer token.");

  const badLogin = await jsonRequest("/api/v1/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "wrong-user", password: "wrong-password" })
  });
  assert(badLogin.response.status === 401, "Invalid admin credentials must be rejected.");

  const login = await jsonRequest("/api/v1/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "ci-admin", password: "ci-only-test-password" })
  });
  assert(login.response.ok && login.data.success && typeof login.data.token === "string", "Valid login must issue a Bearer token.");
  const token = login.data.token;

  const projects = await jsonRequest("/api/v1/admin/projects", { headers: { Authorization: "Bearer " + token } });
  assert(projects.response.ok && Array.isArray(projects.data.projects) && projects.data.projects.length > 0, "Authenticated admin must read seeded projects.");
  const project = projects.data.projects[0];

  const publicEmpty = await jsonRequest("/api/v1/public/apps");
  assert(publicEmpty.response.ok && Array.isArray(publicEmpty.data.apps) && publicEmpty.data.apps.length === 0, "Unpublished sample projects must not appear in the public store.");

  const publicRoutes = await jsonRequest("/api/v1/public/domain-routes");
  assert(publicRoutes.response.ok && publicRoutes.data.success && Array.isArray(publicRoutes.data.routes), "Public hostname-route list must be readable.");

  const saveRoutes = await jsonRequest("/api/v1/admin/domain-routes", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ adminDomain: "admin.example.test", publicDomain: "store.example.test" })
  });
  assert(saveRoutes.response.ok && saveRoutes.data.routes.length === 2, "Admin must persist distinct Portal/Admin hostnames.");

  const resolvedAdmin = await jsonRequest("/api/v1/public/domain-route?host=admin.example.test");
  assert(resolvedAdmin.response.ok && resolvedAdmin.data.targetView === "admin", "Hostname API must resolve the Admin entry.");

  const duplicateRoutes = await jsonRequest("/api/v1/admin/domain-routes", {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify({ adminDomain: "same.example.test", publicDomain: "same.example.test" })
  });
  assert(duplicateRoutes.response.status === 400, "Duplicate Portal/Admin hostnames must be rejected.");

  const form = new FormData();
  form.append("projectSlug", project.slug);
  form.append("version", "0.0.1");
  form.append("platform", "windows");
  form.append("format", ".zip");
  form.append("arch", "x86_64");
  form.append("file", new Blob([new TextEncoder().encode("CI test artifact bytes")], { type: "application/zip" }), "ci-smoke-test.zip");
  const upload = await jsonRequest("/api/v1/admin/upload-artifact", {
    method: "POST", headers: { Authorization: "Bearer " + token }, body: form
  });
  assert(upload.response.status === 201 && upload.data.artifact?.sha256, "Admin artifact upload must store the bytes in R2 and calculate SHA-256.");

  const rereadProjects = await jsonRequest("/api/v1/admin/projects", { headers: { Authorization: "Bearer " + token } });
  const storedProject = rereadProjects.data.projects.find(item => item.id === project.id);
  const release = storedProject?.releases?.find(item => item.version === "v0.0.1" || item.tag === "v0.0.1");
  assert(release && release.artifacts.some(item => item.filename === upload.data.artifact.filename), "Uploaded artifact must be registered in D1.");
  release.published = true;
  const publish = await jsonRequest("/api/v1/admin/projects/" + encodeURIComponent(project.id), {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
    body: JSON.stringify(storedProject)
  });
  assert(publish.response.ok, "An uploaded artifact may be published only through an authenticated project update.");

  const publicApps = await jsonRequest("/api/v1/public/apps");
  assert(publicApps.response.ok && publicApps.data.apps.some(item => item.slug === project.slug), "Published real artifacts must make the app visible in the Portal.");

  const download = await fetch(origin + upload.data.artifact.downloadUrl);
  assert(download.ok, "Public download endpoint must serve a published R2 artifact.");
  assert(await download.text() === "CI test artifact bytes", "Downloaded R2 artifact bytes must be unchanged.");

  const logout = await jsonRequest("/api/v1/auth/logout", { method: "POST", headers: { Authorization: "Bearer " + token } });
  assert(logout.response.ok && logout.data.success, "Logout must revoke the session.");
  const afterLogout = await jsonRequest("/api/v1/auth/me", { headers: { Authorization: "Bearer " + token } });
  assert(afterLogout.response.status === 401, "Logged-out session must not authenticate.");

  console.log("Cloudflare Worker API smoke tests passed: health, D1/R2 bindings, auth, seeded projects, domain routing, upload/hash, publish filtering, R2 download, logout.");
}
try {
  await main();
} catch (error) {
  console.error("Cloudflare API smoke tests failed:", error instanceof Error ? error.message : String(error));
  console.error("Worker output:\n" + logs);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode === null && child.signalCode === null) {
    child.kill("SIGTERM");
    await Promise.race([new Promise(resolve => child.once("exit", resolve)), delay(2000)]);
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  }
}
