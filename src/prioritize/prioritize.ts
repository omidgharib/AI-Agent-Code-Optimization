// FILE: src/prioritize/prioritize.ts
import type { Issue, PrioritizedIssue, Effort } from "../core/types";

const SEVERITY_WEIGHT: Record<string, number> = {
  low: 10,
  medium: 30,
  high: 60,
  critical: 90,
};
const CATEGORY_WEIGHT: Record<string, number> = {
  security: 30,
  bug: 20,
  performance: 15,
  a11y: 15,
  maintainability: 10,
  seo: 10,
  style: 5,
  test: 8,
};
const EFFORT_PENALTY: Record<Effort, number> = { xs: 0, s: 5, m: 15, l: 30 };
const CONFIDENCE: Record<string, number> = { eslint: 10, tsc: 10 };

function getEffort(issue: Issue): Effort {
  if (issue.category === "security" && issue.severity === "critical")
    return "l";
  if (
    issue.tool === "eslint" &&
    (issue.ruleId?.includes("fix") || issue.fix?.canAutoFix)
  )
    return "xs";
  if (issue.category === "style") return "xs";
  if (issue.tool === "tsc") return "m";
  return "s";
}

export function prioritize(issues: Issue[]): PrioritizedIssue[] {
  const result: PrioritizedIssue[] = issues.map((issue) => {
    const effort = getEffort(issue);
    const score =
      (SEVERITY_WEIGHT[issue.severity] ?? 10) +
      (CATEGORY_WEIGHT[issue.category] ?? 5) +
      (CONFIDENCE[issue.tool] ?? 5) -
      EFFORT_PENALTY[effort];
    const rationale = [
      `severity=${issue.severity}(+${SEVERITY_WEIGHT[issue.severity]})`,
      `category=${issue.category}(+${CATEGORY_WEIGHT[issue.category] ?? 5})`,
      `confidence=${CONFIDENCE[issue.tool] ?? 5}`,
      `effort=${effort}(-${EFFORT_PENALTY[effort]})`,
    ];
    return { ...issue, score, effort, rationale };
  });

  return result.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const fa = a.location?.filePath ?? "\uffff";
    const fb = b.location?.filePath ?? "\uffff";
    if (fa !== fb) return fa.localeCompare(fb);
    const la = a.location?.startLine ?? Infinity;
    const lb = b.location?.startLine ?? Infinity;
    if (la !== lb) return la - lb;
    return a.id.localeCompare(b.id);
  });
}
