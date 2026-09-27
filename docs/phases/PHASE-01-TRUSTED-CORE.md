# Phase 1 — Trusted JS/TS core

## Objective

Make audits and automatic fixes safe and repeatable before adding more analyzers.

## Acceptance criteria

- [x] Detect and describe the target JS/TS project before analysis.
- [x] Reject missing, invalid and non-JS/TS project roots with a clear error.
- [x] Recognize common runtimes/frameworks from `package.json` without guessing.
- [x] Reject absolute paths, traversal, symlink escapes, `.git`, `.env`, lockfiles and generated/vendor paths.
- [x] Apply each AI diff to exactly one file and preserve BOM/line-ending style.
- [x] Snapshot every source file before an AI write.
- [x] Roll back the whole fix iteration when verification regresses or fails.
- [x] Re-run ESLint and TypeScript analysis after an applied iteration.
- [x] Keep mechanical, AI-patch and advisory flows distinct in logs/reports.
- [x] Build succeeds and all Jest suites pass.

## Verification

```bash
npm run build
npm test -- --runInBand
```

## Out of scope

- Full Playwright journeys, advanced SEO crawling and dependency auditing (Phase 2).
- Cost budgets and human approval workflows (Phase 3).
- Diff-review UI and history charts (Phase 4).
- Scheduled monitoring and CI gates (Phase 5).

## Implementation notes

- 2026-09-01: Phase started on `codex/local-web-ui`.
- 2026-09-01: Added JS/TS project detection and framework/package-manager profiling.
- 2026-09-01: Added real-path/symlink containment and removed destructive Git checkout fallback.
- 2026-09-01: Added transactional snapshots and iteration rollback after regressive verification.
- 2026-09-01: Added explicit mechanical/AI/advisory counts to report data and Markdown.
- 2026-09-01: Verification passed: TypeScript build plus 10 Jest suites / 87 tests.
