import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { glob } from "glob";
import { checkTargetPath, getDiffTargetPath } from "../fix/diffApplier";
import { redactSensitive } from "../platform/security/secrets";
import { atomicReplace, safeCreate, safeRead } from "../platform/security/safeMutation";

const SECRET_FILE = /(^|\/)(\.env(?:\..*)?|\.npmrc|\.pypirc|credentials|secrets?\.(?:json|ya?ml)|id_(?:rsa|dsa|ecdsa|ed25519)|[^/]+\.(?:pem|key|p12|pfx|crt|cer))$/i;
const SECRET_VALUES = [
  /-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/g,
  /\b(?:sk|rk|pk)-(?:live|test)?[_-]?[A-Za-z0-9_-]{16,}\b/g,
  /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[A-Z0-9]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\b(?:xox[baprs]-[A-Za-z0-9-]{10,}|glpat-[A-Za-z0-9_-]{20,})\b/g,
  /((?:api[_-]?key|token|secret|password|authorization)\s*[=:]\s*["']?)([^\s"']{8,})/gi,
];

export function isSecretFile(filePath: string): boolean {
  return SECRET_FILE.test(filePath.replace(/\\/g, "/"));
}

export function redactSecrets(value: string): string {
  let result = value;
  for (const pattern of SECRET_VALUES) result = result.replace(pattern, (_match, prefix?: string) => `${prefix ?? ""}<REDACTED>`);
  return redactSensitive(result);
}

export function changedLineCount(diff: string): number {
  return diff.split(/\r?\n/).filter((line) => (/^[+-]/.test(line) && !/^(---|\+\+\+)/.test(line))).length;
}

export interface PatchTrustAssessment {
  confidence: number;
  changedLines: number;
  files: string[];
  approvalRequired: boolean;
  factors: string[];
  blastRadius: { imports: string[]; tests: string[]; routes: string[]; score: number };
}

export async function assessPatches(repoRoot: string, diffs: string[]): Promise<PatchTrustAssessment> {
  const files = [...new Set(diffs.map(getDiffTargetPath).filter((item): item is string => Boolean(item)))];
  for (const file of files) {
    const error = checkTargetPath(file, repoRoot);
    if (error) throw new Error(error);
    if (isSecretFile(file)) throw new Error(`refusing secret-bearing file "${file}"`);
  }
  const changedLines = diffs.reduce((sum, diff) => sum + changedLineCount(diff), 0);
  const candidates = await glob("**/*.{js,jsx,ts,tsx,mjs,cjs}", { cwd: repoRoot, nodir: true, ignore: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/coverage/**", "ai-auditor-report/**"] });
  const imports = new Set<string>(); const tests = new Set<string>(); const routes = new Set<string>();
  for (const rawCandidate of candidates.slice(0, 5000)) {
    const candidate = rawCandidate.replace(/\\/g, "/");
    let source = ""; try { source = await fs.readFile(path.join(repoRoot, rawCandidate), "utf8"); } catch { continue; }
    for (const target of files) {
      const stem = path.basename(target).replace(/\.[^.]+$/, "");
      if (candidate !== target && new RegExp(`(?:from\\s+|require\\()["'][^"']*${stem.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`).test(source)) imports.add(candidate);
      if (/(?:^|\/)(?:__tests__|tests?)\/|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(candidate) && source.includes(stem)) tests.add(candidate);
    }
    if (/(?:^|\/)(?:pages|routes|app)\//.test(candidate) && files.some((file) => candidate === file || source.includes(path.basename(file).replace(/\.[^.]+$/, "")))) routes.add(candidate);
  }
  const blastScore = Math.min(100, imports.size * 3 + tests.size * 2 + routes.size * 8 + files.length * 5);
  const factors: string[] = [];
  let confidence = 95;
  if (files.length > 1) { confidence -= Math.min(25, (files.length - 1) * 8); factors.push(`${files.length} files are changed`); }
  if (changedLines > 50) { confidence -= Math.min(30, Math.ceil((changedLines - 50) / 10) * 3); factors.push(`${changedLines} changed lines`); }
  if (routes.size) { confidence -= 8; factors.push(`${routes.size} affected route(s)`); }
  if (imports.size > 5) { confidence -= 10; factors.push(`${imports.size} importing modules`); }
  if (!tests.size) { confidence -= 12; factors.push("no related test was detected"); } else factors.push(`${tests.size} related test(s) detected`);
  confidence = Math.max(0, confidence);
  return { confidence, changedLines, files, approvalRequired: files.length > 1 || changedLines > 100 || routes.size > 0 || confidence < 70, factors, blastRadius: { imports: [...imports], tests: [...tests], routes: [...routes], score: blastScore } };
}

export async function createPersistentSnapshot(repoRoot: string, diffs: string[], snapshotRoot: string): Promise<string> {
  const id = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const dir = path.join(snapshotRoot, id); await fs.mkdir(dir, { recursive: true });
  const manifest: Array<{ file: string; existed: boolean; mode?: number; sha256?: string }> = [];
  for (const file of [...new Set(diffs.map(getDiffTargetPath).filter((item): item is string => Boolean(item)))]) {
    const error = checkTargetPath(file, repoRoot); if (error) throw new Error(error);
    const absolute = path.resolve(repoRoot, file); const backup = path.join(dir, "files", file);
    try { const source = await safeRead(repoRoot, file); await fs.mkdir(path.dirname(backup), { recursive: true }); await fs.writeFile(backup, source.bytes, { flag: "wx" }); manifest.push({ file, existed: true, mode: source.mode, sha256: source.sha256 }); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; manifest.push({ file, existed: false }); }
  }
  await fs.writeFile(path.join(dir, "manifest.json"), JSON.stringify({ schemaVersion: 1, id, createdAt: new Date().toISOString(), files: manifest }, null, 2)); return id;
}

export async function restorePersistentSnapshot(repoRoot: string, snapshotRoot: string, id: string): Promise<number> {
  if (!/^[0-9]+-[a-f0-9]{8}$/.test(id)) throw new Error("Invalid snapshot ID");
  const dir = path.join(snapshotRoot, id); const data = JSON.parse(await fs.readFile(path.join(dir, "manifest.json"), "utf8")) as { files: Array<{ file: string; existed: boolean; mode?: number; sha256?: string }> };
  for (const item of data.files) { const error = checkTargetPath(item.file, repoRoot); if (error) throw new Error(error); if (!item.existed) { try { const current = await safeRead(repoRoot, item.file); await fs.unlink(current.absolutePath); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; } } else { const backup = await fs.readFile(path.join(dir, "files", item.file)); const hash = crypto.createHash("sha256").update(backup).digest("hex"); if (!item.sha256 || hash !== item.sha256) throw new Error(`snapshot integrity failure for ${item.file}`); try { const current = await safeRead(repoRoot, item.file); await atomicReplace(repoRoot, item.file, backup, current.sha256); } catch (e) { if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e; await safeCreate(repoRoot, item.file, backup); } const target = (await safeRead(repoRoot, item.file)).absolutePath; if (item.mode) await fs.chmod(target, item.mode); } }
  return data.files.length;
}
