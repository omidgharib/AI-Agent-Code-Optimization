# Phase 7 — SEO Lab for single-page audits

## Objective

Create a dedicated bilingual SEO workspace for deep inspection of one running page.

## Planned acceptance criteria

- [ ] Add an SEO Lab navigation item with Overview, Metadata, Indexability, Structured Data, Web Vitals and Recommendations tabs.
- [ ] Calculate an explainable SEO Health score with category-level deductions.
- [ ] Audit title, description, canonical, robots directives, viewport, language and heading hierarchy.
- [ ] Audit Open Graph, Twitter Card, image alt text and social-preview completeness.
- [ ] Parse and validate JSON-LD blocks and show Schema.org validation evidence.
- [ ] Inspect status codes, redirect chains, `robots.txt`, sitemap discovery and indexability conflicts.
- [ ] Run separate Lighthouse Mobile and Desktop profiles and compare their results.
- [ ] Add actionable evidence, affected selectors and source locations where mapping is possible.
- [ ] Let the SEO agent produce framework-aware recommendations without applying unreviewed patches.

## Out of scope

- Multi-page crawling, keyword-rank tracking and backlink analysis.

## Verification

- Unit tests for SEO rules and score calculation.
- Browser test against a fixture containing valid and invalid metadata.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 7 using docs/phases/PHASE-07-SEO-LAB.md`.
