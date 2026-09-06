# Phase 12 — Performance and bundle lab

## Objective

Measure route, runtime and bundle performance over time and prevent measurable regressions.

## Planned acceptance criteria

- [ ] Run bounded Lighthouse Mobile and Desktop profiles across selected routes.
- [ ] Track LCP, CLS, TBT, Speed Index and supporting laboratory metrics per route.
- [ ] Import Vite, Webpack, Rollup and esbuild bundle metadata where available.
- [ ] Visualize bundle composition, duplicated modules and dependency weight.
- [ ] Detect unused JavaScript/CSS, render blockers, oversized images and request waterfalls.
- [ ] Define global and route-specific performance budgets.
- [ ] Compare metrics and screenshots before and after an approved patch.
- [ ] Add explainable Performance and Bundle scores with trend charts.
- [ ] Fail local/CI Quality Gates on configured performance regressions.
- [ ] Let the Performance agent propose evidence-grounded optimizations.

## Out of scope

- Real-user monitoring collection and third-party production telemetry ingestion.

## Verification

- Repeatable local performance fixture with controlled regressions.
- Bundle-parser and budget-gate tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 12 using docs/phases/PHASE-12-PERFORMANCE-LAB.md`.
