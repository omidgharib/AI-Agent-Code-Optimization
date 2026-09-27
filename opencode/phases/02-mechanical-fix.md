# Phase 2 — Mechanical pre-pass before any LLM

Read `@opencode/AGENTS.md` for hard rules. Implement ONLY this phase.

## Goal

Run bundled ESLint's own autofix first so the LLM never spends tokens on
deterministic fixes. Verify mechanically, mark issues accordingly.

## Tasks

### 1. Autofix entry in the ESLint analyzer

In `src/analyzers/eslint.ts`, add an exported async helper:

```ts
export async function runEslintAutofix(cwd: string): Promise<Issue[]>;
- Use the programmatic `ESLint.lintText/lintFiles` API with `fix: true` (same bundled ESLint v8 as the rest of the module; never npx).
- Write fixes back to disk, respecting `AuditConfig.exclude`.
- Return the list of issues that were autofixed (deterministic IDs as usual).

### 2. Wire the pre-pass into the engine
In `src/core/engine.ts`, inside the `config.fix` branch, BEFORE the agent loop:
- If NOT dry-run: call `runEslintAutofix(repoRoot)`.
- Treat autofixed issues as fixed & verified — do not send them to the LLM.
- If dry-run: skip writing; only report what WOULD be autofixed.

### 3. CLI flag
Add `--no-mechanical` to `<fix>`. Default: mechanical pre-pass ON.
Plumb it through `AuditConfig` (e.g. `mechanicalAutofix: boolean`).

### Tests
- `runEslintAutofix` writes a fix for an autofixable rule and returns the ID.
- Dry-run mode does NOT write files.
- `--no-mechanical` skips the pre-pass.
- Excluded files are never modified.

## Definition of Done
- `npm run build` and `npm test` pass.
- Autofixed issues never reach the LLM path.
- No files outside repoRoot and no protected files are touched.
```
