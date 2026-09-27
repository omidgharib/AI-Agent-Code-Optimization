import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

export interface WorkspacePackage { name: string; path: string; manifest: Record<string, unknown> }
export interface WorkspaceGraph { root: string; packageManager: "npm" | "pnpm" | "yarn" | "unknown"; lockfile?: string; packages: WorkspacePackage[]; warnings: string[] }
export async function detectWorkspaceGraph(root: string): Promise<WorkspaceGraph> {
  const absolute = path.resolve(root); const warnings: string[] = [];
  const candidates = [["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["package-lock.json", "npm"], ["npm-shrinkwrap.json", "npm"]] as const;
  let lockfile: string | undefined; let packageManager: WorkspaceGraph["packageManager"] = "unknown";
  for (const [file, manager] of candidates) { try { await fs.access(path.join(absolute, file)); lockfile = file; packageManager = manager; break; } catch { /* absent */ } }
  const rootManifest = JSON.parse(await fs.readFile(path.join(absolute, "package.json"), "utf8")) as Record<string, unknown>;
  const raw = Array.isArray(rootManifest.workspaces) ? rootManifest.workspaces : (rootManifest.workspaces as { packages?: unknown } | undefined)?.packages;
  const patterns = Array.isArray(raw) ? raw.filter((item): item is string => typeof item === "string") : [];
  if (packageManager === "unknown" && typeof rootManifest.packageManager === "string") packageManager = rootManifest.packageManager.split("@")[0] as WorkspaceGraph["packageManager"];
  const manifests = patterns.length ? await glob(patterns.map((item) => `${item.replace(/\/$/, "")}/package.json`), { cwd: absolute, nodir: true, ignore: ["**/node_modules/**"] }) : [];
  const packages: WorkspacePackage[] = [{ name: String(rootManifest.name ?? path.basename(absolute)), path: ".", manifest: rootManifest }];
  for (const file of manifests.sort()) { try { const manifest = JSON.parse(await fs.readFile(path.join(absolute, file), "utf8")) as Record<string, unknown>; packages.push({ name: String(manifest.name ?? path.dirname(file)), path: path.dirname(file).replace(/\\/g, "/"), manifest }); } catch (error) { warnings.push(`${file}: ${String(error)}`); } }
  return { root: absolute, packageManager, lockfile, packages, warnings };
}
