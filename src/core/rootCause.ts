import type { PrioritizedIssue } from "./types";

export interface RootCauseGroup {
  id: string; title: string; issueIds: string[]; filePath?: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: "high" | "medium" | "low"; rationale: string;
}
const order = { low: 0, medium: 1, high: 2, critical: 3 };
/** Groups deterministic diagnostics into one root-cause review unit. */
export function groupRootCauses(issues: PrioritizedIssue[]): RootCauseGroup[] {
  const groups = new Map<string, PrioritizedIssue[]>();
  for (const issue of issues) {
    const file = issue.location?.filePath ?? "-";
    const family = issue.tool === "tsc" ? "tsc:" + (issue.ruleId?.replace(/\\d+$/, "") ?? "diagnostic")
      : issue.tool === "eslint" ? "eslint:" + (issue.ruleId?.split("/")[0] ?? "rule")
      : issue.tool + ":" + issue.category;
    const key = file + "\0" + family;
    groups.set(key, [...(groups.get(key) ?? []), issue]);
  }
  return [...groups.entries()].map(([key, members]) => {
    const first = members[0];
    const severity = members.reduce((current, issue) => order[issue.severity] > order[current] ? issue.severity : current, first.severity);
    const deterministic = members.every((issue) => issue.tool === "tsc" || issue.tool === "eslint");
    const confidence: RootCauseGroup["confidence"] = deterministic ? "high" : first.meta?.confidence === "low" ? "low" : "medium";
    return { id: Buffer.from(key).toString("base64url").slice(0, 24), title: members.length === 1 ? first.message : String(members.length) + " related findings in " + (first.location?.filePath ?? "project"), issueIds: members.map((issue) => issue.id), filePath: first.location?.filePath, severity, confidence, rationale: deterministic ? "Deterministic analyzer diagnostics share the same file and rule family." : "Findings share a location and category; review together before changing code." };
  }).sort((a, b) => order[b.severity] - order[a.severity] || b.issueIds.length - a.issueIds.length);
}
