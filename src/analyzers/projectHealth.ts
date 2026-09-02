import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { glob } from "glob";
import type { Issue } from "../core/types";
import { loadProjectIgnore } from "../core/projectIgnore";

const SOURCE_GLOB = "**/*.{js,jsx,ts,tsx,mjs,cjs,mts,cts}";
const IGNORE = ["node_modules/**", "dist/**", "build/**", ".next/**", "coverage/**", "ai-auditor-report/**"];

function finding(ruleId: string, message: string, severity: Issue["severity"], category: Issue["category"], filePath: string, evidence: Record<string, unknown>, canAutoFix = false): Issue {
  return {
    id: createHash("sha256").update(`project-health:${ruleId}:${filePath}:${message}`).digest("hex").slice(0, 16),
    tool: "custom", ruleId, message, severity, category,
    location: { filePath },
    evidence: { snippet: JSON.stringify(evidence).slice(0, 1400), relatedFiles: Array.isArray(evidence.relatedFiles) ? evidence.relatedFiles as string[] : undefined },
    fix: { canAutoFix, hint: canAutoFix ? `Review ${ruleId} evidence and apply a minimal source change` : undefined, strategy: canAutoFix ? "local" : "advisory" },
    meta: { reproducible: evidence },
  };
}

async function readJson(file: string): Promise<Record<string, unknown>> {
  return JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
}

function importedSpecifiers(source: string): Array<{ names: string[]; statement: string }> {
  const imports: Array<{ names: string[]; statement: string }> = [];
  const pattern = /import\s+([^;\n]+?)\s+from\s+["'][^"']+["'];?/g;
  for (const match of source.matchAll(pattern)) {
    const clause = match[1].replace(/^type\s+/, "");
    const names: string[] = [];
    const named = clause.match(/\{([^}]+)\}/)?.[1];
    if (named) for (const item of named.split(",")) names.push((item.trim().split(/\s+as\s+/).pop() ?? "").trim());
    const defaultName = clause.match(/^([A-Za-z_$][\w$]*)/)?.[1];
    if (defaultName) names.push(defaultName);
    const namespace = clause.match(/\*\s+as\s+([A-Za-z_$][\w$]*)/)?.[1];
    if (namespace) names.push(namespace);
    imports.push({ names: names.filter(Boolean), statement: match[0] });
  }
  return imports;
}

function resolveLocalImport(from: string, specifier: string, files: Set<string>): string | undefined {
  if (!specifier.startsWith(".")) return undefined;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(from), specifier));
  const candidates = [base, ...[".ts", ".tsx", ".js", ".jsx", ".mts", ".cts", ".mjs", ".cjs"].map((ext) => `${base}${ext}`), ...["index.ts", "index.tsx", "index.js", "index.jsx"].map((name) => `${base}/${name}`)];
  return candidates.find((candidate) => files.has(candidate));
}

export async function runProjectHealth(cwd: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const pkg = await readJson(path.join(cwd, "package.json"));
  const dependencies = { ...(pkg.dependencies as Record<string, string> | undefined), ...(pkg.devDependencies as Record<string, string> | undefined) };
  const projectIgnore = await loadProjectIgnore(cwd);
  const files = (await glob(SOURCE_GLOB, { cwd, ignore: IGNORE, nodir: true, windowsPathsNoEscape: true }))
    .map((file) => file.replace(/\\/g, "/"))
    .filter((file) => !projectIgnore.ignores(file))
    .sort();
  const fileSet = new Set(files);
  const imported = new Set<string>();
  const duplicateBlocks = new Map<string, Array<{ file: string; line: number; excerpt: string }>>();

  for (const file of files) {
    let source: string;
    try { source = await fs.readFile(path.join(cwd, file), "utf8"); } catch { continue; }
    for (const entry of importedSpecifiers(source)) {
      const body = source.replace(entry.statement, "");
      for (const name of entry.names) {
        const uses = body.match(new RegExp(`\\b${name.replace(/[$]/g, "\\$")}\\b`, "g"))?.length ?? 0;
        if (uses === 0) issues.push(finding("unused-import", `Imported binding '${name}' is not used`, "low", "maintainability", file, { import: entry.statement, binding: name }, true));
      }
    }
    for (const match of source.matchAll(/(?:import|export)\s+(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g)) {
      const resolved = resolveLocalImport(file, match[1], fileSet); if (resolved) imported.add(resolved);
    }
    const lines = source.split(/\r?\n/);
    for (let line = 0; line + 7 < lines.length; line += 4) {
      const block = lines.slice(line, line + 8).map((value) => value.trim()).filter((value) => value && !value.startsWith("//")).join("\n");
      if (block.length < 160) continue;
      const hash = createHash("sha1").update(block).digest("hex");
      const entries = duplicateBlocks.get(hash) ?? []; entries.push({ file, line: line + 1, excerpt: block.slice(0, 400) }); duplicateBlocks.set(hash, entries);
    }
  }

  const entryNames = new Set(["index.ts", "index.tsx", "index.js", "index.jsx", "main.ts", "main.tsx", "main.js", "main.jsx", "vite.config.ts", "next.config.js", "next.config.mjs"]);
  for (const file of files) if (!imported.has(file) && !entryNames.has(path.posix.basename(file)) && !/(^|\/)(pages|app|routes|scripts|tests?|__tests__)\//.test(file)) {
    issues.push(finding("possibly-unused-file", "Source file is not referenced by another local module", "low", "maintainability", file, { file, method: "static import graph" }));
  }
  for (const entries of duplicateBlocks.values()) if (entries.length > 1) {
    const uniqueFiles = [...new Set(entries.map((entry) => entry.file))];
    if (uniqueFiles.length > 1) issues.push(finding("duplicate-code", `Duplicate 8-line block found in ${uniqueFiles.length} files`, "medium", "maintainability", entries[0].file, { relatedFiles: uniqueFiles, occurrences: entries }));
  }

  const bundles = await glob("{dist,build,.next}/**/*.{js,mjs,cjs,css}", { cwd, ignore: ["**/*.map"], nodir: true, windowsPathsNoEscape: true });
  for (const file of bundles) {
    const stat = await fs.stat(path.join(cwd, file));
    const limit = file.endsWith(".css") ? 250_000 : 500_000;
    if (stat.size > limit) issues.push(finding("oversized-bundle", `Generated asset is ${(stat.size / 1024).toFixed(1)} KiB (limit ${(limit / 1024).toFixed(0)} KiB)`, stat.size > limit * 2 ? "high" : "medium", "performance", file.replace(/\\/g, "/"), { bytes: stat.size, limitBytes: limit, command: "Run the production build and inspect this asset" }));
  }

  const has = (name: string) => Boolean(dependencies[name]);
  if (has("react") && !has("eslint-plugin-jsx-a11y")) issues.push(finding("react-a11y-rules", "React project does not declare eslint-plugin-jsx-a11y", "low", "a11y", "package.json", { framework: "react", missingPackage: "eslint-plugin-jsx-a11y" }));
  if (has("vite") && !(pkg.scripts as Record<string, string> | undefined)?.build) issues.push(finding("vite-build-script", "Vite project has no build script", "medium", "maintainability", "package.json", { framework: "vite", scripts: pkg.scripts }));
  if (has("next")) {
    for (const file of files.filter((name) => /\.(tsx|jsx)$/.test(name))) {
      const source = await fs.readFile(path.join(cwd, file), "utf8");
      if (/<img\b/.test(source)) issues.push(finding("next-image", "Next.js component uses <img>; consider next/image for optimized responsive delivery", "low", "performance", file, { framework: "nextjs", selector: "<img" }));
    }
  }
  if ((has("express") || has("fastify") || has("koa")) && !(pkg.engines as Record<string, string> | undefined)?.node) issues.push(finding("node-engine", "Node.js server package does not declare engines.node", "low", "maintainability", "package.json", { frameworks: ["express", "fastify", "koa"].filter(has) }));
  return issues;
}

export async function runDependencyAudit(cwd: string): Promise<Issue[]> {
  const issues: Issue[] = [];
  const registry = (process.env.npm_config_registry || "https://registry.npmjs.org").replace(/\/$/, "");
  let pkg: Record<string, unknown>;
  try { pkg = await readJson(path.join(cwd, "package.json")); }
  catch { return issues; }
  const direct = { ...(pkg.dependencies as Record<string, string> | undefined), ...(pkg.devDependencies as Record<string, string> | undefined) };
  const versions: Record<string, string[]> = {};
  try {
    const lock = await readJson(path.join(cwd, "package-lock.json"));
    const packages = lock.packages as Record<string, { version?: string }> | undefined;
    for (const [location, data] of Object.entries(packages ?? {})) {
      if (!location.startsWith("node_modules/") || !data.version) continue;
      const name = location.slice("node_modules/".length);
      (versions[name] ??= []).push(data.version);
    }
    if (Object.keys(versions).length) {
      const response = await fetch(`${registry}/-/npm/v1/security/advisories/bulk`, {
        method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(versions), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`registry returned HTTP ${response.status}`);
      const advisories = await response.json() as Record<string, Array<Record<string, unknown>>>;
      for (const [name, entries] of Object.entries(advisories)) for (const advisory of entries) {
        const rawSeverity = String(advisory.severity ?? "medium");
        const severity = (rawSeverity === "moderate" ? "medium" : ["low", "medium", "high", "critical"].includes(rawSeverity) ? rawSeverity : "medium") as Issue["severity"];
        issues.push(finding("vulnerable-dependency", `Dependency '${name}' is affected by ${String(advisory.title ?? "a security advisory")}`, severity, "security", "package-lock.json", { package: name, installedVersions: versions[name], severity: rawSeverity, vulnerableVersions: advisory.vulnerable_versions, advisoryUrl: advisory.url, advisoryId: advisory.id, request: `POST ${registry}/-/npm/v1/security/advisories/bulk` }));
      }
    }
  } catch (error) { issues.push(finding("dependency-audit-unavailable", "Registry vulnerability audit could not complete", "low", "maintainability", "package.json", { error: String(error), request: `POST ${registry}/-/npm/v1/security/advisories/bulk` })); }

  const checks = await Promise.allSettled(Object.keys(direct).slice(0, 100).map(async (name) => {
    const response = await fetch(`${registry}/${encodeURIComponent(name)}`, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
    const manifest = await response.json() as { "dist-tags"?: { latest?: string } };
    return { name, current: versions[name]?.[0], declared: direct[name], latest: manifest["dist-tags"]?.latest };
  }));
  let successfulChecks = 0;
  for (const check of checks) {
    if (check.status !== "fulfilled") continue;
    successfulChecks++;
    const { name, current, declared, latest } = check.value;
    if (current && latest && current !== latest) issues.push(finding("outdated-dependency", `Dependency '${name}' is outdated (${current} -> ${latest})`, "low", "maintainability", "package.json", { package: name, current, declared, latest, request: `GET ${registry}/${encodeURIComponent(name)}` }));
  }
  if (checks.length && successfulChecks === 0) issues.push(finding("outdated-audit-unavailable", "Registry version checks could not complete", "low", "maintainability", "package.json", { registry, packagesChecked: checks.length }));
  return issues;
}
