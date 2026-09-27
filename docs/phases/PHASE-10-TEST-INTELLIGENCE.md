# Phase 10 — Test intelligence and visual regression

## Objective

Verify changes with the smallest relevant test set and provide visual evidence for UI regressions.

## Planned acceptance criteria

- [x] Detect Jest, Vitest, Playwright and common React testing configurations.
- [x] Map source files to related tests and run only relevant tests after a patch.
- [x] Import coverage data and identify high-risk untested branches and modules.
- [x] Detect likely flaky tests through controlled repeated execution.
- [x] Generate reviewable unit-test suggestions for explicitly selected code.
- [x] Create bounded Playwright journeys for selected routes.
- [x] Capture before/after screenshots at configurable viewports.
- [x] Add pixel/structural visual-diff review with configurable thresholds.
- [x] Block patch acceptance when required tests, runtime checks or visual gates regress.
- [x] Show a bilingual Test Health score, coverage gaps and verification evidence.

## Out of scope

- Hosted browser farms and mobile-native application testing.

## Verification

- Fixture projects for Jest, Vitest and Playwright.
- Visual baseline, flaky-test and relevant-test selection tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 10 using docs/phases/PHASE-10-TEST-INTELLIGENCE.md`.

## 2026-09-21 implementation note

`src/verify/visualRegression.ts` adds screenshots at configurable viewports (`captureScreenshots`, Playwright PNG decoder) and pixel/structural diff review with thresholds (`diffFrames`, `regressionGate`, `sampleFrame`). `src/verify/testIntelligence.ts` adds reviewable unit-test suggestions (`suggestUnitTests`) and bounded Playwright journeys (`buildPlaywrightJourney`, `isJourneyWithinBudget`). `verificationGate` blocks patch acceptance when required tests, runtime checks or visual gates regress. Covered by the Phase 10 tests in `src/tests/finalPhases.test.ts` plus the existing `advancedPhases.test.ts`.
