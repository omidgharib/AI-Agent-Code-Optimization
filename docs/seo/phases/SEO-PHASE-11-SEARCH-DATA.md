# SEO Phase 11 — Search Performance Integrations

## Objective

Connect technical findings to real search and conversion evidence.

## Acceptance criteria

- [ ] Add optional read-only connectors for Search Console, Analytics, Bing Webmaster Tools, CrUX/PageSpeed and Merchant Center.
- [ ] Scope credentials and cached data to a single project with least privilege and explicit revocation.
- [ ] Normalize clicks, impressions, CTR, position, query/page, device, country and search appearance by date.
- [ ] Detect declining pages, CTR opportunities, query cannibalization and audit/performance mismatches.
- [ ] Track freshness, sampling, timezone, attribution and unavailable dimensions.
- [ ] Join performance data to URLs, topics and campaigns without losing source provenance.
- [ ] Preview and approve any connector write operation separately.
- [ ] Support anonymized fixtures so tests never contact real accounts.

## Verification

- OAuth boundary, project isolation, normalization, pagination, quota and stale-data tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 11 using `docs/seo/phases/SEO-PHASE-11-SEARCH-DATA.md`.

## Implementation notes

- 2026-09-03: Added project/source-provenanced metric normalization, decline/CTR/cannibalization analysis and read-only connector scope/revocation boundaries. Live OAuth connectors remain unchecked.
