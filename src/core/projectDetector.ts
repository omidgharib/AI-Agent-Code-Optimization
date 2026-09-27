import fs from "node:fs/promises";
import path from "node:path";

export type JsTsFramework = "next" | "vite" | "react" | "node" | "unknown";

export interface ProjectProfile {
  root: string;
  name: string;
  packageManager: "npm" | "pnpm" | "yarn" | "bun" | "unknown";
  framework: JsTsFramework;
  languages: Array<"javascript" | "typescript">;
}

const SOURCE_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts",
]);
const IGNORED_DIRS = new Set([
  ".git", "node_modules", "dist", "build", "out", "coverage",
  "ai-auditor-report", ".next", ".nuxt", ".svelte-kit",
]);

async function findLanguages(root: string): Promise<Set<"javascript" | "typescript">> {
  const languages = new Set<"javascript" | "typescript">();
  const pending = [root];
  let visited = 0;
  while (pending.length > 0 && visited < 10_000 && languages.size < 2) {
    const current = pending.pop() as string;
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      visited++;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (!IGNORED_DIRS.has(entry.name)) pending.push(path.join(current, entry.name));
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!SOURCE_EXTENSIONS.has(ext)) continue;
      if ([".ts", ".tsx", ".mts", ".cts"].includes(ext)) languages.add("typescript");
      else languages.add("javascript");
    }
  }
  return languages;
}

function frameworkOf(packages: Record<string, unknown>): JsTsFramework {
  if ("next" in packages) return "next";
  if ("vite" in packages) return "vite";
  if ("react" in packages || "react-dom" in packages) return "react";
  if ("@types/node" in packages || "express" in packages || "fastify" in packages) return "node";
  return "unknown";
}

async function packageManagerOf(root: string): Promise<ProjectProfile["packageManager"]> {
  const candidates: Array<[string, ProjectProfile["packageManager"]]> = [
    ["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["bun.lockb", "bun"],
    ["bun.lock", "bun"], ["package-lock.json", "npm"],
  ];
  for (const [file, manager] of candidates) {
    try { await fs.access(path.join(root, file)); return manager; } catch { /* continue */ }
  }
  return "unknown";
}

export async function detectProject(projectRoot: string): Promise<ProjectProfile> {
  const root = path.resolve(projectRoot);
  const packagePath = path.join(root, "package.json");
  let pkg: Record<string, unknown>;
  try {
    pkg = JSON.parse(await fs.readFile(packagePath, "utf8")) as Record<string, unknown>;
  } catch (error) {
    throw new Error(`Unsupported project: a valid package.json is required at ${packagePath} (${String(error)})`);
  }

  const dependencies = {
    ...(pkg.dependencies && typeof pkg.dependencies === "object" ? pkg.dependencies : {}),
    ...(pkg.devDependencies && typeof pkg.devDependencies === "object" ? pkg.devDependencies : {}),
  } as Record<string, unknown>;
  const languages = await findLanguages(root);
  const hasJsTooling = Object.keys(dependencies).length > 0 ||
    (pkg.scripts !== null && typeof pkg.scripts === "object");
  if (languages.size === 0 && !hasJsTooling) {
    throw new Error("Unsupported project: no JavaScript/TypeScript source files or package scripts/dependencies were found");
  }

  return {
    root,
    name: typeof pkg.name === "string" && pkg.name.trim() ? pkg.name : path.basename(root),
    packageManager: await packageManagerOf(root),
    framework: frameworkOf(dependencies),
    languages: [...languages],
  };
}

