// FILE: src/fix/fixPlanner.ts
import type { FixStrategy, PrioritizedIssue } from "../core/types";
import { selectStrategy } from "./strategy";

export interface PlannedFix {
  strategy: FixStrategy;
  issues: PrioritizedIssue[];
}

export function selectIssuesForFix(
  issues: PrioritizedIssue[],
): PlannedFix[] {
  const selected = issues
    .filter(
      (i) =>
        i.fix?.canAutoFix === true ||
        i.category === "style" ||
        i.category === "maintainability",
    )
    .slice(0, 10);

  const buckets = new Map<FixStrategy, PrioritizedIssue[]>();
  for (const issue of selected) {
    const strategy = selectStrategy(issue);
    const bucket = buckets.get(strategy);
    if (bucket) bucket.push(issue);
    else buckets.set(strategy, [issue]);
  }

  return [...buckets.entries()].map(([strategy, issues]) => ({
    strategy,
    issues,
  }));
}
