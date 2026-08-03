// FILE: src/verify/verify.ts
import { runEslint } from "../analyzers/eslint.js";
import { runTsc } from "../analyzers/tsc.js";
import type { Issue } from "../core/types.js";

export async function verify(
  cwd: string,
): Promise<{ issues: Issue[]; passed: boolean }> {
  const [eslintIssues, tscIssues] = await Promise.all([
    runEslint(cwd),
    runTsc(cwd),
  ]);
  const issues = [...eslintIssues, ...tscIssues];
  return { issues, passed: issues.length === 0 };
}
