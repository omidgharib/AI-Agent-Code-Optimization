import fs from "node:fs/promises";
import path from "node:path";
import type { PrioritizedIssue } from "./types";
import type { LighthouseReport } from "../report/summary";

export interface QualityGateResult {
  passed: boolean;
  reasons: string[];
  baselinePath?: string;
  newIssueIds: string[];
  resolvedIssueIds: string[];
  thresholds: { maxCritical: number; maxHigh: number; failOnNew: boolean; minScores: Record<string, number> };
}

interface BaselineReport { topIssues?: Array<{ id: string }>; lighthouse?: LighthouseReport }

export async function evaluateQualityGate(
  issues: PrioritizedIssue[],
  lighthouse: LighthouseReport | undefined,
  options: { baselinePath?: string; maxCritical: number; maxHigh: number; failOnNew: boolean; minScores: Record<string, number> },
): Promise<QualityGateResult> {
  let baseline: BaselineReport | undefined;
  let baselinePath: string | undefined;
  if (options.baselinePath) {
    baselinePath = path.resolve(options.baselinePath);
    baseline = JSON.parse(await fs.readFile(baselinePath, "utf8")) as BaselineReport;
  }
  const currentIds = new Set(issues.map((issue) => issue.id));
  const baselineIds = new Set((baseline?.topIssues ?? []).map((issue) => issue.id));
  const newIssueIds = baseline ? [...currentIds].filter((id) => !baselineIds.has(id)) : [];
  const resolvedIssueIds = baseline ? [...baselineIds].filter((id) => !currentIds.has(id)) : [];
  const reasons: string[] = [];
  const critical = issues.filter((issue) => issue.severity === "critical").length;
  const high = issues.filter((issue) => issue.severity === "high").length;
  if (critical > options.maxCritical) reasons.push(`critical issues ${critical} exceed ${options.maxCritical}`);
  if (high > options.maxHigh) reasons.push(`high issues ${high} exceed ${options.maxHigh}`);
  if (options.failOnNew && newIssueIds.length) reasons.push(`${newIssueIds.length} new issue(s) compared with baseline`);
  for (const [category, minimum] of Object.entries(options.minScores)) {
    const score = lighthouse?.categories[category]?.score;
    if (typeof score === "number" && score * 100 < minimum)
      reasons.push(`${category} score ${(score * 100).toFixed(0)} is below ${minimum}`);
  }
  return { passed: reasons.length === 0, reasons, baselinePath, newIssueIds, resolvedIssueIds, thresholds: { maxCritical: options.maxCritical, maxHigh: options.maxHigh, failOnNew: options.failOnNew, minScores: options.minScores } };
}
