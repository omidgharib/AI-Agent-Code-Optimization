import fs from "node:fs/promises";
import path from "node:path";
import ignore, { type Ignore } from "ignore";

export const DEFAULT_IGNORE_PATTERNS = [
  "node_modules/",
  "dist/",
  "build/",
  "out/",
  "coverage/",
  ".next/",
  ".nuxt/",
  ".cache/",
  ".parcel-cache/",
  ".turbo/",
  "vendor/",
  "ai-auditor-report/",
  ".git/",
  ".env",
  ".env.*",
  "package-lock.json",
  "npm-shrinkwrap.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "*.lock",
  "**/*.min.*",
];

export interface ProjectIgnore {
  matcher: Ignore;
  patterns: string[];
  ignores(filePath: string): boolean;
}

function normalizeRelative(repoRoot: string, filePath: string): string | undefined {
  if (!filePath || filePath === "-") return undefined;
  const relative = path.isAbsolute(filePath)
    ? path.relative(repoRoot, filePath)
    : filePath;
  const normalized = relative.replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized === "." || normalized.startsWith("../")) return undefined;
  return normalized;
}

export async function loadProjectIgnore(
  repoRoot: string,
  extraPatterns: string[] = [],
): Promise<ProjectIgnore> {
  let gitignore = "";
  try {
    gitignore = await fs.readFile(path.join(repoRoot, ".gitignore"), "utf8");
  } catch {
    // A project does not have to contain .gitignore.
  }
  const gitPatterns = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const patterns = [...DEFAULT_IGNORE_PATTERNS, ...extraPatterns, ...gitPatterns];
  const matcher = ignore().add(patterns);
  return {
    matcher,
    patterns,
    ignores(filePath: string) {
      const relative = normalizeRelative(repoRoot, filePath);
      return relative ? matcher.ignores(relative) : false;
    },
  };
}
