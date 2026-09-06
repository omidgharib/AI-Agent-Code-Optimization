# Phase 13 — Multi-project and team dashboard

## Objective

Turn the local auditor into a controlled quality workspace for multiple projects, branches and team workflows.

## Planned acceptance criteria

- [ ] Add a project registry with isolated settings, histories, baselines and retention policies.
- [ ] Add portfolio, project and branch-level quality dashboards.
- [ ] Compare branches, commits and arbitrary audit runs.
- [ ] Support reusable audit and Quality Gate presets.
- [ ] Produce bilingual technical and management reports, including PDF export.
- [ ] Add GitHub and GitLab annotations and pull-request summaries.
- [ ] Add optional Jira, Linear and Slack integrations with explicit approval and least-privilege credentials.
- [ ] Support branch-specific policies and protected-branch gates.
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
