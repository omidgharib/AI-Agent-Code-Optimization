# SEO Phase 8 — Keyword, Topic and Intent System

## Objective

Create a project-owned source of truth connecting demand, intent, topics, pages and business value.

## Acceptance criteria

- [ ] Import and normalize keywords with source, market, language, device and collection date.
- [ ] Model Topic → Cluster → Keyword → Intent → Funnel stage → Target URL → Campaign.
- [ ] Support human-editable clustering and intent classification with confidence.
- [ ] Detect unmapped demand, competing target URLs and incompatible intents on one page.
- [ ] Calculate explainable opportunity score from business value, relevance, evidence, feasibility and effort.
- [ ] Track branded/non-branded, local, transactional, commercial and informational segments.
- [ ] Generate reviewable page briefs grounded in project facts and cited evidence.
- [ ] Preserve historical mappings when strategy changes.

## Verification

- Import, normalization, clustering, conflict and score-explanation tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 8 using `docs/seo/phases/SEO-PHASE-08-KEYWORDS-TOPICS.md`.

## Implementation notes

- 2026-09-03: Existing normalized keyword model, historical URL mapping, conflict detection and explainable opportunity score were verified. Import UI and page-brief workflow remain unchecked.
