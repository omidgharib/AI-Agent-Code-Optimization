// FILE: src/fix/contextBuilder.ts
import fs from "node:fs/promises";
import type { PrioritizedIssue } from "../core/types";

const SECRET_PATTERNS = [
  /sk-[A-Za-z0-9]{20,}/g,
  /ghp_[A-Za-z0-9]{36}/g,
  /AKIA[A-Z0-9]{16}/g,
  /-----BEGIN [A-Z ]+-----/g,
];
const MAX_CHARS = 60_000;
const HEADER_LINES = 80;
const CONTEXT_LINES = 60;

function redact(text: string): string {
  let out = text;
  for (const p of SECRET_PATTERNS) out = out.replace(p, "<REDACTED>");
  return out;
}

function addLineNumbers(lines: string[], startIdx: number): string {
  return lines.map((l, i) => `${startIdx + i + 1}: ${l}`).join("\n");
}

export async function buildContext(
  issues: PrioritizedIssue[],
): Promise<Array<{ filePath: string; excerpt: string }>> {
  const fileIssues = new Map<string, number[]>();
  for (const issue of issues) {
    if (!issue.location?.filePath) continue;
    const fp = issue.location.filePath;
    if (!fileIssues.has(fp)) fileIssues.set(fp, []);
    if (issue.location.startLine)
      fileIssues.get(fp)!.push(issue.location.startLine);
  }

  const contexts: Array<{ filePath: string; excerpt: string }> = [];
  let totalChars = 0;

  for (const [filePath, lines] of fileIssues) {
    try {
      const content = await fs.readFile(filePath, "utf8");
      const allLines = content.split("\n");
      const included = new Set<number>();

      for (let i = 0; i < Math.min(HEADER_LINES, allLines.length); i++)
        included.add(i);
      for (const line of lines) {
        const start = Math.max(0, line - CONTEXT_LINES - 1);
        const end = Math.min(allLines.length - 1, line + CONTEXT_LINES - 1);
        for (let i = start; i <= end; i++) included.add(i);
      }

      const sortedIdx = [...included].sort((a, b) => a - b);
      const parts: string[] = [];
      let prev = -2;
      let chunk: number[] = [];

      for (const idx of sortedIdx) {
        if (idx !== prev + 1 && chunk.length > 0) {
          parts.push(
            addLineNumbers(
              chunk.map((i) => allLines[i]),
              chunk[0],
            ),
          );
          chunk = [];
        }
        chunk.push(idx);
        prev = idx;
      }
      if (chunk.length > 0)
        parts.push(
          addLineNumbers(
            chunk.map((i) => allLines[i]),
            chunk[0],
          ),
        );

      let excerpt = redact(parts.join("\n...\n"));
      if (totalChars + excerpt.length > MAX_CHARS) {
        const remaining = MAX_CHARS - totalChars;
        if (remaining <= 0) break;
        excerpt = excerpt.slice(0, remaining) + "\n[TRUNCATED]";
      }
      totalChars += excerpt.length;
      contexts.push({ filePath, excerpt });
    } catch {
      /* skip unreadable files */
    }
  }

  return contexts;
}
