import fs from "node:fs/promises";
import path from "node:path";

export type FileClass = "normal" | "elevated" | "forbidden";
export interface RepositoryPolicy { sensitivePaths?: string[]; allowLockfiles?: boolean; allowEnvironmentFiles?: boolean; }

const forbidden = /(^|\/)(\.git(?:\/|$)|node_modules(?:\/|$)|dist(?:\/|$)|build(?:\/|$)|out(?:\/|$)|coverage(?:\/|$)|vendor(?:\/|$)|ai-auditor-report(?:\/|$))/i;
const elevated = /(^|\/)(\.env(?:\..*)?$|\.npmrc$|\.pypirc$|credentials?(?:\.[^/]*)?$|secrets?(?:\.[^/]*)?$|[^/]+\.(?:pem|key|p12|pfx)$|package-lock\.json$|yarn\.lock$|pnpm-lock\.yaml$|npm-shrinkwrap\.json$|bun\.lockb$|[^/]+\.lock$)/i;

function normalizedRelative(value: string): string {
  const input = value.replace(/\\/g, "/").trim();
  if (!input || input.includes("\0") || input.startsWith("/") || /^[a-z]:/i.test(input) || /(^|\/)[^/]+:[^/]+/.test(input)) throw new Error(`Unsafe repository path: ${value}`);
  const normalized = path.posix.normalize(input);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) throw new Error(`Repository path escapes root: ${value}`);
  return normalized;
}

export function classifyRepositoryPath(value: string, policy: RepositoryPolicy = {}): FileClass {
  const relative = normalizedRelative(value);
  if (forbidden.test(relative)) return "forbidden";
  if (policy.sensitivePaths?.some((item) => relative === normalizedRelative(item) || relative.startsWith(`${normalizedRelative(item)}/`))) return "elevated";
  if (elevated.test(relative)) {
    if (policy.allowEnvironmentFiles && /(^|\/)\.env(?:\..*)?$/i.test(relative)) return "elevated";
    if (policy.allowLockfiles && /(?:lock|lock\.json|lock\.yaml|shrinkwrap\.json|lockb)$/i.test(relative)) return "elevated";
    return "forbidden";
  }
  return "normal";
}

export async function resolveRepositoryPath(rootInput: string, target: string, policy: RepositoryPolicy = {}): Promise<{ root: string; absolute: string; relative: string; fileClass: FileClass }> {
  const root = await fs.realpath(path.resolve(rootInput));
  const relative = normalizedRelative(target);
  const absolute = path.resolve(root, relative);
  const lexical = path.relative(root, absolute);
  if (!lexical || lexical.startsWith("..") || path.isAbsolute(lexical)) throw new Error(`Repository path escapes root: ${target}`);
  let cursor = absolute;
  while (true) {
    try {
      const real = await fs.realpath(cursor);
      const realRelative = path.relative(root, real);
      if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) throw new Error(`Repository path escapes through a symlink or junction: ${target}`);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      const parent = path.dirname(cursor); if (parent === cursor) throw error; cursor = parent;
    }
  }
  const fileClass = classifyRepositoryPath(relative, policy);
  return { root, absolute, relative: lexical.replace(/\\/g, "/"), fileClass };
}
