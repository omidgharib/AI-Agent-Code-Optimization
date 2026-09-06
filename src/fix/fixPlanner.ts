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

/** True when the issue has no usable file target but belongs to a tool whose
 * findings can still be addressed advisory-style (Lighthouse / custom URL- or
 * server-level audits). These are handled as recommendations, not diffs —
 * protected/generated paths above still name a real file and stay excluded. */
function isAdvisoryTarget(issue: PrioritizedIssue): boolean {
  const filePath = issue.location?.filePath;
  if (filePath && filePath !== "-") return false;
  return issue.tool === "lighthouse" || issue.tool === "custom";
}

/** Categories the LLM is allowed to handle (diffs for files, or
 * recommendations for advisory). Bug/security-to-file/seo/a11y are handled by
 * other analyzers or are not auto-fixable by design. */
function passesLLMFilter(issue: PrioritizedIssue): boolean {
  return (
    issue.fix?.canAutoFix === true ||
    issue.category === "style" ||
    issue.category === "maintainability" ||
    issue.category === "security" ||
    issue.category === "performance"
  );
}

export function selectIssuesForFix(
  issues: PrioritizedIssue[],
  limit = 10,
): PlannedFix[] {
  // Diff-based fix pool: only issues that map to a real file the tool is
  // allowed to edit. Advisory (no-file) Lighthouse/custom issues stay out of
  // this loop — they have no diff target and are handled by
  // selectAdvisoryIssues instead.
  const selected = issues
    .filter(passesLLMFilter)
    .filter(hasFixableTarget)
    .slice(0, limit);

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

/** Advisory candidates: allowed categories with no editable file target
 * (Lighthouse / custom URL-level audits). Returned unsliced so the engine can
 * batch them across multiple LLM calls until every issue is covered. */
export function selectAdvisoryIssues(
  issues: PrioritizedIssue[],
): PrioritizedIssue[] {
  return issues.filter(passesLLMFilter).filter(isAdvisoryTarget);
}
