# Phase 12 — Performance and bundle lab

## Objective

Measure route, runtime and bundle performance over time and prevent measurable regressions.

## Planned acceptance criteria

- [x] Run bounded Lighthouse Mobile and Desktop profiles across selected routes.
- [x] Track LCP, CLS, TBT, Speed Index and supporting laboratory metrics per route.
- [x] Import Vite, Webpack, Rollup and esbuild bundle metadata where available.
- [x] Visualize bundle composition, duplicated modules and dependency weight.
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

## 2026-10-05 implementation note

Completed bilingual interactive architecture and bundle exploration in the audit dashboard. Architecture supports module search, cycle filtering, directed edges, keyboard navigation, complete neighbor lists and transitive change impact excluding the selected file. Bundle metadata is discovered from explicit root files with size and path checks, persisted in report JSON and displayed with module weights, shares, multi-chunk filtering and chunk details. Missing or invalid metadata is explicitly identified. Webpack nested modules are counted without their parent container; Vite/Rollup and esbuild module metadata are supported. No third-party graph library is required.

Validation: server and UI TypeScript compilation, production Vite build, 32 Jest suites (239 tests), and 7 Edge browser tests including Persian/English insight fixtures passed.
