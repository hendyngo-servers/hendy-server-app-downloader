import { readFileSync, writeFileSync } from "node:fs";

const accountId = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const apiToken = process.env.CLOUDFLARE_API_TOKEN?.trim();
if (!accountId || !apiToken) {
  console.error("Missing CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN.");
  process.exit(1);
}
const databaseName = "hendy-server-app-store";
const bucketName = "hendy-server-app-artifacts";
const base = "https://api.cloudflare.com/client/v4";
async function cf(path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: "Bearer " + apiToken,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) {
    const messages = Array.isArray(data.errors) ? data.errors.map(item => item.message).join("; ") : "";
    throw new Error("Cloudflare API " + method + " " + path + " failed (HTTP " + response.status + "): " + (messages || "unknown error"));
  }
  return data.result;
}
async function ensureD1() {
  const current = await cf("/accounts/" + accountId + "/d1/database");
  const items = Array.isArray(current) ? current : current?.result || [];
  let database = items.find(item => item.name === databaseName);
  if (!database) {
    database = await cf("/accounts/" + accountId + "/d1/database", "POST", {
      name: databaseName,
      primary_location_hint: "apac",
      read_replication: { mode: "disabled" }
    });
    console.log("Created Cloudflare D1 database: " + databaseName);
  } else {
    console.log("Using existing Cloudflare D1 database: " + databaseName);
  }
  if (!database?.uuid) throw new Error("Cloudflare D1 API did not return a database UUID.");
  return database.uuid;
}
async function ensureBucket() {
  const current = await cf("/accounts/" + accountId + "/r2/buckets");
  const items = Array.isArray(current) ? current : current?.buckets || current?.result?.buckets || [];
  const existing = items.find(item => item.name === bucketName);
  if (existing) {
    console.log("Using existing Cloudflare R2 bucket: " + bucketName);
    return;
  }
  await cf("/accounts/" + accountId + "/r2/buckets", "POST", { name: bucketName, locationHint: "apac" });
  console.log("Created Cloudflare R2 bucket: " + bucketName);
}
function updateConfig(path, databaseId) {
  const content = readFileSync(path, "utf8");
  if (!content.includes('database_name = "' + databaseName + '"')) {
    throw new Error(path + " does not declare the expected D1 database name.");
  }
  const updated = content.replace(/database_id = "[^"]*"/, 'database_id = "' + databaseId + '"');
  if (updated === content && !content.includes('database_id = "' + databaseId + '"')) {
    throw new Error("Could not update database_id in " + path);
  }
  writeFileSync(path, updated);
}
const d1Id = await ensureD1();
await ensureBucket();
updateConfig("wrangler.toml", d1Id);
updateConfig("wrangler.pages.toml", d1Id);
if (process.env.GITHUB_OUTPUT) {
  const fs = await import("node:fs");
  fs.appendFileSync(process.env.GITHUB_OUTPUT, "d1_database_id=" + d1Id + "\n");
}
console.log("Configured the real D1 database ID in wrangler.toml and wrangler.pages.toml.");
