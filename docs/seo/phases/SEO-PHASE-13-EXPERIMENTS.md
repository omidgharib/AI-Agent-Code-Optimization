# SEO Phase 13 — SEO Experiments

## Objective

Measure controlled SEO changes without presenting correlation as causation.

## Acceptance criteria

- [ ] Model hypothesis, metric, control/test groups, rollout, duration, guardrails and rollback conditions.
- [ ] Support title, internal-link, content-refresh, schema and template rollout experiments.
- [ ] Validate group comparability and warn about overlap, contamination and simultaneous changes.
- [ ] Annotate seasonality, releases, migrations and external events.
- [ ] Calculate effect ranges and confidence while clearly stating methodological limits.
- [ ] Require approval for rollout expansion and automated rollback.
- [ ] Attach experiments to campaigns, URLs, commits and audit baselines.
- [ ] Produce a final decision record: ship, iterate, stop or inconclusive.

## Verification

- Assignment, contamination, guardrail, rollback and inconclusive-result tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 13 using `docs/seo/phases/SEO-PHASE-13-EXPERIMENTS.md`.

## Implementation notes

- 2026-09-03: Added typed experiment definitions, overlap/rollout guards, effect ranges, contamination notes, guardrails and approval-requiring decisions. Automated rollout persistence remains unchecked.
