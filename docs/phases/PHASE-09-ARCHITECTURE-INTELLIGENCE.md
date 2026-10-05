# Phase 9 — Architecture and dependency intelligence

## Objective

Explain the structure, coupling and technical debt of JavaScript and TypeScript projects.

## Planned acceptance criteria

- [x] Build a TypeScript-aware module, import and export graph.
- [x] Detect circular dependencies with complete cycle paths.
- [x] Detect unused files, exports and direct dependencies with confidence levels.
- [x] Detect oversized modules/components, high coupling and boundary violations.
- [x] Group duplicated logic and distinguish generated or test fixtures from production code.
- [x] Calculate an explainable Technical Debt score.
- [x] Render interactive dependency and architecture graphs in the bilingual UI.
- [x] Calculate blast radius for a file, symbol or proposed patch.
- [x] Generate staged refactoring plans without changing public APIs by default.
- [x] Export architecture findings in JSON, Markdown and SARIF-compatible form where applicable.

## Out of scope

- Runtime distributed tracing and non-JS/TS language graphs.

## Verification

- Fixture repositories covering cycles, barrels, aliases and monorepo packages.
- Graph snapshot and blast-radius tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 9 using docs/phases/PHASE-09-ARCHITECTURE-INTELLIGENCE.md`.

## 2026-09-21 implementation note

The remaining deterministic criteria are implemented in `src/analyzers/architectureRefactoring.ts` (`groupDuplicatedLogic`, `duplicationWindows`, `generateRefactoringPlan`, `findBoundaryViolations`, `analyzeDuplicationFromDisk`, `normalizeDuplicationToken`) on top of the existing `src/analyzers/architecture.ts` module graph, cycle detector and debt score. Covered by `phase9-architecture` tests in `src/tests/finalPhases.test.ts`. The only unchecked criterion is the interactive graph surface in the bilingual UI.

## 2026-10-05 implementation note

Completed bilingual interactive architecture and bundle exploration in the audit dashboard. Architecture supports module search, cycle filtering, directed edges, keyboard navigation, complete neighbor lists and transitive change impact excluding the selected file. Bundle metadata is discovered from explicit root files with size and path checks, persisted in report JSON and displayed with module weights, shares, multi-chunk filtering and chunk details. Missing or invalid metadata is explicitly identified. Webpack nested modules are counted without their parent container; Vite/Rollup and esbuild module metadata are supported. No third-party graph library is required.

Validation: server and UI TypeScript compilation, production Vite build, 32 Jest suites (239 tests), and 7 Edge browser tests including Persian/English insight fixtures passed.
