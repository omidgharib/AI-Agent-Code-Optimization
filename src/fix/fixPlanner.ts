// FILE: src/fix/fixPlanner.ts
import type { FixStrategy, PrioritizedIssue } from "../core/types";
import { selectStrategy } from "./strategy";

export interface PlannedFix {
  strategy: FixStrategy;
  issues: PrioritizedIssue[];
}

// Files the fix loop must never invite the LLM to edit, mirroring the
// protected / generated sets enforced at apply time (diffApplier.ts).
const SKIP_PATH_RE =
  /(^|\/)(\.git\/|\.env($|\.)|package-lock\.json|yarn\.lock|pnpm-lock\.yaml|npm-shrinkwrap\.json|bun\.lockb|[^/]*\.lock$)/i;
const GENERATED_DIR_RE =
  /^(\.git|node_modules|dist|build|out|coverage|dev-dist|vendor)\//;

// The tool's own lint/build config files are not safe for the LLM to rewrite:
// an "ESLint failed to run / parsing error" targeting them is usually an
// analyzer-side config issue, not a code defect worth auto-editing.
const CONFIG_RE =
  /(^|\/)(\.eslintrc(\.[a-z]+)?|eslint\.config(\.[a-z]+)?|\.babelrc(\.[a-z]+)?|babel\.config(\.[a-z]+)?|tsconfig(\.[a-z]+)?\.json|\.prettierrc(\.[a-z]+)?|prettier\.config(\.[a-z]+)?|vite\.config(\.[a-z]+)?|webpack\.config(\.[a-z]+)?|package\.json)$/;

/** True when the issue points at a concrete, editable source file. */
function hasFixableTarget(issue: PrioritizedIssue): boolean {
  const filePath = issue.location?.filePath;
  if (!filePath || filePath === "-") return false;
  const posix = filePath.replace(/\\/g, "/");
  if (SKIP_PATH_RE.test(posix)) return false;
  if (GENERATED_DIR_RE.test(posix)) return false;
  if (CONFIG_RE.test(posix)) return false;
  return true;
}

export function selectIssuesForFix(issues: PrioritizedIssue[]): PlannedFix[] {
  const selected = issues
    .filter(
      (i) =>
        i.fix?.canAutoFix === true ||
        i.category === "style" ||
        i.category === "maintainability" ||
        i.category === "security" ||
        i.category === "performance",
    )
    // Only issues that map to a real file the tool is allowed to edit. Without
    // this, Lighthouse `-` targets and generated/protected files get handed to
    // the LLM, which then fabricates diffs that can never be applied.
    .filter(hasFixableTarget)
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
