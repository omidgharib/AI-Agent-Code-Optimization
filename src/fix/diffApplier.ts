// FILE: src/fix/diffApplier.ts
import fs from "node:fs/promises";
import path from "node:path";

interface Hunk {
  oldStart: number;
  oldCount: number;
  newLines: string[];
  oldLines: string[];
}

// Files the fix loop must never write to, no matter what the LLM's diff says
// (mirrors the protected set documented in AGENTS.md / PROTECTED_IGNORES).
const PROTECTED_PATH_RE =
  /(^|\/)(\.git\/|\.env($|\.)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json|bun\.lockb|[^/]*\.lock$)/i;
const GENERATED_DIR_RE = /^(\.git|node_modules|dist|build|out|coverage|dev-dist|vendor)\//;

/**
 * Resolve a diff target path against repoRoot, enforcing the path-safety model:
 * relative paths only, containment inside repoRoot, and never a protected file.
 * Returns an error message on violation, null when the path is safe.
 */
export function checkTargetPath(
  filePath: string,
  repoRoot: string,
): string | null {
  const cleaned = filePath.replace(/\\/g, "/").trim();
  if (!cleaned || cleaned === "/dev/null") {
    return "diff has no valid target path (---/+++ header missing or /dev/null; file deletions are not supported)";
  }
  if (/^[a-zA-Z]:[\\/]/.test(cleaned) || cleaned.startsWith("/")) {
    return `refusing absolute diff target "${filePath}" — paths must be relative to the repo root`;
  }
  const abs = path.resolve(repoRoot, cleaned);
  const rel = path.relative(path.resolve(repoRoot), abs);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) {
    return `refusing diff target "${filePath}" — it resolves outside the repo root`;
  }
  const posix = rel.split("\\").join("/");
  if (PROTECTED_PATH_RE.test(posix)) {
    return `refusing to modify protected file "${posix}"`;
  }
  if (GENERATED_DIR_RE.test(posix)) {
    return `refusing to modify generated/vendored file "${posix}"`;
  }
  return null;
}

async function checkRealTargetPath(filePath: string, repoRoot: string): Promise<string | null> {
  const root = await fs.realpath(repoRoot);
  const absolute = path.resolve(repoRoot, filePath);
  let existing = absolute;
  while (true) {
    try { existing = await fs.realpath(existing); break; } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return `cannot resolve diff target "${filePath}": ${String(error)}`;
      const parent = path.dirname(existing);
      if (parent === existing) return `cannot resolve parent for diff target "${filePath}"`;
      existing = parent;
    }
  }
  const rel = path.relative(root, existing);
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    return `refusing diff target "${filePath}" — its real path escapes the repo through a symlink`;
  }
  try {
    const stat = await fs.lstat(absolute);
    if (stat.isSymbolicLink()) return `refusing symbolic-link diff target "${filePath}"`;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") return `cannot inspect diff target "${filePath}": ${String(error)}`;
  }
  return null;
}

function parseHunks(
  diff: string,
): { filePath: string; hunks: Hunk[]; fileCount: number; renameOnly: boolean } | null {
  const lines = diff.split("\n");
  let filePath = "";
  let fileCount = 0;
  let sawRename = false;
  const hunks: Hunk[] = [];
  let current: Hunk | null = null;

  for (const rawLine of lines) {
    // LLM output is LF, but files/models on Windows may echo CRLF. Normalize
    // each line so line-ending style never causes a false mismatch.
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line.startsWith("diff --git ")) {
      fileCount++;
    } else if (/^rename (from|to) /.test(line)) {
      sawRename = true;
    } else if (line.startsWith("+++ ")) {
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
      // "\ No newline at end of file" markers are intentionally ignored.
    }
  }
  if (current) hunks.push(current);
  return filePath || hunks.length > 0 || sawRename
    ? { filePath, hunks, fileCount, renameOnly: sawRename && hunks.length === 0 }
    : null;
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

export async function applyDiff(
  unifiedDiff: string,
  repoRoot: string,
  dryRun: boolean,
): Promise<{ success: boolean; error?: string }> {
  const parsed = parseHunks(unifiedDiff);
  if (!parsed) return { success: false, error: "Could not parse diff" };

  const { filePath, hunks, fileCount, renameOnly } = parsed;
  if (renameOnly) {
    return {
      success: false,
      error:
        "unsupported diff: rename/mode-only change with no content hunks — this tool cannot rename files; emit a content diff against an existing path instead",
    };
  }
  if (fileCount > 1) {
    return {
      success: false,
      error:
        "unsupported diff: multiple files in one patch — send exactly one file per patch",
    };
  }
  if (hunks.length === 0) {
    return {
      success: false,
      error:
        "diff contains no @@ hunks (nothing to apply) — emit a unified diff with ---/+++ headers and at least one hunk",
    };
  }

  const pathError = checkTargetPath(filePath, repoRoot);
  if (pathError) return { success: false, error: pathError };
  const realPathError = await checkRealTargetPath(filePath, repoRoot);
  if (realPathError) return { success: false, error: realPathError };

  const absPath = path.resolve(repoRoot, filePath);

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

  // A create-file hunk (@@ -0,0) against a file that ALREADY exists used to
  // silently splice its lines into the existing content (corrupting e.g.
  // package.json). Refuse it outright unless the target is empty.
  const isCreateOnly = hunks.every((h) => h.oldCount === 0);
  const hadBom = content.charCodeAt(0) === 0xfeff;
  const body = hadBom ? content.slice(1) : content;
  if (isCreateOnly && body.trim() !== "") {
    return {
      success: false,
      error: `refusing new-file diff (@@ -0,0) for "${filePath}" — the file already exists with content; modify it with a context-based hunk instead`,
    };
  }

  // Normalize the file's line endings to LF for matching, but write the result
  // back with the file's original style (CRLF stays CRLF on Windows).
  const crlf = body.includes("\r\n");
  const fileLines = body.replace(/\r\n/g, "\n").split("\n");
  let offset = 0;

  for (const hunk of hunks) {
    const start = hunk.oldStart - 1 + offset;
    // Negative or past-EOF starts must fail loudly; splice() with a negative
    // index would silently insert lines at the wrong place.
    if (start < 0 || start > fileLines.length) {
      return {
        success: false,
        error: `Hunk mismatch at line ${hunk.oldStart}: hunk targets line ${start + 1} but the file only has ${fileLines.length} lines. The model's context lines may be stale — check ${filePath}`,
      };
    }
    const actual = fileLines
      .slice(start, start + hunk.oldLines.length)
      .join("\n");
    const expected = hunk.oldLines.join("\n");
    if (actual !== expected) {
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
