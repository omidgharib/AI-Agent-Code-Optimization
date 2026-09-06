# Phase 1 — Introduce the FixStrategy model

You are executing Phase 1 of the ai-auditor redesign. Read `@opencode/AGENTS.md`
for hard rules. Implement ONLY this phase; do not touch phase 2–4 concerns.

## Goal

Introduce a first-class strategy concept into the fix subsystem and the shared
types, so later phases can dispatch per strategy.

## Tasks

### 1. Add `FixStrategy` to shared types

In `src/core/types.ts`, add:

```ts
export type FixStrategy =
  | "mechanical"    // eslint --fix, no LLM, deterministic verify
  | "local"         // LLM, single file, small context
  | "cross-file"    // LLM, multiple files, needs care/approval
  | "advisory";     // lighthouse et al., recommendations only, NO diff
Add an optional `strategy?: FixStrategy` field to the `Issue.fix` shape.

### 2. Add a pure dispatcher
Create `src/fix/strategy.ts` exporting:

ts
export function selectStrategy(issue: Issue): FixStrategy;
Rules:
- Lighthouse/custom findings with no meaningful source location → advisory.
- Issues with `fix.canAutoFix === true` (an eslint autofix rule) → mechanical.
- Everything else → local. Leave cross-file resolution to a later phase; for now local must degrade safely when context spans multiple files.

### 3. Group issues by strategy
Update `selectIssuesForFix` in `src/fix/fixPlanner.ts` so it no longer returns a flat list. Return grouped output:

ts
export interface PlannedFix {
  strategy: FixStrategy;
  issues: PrioritizedIssue[];
}
Keep the existing exported function name stable, change its return contract intentionally and update the call site in `src/core/engine.ts`.

### 4. Tests
Add tests in `tests/fixPlanner.test.ts` (or your test layout):
- eslint autofix rule → mechanical
- tsc diagnostic with a single file/line → local
- lighthouse issue with no file → advisory
- grouping returns separable strategy buckets

## Definition of Done
- `npm run build` and `npm test` pass.
- `selectStrategy` is pure, deterministic, covered by tests.
- No behavior regression in normalize / prioritize / report.

```
