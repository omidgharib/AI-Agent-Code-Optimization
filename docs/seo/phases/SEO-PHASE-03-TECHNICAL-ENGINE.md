# SEO Phase 3 — Advanced Technical SEO Engine

## Objective

Build an evidence-first crawler and conflict engine for crawlability, indexability and canonicalization.

## Acceptance criteria

- [ ] Parse robots.txt according to RFC 9309, including user-agent precedence, wildcards, errors and caching behavior.
- [ ] Inspect status, redirect chains/loops, soft 404s, MIME types, headers, meta robots and X-Robots-Tag.
- [ ] Resolve HTML/header canonicals, canonical chains/loops and conflicting sitemap/internal-link signals.
- [ ] Validate sitemap indexes, limits, absolute URLs, canonical inclusion and discovered/indexable differences.
- [ ] Validate hreflang language/region codes, reciprocity, x-default and canonical-language consistency.
- [ ] Detect faceted navigation, parameter duplication, crawl traps and inconsistent URL normalization.
- [ ] Produce selector/header evidence, confidence, impact, affected URLs and remediation guidance.
- [ ] Make all rules configurable per project, template and campaign.

## Verification

- Deterministic fixtures for robots, canonicals, redirects, hreflang, sitemaps, soft 404 and crawl traps.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 3 using `docs/seo/phases/SEO-PHASE-03-TECHNICAL-ENGINE.md`.

## Implementation notes

- 2026-09-03: Added robots group precedence and wildcard matching, redirect/header/MIME evidence, soft-404, canonical and hreflang conflicts, sitemap validation and crawler integration. Template/campaign rule overrides and broader deterministic fixtures remain unchecked.
