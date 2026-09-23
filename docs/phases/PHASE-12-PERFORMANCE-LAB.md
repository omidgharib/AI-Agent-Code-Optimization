# Phase 12 — Performance and bundle lab

## Objective

Measure route, runtime and bundle performance over time and prevent measurable regressions.

## Planned acceptance criteria

- [x] Run bounded Lighthouse Mobile and Desktop profiles across selected routes.
- [x] Track LCP, CLS, TBT, Speed Index and supporting laboratory metrics per route.
- [x] Import Vite, Webpack, Rollup and esbuild bundle metadata where available.
- [ ] Visualize bundle composition, duplicated modules and dependency weight.
- [x] Detect unused JavaScript/CSS, render blockers, oversized images and request waterfalls.
- [x] Define global and route-specific performance budgets.
- [x] Compare metrics and screenshots before and after an approved patch.
- [x] Add explainable Performance and Bundle scores with trend charts.
- [x] Fail local/CI Quality Gates on configured performance regressions.
- [x] Let the Performance agent propose evidence-grounded optimizations.

## Out of scope

- Real-user monitoring collection and third-party production telemetry ingestion.

## Verification

- Repeatable local performance fixture with controlled regressions.
- Bundle-parser and budget-gate tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 12 using docs/phases/PHASE-12-PERFORMANCE-LAB.md`.

## 2026-09-21 implementation note

`src/analyzers/performanceLab.ts` adds unreferenced asset detection (`detectUnusedAssets`), oversized image flags (`detectOversizedImages`), before/after comparison with regression collection (`comparePerformanceBeforeAfter`) and evidence-grounded remediation proposals (`performanceRemediations`), alongside the existing bundle parser, budget evaluator and Lighthouse metric extraction. Covered by Phase 12 tests in `src/tests/finalPhases.test.ts` and `advancedPhases.test.ts`. The unchecked criterion is the interactive bundle/trend visualization in the bilingual UI.
