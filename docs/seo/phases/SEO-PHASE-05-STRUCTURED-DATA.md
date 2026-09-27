# SEO Phase 5 — Structured Data Studio

## Objective

Validate structured data syntax, eligibility, completeness and truthfulness against visible page content.

## Acceptance criteria

- [ ] Parse JSON-LD, Microdata and RDFa into a normalized entity graph.
- [ ] Validate Schema.org vocabulary and Google-specific required/recommended properties separately.
- [ ] Support Product, Article, NewsArticle, Organization, LocalBusiness, Breadcrumb, Event, JobPosting, Recipe, Video, SoftwareApplication, WebSite and ProfilePage.
- [ ] Detect missing @id, duplicate/conflicting entities, invalid nesting and inaccessible referenced images/URLs.
- [ ] Compare marked-up claims with visible content and flag misleading, hidden, stale or unsupported values.
- [ ] Show rich-result eligibility as possibility, never as a guarantee.
- [ ] Generate framework-aware preview patches that require explicit approval.
- [ ] Render an interactive entity graph and template-level issue aggregation.

## Verification

- Valid, invalid, incomplete, deceptive and rendered-only schema fixtures.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 5 using `docs/seo/phases/SEO-PHASE-05-STRUCTURED-DATA.md`.

## Implementation notes

- 2026-09-03: Added normalized JSON-LD/Microdata/RDFa parsing, supported-type requirements, entity conflicts, visible-content checks and non-guaranteed eligibility; integrated findings into SEO Lab. Patch generation and interactive graph UI remain unchecked.
