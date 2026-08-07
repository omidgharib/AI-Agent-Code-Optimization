// FILE: src/fix/fixPlanner.ts
import type { PrioritizedIssue } from "../core/types";

export function selectIssuesForFix(
  issues: PrioritizedIssue[],
): PrioritizedIssue[] {
  return issues
    .filter(
      (i) =>
        i.fix?.canAutoFix === true ||
        i.category === "style" ||
        i.category === "maintainability",
    )
    .slice(0, 10);
}
