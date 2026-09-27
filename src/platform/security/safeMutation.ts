import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { classifyRepositoryPath } from "./repositoryPolicy";

const digest = (value: Buffer | string) => crypto.createHash("sha256").update(value).digest("hex");
export async function safeRead(repoRoot: string, relativePath: string) {
  if (!relativePath || path.isAbsolute(relativePath) || classifyRepositoryPath(relativePath.replace(/\\/g, "/")) !== "normal") throw new Error(`refusing protected or absolute target "${relativePath}"`);
  const root = await fs.realpath(repoRoot); const absolute = path.resolve(root, relativePath); const stat = await fs.lstat(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`refusing non-regular target "${relativePath}"`);
  const real = await fs.realpath(absolute); const rel = path.relative(root, real); if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error(`target escapes repository: ${relativePath}`);
  const bytes = await fs.readFile(real); return { absolutePath: real, bytes, sha256: digest(bytes), mode: stat.mode, identity: `${stat.dev}:${stat.ino}` };
}

export async function atomicReplace(repoRoot: string, relativePath: string, bytes: Buffer | string, expectedSha256?: string): Promise<string> {
  const snapshot = await safeRead(repoRoot, relativePath);
  if (expectedSha256 && snapshot.sha256 !== expectedSha256) throw new Error(`concurrent modification detected for ${relativePath}`);
  const parent = path.dirname(snapshot.absolutePath); const parentReal = await fs.realpath(parent);
  const temp = path.join(parentReal, `.ai-auditor-${process.pid}-${crypto.randomBytes(8).toString("hex")}.tmp`);
  try {
    await fs.writeFile(temp, bytes, { flag: "wx", mode: snapshot.mode });
    const current = await safeRead(repoRoot, relativePath);
    if (current.sha256 !== snapshot.sha256 || current.identity !== snapshot.identity || await fs.realpath(parent) !== parentReal) throw new Error(`concurrent modification detected for ${relativePath}`);
    await fs.rename(temp, snapshot.absolutePath);
    const written = await safeRead(repoRoot, relativePath); const wanted = digest(bytes); if (written.sha256 !== wanted) throw new Error(`post-write integrity check failed for ${relativePath}`);
    return written.sha256;
  } finally { await fs.unlink(temp).catch(() => undefined); }
}

export async function safeCreate(repoRoot: string, relativePath: string, bytes: Buffer | string): Promise<string> {
  if (!relativePath || path.isAbsolute(relativePath) || classifyRepositoryPath(relativePath.replace(/\\/g, "/")) !== "normal") throw new Error(`refusing protected or absolute target "${relativePath}"`);
  const root = await fs.realpath(repoRoot); const absolute = path.resolve(root, relativePath); const rel = path.relative(root, absolute); if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("target escapes repository");
  const parent = path.dirname(absolute); await fs.mkdir(parent, { recursive: true }); const parentReal = await fs.realpath(parent); const parentRel = path.relative(root, parentReal); if (parentRel.startsWith("..") || path.isAbsolute(parentRel)) throw new Error("parent escapes repository");
  const resolvedTarget = path.join(parentReal, path.basename(absolute)); await fs.writeFile(resolvedTarget, bytes, { flag: "wx" }); const result = await safeRead(root, relativePath); return result.sha256;
}
