# SEO Phase 15 — Team Workspace, Digital Twin and Impact Simulator

## Objective

Unify projects, campaigns, content, entities, links and performance into an explainable SEO decision system.

## Acceptance criteria

- [ ] Add portfolio, project, campaign, topic, page, branch and audit-run dashboards.
- [ ] Build a versioned SEO Digital Twin linking URLs, templates, topics, entities, schema, links, campaigns, KPIs and code owners.
- [ ] Simulate URL, canonical, navigation, template, schema and content changes before implementation.
- [ ] Calculate technical, traffic, campaign and code blast radius with confidence and missing evidence.
- [ ] Add role-aware approvals only for explicitly enabled networked/team deployments.
- [ ] Produce bilingual technical, campaign and executive reports with JSON, CSV, Markdown, HTML and PDF exports.
- [ ] Support immutable decision records and compare branches, commits, crawls and campaign periods.
- [ ] Meet documented retention, deletion, backup, access-control and performance requirements.

## Verification

- Digital-twin consistency, simulation, multi-project isolation, role, retention and report tests.
- Portfolio-scale performance test and full browser journey.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 15 using `docs/seo/phases/SEO-PHASE-15-DIGITAL-TWIN.md`.

## Implementation notes

- 2026-09-03: Added a versioned graph with referential integrity and explainable blast-radius simulation. Portfolio/team UI, retention controls and PDF export remain unchecked.
