# SEO Phase 1 — Project SEO Profile

## Objective

Create an isolated, versioned SEO identity and configuration for every project.

## Acceptance criteria

- [x] Model business type, brand, domains, environments, markets, languages, audiences, conversions and competitors.
- [x] Add presets for SaaS, ecommerce, marketplace, local, publisher, documentation, multilingual and programmatic sites.
- [x] Implement global → project → campaign → run configuration merging with provenance for every value.
- [x] Configure crawl boundaries, URL patterns, indexability exceptions, template rules, schema requirements and performance budgets.
- [x] Store credentials separately from project configuration and redact them in exports and logs.
- [x] Add import/export, schema migration, version history and rollback.
- [x] Enforce project isolation for settings, history, memory and baselines.
- [x] Add bilingual settings UI with validation and a resolved-configuration preview.

## Verification

- Configuration merge, migration, isolation, secret-redaction and rollback tests.
- `npm run build:all && npm test -- --runInBand`

## Start instruction

Implement SEO Phase 1 using `docs/seo/phases/SEO-PHASE-01-PROJECT-PROFILE.md`.

## Implementation notes

- 2026-09-02: Added versioned isolated profiles, eight presets, four-layer provenance merge, separate credentials, migration/import/export/history/rollback, server APIs, bilingual UI, and deterministic tests.
