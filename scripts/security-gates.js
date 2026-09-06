const fs = require("node:fs");
const path = require("node:path");
const cp = require("node:child_process");

const allowed = new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "0BSD", "BlueOak-1.0.0", "Python-2.0"]);
const denied = [];
for (const name of Object.keys(require(path.resolve("package.json")).dependencies || {})) {
  const manifest = path.resolve("node_modules", name, "package.json");
  if (!fs.existsSync(manifest)) throw new Error(`Dependency is not installed: ${name}`);
  const license = require(manifest).license;
  if (!license || !String(license).split(/\s+OR\s+/).some((item) => allowed.has(item.replace(/[()]/g, "")))) denied.push(`${name}: ${license || "UNKNOWN"}`);
}
if (denied.length) throw new Error(`Dependency license policy failed:\n${denied.join("\n")}`);
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable; run this gate through npm run security:gate");
const audit = cp.spawnSync(process.execPath, [npmCli, "audit", "--omit=dev", "--audit-level=high", "--json"], { encoding: "utf8", shell: false });
if (audit.error) throw audit.error;
let result; try { result = JSON.parse(audit.stdout || "{}"); } catch { throw new Error(audit.stderr || "npm audit returned invalid JSON"); }
const vulnerabilities = result.metadata?.vulnerabilities || {};
if ((vulnerabilities.high || 0) + (vulnerabilities.critical || 0) > 0) throw new Error(`Vulnerability policy failed: ${vulnerabilities.high || 0} high, ${vulnerabilities.critical || 0} critical`);
console.log("Security gates passed: production vulnerabilities and dependency licenses");
