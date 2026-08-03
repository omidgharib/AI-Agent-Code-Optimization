// FILE: src/analyzers/eslint.ts
import { execa } from "execa";
import { createHash } from "node:crypto";
import type { Issue } from "../core/types.js";

function makeId(
  tool: string,
  ruleId: string,
  filePath: string,
  line: number,
  msg: string,
): string {
  return createHash("sha256")
    .update(`${tool}:${ruleId}:${filePath}:${line}:${msg}`)
    .digest("hex")
    .slice(0, 16);
}

export async function runEslint(cwd: string): Promise<Issue[]> {
  try {
    const { stdout } = await execa(
      "npx",
      ["eslint", ".", "-f", "json", "--no-error-on-unmatched-pattern"],
      {
        cwd,
        reject: false,
      },
    );
    const results: Array<{
      filePath: string;
      messages: Array<{
        ruleId?: string;
        message: string;
        severity: number;
        line?: number;
        column?: number;
        endLine?: number;
        endColumn?: number;
        fix?: unknown;
      }>;
    }> = JSON.parse(stdout);
    const issues: Issue[] = [];
    for (const file of results) {
      for (const msg of file.messages) {
        const ruleId = msg.ruleId ?? "unknown";
        const sev = msg.severity === 2 ? "high" : "low";
        issues.push({
          id: makeId(
            "eslint",
            ruleId,
            file.filePath,
            msg.line ?? 0,
            msg.message,
          ),
          tool: "eslint",
          ruleId,
          message: msg.message,
          severity: sev,
          category: ruleId.includes("security")
            ? "security"
            : ruleId.includes("test")
              ? "test"
              : "style",
          location: {
            filePath: file.filePath,
            startLine: msg.line,
            startColumn: msg.column,
            endLine: msg.endLine,
            endColumn: msg.endColumn,
          },
          fix: { canAutoFix: !!msg.fix },
        });
      }
    }
    return issues;
  } catch {
    return [
      {
        id: makeId("custom", "missing-eslint", "", 0, "ESLint not available"),
        tool: "custom",
        message:
          "ESLint is not installed or failed to run. Install eslint to enable linting.",
        severity: "medium",
        category: "maintainability",
      },
    ];
  }
}
