# SEO Phase 9 — Campaign and Strategy Engine

## Objective

Prioritize SEO work through explicit project strategies, campaigns, KPIs and approval policies.

## Acceptance criteria

- [ ] Model campaign goal, dates, audience, markets, topics, target URLs, competitors, owners, budget and dependencies.
- [ ] Add strategy templates for launches, category growth, local, international, migration, seasonal, authority, recovery, CWV and refresh campaigns.
- [ ] Define KPI trees, baselines, milestones, success/failure criteria and stop conditions.
- [ ] Apply campaign overrides without mutating project defaults and show configuration provenance.
- [ ] Rank issues/opportunities by campaign relevance, business impact, confidence, effort and risk.
- [ ] Associate pages, tasks, findings, experiments and recommendations with one or more campaigns.
- [ ] Enforce campaign-specific quality gates and approval roles.
- [ ] Add campaign timeline, backlog, ownership and progress dashboards.

## Verification

- Override isolation, prioritization, KPI, lifecycle and approval-policy tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 9 using `docs/seo/phases/SEO-PHASE-09-CAMPAIGNS.md`.

## Implementation notes

- 2026-09-03: Existing campaign templates, KPI fields, overrides, approval roles and relevance ranking were verified. Persistent lifecycle dashboards remain unchecked.
