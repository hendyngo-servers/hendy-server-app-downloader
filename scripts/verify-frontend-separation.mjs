import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const output = resolve(process.cwd(), "dist");
const publicHtml = resolve(output, "index.html");
const adminHtml = resolve(output, "admin.html");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
assert(existsSync(publicHtml), "Missing dist/index.html (Public Store entry).");
assert(existsSync(adminHtml), "Missing dist/admin.html (Admin Control Center entry).");

const publicMarkup = readFileSync(publicHtml, "utf8");
const adminMarkup = readFileSync(adminHtml, "utf8");
const entryScript = markup => markup.match(/<script[^>]+src="([^"]+\.js)"[^>]*>/i)?.[1] || "";
const publicEntry = entryScript(publicMarkup);
const adminEntry = entryScript(adminMarkup);

assert(publicEntry, "Public HTML does not reference a built JavaScript entry.");
assert(adminEntry, "Admin HTML does not reference a built JavaScript entry.");
assert(publicEntry !== adminEntry, "Public and admin HTML resolve to the same JavaScript entry.");
assert(/Cổng tải phần mềm|SOFTWARE STORE/i.test(publicMarkup), "Public HTML title/metadata is not storefront-specific.");
assert(/Admin Control Center/i.test(adminMarkup), "Admin HTML title is not admin-specific.");
assert(/noindex, nofollow, noarchive/i.test(adminMarkup), "Admin HTML must include a noindex directive.");

console.log("Frontend separation passed:", { publicEntry, adminEntry, adminNoindex: true });
