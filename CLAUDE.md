# CLAUDE.md — ai-auditor Agent Instructions

> **Legacy architecture guidance:** commands may remain useful, but architecture/type claims can be stale. The [Enterprise Roadmap](docs/enterprise/ROADMAP.md), [E00 baseline](docs/enterprise/phases/E00-PRODUCT-BOUNDARIES.md), ADRs, and current code are authoritative.

## Purpose

ai-auditor is a TypeScript CLI for auditing source code and generating actionable findings.

Supports:

- Static analysis with bundled ESLint and the TypeScript compiler
- Lighthouse performance and SEO audits when a target URL is provided
- Issue normalization, deduplication, and prioritization
- Optional LLM-assisted auto-fixes using unified diffs
- JSON and Markdown reports

For full system design, directory layout, shared data contracts, and pipeline details, see `ARCHITECTURE.md`.

---

## Essential Commands

```bash
npm run build
npm test
```

---

## Verification Rules

After changing TypeScript source files:
bash
npm run build

After changing behavior, business logic, issue mapping, scoring, report output, or diff application:
bash
npm test

Before completing any coding task:
bash
npm run build && npm test

If a command fails, investigate and report the failure. Do not claim verification succeeded when it did not.

---

## Runtime and Module Rules

- Requires Node.js 20 LTS or newer.
- This project uses ESM-compatible TypeScript imports.
- Keep `.js` extensions in TypeScript import specifiers where they are already used.

ts
import { normalize } from "../normalize/normalizer.js";
import type { Issue } from "../core/types.js";

---

## Build Constraint: CLI Shebang

The build process injects the CLI shebang after TypeScript compilation via `npm run build`.

Do **not** add this line to `src/cli/index.ts`:
ts
#!/usr/bin/env node
Adding it causes TypeScript error `TS18026`.

---

## Change Scope and Refactoring Rules

- Prefer minimal, focused changes over broad rewrites.
- Preserve existing behavior unless the task explicitly requires behavior changes.
- Do not rename exported functions, public types, CLI flags, report fields, or file locations unless explicitly requested.
- Large refactors require user approval before implementation.
- Do not perform unrelated cleanup while working on a focused task.
- Keep architecture documentation aligned with intentional architectural changes.

---

## Dependency Policy

New dependencies are allowed only when necessary. Before adding one:

- Confirm that built-in Node.js APIs or existing dependencies cannot reasonably solve the problem.
- Explain why the dependency is needed.
- Describe its impact on bundle size, installation, runtime behavior, or maintenance.
- Update the relevant tests and documentation.

Do not require the target repository being audited to install tools globally or locally for analyzers to work.

- ESLint must remain bundled with ai-auditor.
- Do not execute ESLint through `npx`.
- Do not rely on a globally installed ESLint binary in the audited project.

---

## Public Contracts

Canonical shared types are defined in `src/core/types.ts`.

Do not change these contracts casually:

- `Severity`
- `Category`
- `Issue`
- `PrioritizedIssue`
- `FixResponse`
- `AuditConfig`

See `ARCHITECTURE.md` for their definitions and expectations.

### Issue Identity

Every issue ID must be deterministic and use SHA-256 over:

tool + rule + file + line + message
Do not use random IDs, timestamps, counters, or non-deterministic values for `Issue.id`.

### Required Export Names

| Export               | File                           |
| -------------------- | ------------------------------ |
| `runEslint`          | `src/analyzers/eslint.ts`      |
| `runTsc`             | `src/analyzers/tsc.ts`         |
| `runPlaywright`      | `src/analyzers/playwright.ts`  |
| `runLighthouse`      | `src/analyzers/lighthouse.ts`  |
| `normalize`          | `src/normalize/normalizer.ts`  |
| `prioritize`         | `src/prioritize/prioritize.ts` |
| `buildContext`       | `src/fix/contextBuilder.ts`    |
| `selectIssuesForFix` | `src/fix/fixPlanner.ts`        |
| `requestFix`         | `src/fix/llmClient.ts`         |
| `applyDiff`          | `src/fix/diffApplier.ts`       |
| `writeReport`        | `src/report/report.ts`         |

Do not introduce naming variations such as `eslintRunner`, `runTypeScript`, `applyPatch`, or `generateReport`.

---

## Analyzer Rules

### General Analyzer Contract

Analyzer modules must return normalized issues:
ts
Promise<Issue[]>
Each analyzer is responsible for converting its raw tool output into the shared `Issue` shape.

When adding an analyzer, follow the workflow in `ARCHITECTURE.md`.

### ESLint

Use the bundled ESLint v8 API:
ts
new ESLint({ ... } as ConstructorParameters<typeof ESLint>[0]);

Never run ESLint with:
ts
execa("npx", ["eslint", ...]);
or any equivalent shell command.

### Lighthouse

- Run Lighthouse only when `config.url` is provided.
- Lighthouse is included in the initial audit analysis.
- Lighthouse must be skipped during re-analysis inside the auto-fix loop.

Required fix-loop behavior:
ts
// Initial analysis: Lighthouse may run.
const issues = await analyze(repoRoot, config.url);

// Re-analysis after applying fixes: Lighthouse must be skipped.
const next = await analyze(repoRoot, config.url, false);

### Playwright

`runPlaywright` is currently a roadmap feature.

- Do not assume Playwright analysis is already available.
- If implementing it, preserve the exact required export name.
- Add tests and register it in the engine.
- Do not make Playwright a mandatory dependency of audited repositories.

---

## Auto-Fix Safety Rules

Auto-fixes are security-sensitive. Follow these rules strictly.

### Diff Requirements

- The LLM must return a valid unified diff.
- Validate diffs before applying them.
- Reject malformed, ambiguous, or unsafe diffs.
- Do not apply free-form code responses as file edits.

### Path Safety

`applyDiff` must never create, modify, delete, or move files outside `repoRoot`.

Reject paths that:

- Resolve outside `repoRoot`
- Use path traversal such as `../`
- Target `.git/` content
- Are absolute paths outside the repository

### Protected Files

Do not modify the following without explicit user approval:

- `.env` files
- Private keys, certificates, tokens, or credential files
- Lockfiles: `package-lock.json`, `npm-shrinkwrap.json`, `yarn.lock`, `pnpm-lock.yaml`
- Git internals under `.git/`
- CI secrets or deployment credentials

### Dry Run

When `dryRun` is enabled:

- Do not write to the filesystem.
- Do not modify source files.
- Do not modify reports in a way that implies fixes were applied.
- You may generate, validate, and display a proposed diff.

---

## Fix Loop Rules

Expected flow:

Analyze
→ Normalize
→ Prioritize
→ Select fixable issues
→ Build context
→ Request unified diff from LLM
→ Validate and apply diff
→ Re-analyze without Lighthouse
→ Repeat until complete or maxFixIterations is reached
→ Write reports

Rules:

- Respect `maxFixIterations`.
- Stop when no eligible fixable issues remain.
- Skip Lighthouse during fix-loop re-analysis.
- Do not report an issue as fixed unless re-analysis verifies that it is gone or changed as expected.
- Preserve non-fixable issues in final reports.

---

## Reports

Reports are written to `ai-auditor-report/`.

Supported outputs:

- `ai-auditor-report/report.json`
- `ai-auditor-report/report.md`

Rules:

- Generate report formats selected through CLI flags.
- If neither JSON nor Markdown is explicitly selected, generate both formats.
- Each generated report must be recreated on every audit run like a history.
- Keep JSON output machine-readable and stable.
- Keep Markdown output readable and useful for humans.
- Do not change report schema or field names without explicit approval and corresponding test/documentation updates.

---

## Testing Rules

Use Node's built-in test runner:
bash
npm test

Test import paths must use `.js` extensions:
ts

```
// src/tests/*.test.ts
import { normalize } from "../normalize/normalizer.js";
import type { Issue } from "../core/types.js";

// tests/*.test.ts
import { prioritize } from "../src/prioritize/prioritize.js";
import { applyDiff } from "../src/fix/diffApplier.js";
```

Add or update tests when changing:

- Issue normalization or deduplication
- Issue priority scoring
- Diff validation or application
- Analyzer output mapping
- Report structure or report generation behavior
- Fix-loop behavior

---

## Documentation Maintenance

Update `ARCHITECTURE.md` when changing:

- Directory structure
- Pipeline stages
- Shared types
- Analyzer contracts
- Report behavior
- Auto-fix safety model
- Major architectural decisions
