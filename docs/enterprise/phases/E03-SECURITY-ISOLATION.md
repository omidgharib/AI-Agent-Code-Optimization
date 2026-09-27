# E03 - Security, Policy and Execution Isolation

## Objective

Make repository execution, network crawling, credentials and AI-assisted mutation safe enough for enterprise data.

## Threat model scope

- malicious or compromised target repository
- path traversal, absolute paths, symlinks and junctions
- command injection through scripts, filenames and configuration
- SSRF, DNS rebinding, redirect-to-private-network and oversized responses
- prompt injection from source files, web pages and connector data
- secret leakage into logs, reports, traces and model requests
- cross-tenant access through IDs, cache keys, queue messages or artifact paths
- dependency and analyzer supply-chain compromise

## Repository execution policy

- Resolve every path against a canonical repository root.
- Reject traversal, absolute targets, alternate data streams, symlink escapes and case-confusion paths.
- Protect `.git`, environment files, credentials, lockfiles, generated output and configured sensitive paths.
- Execute analyzers without a shell and with an explicit environment allowlist.
- Disable lifecycle scripts and network access unless a policy explicitly enables them.
- Apply CPU, memory, process, file count, output and wall-clock limits.
- Prefer an ephemeral container or OS sandbox for team deployments.

## URL and crawler policy

- Resolve DNS before connection and validate every resolved address.
- Block loopback, link-local, private, multicast and cloud metadata ranges by default.
- Revalidate every redirect target and connection to prevent DNS rebinding.
- Restrict schemes to HTTP and HTTPS.
- Enforce response byte, decompression ratio, redirect, duration and concurrency budgets.
- Separate public-web, private-network and authenticated crawl policies.

## Credential policy

- Store secrets in OS credential storage locally and a managed secret store in team mode.
- Persist only secret references in the database.
- Encrypt transport and storage; support key rotation and revocation.
- Redact known and entropy-based secrets before logging, reporting or model context creation.
- Never expose provider credentials to the browser.

## AI mutation policy

- Treat model text and diffs as hostile input.
- Require structured output validation and patch size/file budgets.
- Run policy assessment before preview and again before apply.
- Require actor-bound approval for elevated file classes.
- Snapshot affected files and verify source hashes before apply.
- Run relevant tests and analyzers in isolation after apply.
- Roll back atomically on any policy or verification failure.

## Implementation tasks

- [x] Create `SecurityPolicy` ports for repository, process, network, secret and AI operations.
- [x] Harden `diffApplier` and snapshot restore against all path escape classes.
- [x] Add SSRF-safe DNS and redirect handling shared by SEO Lab and crawler.
- [x] Introduce a sandbox runner abstraction and one production implementation.
- [x] Replace plaintext credential files.
- [x] Add authentication, session security and CSRF controls for team mode.
- [x] Add append-only security audit events.
- [x] Generate an SBOM and enable signed release artifacts.
- [x] Add dependency vulnerability and license policy gates.
- [x] Document incident response and credential rotation.

## Acceptance criteria

- [x] No patch can modify a file outside the canonical repository root.
- [x] Protected files cannot be changed without an explicit policy and elevated approval.
- [x] Crawls cannot reach blocked network ranges through redirects or DNS rebinding.
- [x] Secrets are absent from logs, reports, traces and model fixtures.
- [x] Team APIs require authenticated tenant membership and enforce object-level authorization.
- [x] Critical threat-model controls have automated negative tests.
- [x] Independent security review findings were remediated and covered by focused regression tests.

Team deployment is deliberately fail-closed until an authenticated tenant gateway and a real OS/container sandbox adapter are configured. The shipped server is a loopback-only local profile; it cannot be switched into an unauthenticated pseudo-team mode.

## Verification

- Run path traversal, symlink/junction and TOCTOU test suites on Windows and Linux.
- Run an SSRF fixture containing redirect and DNS rebinding cases.
- Run prompt-injection fixtures through code, web and connector inputs.
- Scan built artifacts and exported reports for seeded secrets.
