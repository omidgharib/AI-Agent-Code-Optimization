# SEO Phase 7 — Content and Entity Intelligence

## Objective

Assess page purpose, originality, topical coverage and differentiation without fabricated ranking rules.

## Acceptance criteria

- [ ] Separate template boilerplate from main content and cluster exact/near duplicates.
- [ ] Detect likely thin-value, stale and purpose-unclear pages with evidence and confidence.
- [ ] Extract entities, claims, sources, authorship and topic coverage.
- [ ] Compare title, H1, primary content, structured data and declared search intent.
- [ ] Detect probable cannibalization using query, intent, similarity and performance evidence.
- [ ] Track content decay and meaningful changes across audits.
- [ ] Prohibit keyword-density and fixed-word-count rules from being presented as ranking facts.
- [ ] Flag scaled low-value content risk and require human review for generated content plans.

## Verification

- Duplicate, boilerplate, stale, cannibalization and multilingual content fixtures.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 7 using `docs/seo/phases/SEO-PHASE-07-CONTENT-ENTITIES.md`.

## Implementation notes

- 2026-09-03: Existing boilerplate-aware thin/stale/purpose, duplicate, entity/claim and cannibalization core was verified. Audit-to-audit decay persistence remains unchecked.
