# SEO Phase 10 — Strategy-Aware SEO Copilot

## Objective

Provide a conversational strategist that understands project facts, campaign context and missing inputs.

## Acceptance criteria

- [ ] Add Discover, Strategize, Operate and Explain conversation modes.
- [ ] Expose active project, campaign, evidence, assumptions and unresolved questions in every session.
- [ ] Let the copilot request URLs, files, metrics or connectors and explain why each is needed.
- [ ] Produce structured briefs, KPI trees, URL maps, technical/content backlogs, milestones and risk registers.
- [ ] Ground every recommendation in audit evidence, connected data or an explicitly labeled assumption.
- [ ] Use Proposal → Evidence → Preview → Approval → Apply → Verify for all mutations.
- [ ] Enforce independent model, token, cost, time, file and approval budgets per session.
- [ ] Keep memory local, inspectable, editable, resettable and isolated by project/campaign.

## Verification

- Grounding, missing-input, memory isolation, approval, budget and prompt-injection tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 10 using `docs/seo/phases/SEO-PHASE-10-SEO-COPILOT.md`.

## Implementation notes

- 2026-09-03: Existing modes, grounded recommendations, mutation workflow and independent budgets were verified. Persistent inspectable copilot memory UI remains unchecked.
