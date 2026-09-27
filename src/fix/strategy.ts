// FILE: src/fix/strategy.ts
import type { FixStrategy, Issue } from "../core/types";

export function selectStrategy(issue: Issue): FixStrategy {
  const filePath = issue.location?.filePath;
  if (
    (issue.tool === "lighthouse" || issue.tool === "custom") &&
    (!filePath || filePath === "-")
  ) {
    return "advisory";
  }
  if (issue.fix?.canAutoFix === true) return "mechanical";
  return "local";
}
