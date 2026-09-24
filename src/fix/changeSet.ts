import fs from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { runEslint } from "../analyzers/eslint";
import { runTsc } from "../analyzers/tsc";
import { normalize } from "../normalize/normalizer";
import { detectTests } from "../verify/testIntelligence";
import type { FixResponse, Issue, PrioritizedIssue } from "../core/types";
import { applyDiff, getDiffTargetPath, validateDiffPreview } from "./diffApplier";
import { PatchTransaction } from "./patchTransaction";
import { safeRead } from "../platform/security/safeMutation";
import { loadCodeAuditPolicy, type CodeAuditPolicy } from "../code/application/policy";
import { analyzeChangeImpact, scoreDecision, type ChangeImpact, type ConfidenceScores } from "./changeDecision";
import { findNewBlockingSonarIssues, runSonar, type SonarConfig } from "../analyzers/sonar";
import type { SonarSummary } from "../core/types";

const execFileAsync = promisify(execFile);
type Patch = FixResponse["patches"][number];

export interface ChangeSetVerification {
  passed: boolean;
  fixedIssueIds: string[];
  beforeIssueCount: number;
  afterIssueCount: number;
  introducedSevere: number;
  checks: {
    eslint: "passed" | "failed";
    typescript: "passed" | "failed";
    relatedTests: "passed" | "failed" | "not-found";
  };
  relatedTests: string[];
  attempts: number;
  confidence?: ConfidenceScores;
  impact?: ChangeImpact;
  sonar?: SonarSummary & { introducedSevere: number };
  error?: string;
}

export interface PreparedChangeSet {
  id: string;
  description: string;
  issueIds: string[];
  patches: Patch[];
  touches: string[];
  baseSha256: Record<string, string>;
  verification: ChangeSetVerification;
}

export const issueVerificationFingerprint = (
  issue: Pick<Issue, "tool" | "ruleId" | "location" | "message">,
) => [
  issue.tool,
  issue.ruleId ?? "",
  issue.location?.filePath?.replace(/\\/g, "/").toLowerCase() ?? "",
  issue.message,
].join("\0");

async function createWorkspace(repoRoot: string): Promise<string> {
  const workspace = await fs.mkdtemp(path.join(tmpdir(), "ai-auditor-change-set-"));
  const excluded = new Set([".git", "node_modules", "dist", "build", "out", "coverage", "ai-auditor-report"]);
  await fs.cp(repoRoot, workspace, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(repoRoot, source);
      return !relative || !excluded.has(relative.split(path.sep)[0]);
    },
  });
  try {
    await fs.access(path.join(repoRoot, "node_modules"));
    await fs.symlink(
      path.join(repoRoot, "node_modules"),
      path.join(workspace, "node_modules"),
      process.platform === "win32" ? "junction" : "dir",
    );
  } catch { /* dependency directory is optional */ }
  return workspace;
}

function touchedFiles(patches: Patch[]): string[] {
  return [...new Set(patches.flatMap((patch) => {
    const target = getDiffTargetPath(patch.unifiedDiff);
    return patch.touches.length ? patch.touches : target ? [target] : [];
  }).map((file) => file.replace(/\\/g, "/")))];
}

async function runRelatedTests(workspace: string, touches: string[]) {
  const mapping = await detectTests(workspace, touches);
  const tests = [...new Set(touches.flatMap((file) => mapping.related[file] ?? []))];
  if (!tests.length) return { status: "not-found" as const, tests };
  try {
    await execFileAsync("npm", ["test", "--", "--runInBand", "--runTestsByPath", ...tests], {
      cwd: workspace,
      timeout: 120_000,
      maxBuffer: 2_000_000,
    });
    return { status: "passed" as const, tests };
  } catch (error) {
    const value = error as { stdout?: string; stderr?: string };
    return {
      status: "failed" as const,
      tests,
      error: `${value.stdout ?? ""}${value.stderr ?? ""}`.slice(-2000) || String(error),
    };
  }
}

export async function prepareChangeSet(
  repoRoot: string,
  patches: Patch[],
  baseline: PrioritizedIssue[],
  issueIds: string[],
  attempts = 0,
  policy?: CodeAuditPolicy,
  sonarConfig?: SonarConfig,
): Promise<PreparedChangeSet> {
  const effectivePolicy = policy ?? await loadCodeAuditPolicy(repoRoot);
  const touches = touchedFiles(patches);
  const baseSha256: Record<string, string> = {};
  for (const file of touches) {
    try { baseSha256[file] = (await safeRead(repoRoot, file)).sha256; }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") baseSha256[file] = "absent";
      else throw error;
    }
  }
  const id = createHash("sha256").update(patches.map((patch) => patch.unifiedDiff).join("\0")).digest("hex").slice(0, 16);
  const common = { id, description: patches.map((patch) => patch.description).join("; "), issueIds, patches, touches, baseSha256 };
  let workspace: string | undefined;
  try {
    workspace = await createWorkspace(repoRoot);
    for (const patch of patches) {
      const applied = await applyDiff(patch.unifiedDiff, workspace, false);
      if (!applied.success) throw new Error(applied.error);
    }
    const [eslintIssues, tscIssues, tests, impact, sonarRun] = await Promise.all([
      runEslint(workspace),
      runTsc(workspace),
      runRelatedTests(workspace, touches),
      analyzeChangeImpact(repoRoot, touches, effectivePolicy),
      sonarConfig?.enabled ? runSonar(workspace, sonarConfig) : Promise.resolve({ issues: [] as Issue[], summary: { status: "not-run" as const, hostUrl: sonarConfig?.hostUrl ?? "http://127.0.0.1:9000", projectKey: sonarConfig?.projectKey ?? "", issueCount: 0, reason: "SonarQube is disabled" } }),
    ]);
    const after = normalize([...eslintIssues, ...tscIssues, ...sonarRun.issues]);
    const before = baseline.filter((issue) => issue.tool === "eslint" || issue.tool === "tsc" || issue.tool === "sonar");
    const known = new Set(before.map(issueVerificationFingerprint));
    const remaining = new Set(after.map(issueVerificationFingerprint));
    const fixedIssueIds = before.filter((issue) => !remaining.has(issueVerificationFingerprint(issue))).map((issue) => issue.id);
    const selectedCodeIssues = before.filter((issue) => issueIds.includes(issue.id));
    const unresolvedSelected = selectedCodeIssues.filter((issue) => remaining.has(issueVerificationFingerprint(issue)));
    const introduced = after.filter((issue) =>
      !known.has(issueVerificationFingerprint(issue)) &&
      (issue.severity === "high" || issue.severity === "critical"));
    const introducedSonar = findNewBlockingSonarIssues(before, after);
    // A preview is ready only when it resolves every editable issue the user
    // explicitly selected. Resolving one out of several must not look like a
    // safe, complete change-set.
    const changedLines = patches.reduce((count, patch) => count + patch.unifiedDiff.split(/\r?\n/).filter((line) => /^[+-]/.test(line) && !/^(---|\+\+\+)/.test(line)).length, 0);
    if (changedLines > effectivePolicy.maxLinesPerChangeSet) impact.policyViolations.push(`policy allows at most ${effectivePolicy.maxLinesPerChangeSet} changed lines per change set`);
    const blockingIntroduced = introduced.filter((issue) => issue.tool !== "sonar" || introducedSonar.includes(issue));
    const confidence = scoreDecision({ issues: selectedCodeIssues, fixedSelected: selectedCodeIssues.length - unresolvedSelected.length, selected: selectedCodeIssues.length, introducedSevere: blockingIntroduced.length, tests: tests.status, impact });
    // Coverage is informational, not a readiness gate: an incomplete-but-safe
    // subset of a request is still approval-worthy. The untouched issues stay
    // visible in the report and are handled by a later iteration — exactly the
    // partial-progress model apply mode already uses. Only new blocking
    // findings, policy violations, and failing related tests block approval.
    const policyBlocked = impact.policyViolations.length > 0;
    const testsBlocked = tests.status === "failed";
    const passed = !policyBlocked && !testsBlocked && blockingIntroduced.length === 0;
    const error = policyBlocked
      ? `Policy blocked change set: ${impact.policyViolations.join("; ")}`
      : introducedSonar.length
      ? `Sonar preflight introduced ${introducedSonar.length} high/critical bug or vulnerability: ${introducedSonar.map((issue) => `${issue.ruleId ?? "sonar"} in ${issue.location?.filePath ?? "unknown"}:${issue.location?.startLine ?? 1}`).join("; ")}`
      : blockingIntroduced.length
      ? `Introduced ${blockingIntroduced.length} high/critical issue(s)`
      : tests.error;
    return {
      ...common,
      verification: {
        passed,
        fixedIssueIds,
        beforeIssueCount: before.length,
        afterIssueCount: after.length,
        introducedSevere: blockingIntroduced.length,
        checks: {
          // Keep the per-tool result aligned with the readiness gate: a newly
          // introduced high ESLint finding is just as unsafe to apply as a
          // critical one. Reporting it as passed made blocked previews look
          // contradictory in the UI.
          eslint: eslintIssues.some((issue) => issue.severity === "critical" || issue.severity === "high") ? "failed" : "passed",
          typescript: tscIssues.some((issue) => issue.severity === "critical" || issue.severity === "high") ? "failed" : "passed",
          relatedTests: tests.status,
        },
        relatedTests: tests.tests,
        attempts,
        confidence,
        impact,
        sonar: { ...sonarRun.summary, introducedSevere: introducedSonar.length },
        ...(error ? { error } : {}),
      },
    };
  } catch (error) {
    return {
      ...common,
      verification: {
        passed: false,
        fixedIssueIds: [],
        beforeIssueCount: baseline.length,
        afterIssueCount: baseline.length,
        introducedSevere: 0,
        checks: { eslint: "failed", typescript: "failed", relatedTests: "not-found" },
        relatedTests: [],
        attempts,
        confidence: { diagnosis: 0, patch: 0, behavioral: 0, status: "red", reasons: [String(error)] },
        impact: { importers: [], routes: [], publicApis: [], relatedTests: [], sensitiveFiles: [], policyViolations: [] },
        sonar: sonarConfig ? { status: "not-run", hostUrl: sonarConfig.hostUrl, projectKey: sonarConfig.projectKey, issueCount: 0, introducedSevere: 0, reason: String(error) } : undefined,
        error: String(error),
      },
    };
  } finally {
    if (workspace) await fs.rm(workspace, { recursive: true, force: true });
  }
}

export async function applyPreparedChangeSet(repoRoot: string, changeSet: PreparedChangeSet): Promise<void> {
  if (!changeSet.verification.passed)
    throw new Error(changeSet.verification.error ?? "Change set is not ready");
  const transaction = new PatchTransaction(repoRoot, false);
  try {
    for (const patch of changeSet.patches) {
      const target = getDiffTargetPath(patch.unifiedDiff);
      if (!target) throw new Error("Patch lacks a target");
      const validation = await validateDiffPreview(patch.unifiedDiff, repoRoot, changeSet.baseSha256[target]);
      if (!validation.valid)
        throw new Error(`Repository changed since preview; regenerate the change set. ${validation.error ?? target}`);
      await transaction.capture(patch.unifiedDiff);
    }
    await transaction.verifyUnchanged();
    for (const patch of changeSet.patches) {
      const result = await applyDiff(patch.unifiedDiff, repoRoot, false);
      if (!result.success) throw new Error(result.error);
    }
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
