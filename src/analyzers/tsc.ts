// FILE: src/analyzers/tsc.ts
import { execa } from "execa";
import { createHash } from "node:crypto";
import path from "node:path";
import type { Issue } from "../core/types.js";

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

const TSC_LINE = /^(.+)\((\d+),(\d+)\):\s+error\s+(TS\d+):\s+(.+)$/;

export async function runTsc(cwd: string): Promise<Issue[]> {
  try {
    const { stdout, stderr } = await execa(
      "npx",
      ["tsc", "--noEmit", "--pretty", "false"],
      {
        cwd,
        reject: false,
      },
    );
    const output = stdout + stderr;
    const issues: Issue[] = [];
    for (const line of output.split("\n")) {
      const m = TSC_LINE.exec(line.trim());
      if (!m) continue;
      const [, filePath, lineNum, colNum, ruleId, message] = m;
      const posixPath = filePath.split(path.sep).join("/");
      issues.push({
        id: makeId(posixPath, +lineNum, +colNum, message),
        tool: "tsc",
        ruleId,
        message,
        severity: "high",
        category: "bug",
        location: { filePath, startLine: +lineNum, startColumn: +colNum },
        fix: { canAutoFix: false },
      });
    }
    return issues;
  } catch {
    return [
      {
        id: createHash("sha256")
          .update("custom:missing-tsc")
          .digest("hex")
          .slice(0, 16),
        tool: "custom",
        message:
          "TypeScript compiler (tsc) is not available. Install typescript to enable type checking.",
        severity: "medium",
        category: "maintainability",
      },
    ];
  }
}
