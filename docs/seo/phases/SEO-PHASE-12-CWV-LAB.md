# SEO Phase 12 — Core Web Vitals and Experience Lab

## Objective

Combine lab diagnostics and field experience data without conflating them.

## Acceptance criteria

- [ ] Track LCP, INP and CLS as Core Web Vitals and TTFB, FCP, TBT and Speed Index as supporting diagnostics.
- [ ] Display lab and field data separately with sample period, percentile, device and source.
- [ ] Run bounded Lighthouse mobile/desktop profiles across selected routes.
- [ ] Capture waterfalls, long tasks, render blockers, unused JS/CSS, image and font evidence.
- [ ] Define global, template, route and campaign performance budgets.
- [ ] Compare before/after metrics and screenshots for approved changes.
- [ ] Fail quality gates on configured regressions while accounting for measurement variance.
- [ ] Map likely regressions to bundles, source owners and affected campaigns.

## Verification

- Controlled performance fixture, variance, budget, lab/field and regression tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 12 using `docs/seo/phases/SEO-PHASE-12-CWV-LAB.md`.

## Implementation notes

- 2026-09-03: Added separate lab/field CWV and supporting metrics, budgets, before/after comparison and variance-aware gates. Waterfall/source-owner mapping remains unchecked.
