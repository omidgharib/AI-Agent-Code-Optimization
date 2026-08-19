// FILE: src/fix/diffApplier.ts
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
async function git(
  args: string[],
  cwd: string,
): Promise<boolean> {
  try {
    await run("git", args, { cwd });
    return true;
  } catch {
    return false;
  }
}

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

  for (const rawLine of lines) {
    // LLM output is LF, but files/models on Windows may echo CRLF. Normalize
    // each line so line-ending style never causes a false mismatch.
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
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

/**
 * The target file path from a unified diff's `+++` header, or null if absent.
 * Used by the fix loop to send the exact current file content back to the LLM
 * when a patch fails to apply.
 */
export function getDiffTargetPath(unifiedDiff: string): string | null {
  for (const line of unifiedDiff.split("\n")) {
    if (line.startsWith("+++ ")) {
      const p = line
        .slice(4)
        .replace(/^b\//, "")
        .trim();
      return p || null;
    }
  }
  return null;
}

async function backupFile(filePath: string, backupDir: string): Promise<void> {
  const dest = path.join(backupDir, filePath.replace(/[/\\:]/g, "_"));
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.copyFile(filePath, dest).catch(() => {});
}

async function isGitRepo(cwd: string): Promise<boolean> {
  return git(["rev-parse", "--git-dir"], cwd);
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

  // Normalize the file's line endings to LF for matching, but write the result
  // back with the file's original style (CRLF stays CRLF on Windows).
  const hadBom = content.charCodeAt(0) === 0xfeff;
  const body = hadBom ? content.slice(1) : content;
  const crlf = body.includes("\r\n");
  const fileLines = body.replace(/\r\n/g, "\n").split("\n");
  let offset = 0;

  for (const hunk of hunks) {
    const start = hunk.oldStart - 1 + offset;
    const actual = fileLines
      .slice(start, start + hunk.oldLines.length)
      .join("\n");
    const expected = hunk.oldLines.join("\n");
    if (actual !== expected) {
      if (gitRepo) await git(["checkout", "--", absPath], repoRoot);
      else {
        const backup = path.join(backupDir, filePath.replace(/[/\\:]/g, "_"));
        await fs.copyFile(backup, absPath).catch(() => {});
      }
      return {
        success: false,
        error:
          `Hunk mismatch at line ${hunk.oldStart}: expected "${expected.slice(0, 80) || "∅"}" but the file has "${actual.slice(0, 80) || "∅"}". ` +
          `The model's context lines may be stale — check ${filePath}`,
      };
    }
    fileLines.splice(start, hunk.oldLines.length, ...hunk.newLines);
    offset += hunk.newLines.length - hunk.oldLines.length;
  }

  if (!dryRun) {
    let out = fileLines.join("\n");
    if (crlf) out = out.replace(/\n/g, "\r\n");
    if (hadBom) out = "\uFEFF" + out;
    await fs.writeFile(absPath, out);
  }
  return { success: true };
}
