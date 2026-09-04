import { createHash } from "node:crypto";
import type { Issue } from "../../core/types";

export type AnalyzerStatus = "completed" | "unavailable" | "not_applicable" | "timed_out" | "failed";
export interface AnalyzerManifest { id: string; version: string; ecosystems: string[]; requiredFiles: string[]; timeoutMs: number; resourceProfile: { memoryMb: number; outputBytes: number } }
export interface AnalyzerOutcome { manifest: AnalyzerManifest; status: AnalyzerStatus; issues: Issue[]; evidence: { stdout: string; stderr: string; exitCode: number | null; truncated: boolean; durationMs: number }; reason?: string }
export type FindingState = "introduced" | "recurring" | "resolved" | "suppressed" | "accepted-risk";

export function stableFindingFingerprint(issue: Pick<Issue, "tool" | "ruleId" | "location" | "evidence" | "meta">): string {
  const asset = issue.location?.filePath?.replace(/\\/g, "/").toLowerCase() ?? "-";
  const condition = String(issue.meta?.messageId ?? issue.ruleId);
  const region = `${issue.location?.startLine ?? 0}:${issue.location?.startColumn ?? 0}`;
  return createHash("sha256").update(`v1\0${issue.tool}\0${issue.ruleId}\0${condition}\0${asset}\0${region}`).digest("hex").slice(0, 24);
}

export function correlateFindings(current: Issue[], baseline: string[], accepted: string[] = [], suppressed: string[] = []) {
  const baselineSet = new Set(baseline), acceptedSet = new Set(accepted), suppressedSet = new Set(suppressed);
  const active = current.map((issue) => { const fingerprint = stableFindingFingerprint(issue); const state: FindingState = acceptedSet.has(fingerprint) ? "accepted-risk" : suppressedSet.has(fingerprint) ? "suppressed" : baselineSet.has(fingerprint) ? "recurring" : "introduced"; return { issue, fingerprint, state }; });
  const currentSet = new Set(active.map((item) => item.fingerprint));
  return { active, resolved: baseline.filter((fingerprint) => !currentSet.has(fingerprint)).map((fingerprint) => ({ fingerprint, state: "resolved" as const })) };
}
