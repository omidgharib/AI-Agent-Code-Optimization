// FILE: src/fix/diffApplier.ts
import fs from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";

interface Hunk {
  oldStart: number;
  oldCount: number;
  newLines: string[];
  oldLines: string[];
}

function parseHunks(diff: string): { filePath: string; hunks: Hunk[] } | null {
  const lines = diff.split("\n");
  let filePath = "";
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;

  for (const line of lines) {
    if (line.startsWith("+++ ")) {
      filePath = line.slice(4).replace(/^b\//, "").trim();
    } else if (line.startsWith("@@ ")) {
      const m = /@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(line);
      if (!m) continue;
      if (current) hunks.push(current);
      current = {
        oldStart: +m[1],
        oldCount: +(m[2] ?? 1),
        newLines: [],
        oldLines: [],
      };
    } else if (current) {
      if (line.startsWith("+")) current.newLines.push(line.slice(1));
      else if (line.startsWith("-")) current.oldLines.push(line.slice(1));
      else if (line.startsWith(" ")) {
        current.newLines.push(line.slice(1));
        current.oldLines.push(line.slice(1));
      }
    }
  }
  if (current) hunks.push(current);
  return filePath ? { filePath, hunks } : null;
}

async function backupFile(filePath: string, backupDir: string): Promise<void> {
  const dest = path.join(backupDir, filePath.replace(/[/\\:]/g, "_"));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(filePath, dest).catch(() => {});
}

async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await execa("git", ["rev-parse", "--git-dir"], { cwd });
    return true;
  } catch {
    return false;
  }
}

export async function applyDiff(
  unifiedDiff: string,
  repoRoot: string,
  dryRun: boolean,
): Promise<{ success: boolean; error?: string }> {
  const parsed = parseHunks(unifiedDiff);
  if (!parsed) return { success: false, error: "Could not parse diff" };

  const { filePath, hunks } = parsed;
  const absPath = path.resolve(repoRoot, filePath);
  const backupDir = path.join(repoRoot, ".ai-auditor-backup");
  const gitRepo = await isGitRepo(repoRoot);

  let content: string;
  try {
    content = await fs.readFile(absPath, "utf8");
  } catch {
    if (hunks.every((h) => h.oldCount === 0)) {
      if (!dryRun) {
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(
          absPath,
          hunks.flatMap((h) => h.newLines).join("\n"),
        );
      }
      return { success: true };
    }
    return { success: false, error: `File not found: ${absPath}` };
  }

  if (!gitRepo) await backupFile(absPath, backupDir);

  const fileLines = content.split("\n");
  let offset = 0;

  for (const hunk of hunks) {
    const start = hunk.oldStart - 1 + offset;
    const actual = fileLines
      .slice(start, start + hunk.oldLines.length)
      .join("\n");
    const expected = hunk.oldLines.join("\n");
    if (actual !== expected) {
      if (gitRepo)
        await execa("git", ["checkout", "--", absPath], {
          cwd: repoRoot,
        }).catch(() => {});
      else {
        const backup = path.join(backupDir, filePath.replace(/[/\\:]/g, "_"));
        await fs.copyFile(backup, absPath).catch(() => {});
      }
      return {
        success: false,
        error: `Hunk mismatch at line ${hunk.oldStart}`,
      };
    }
    fileLines.splice(start, hunk.oldLines.length, ...hunk.newLines);
    offset += hunk.newLines.length - hunk.oldLines.length;
  }

  if (!dryRun) await fs.writeFile(absPath, fileLines.join("\n"));
  return { success: true };
}
