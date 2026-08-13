# Phase 3 — Replace requestFix with an agent session

Read `@opencode/AGENTS.md` for hard rules. Implement ONLY this phase.

## Goal

Replace the single-shot `requestFix` with a tool-calling agent loop
(`runFixSession`) that can read files, build context, propose a diff through the
safe applier, and re-analyze a file to self-verify before the engine globally
re-checks.

## Tasks

### 1. New module `src/fix/agentSession.ts`

Export:

```ts
export interface FixSessionResult {
  issues: Map<string, "fixed" | "failed" | "skipped">; // keyed by issue ID
  patches: FixResponse["patches"];
}

export async function runFixSession(
  planned: PlannedFix[],
  config: FixSessionConfig, // model, baseUrl, apiKey, dryRun, repoRoot
): Promise<FixSessionResult>;

### 2. Agent tool surface
Expose FOUR tools to the model, each backed by existing secure modules:

| Tool | Backing | Notes |
| :--- | :--- | :--- |
| `read_file` | fs within repoRoot | path-gated, returns range |
| `get_context` | buildContext | per-issue PER FILE (not all-at-once) |
| `apply_patch` | applyDiff | ONLY write path; dry-run aware |
| `run_analyzer` | eslint.ts/tsc.ts | scope = single file for self-verify |

- Implement the loop with the SDK available for `baseUrl` (OpenAI-compatible tool calling), or a minimal OpenAI-compatible tool-loop if no SDK fits.
- Stop conditions: all targeted issues verified, agent declares give-up, or per-session iteration cap reached.

### 3. Per-file sessions
Call `runFixSession` once per FILE (not per all-issues batch). Group issues by their file; sort so mechanical (already removed in phase 2) and high severity go first. Context per file stays small.

### 4. Plumb into engine
In `src/core/engine.ts`, replace the `requestFix` block with:
ts
const sessionResult = await runFixSession(plannedGroups, { ...config });
Keep collecting `sessionResult.patches` into `allPatches`.

### 5. Deprecate old path
Keep `requestFix` exported for backward-compat but stop using it in the engine. Mark it `@deprecated`.

### Tests
- Agent respects `apply_patch` safety (path traversal / protected files) via the existing diffApplier guard — prove no alternate write path exists.
- Dry-run: session may READ and PROPOSE but never writes.
- Session stops when its own `run_analyzer`(scope=file) verifies a fix.
- Per-file grouping keeps context below a configured budget.

## Definition of Done
- `npm run build` and `npm test` pass.
- The only way the agent writes to disk is through `applyDiff`.
- No all-issues one-shot LLM call remains in the engine.
```
