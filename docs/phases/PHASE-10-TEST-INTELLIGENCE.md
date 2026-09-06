# Phase 10 — Test intelligence and visual regression

## Objective

Verify changes with the smallest relevant test set and provide visual evidence for UI regressions.

## Planned acceptance criteria

- [ ] Detect Jest, Vitest, Playwright and common React testing configurations.
- [ ] Map source files to related tests and run only relevant tests after a patch.
- [ ] Import coverage data and identify high-risk untested branches and modules.
- [ ] Detect likely flaky tests through controlled repeated execution.
- [ ] Generate reviewable unit-test suggestions for explicitly selected code.
- [ ] Create bounded Playwright journeys for selected routes.
- [ ] Capture before/after screenshots at configurable viewports.
- [ ] Add pixel/structural visual-diff review with configurable thresholds.
- [ ] Block patch acceptance when required tests, runtime checks or visual gates regress.
- [ ] Show a bilingual Test Health score, coverage gaps and verification evidence.

## Out of scope

- Hosted browser farms and mobile-native application testing.

## Verification

- Fixture projects for Jest, Vitest and Playwright.
- Visual baseline, flaky-test and relevant-test selection tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 10 using docs/phases/PHASE-10-TEST-INTELLIGENCE.md`.
