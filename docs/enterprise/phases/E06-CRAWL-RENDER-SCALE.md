# E06 - Scalable Crawl and Rendering Platform

## Objective

Build a correct, bounded and restart-safe crawl system that separates inexpensive HTTP crawling from expensive browser rendering.

## Crawl architecture

### Frontier

- Durable normalized URL queue with priority, depth and discovery source.
- Unique key by project, environment, policy version and normalized URL.
- Separate states for queued, leased, fetched, blocked, skipped, failed and complete.
- Host-level concurrency and delay controls.
- Checkpointed counters and budget enforcement.

### Fetch pipeline

1. Normalize and policy-check candidate URL.
2. Resolve DNS and apply SSRF policy.
3. Evaluate robots policy from cached origin state.
4. Fetch with manual redirects and revalidate each target.
5. Bound compressed and decompressed response size.
6. Decode charset and classify MIME.
7. Parse HTML with a standards-based parser.
8. Extract canonical, robots, hreflang, schema and links with evidence locations.
9. Store bounded observations and enqueue allowed links.

### Render selection

Do not render every page. Select routes using template samples, metadata differences, JavaScript-only signals, business priority and deterministic sampling. Render pools have separate concurrency, timeout and browser-recycle budgets.

## Protocol correctness

- Implement RFC 9309 robots behavior including matching, precedence and caching.
- Define explicit behavior for robots 2xx, redirects, 4xx, 5xx and network failure.
- Support sitemap index recursion, gzip, limits, alternate namespaces and absolute URL validation.
- Preserve redirect chains and detect loops.
- Handle `X-Robots-Tag` for HTML and non-HTML resources.
- Record final connection address and TLS/network failure category without leaking sensitive topology.

## Resilience

- Retry transient DNS, reset, 429 and 5xx failures with bounded exponential backoff.
- Do not retry deterministic policy, 4xx or validation failures by default.
- Respect `Retry-After` and project quiet periods.
- Add circuit breakers per origin.
- Resume frontier state after worker restart.
- Support cancellation without corrupting checkpoints.

## Implementation tasks

- [ ] Replace regex HTML extraction with `parse5` or an equivalent parser.
- [ ] Move frontier and observations to persistent storage.
- [ ] Add fetch error taxonomy and causal diagnostics.
- [ ] Add host scheduler, leases and adaptive backpressure.
- [ ] Add recursive sitemap processing and sitemap/crawl reconciliation.
- [ ] Add a browser-worker pool with process recycling.
- [ ] Capture raw/rendered metadata and bounded sanitized DOM diffs.
- [ ] Add Googlebot smartphone, mobile and desktop render profiles.
- [ ] Add response sampling policy and artifact limits.
- [ ] Add authenticated crawl profiles through secret references.

## Tests

- RFC robots conformance fixtures.
- Redirect, DNS, TLS, timeout, 429 and WAF-like response fixtures.
- Charset, compression bomb and oversized-response tests.
- Sitemap index recursion and 50,000 URL boundary tests.
- SPA, SSR, hydration failure and client-metadata fixtures.
- Crash/restart and duplicate-delivery tests.
- Load tests at 1k, 10k and 100k URL tiers.

## Acceptance criteria

- [ ] A 10,000 URL crawl resumes after API and worker restart.
- [ ] No URL exceeds configured host concurrency or delay.
- [ ] Every failed fetch has a stable category and bounded diagnostic evidence.
- [ ] The renderer cannot bypass crawler network policy.
- [ ] Sitemap and crawl differences identify the evidence source.
- [ ] Memory usage remains within the documented worker budget.
- [ ] Cancellation persists a reusable checkpoint.

## Scale progression

- Tier 1: up to 10,000 URLs using PostgreSQL and a small worker pool.
- Tier 2: up to 100,000 URLs using partitioned frontier leases and object artifacts.
- Tier 3: one million URLs only after benchmark evidence, sharding and cost controls exist.

