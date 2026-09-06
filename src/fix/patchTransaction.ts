import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { checkTargetPath, getDiffTargetPath } from "./diffApplier";
import { atomicReplace, safeCreate, safeRead } from "../platform/security/safeMutation";

interface Snapshot {
  absolutePath: string;
  relativePath: string;
  content: Buffer | null;
  mode?: number;
  sha256?: string;
}

export class PatchTransaction {
  private readonly snapshots = new Map<string, Snapshot>();

  constructor(private readonly repoRoot: string, private readonly dryRun: boolean) {}

  async capture(unifiedDiff: string): Promise<void> {
    if (this.dryRun) return;
    const target = getDiffTargetPath(unifiedDiff);
    if (!target) throw new Error("Cannot snapshot patch without a +++ target path");
    const pathError = checkTargetPath(target, this.repoRoot);
    if (pathError) throw new Error(pathError);
    const absolutePath = path.resolve(this.repoRoot, target);
    if (this.snapshots.has(absolutePath)) return;
    try {
      const source = await safeRead(this.repoRoot, target);
      this.snapshots.set(absolutePath, {
        absolutePath,
        relativePath: target,
        content: source.bytes,
        mode: source.mode,
        sha256: source.sha256,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.snapshots.set(absolutePath, { absolutePath, relativePath: target, content: null });
    }
  }

  async verifyUnchanged(unifiedDiff?: string): Promise<void> {
    const target = unifiedDiff ? getDiffTargetPath(unifiedDiff) : null;
    const snapshots = target ? [...this.snapshots.values()].filter((snapshot) => snapshot.absolutePath === path.resolve(this.repoRoot, target)) : [...this.snapshots.values()];
    if (target && snapshots.length !== 1) throw new Error(`No snapshot captured for ${target}`);
    for (const snapshot of snapshots) {
      if (snapshot.content === null) { try { await safeRead(this.repoRoot, snapshot.relativePath); throw new Error(`TOCTOU detected: ${snapshot.absolutePath} was created after preview`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; } }
      else { const current = await safeRead(this.repoRoot, snapshot.relativePath); if (current.sha256 !== snapshot.sha256) throw new Error(`TOCTOU detected: ${snapshot.absolutePath} changed after snapshot`); }
    }
  }

  async rollback(): Promise<void> {
    if (this.dryRun) return;
    for (const snapshot of [...this.snapshots.values()].reverse()) {
      if (snapshot.content === null) {
        try { const current = await safeRead(this.repoRoot, snapshot.relativePath); await fs.unlink(current.absolutePath); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
      } else {
        try { const current = await safeRead(this.repoRoot, snapshot.relativePath); await atomicReplace(this.repoRoot, snapshot.relativePath, snapshot.content, current.sha256); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; await safeCreate(this.repoRoot, snapshot.relativePath, snapshot.content); }
        if (snapshot.mode !== undefined) await fs.chmod((await safeRead(this.repoRoot, snapshot.relativePath)).absolutePath, snapshot.mode);
      }
    }
  }
}
