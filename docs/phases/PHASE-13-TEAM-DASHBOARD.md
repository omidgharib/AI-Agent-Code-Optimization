# Phase 13 — Multi-project and team dashboard

## Objective

Turn the local auditor into a controlled quality workspace for multiple projects, branches and team workflows.

## Planned acceptance criteria

- [x] Add a project registry with isolated settings, histories, baselines and retention policies.
- [ ] Add portfolio, project and branch-level quality dashboards.
- [x] Compare branches, commits and arbitrary audit runs.
- [x] Support reusable audit and Quality Gate presets.
- [x] Produce bilingual technical and management reports, including PDF export.
- [x] Add GitHub and GitLab annotations and pull-request summaries.
- [ ] Add optional Jira, Linear and Slack integrations with explicit approval and least-privilege credentials.
- [x] Support branch-specific policies and protected-branch gates.
- [ ] Provide documented headless and Docker execution.
- [ ] Add role-aware team access only if a networked deployment mode is enabled.

## Out of scope

- Public SaaS hosting, billing and organization administration unless separately approved.

## Verification

- Multi-project isolation and branch-comparison tests.
- Connector preview/approval tests without sending real external messages by default.
- Docker/headless smoke test.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 13 using docs/phases/PHASE-13-TEAM-DASHBOARD.md`.

## 2026-09-21 implementation note

`src/report/pdf.ts` adds a printable `report.pdf` (`--pdf` flag on the `audit` command, config `pdf`), and the CLI `audit`/`monitor` commands can emit GitHub workflow annotation lines and a GitLab Code Quality report via `--github-annotations` / `--gitlab-annotations` (writer: `src/report/annotations.ts`). Project registry, run comparison, presets and branch-policy gates already live in `src/core/projectRegistry.ts`. Covered by Phase 13 tests in `src/tests/finalPhases.test.ts` and `advancedPhases.test.ts`. Dashboards, Jira/Linear/Slack connectors, Docker packaging and networked role-based access remain integration work.
