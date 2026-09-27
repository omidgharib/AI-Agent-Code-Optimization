// FILE: src/analyzers/tscParse.ts
// Pure parser for `tsc --noEmit --pretty false` output. No external deps.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { Category, Issue } from "../core/types";

const TSC_LINE = /^(.+)\((\d+)(?:,(\d+))?\):\s+error\s+(TS\d+):\s+(.+)$/;
const TSC_GLOBAL = /^error\s+(TS\d+):\s+(.+)$/;
const SNIPPET_MAX = 200;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

function makeId(
  filePath: string,
  line: number,
  col: number,
  msg: string,
): string {
  return createHash("sha256")
    .update(`tsc:${filePath}:${line}:${col}:${msg}`)
    .digest("hex")
    .slice(0, 16);
}

function toPosix(p: string): string {
  return p.split("\\").join("/");
}

const TSC_CATEGORIES: Array<[Category, RegExp]> = [
  [
    "maintainability",
    /^TS(6133|6192|6196|6198|6199|6200|7005|7006|7015|7016|7022|7024|7026|7027|7030|7031|7033|7034)$/,
  ],
];

export function mapCategory(ruleId: string): Category {
  const id = ruleId.toUpperCase();
  for (const [cat, re] of TSC_CATEGORIES) {
    if (re.test(id)) return cat;
  }
  return "bug";
}

function snippetFor(
  cwd: string,
  filePath: string,
  line: number,
): string | undefined {
  try {
    const abs = path.isAbsolute(filePath)
      ? filePath
      : path.resolve(cwd, filePath);
    if (!existsSync(abs) || !statSync(abs).isFile()) return undefined;
    if (statSync(abs).size > MAX_FILE_BYTES) return undefined;
    const text = readFileSync(abs, "utf8").split(/\r?\n/)[line - 1];
    if (text === undefined) return undefined;
    const trimmed = text.trim();
    if (!trimmed) return undefined;
    return trimmed.length > SNIPPET_MAX
      ? trimmed.slice(0, SNIPPET_MAX) + "…"
      : trimmed;
  } catch {
    return undefined;
  }
}

function buildIssue(
  cwd: string,
  filePath: string,
  lineNum: number | undefined,
  colNum: number | undefined,
  ruleId: string,
  message: string,
): Issue {
  const posixPath = toPosix(filePath);
  return {
    id: makeId(posixPath, lineNum ?? 0, colNum ?? 0, message),
    tool: "tsc",
    ruleId,
    message,
    severity: "high",
    category: mapCategory(ruleId),
    location: {
      filePath: posixPath,
      startLine: lineNum,
      startColumn: colNum,
    },
    evidence: lineNum
      ? { snippet: snippetFor(cwd, filePath, lineNum) }
      : undefined,
    fix: { canAutoFix: false },
    meta: { tscCode: ruleId, hasLocation: lineNum !== undefined },
  };
}

export function parseTscOutput(output: string, cwd: string): Issue[] {
  const issues: Issue[] = [];
  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const located = TSC_LINE.exec(line);
    if (located) {
      issues.push(
        buildIssue(
          cwd,
          located[1] ?? "-",
          located[2] ? parseInt(located[2], 10) : undefined,
          located[3] ? parseInt(located[3], 10) : undefined,
          located[4] ?? "TS????",
          located[5] ?? "",
        ),
      );
      continue;
    }

    const global = TSC_GLOBAL.exec(line);
    if (global) {
      issues.push(
        buildIssue(cwd, "-", undefined, undefined, global[1], global[2]),
      );
    }
  }
  return issues;
}
