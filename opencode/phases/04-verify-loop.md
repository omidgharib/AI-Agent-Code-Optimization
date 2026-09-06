# Phase 4 — ID-based verification loop + advisory in reports

Read `@opencode/AGENTS.md` for hard rules. Implement ONLY this phase.

## Goal

Make the fix loop trustworthy: verify improvement by issue ID (not raw
counts), and surface advisory (lighthouse) recommendations separately from
applied/verified fixes.

## Tasks

### 1. ID-based progress

Replace the faulty check in `src/core/engine.ts`:

```ts
if (newPrioritized.length >= prioritized.length) { ... }
with a set-diff on deterministic IDs:

ts
const resolved  = beforeIds.difference(afterIds);
const regressed = afterIds.difference(beforeIds);
const remaining = afterIds.intersection(beforeIds);
- Loop continues while `resolved.size > 0` OR new eligible issues remain, capped by `maxFixIterations`.
- Log resolved / remaining / regressed per iteration.

### 2. Advisory routing
Ensure lighthouse/advisory issues never produce a diff. They must:
- Appear in reports under a clearly separated status (applied-verified vs proposed vs advisory).
- Optionally carry a recommendation string instead of a patch.

### 3. Report schema
Extend `writeReport` output to include per-issue `fixStatus`:
`"applied-verified" | "proposed" | "advisory" | "unfixed"`.
JSON and Markdown must both reflect it. Keep existing top-level fields intact.

### 4. Dry-run clarity
Dry-run reports must label everything as proposed; nothing may be stamped applied-verified.

### Tests
- After a fix, an ID comparison detects a resolution even if total count stayed the same (guards the classic regression bug).
- Regression detection: a new issue appearing cancels “no improvement” false positives when `resolved > 0`.
- Advisory issues never reach the diff path.
- Report JSON contains `fixStatus`; dry-run always proposed.

## Definition of Done
- `npm run build` and `npm test` pass.
- Fix loop is driven by ID set-diff, count is gone.
- Report clearly separates advisory from applied fixes.
```
