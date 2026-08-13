// FILE: src/fix/strategy.ts
import type { FixStrategy, Issue } from "../core/types";

export function selectStrategy(issue: Issue): FixStrategy {
  if (
    (issue.tool === "lighthouse" || issue.tool === "custom") &&
    !issue.location?.filePath
  ) {
    return "advisory";
  }
  if (issue.fix?.canAutoFix === true) return "mechanical";
  return "local";
}
