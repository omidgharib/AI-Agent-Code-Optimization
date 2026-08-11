# AGENTS.md

TypeScript CLI (`ai-auditor`) that audits a target repo with bundled ESLint and `tsc`, optionally Lighthouse, and an LLM auto-fix loop that applies validated unified diffs. Reports go to `ai-auditor-report/`.

## Commands

- `npm run build` — compiles with `tsc`, then injects `#!/usr/bin/env node` into `dist/cli/index.js`. Do **not** add the shebang to `src/cli/index.ts` (causes TS18026).
- `npm test` — runs Jest (2 suites: `src/tests/{normalizer,prioritize}.test.ts`). Config is `jest.config.js` (plain CJS, `ts-jest/presets/default-esm`). Do **not** recreate `jest.config.ts` or you'll need `ts-node`.
- `npm start` — runs the built CLI.
- No lint script exists.

## Docs vs. code (high signal)

`CLAUDE.md` and `ARCHITECTURE.md` describe an idealized design that has drifted from the code. Trust the code; docs are stale on:

- Types (`src/core/types.ts`): `Issue` uses `ruleId` / `location` / `evidence` / `meta` (not `rule`/`file`/`line`). `FixResponse` is `{ patches: [{description, unifiedDiff, touches}], notes }`. `AuditConfig` has `path` (not `repoRoot`) and no `url` field.
- Tests are **Jest** (`describe`/`it`/`expect` in `src/tests/*.test.ts`), not Node's built-in runner.
- Imports are **extensionless** (`../core/types`), despite docs requiring `.js`; only `src/report/_report.ts` uses `.js`. tsconfig compiles CommonJS.
- Reports: `src/report/report.ts` writes into a timestamped subdir `ai-auditor-report/<timestamp>/report.{json,md,html}`. `src/report/_report.ts` is a stale duplicate (writes directly to `ai-auditor-report/`) — don't edit it.
- `ai-auditor-report/` is committed and not gitignored (`.gitignore` only covers `node_modules/` and `dist/`).

## Known bugs / quirks

- `--url` and `--html` CLI flags are parsed in `src/cli/index.ts` but never wired into `buildConfig`/`AuditConfig`. The engine passes `config.baseUrl` (the LLM base URL) to `runLighthouse`, so Lighthouse can't actually run correctly via the CLI.
- `package.json` `bin` points at `./dist/cli/index.ts`, but the built exec with shebang is `dist/cli/index.js` — `npm link` does not produce a working `ai-auditor` command.
- `src/fix/diffApplier.ts` does **not** implement the path-safety model in `ARCHITECTURE.md`: no `repoRoot` containment check, no protection for `.git/`, `.env`, or lockfiles. A `../` diff could escape the repo. Don't assume those rules are enforced.
- `src/analyzers/tsc.ts` shells out to `npx tsc` in the target repo, contradicting the "bundled tools only" principle (ESLint is the only bundled analyzer).
- `src/analyzers/playwright.ts` `runPlaywright` is a stub that always returns `[]`.
- `src/verify/verify.ts` is unused (not imported by the engine).
- `tsconfig.json` `exclude` lists `tests`, but tests live under `src/tests/`, and `include` is `src/**/*` — so `src/tests/*.test.ts` ARE compiled into `dist/`.
- `src/report/summary.ts` declares `LighthouseReport`/`LighthouseAudit` types, but `report.ts`/`html.ts`/`markdown.ts` never populate or render `data.lighthouse` — the LHR UI is unimplemented scaffolding.

## Conventions

- Many files start with a literal `// FILE: <path>` header; it's a marker, not a requirement.
- Required exports: `runEslint`, `runTsc`, `runLighthouse`, `runPlaywright`, `normalize`, `prioritize`, `buildContext`, `selectIssuesForFix`, `requestFix`, `applyDiff`, `writeReport`. Don't rename them.
- Issue IDs are deterministic SHA-256 (first 16 hex chars) over tool/rule/path/line/message — never random.
- Env vars (read in `src/core/config.ts`): `OPENAI_API_KEY`, `AI_AUDITOR_BASE_URL`, `AI_AUDITOR_MODEL`. Exit codes: `0` no issues, `1` issues found, `2` error or missing API key for `--fix`.