# Phase 9 — Architecture and dependency intelligence

## Objective

Explain the structure, coupling and technical debt of JavaScript and TypeScript projects.

## Planned acceptance criteria

- [ ] Build a TypeScript-aware module, import and export graph.
- [ ] Detect circular dependencies with complete cycle paths.
- [ ] Detect unused files, exports and direct dependencies with confidence levels.
- [ ] Detect oversized modules/components, high coupling and boundary violations.
- [ ] Group duplicated logic and distinguish generated or test fixtures from production code.
- [ ] Calculate an explainable Technical Debt score.
- [ ] Render interactive dependency and architecture graphs in the bilingual UI.
- [ ] Calculate blast radius for a file, symbol or proposed patch.
- [ ] Generate staged refactoring plans without changing public APIs by default.
- [ ] Export architecture findings in JSON, Markdown and SARIF-compatible form where applicable.

## Out of scope

- Runtime distributed tracing and non-JS/TS language graphs.

## Verification

- Fixture repositories covering cycles, barrels, aliases and monorepo packages.
- Graph snapshot and blast-radius tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 9 using docs/phases/PHASE-09-ARCHITECTURE-INTELLIGENCE.md`.
