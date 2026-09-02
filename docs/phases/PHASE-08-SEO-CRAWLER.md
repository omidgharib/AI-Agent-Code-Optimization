# Phase 8 — Controlled SEO crawler

## Objective

Crawl a bounded portion of a site and expose page-level and site-wide SEO problems without overloading the target.

## Planned acceptance criteria

- [ ] Add crawl budgets for page count, depth, concurrency, delay, duration and response size.
- [ ] Support domain/subdomain boundaries plus include and exclude URL patterns.
- [ ] Respect `robots.txt` by default and clearly label blocked URLs.
- [ ] Stream crawl progress and support cancellation and resumable partial results.
- [ ] Store normalized URL records with status, indexability, canonical, title, description, depth and issue count.
- [ ] Detect broken links, redirect loops/chains, duplicate metadata, thin pages and canonical conflicts.
- [ ] Compare sitemap URLs with discovered and indexable pages.
- [ ] Detect likely orphan pages and pages with excessive click depth.
- [ ] Add searchable tables, CSV/JSON export and crawl-to-crawl baseline comparison.
- [ ] Isolate crawler workers from the main UI server and enforce memory/time limits.

## Out of scope

- Crawling external domains, authenticated private areas and backlink discovery.

## Verification

- Deterministic local fixture site with redirects, duplicates, robots and broken links.
- Cancellation, timeout and crawl-budget tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Ask: `Implement Phase 8 using docs/phases/PHASE-08-SEO-CRAWLER.md`.
