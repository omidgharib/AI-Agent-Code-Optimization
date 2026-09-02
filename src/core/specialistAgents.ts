import { redactSecrets } from "./trustSecurity";
export type SpecialistId = "code-quality" | "security" | "performance" | "seo" | "test" | "architecture";
export type SolutionStrategy = "minimal" | "standard" | "refactor";
export type AgentStage = "analyze" | "explain" | "plan" | "diff" | "review" | "verify" | "apply";
export interface SpecialistProfile { id: SpecialistId; categories: string[]; canPatch: boolean; defaultStrategy: SolutionStrategy; approvalStages: AgentStage[] }
export const SPECIALISTS: Record<SpecialistId, SpecialistProfile> = {
  "code-quality": { id: "code-quality", categories: ["bug", "maintainability", "style"], canPatch: true, defaultStrategy: "standard", approvalStages: ["review", "apply"] },
  security: { id: "security", categories: ["security"], canPatch: true, defaultStrategy: "minimal", approvalStages: ["plan", "review", "apply"] },
  performance: { id: "performance", categories: ["performance"], canPatch: true, defaultStrategy: "standard", approvalStages: ["review", "apply"] },
  seo: { id: "seo", categories: ["seo"], canPatch: false, defaultStrategy: "minimal", approvalStages: ["review"] },
  test: { id: "test", categories: ["test", "bug"], canPatch: true, defaultStrategy: "standard", approvalStages: ["review", "apply"] },
  architecture: { id: "architecture", categories: ["maintainability"], canPatch: false, defaultStrategy: "refactor", approvalStages: ["plan", "review", "apply"] },
};
const order: AgentStage[] = ["analyze", "explain", "plan", "diff", "review", "verify", "apply"];
export interface SpecialistSession { id: string; issueId: string; specialist: SpecialistId; strategy: SolutionStrategy; provider: string; model: string; endpoint: string; budgets: { requests: number; tokens: number; costUsd: number }; stage: AgentStage; approved: AgentStage[]; memory: string[] }
export function createSpecialistSession(input: Omit<SpecialistSession, "id" | "stage" | "approved" | "memory">): SpecialistSession { return { ...input, id: `${input.issueId}:${input.specialist}:${Date.now()}`, stage: "analyze", approved: [], memory: [] }; }
export function advanceSpecialist(session: SpecialistSession, next: AgentStage, approval = false): SpecialistSession { const expected = order[order.indexOf(session.stage) + 1]; if (next !== expected) throw new Error(`Invalid workflow transition ${session.stage} → ${next}; expected ${expected}`); const profile = SPECIALISTS[session.specialist]; if ((next === "diff" || next === "apply") && !profile.canPatch) throw new Error(`${session.specialist} is advisory-only`); if (profile.approvalStages.includes(next) && !approval) throw new Error(`Human approval required before ${next}`); return { ...session, stage: next, approved: approval ? [...session.approved, next] : session.approved }; }
export function addProjectMemory(session: SpecialistSession, value: string): SpecialistSession { return { ...session, memory: [...session.memory, redactSecrets(value).slice(0, 20_000)] }; }
export function compareAlternatives(alternatives: Array<{ id: string; confidence: number; blastRadius: number; verificationPassed: boolean; changedLines: number }>) { return [...alternatives].map((item) => ({ ...item, score: item.confidence - item.blastRadius * .35 - Math.min(20, item.changedLines / 10) + (item.verificationPassed ? 15 : -40) })).sort((a, b) => b.score - a.score); }
export function groupRootCauses<T extends { ruleId?: string; category: string; location?: { filePath: string } }>(issues: T[]) { const groups = new Map<string, T[]>(); for (const issue of issues) { const folder = issue.location?.filePath?.split(/[\\/]/).slice(0, -1).join("/") ?? "global"; const key = `${issue.category}:${issue.ruleId ?? "general"}:${folder}`; groups.set(key, [...(groups.get(key) ?? []), issue]); } return [...groups].map(([rootCause, values]) => ({ rootCause, issues: values })); }
