// FILE: src/analyzers/tsc.ts
import { execa } from "execa";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { parseTscOutput } from "./tscParse";
import type { Issue } from "../core/types";

export async function runTsc(cwd: string): Promise<Issue[]> {
  try {
    const absCwd = resolve(cwd);
    const isWin = process.platform === "win32";
    const { stdout, stderr } = await execa(
      "npx",
      ["tsc", "--noEmit", "--pretty", "false"],
      {
        cwd: absCwd,
        reject: false,
        ...(isWin ? { shell: true } : {}),
      },
    );
    return parseTscOutput(stdout + stderr, absCwd);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return [
      {
        id: createHash("sha256")
          .update(`tsc:error:${detail}`)
          .digest("hex")
          .slice(0, 16),
        tool: "tsc",
        ruleId: "tsc-error",
        message: `TypeScript compiler (tsc) failed to run: ${detail}. Install typescript to enable type checking.`,
        severity: "medium",
        category: "maintainability",
        meta: { error: detail },
      },
    ];
  }
}
