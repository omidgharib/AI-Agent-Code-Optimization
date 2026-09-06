# E04 - Production-Grade Code Audit

## Objective

Turn the existing analyzer and AI-fix loop into a deterministic, policy-controlled Code Audit product suitable for CI and reviewed repository changes.

## Code Audit workflow

```text
Detect -> Plan -> Analyze -> Normalize -> Correlate -> Prioritize
       -> Propose -> Policy check -> Preview -> Approve
       -> Snapshot -> Apply -> Verify -> Report -> Optional rollback
```

## Analyzer execution

- Build an analyzer manifest with ID, version, supported ecosystems, required files, timeout and resource profile.
- Pin bundled ESLint and TypeScript behavior to the AI Auditor release.
- Resolve package manager and workspace topology without executing project scripts.
- Support npm, pnpm, Yarn and monorepo workspace boundaries explicitly.
- Make dependency audit data-source and freshness metadata visible.
- Capture stdout, stderr, exit code and truncation as structured evidence.
- Distinguish analyzer unavailable, not applicable, timed out and failed.

## Finding correlation

- Define stable fingerprints independent of message wording.
- Preserve analyzer-native rule ID and raw evidence.
- Deduplicate only findings proven to describe the same asset and condition.
- Track introduced, resolved, recurring, suppressed and accepted-risk states.
- Map findings to code owners, packages, changed files and related tests.
- Version normalization and severity-mapping rules.

## Fix pipeline

- Separate mechanical fixes from model proposals.
- Require a clean preview artifact for every patch.
- Add per-patch approval and rejection reasons.
- Check file ownership, protected paths and change budgets.
- Capture pre-apply hashes and an immutable snapshot.
- Detect concurrent modifications before applying.
- Run targeted analyzers and related tests first, then configured global gates.
- Record verification deltas and roll back any regression.

## CLI and CI surface

- `ai-auditor code scan <path>` for read-only analysis.
- `ai-auditor code fix <path> --preview` for proposals only.
- `ai-auditor code apply <run-id> --patch <id>` for explicit approval.
- `ai-auditor code verify <run-id>` for repeatable verification.
- Machine-readable JSON/SARIF output and stable exit codes.
- Baseline mode that fails CI only on new policy violations.
- Changed-files mode with explicit reporting of checks skipped by scope.

## Implementation tasks

- [x] Extract code orchestration from `src/core/engine.ts`.
- [x] Create analyzer manifest and runner ports.
- [x] Replace `npx tsc` with a deterministic resolution policy.
- [x] Add workspace/package graph detection.
- [x] Implement stable finding lifecycle and baseline storage.
- [x] Add protected-file and concurrent-change checks to apply.
- [x] Integrate `verifyRelevantTests` into the primary engine, not only web apply.
- [x] Add CI annotations for GitHub and GitLab without requiring write access.
- [x] Add policy-as-code configuration with schema and versioning.
- [x] Remove compiled test files from production `dist` output.

## Tests

- Broken npm/pnpm/Yarn monorepo fixtures.
- Analyzer timeout, malformed output and unavailable-tool fixtures.
- Stable fingerprint and deduplication tests.
- Patch traversal, stale source, partial apply and rollback tests.
- Baseline and changed-files CI tests.
- Windows/Linux path and line-ending tests.

## Acceptance criteria

- [x] Read-only scan never mutates the repository.
- [x] The same repository and toolchain produce stable finding fingerprints.
- [x] No patch applies without recorded actor approval and current source hashes.
- [x] Verification failure restores exact original bytes.
- [x] CI can fail only on new findings relative to an approved baseline.
- [x] Analyzer failure cannot be reported as a clean result.
- [x] Reports identify every skipped or unavailable check.

## Operational targets

- Repository with 100,000 source files completes within a documented hardware budget.
- Worker memory and output are bounded for every analyzer.
- Cancellation reaches a terminal state within 10 seconds after the current non-interruptible operation.
