# SEO Phase 6 — Site Architecture Intelligence

## Objective

Explain how internal links, templates and URL signals distribute discovery and importance.

## Acceptance criteria

- [ ] Build separate internal-link, canonical, redirect, hreflang and sitemap graphs.
- [ ] Classify navigation, footer, breadcrumb, contextual and generated links.
- [ ] Calculate approximate internal PageRank, click depth, hubs, dead ends and weakly linked pages.
- [ ] Detect orphans using crawl, sitemap, analytics and Search Console evidence with confidence levels.
- [ ] Analyze anchor quality, repeated ambiguous anchors and links to redirects/non-canonical URLs.
- [ ] Group pages into template and topic clusters.
- [ ] Add interactive filtering, neighborhood expansion and campaign overlays.
- [ ] Simulate link/URL changes and report blast radius before application.

## Verification

- Graph snapshots for hubs, orphans, redirects, canonicals and multilingual clusters.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 6 using `docs/seo/phases/SEO-PHASE-06-SITE-ARCHITECTURE.md`.

## Implementation notes

- 2026-09-03: Existing graph, PageRank, depth, orphan/dead-end, classification and blast-radius core was verified. Interactive filtering and campaign overlays remain unchecked.
