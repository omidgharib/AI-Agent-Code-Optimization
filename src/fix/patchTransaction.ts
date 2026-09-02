import fs from "node:fs/promises";
import path from "node:path";
import { checkTargetPath, getDiffTargetPath } from "./diffApplier";

interface Snapshot {
  absolutePath: string;
  content: Buffer | null;
  mode?: number;
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
      const stat = await fs.stat(absolutePath);
      this.snapshots.set(absolutePath, {
        absolutePath,
        content: await fs.readFile(absolutePath),
        mode: stat.mode,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      this.snapshots.set(absolutePath, { absolutePath, content: null });
    }
  }

  async rollback(): Promise<void> {
    if (this.dryRun) return;
    for (const snapshot of [...this.snapshots.values()].reverse()) {
      if (snapshot.content === null) {
        await fs.unlink(snapshot.absolutePath).catch((error: NodeJS.ErrnoException) => {
          if (error.code !== "ENOENT") throw error;
        });
      } else {
        await fs.mkdir(path.dirname(snapshot.absolutePath), { recursive: true });
        await fs.writeFile(snapshot.absolutePath, snapshot.content);
        if (snapshot.mode !== undefined) await fs.chmod(snapshot.absolutePath, snapshot.mode);
      }
    }
  }
}

