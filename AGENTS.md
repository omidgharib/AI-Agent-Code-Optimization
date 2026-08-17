# AGENTS.md

TypeScript CLI (`ai-auditor`) that audits a target repo with bundled ESLint and `tsc`, optionally Lighthouse, and an LLM auto-fix loop that applies validated unified diffs. Reports go to `ai-auditor-report/`.

## Commands

- `npm run build` — compiles with `tsc`, then injects `#!/usr/bin/env node` into `dist/cli/index.js`. Do **not** add the shebang to `src/cli/index.ts` (causes TS18026).
- `npm test` — runs Jest (7 suites: `src/tests/*.test.ts` + `src/tests/models.test.ts`). Config is `jest.config.js` (plain CJS, `ts-jest/presets/default-esm`). Do **not** recreate `jest.config.ts` or you'll need `ts-node`.
- `npm start` — runs the built CLI.
- No lint script exists.

## Docs vs. code (high signal)

`CLAUDE.md` and `ARCHITECTURE.md` describe an idealized design that has drifted from the code. Trust the code; docs are stale on:

- Types (`src/core/types.ts`): `Issue` uses `ruleId` / `location` / `evidence` / `meta` (not `rule`/`file`/`line`). `FixResponse` is `{ patches: [{description, unifiedDiff, touches}], notes }`. `AuditConfig` has `path` (not `repoRoot`) plus `provider` / `keyRequired`, and `url`/`html` are wired through `buildConfig` and the CLI. `Issue.fix` carries `canAutoFix`, `hint`, `strategy`; `FixStrategy` is `mechanical|local|cross-file|advisory`.
- Tests are **Jest** (`describe`/`it`/`expect` in `src/tests/*.test.ts`), not Node's built-in runner.
- Imports are **extensionless** (`../core/types`), despite docs requiring `.js`; only `src/report/_report.ts` uses `.js`. tsconfig compiles CommonJS.
- Reports: `src/report/report.ts` writes into a timestamped subdir `ai-auditor-report/<timestamp>/report.{json,md,html}`. `src/report/_report.ts` is a stale duplicate (writes directly to `ai-auditor-report/`) — don't edit it.
- `ai-auditor-report/` is committed and not gitignored (`.gitignore` only covers `node_modules/` and `dist/`).

## Known bugs / quirks

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
- Env vars: `OPENAI_API_KEY`, `AI_AUDITOR_BASE_URL`, `AI_AUDITOR_MODEL`, `AI_AUDITOR_PROVIDER`, `AI_AUDITOR_REQUEST_TIMEOUT_MS` (per-request fetch timeout, default 120s), plus per-provider keys (`OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `MISTRAL_API_KEY`, `CEREBRAS_API_KEY`, `DEEPSEEK_API_KEY`, `ZHIPU_API_KEY`, `DASHSCOPE_API_KEY`, `CF_API_TOKEN`/`CF_ACCOUNT_ID`/`CF_GATEWAY_SLUG`). Model/provider resolution lives in `src/core/models.ts` (`resolveModel`, `MODEL_PROVIDERS`, `buildChatUrl`, `listModels`). Exit codes: `0` no issues, `1` issues found, `2` error or missing API key for `--fix`.
- CLI flags: `--debug` enables `logger.trace` (full cause chains, request URLs, retry detail); `--verbose` enables `logger.debug`. `--fix` runs a two-layer endpoint preflight (`diagnoseEndpoint` in `src/fix/llmClient.ts`): a 2s TCP probe aborts the run (exit code `2`) only when nothing is listening; a 4s `GET /v1/models` probe that times out or errors merely warns (server listening but unresponsive, e.g. waiting on upstream/login) and the run proceeds. Request timeouts are not retried (endpoint won't recover in ~1s), connection errors and 5xx/429 are. Fetch error diagnosis (walking undici's `error.cause` chain) lives in `src/core/errorDiagnosis.ts` (`describeNetworkError`, `isTimeoutLike`) — Node's `TypeError: fetch failed` hides the real reason (ECONNREFUSED, timeout, TLS, ...) inside the cause chain.