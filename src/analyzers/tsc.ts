// FILE: src/analyzers/tsc.ts
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { parseTscOutput } from "./tscParse";
import type { Issue } from "../core/types";
import { LocalSandboxRunner } from "../platform/security/sandboxRunner";

export async function runTsc(cwd: string): Promise<Issue[]> {
  try {
    const absCwd = resolve(cwd);
    const compiler = require.resolve("typescript/bin/tsc", { paths: [absCwd, join(__dirname, "../..")] });
    const result = await new LocalSandboxRunner().run({ executable: process.execPath, args: [compiler, "--noEmit", "--pretty", "false"], cwd: absCwd, limits: { timeoutMs: 120_000, maxMemoryMb: 512, maxOutputBytes: 4_000_000 } });
    return parseTscOutput(result.stdout + result.stderr, absCwd);
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
