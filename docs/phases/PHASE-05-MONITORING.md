# Phase 5 — Continuous monitoring and quality gates

## Objective

Run audits continuously and prevent new regressions in local and CI workflows.

## Planned acceptance criteria

- [x] Baseline existing debt and highlight only new/regressed findings.
- [x] Incremental analysis for changed files.
- [x] Watch mode and optional Git hooks.
- [x] GitHub Actions and GitLab CI examples.
- [x] Configurable quality gates and stable exit codes.
- [x] Scheduled audits with retention policies.
- [x] Notifications for regressions and failed runs.
- [x] SARIF output for code-hosting integrations.
- [x] Trend comparison across report history.

## Implementation note

2026-09-01: Added baseline gates (exit 3), changed-only analysis, monitor/watch with retention and optional webhook, safe hook installer, CI templates, SARIF, report history and UI trends.

## Start instruction

Ask: `Implement Phase 5 using docs/phases/PHASE-05-MONITORING.md`.
