// FILE: src/fix/specialistPlanner.ts
import type { PrioritizedIssue } from "../core/types";
import { SPECIALISTS, routeIssuesToSpecialists, type SpecialistId, type SolutionStrategy } from "../core/specialistAgents";

export interface SpecialistTask { specialist: SpecialistId; strategy: SolutionStrategy; rootCause: string; issueIds: string[]; prompt: string; canPatch: boolean; approvalStages: string[]; budget: { requests: number; tokens: number; costUsd: number } }
export interface SpecialistPlanOptions { strategy?: SolutionStrategy; requests?: number; tokens?: number; costUsd?: number }
export interface SpecialistPlanResult { tasks: SpecialistTask[]; skipped: Array<{ rootCause: string; reason: string }> }

export function planSpecialistWork(issues: PrioritizedIssue[], options: SpecialistPlanOptions = {}): SpecialistPlanResult {
  const strategy = options.strategy ?? "standard";
  const budget = { requests: options.requests ?? 3, tokens: options.tokens ?? 20_000, costUsd: options.costUsd ?? 0.5 };
  const tasks: SpecialistTask[] = [];
  const skipped: Array<{ rootCause: string; reason: string }> = [];
  for (const group of routeIssuesToSpecialists(issues)) {
    const profile = SPECIALISTS[group.specialist];
    if (!group.issues.length) continue;
    const rootCause = group.issues.map((issue) => `${issue.ruleId ?? "general"}`)[0] ?? "general";
    if (!profile.canPatch && strategy === "refactor") { skipped.push({ rootCause, reason: `${group.specialist} is advisory-only; refactor strategy requires a patching specialist` }); continue; }
    const prompt = [
      `Specialist: ${group.specialist} (${group.issues.length} issue(s), strategy=${strategy}, canPatch=${profile.canPatch})`,
      `Approval required before: ${profile.approvalStages.join(", ")}`,
      ...group.issues.map((issue) => `${issue.severity} ${issue.ruleId ?? "finding"} in ${issue.location?.filePath ?? "-"}: ${issue.message}`),
    ].join("\n");
    tasks.push({ specialist: group.specialist, strategy: profile.defaultStrategy === "minimal" && strategy === "standard" ? "standard" : strategy === "refactor" && !profile.canPatch ? profile.defaultStrategy : strategy, rootCause, issueIds: group.issues.map((issue) => issue.id), prompt: prompt.slice(0, 20_000), canPatch: profile.canPatch, approvalStages: profile.approvalStages, budget: { ...budget } });
  }
  return { tasks, skipped };
}

export function specialistPromptContext(tasks: SpecialistTask[]): Array<{ filePath: string; excerpt: string }> {
  return tasks.map((task) => ({ filePath: `AI_AUDITOR_SPECIALIST_${task.specialist.toUpperCase().replace(/-/g, "_")}.json`, excerpt: JSON.stringify(task, null, 2).slice(0, 16_000) }));
}