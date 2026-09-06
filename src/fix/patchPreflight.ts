import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { runEslint } from "../analyzers/eslint";
import { runTsc } from "../analyzers/tsc";
import { normalize } from "../normalize/normalizer";
import type { Issue, PrioritizedIssue } from "../core/types";
import { applyDiff } from "./diffApplier";

export const issueVerificationFingerprint = (issue: Pick<Issue, "tool" | "ruleId" | "location" | "message">) => [issue.tool, issue.ruleId ?? "", issue.location?.filePath?.replace(/\\/g, "/").toLowerCase() ?? "", issue.message].join("\0");
async function createWorkspace(repoRoot: string): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(tmpdir(), "ai-auditor-preflight-"));
  const excluded = new Set([".git", "node_modules", "dist", "build", "out", "coverage", "ai-auditor-report"]);
  await fs.cp(repoRoot, workspace, { recursive: true, filter: (source) => { const relative = path.relative(repoRoot, source); return !relative || !excluded.has(relative.split(path.sep)[0]); } });
  try { await fs.access(path.join(repoRoot, "node_modules")); await fs.symlink(path.join(repoRoot, "node_modules"), path.join(workspace, "node_modules"), process.platform === "win32" ? "junction" : "dir"); } catch { /* optional */ }
  return workspace;
}
export async function preflightSuggestedPatch(repoRoot: string, unifiedDiff: string, baseline: PrioritizedIssue[]): Promise<{ success: boolean; error?: string }> {
  let workspace: string | undefined;
  try {
    workspace = await createWorkspace(repoRoot);
    const applied = await applyDiff(unifiedDiff, workspace, false); if (!applied.success) return applied;
    const before = baseline.filter((issue) => issue.tool === "eslint" || issue.tool === "tsc");
    const after = normalize([...(await runEslint(workspace)), ...(await runTsc(workspace))]);
    const known = new Set(before.map(issueVerificationFingerprint));
    const introduced = after.filter((issue) => !known.has(issueVerificationFingerprint(issue)) && (issue.severity === "high" || issue.severity === "critical"));
    if (introduced.length) return { success: false, error: `Preflight introduced ${introduced.length} severe issue(s): ${introduced.map((issue) => `${issue.ruleId ?? issue.tool} in ${issue.location?.filePath ?? "unknown"}: ${issue.message}`).join("; ")}` };
    if (after.length >= before.length) return { success: false, error: `Preflight did not reduce code issues (${before.length} -> ${after.length})` };
    return { success: true };
  } catch (error) { return { success: false, error: `Preflight failed: ${String(error)}` }; }
  finally { if (workspace) await fs.rm(workspace, { recursive: true, force: true }); }
}
