# E08 - Search Data, Connectors and Governance

## Objective

Connect technical findings to search and business evidence through project-scoped, read-only and auditable integrations.

## Initial connectors

- Google Search Console: search analytics, URL inspection where quota permits, sitemap status.
- GA4: landing-page sessions and configured conversions.
- CrUX/PageSpeed Insights: field CWV and lab diagnostics.
- Bing Webmaster Tools: search performance and crawl signals.
- Merchant Center: product diagnostics for explicitly enabled commerce projects.

## Connector architecture

- OAuth and API credentials are secret references scoped to tenant, project and connector account.
- Connector capabilities declare scopes, dimensions, quotas and freshness.
- Sync is an idempotent persistent job with cursor/checkpoint state.
- Raw responses are retained only when policy allows; normalized rows retain provenance.
- Every metric records source, account/property, dimensions, date, timezone, sampling and collection time.
- Revocation stops future jobs and invalidates cached access without silently deleting historical metrics.

## Normalized search model

- date and comparison period
- page and normalized URL
- query where permitted
- clicks, impressions, CTR and position
- device, country and search appearance
- source, freshness and sampling metadata
- optional campaign, topic and target URL mappings

## Analysis capabilities

- Declining pages and queries with configurable comparison windows.
- High-impression CTR opportunities with position context.
- Query/page cannibalization with confidence.
- Technical finding and performance mismatch correlation.
- Branded/non-branded and market/language segmentation.
- Field CWV and search performance overlays without causal claims.

## Implementation tasks

- [ ] Define connector SDK ports and capability manifests.
- [ ] Implement encrypted token/reference storage and rotation.
- [ ] Implement GSC first with anonymized fixtures and quota handling.
- [ ] Add GA4 and CrUX after GSC normalization stabilizes.
- [ ] Add cursor, pagination, retry and backfill limits.
- [ ] Build freshness and data-quality diagnostics.
- [ ] Add project URL mapping and unmatched-row review.
- [ ] Add connector status, revoke and resync UI.
- [ ] Add export/delete behavior aligned with retention policy.
- [ ] Require separate approval for any future write-capable connector action.

## Security and privacy

- Request the minimum read scopes.
- Never include OAuth tokens or raw account identifiers in reports or model context.
- Support query redaction or aggregation for sensitive deployments.
- Apply tenant and project filters in every query and cache key.
- Record connector access and sync events in the audit log.

## Tests

- OAuth boundary and revocation tests.
- Pagination, quota, rate-limit and stale-token fixtures.
- Sampling, timezone and unavailable-dimension tests.
- Cross-project and cross-tenant isolation tests.
- Backfill cancellation and resume tests.
- Deterministic anonymized provider fixtures; CI never contacts live accounts.

## Acceptance criteria

- [ ] GSC sync is read-only, resumable and project-scoped.
- [ ] Every normalized metric retains source and freshness metadata.
- [ ] Revoked credentials cannot be used by queued or retrying jobs.
- [ ] Partial syncs are visible and never presented as complete data.
- [ ] Connector data can enrich findings without becoming an unsupported ranking claim.
- [ ] No test suite requires a real external account.

