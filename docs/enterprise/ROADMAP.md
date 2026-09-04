# AI Auditor Enterprise Roadmap

This roadmap turns the current local TypeScript CLI and web UI into an enterprise-ready audit platform while keeping Code Audit and SEO Workspace inside one product and repository.

## Product decision

- Keep one product, repository and design system.
- Expose two independent workflows: Code Audit and SEO Workspace.
- Share only platform capabilities: identity, projects, jobs, storage, reporting, policy, approvals, observability and billing/usage controls.
- Do not require a local repository for URL-only SEO work.
- Make repository linking optional for SEO source mapping and patch generation.
- Keep a Combined Audit as an explicit orchestration mode, never as an implicit coupling between engines.

## Target architecture

```text
apps/
  cli/                    code, seo and combined commands
  web/                    /code, /seo, /admin and /settings routes
  api/                    authenticated versioned HTTP API
workers/
  code-worker/            static analysis, tests and verification
  crawl-worker/           HTTP crawl frontier and sitemap processing
  browser-worker/         rendered DOM, Lighthouse and screenshots
  ai-worker/              bounded proposal and patch generation
packages/
  contracts/              versioned DTOs, events and report schemas
  platform/               projects, jobs, policy, audit log and storage
  code-engine/            ESLint, tsc, architecture and patch verification
  seo-engine/             technical SEO, schema, content and site graphs
  crawler/                robots, URL frontier, fetch and normalization
  reporting/              JSON, SARIF, CSV, Markdown, HTML and PDF
  security/               path policy, SSRF policy, secret handling
```

The first implementation remains a modular monolith. API and workers become separate deployables only after contracts, persistence and queue semantics are stable.

## Non-negotiable invariants

- AI output is untrusted until parsed, policy-checked, previewed, approved and verified.
- No code mutation may escape the selected repository or touch protected files.
- URL fetching must enforce SSRF, DNS rebinding, redirect and egress policies.
- SEO facts, assumptions and recommendations must remain distinguishable.
- Lab and field performance data must never be conflated.
- Every finding includes evidence, confidence, affected asset, rule version and reproduction metadata.
- Jobs survive API restarts and are idempotent.
- Project and tenant boundaries apply to data, cache, credentials, reports and events.
- External connectors are read-only by default and use least privilege.

## Phase sequence

| Phase | Goal | Exit gate | File |
| --- | --- | --- | --- |
| E00 | Product boundaries and architecture baseline | Approved ADRs and dependency rules | [E00](phases/E00-PRODUCT-BOUNDARIES.md) |
| E01 | Modular monolith and domain contracts | Independent code and SEO APIs compile and test | [E01](phases/E01-MODULAR-MONOLITH.md) |
| E02 | Persistent projects, jobs and artifacts | Restart-safe idempotent jobs | [E02](phases/E02-PERSISTENCE-JOBS.md) |
| E03 | Security and execution isolation | Threat model and critical security tests pass | [E03](phases/E03-SECURITY-ISOLATION.md) |
| E04 | Production-grade Code Audit | Deterministic safe audit/fix pipeline | [E04](phases/E04-CODE-AUDIT.md) |
| E05 | Independent SEO Workspace | URL-only SEO projects work without package.json | [E05](phases/E05-SEO-WORKSPACE.md) |
| E06 | Scalable crawl and rendering | Bounded restart-safe 10k URL crawl | [E06](phases/E06-CRAWL-RENDER-SCALE.md) |
| E07 | Evidence, quality gates and reports | Versioned defensible findings and exports | [E07](phases/E07-EVIDENCE-REPORTING.md) |
| E08 | Search data and connectors | Project-scoped read-only production connectors | [E08](phases/E08-CONNECTORS-DATA.md) |
| E09 | Team workflows and governance | RBAC, approvals and immutable audit history | [E09](phases/E09-TEAM-GOVERNANCE.md) |
| E10 | Observability and SRE | SLOs, telemetry and operational runbooks | [E10](phases/E10-OBSERVABILITY-SRE.md) |
| E11 | Validation corpus and performance | Published accuracy and load baselines | [E11](phases/E11-VALIDATION-BENCHMARKS.md) |
| E12 | Deployment, compliance and GA | Repeatable deployment and launch checklist | [E12](phases/E12-DEPLOYMENT-GA.md) |

## Recommended delivery order

1. Foundation release: E00-E03. Do not onboard external enterprise users before this gate.
2. Product release: E04-E07. This is the first trustworthy private beta.
3. Organization release: E08-E10. This enables multi-team operation.
4. General availability: E11-E12. This requires measured accuracy and operational evidence.

## Definition of enterprise-ready

- No critical or high unresolved issue in the platform threat model.
- 100% of accepted jobs recover or reach a terminal state after process restart.
- At least 98% agreement with the validation corpus for HTTP status, canonical and indexability signals.
- Less than 5% false-positive rate for high-severity rules in the reviewed corpus.
- No secret, cookie, token or personal form value appears in logs, reports or model context fixtures.
- API availability SLO is at least 99.9% for the agreed deployment topology.
- A 10,000 URL crawl completes within its configured resource budget and can resume from a checkpoint.
- Every applied patch has actor, approval, snapshot, verification and rollback evidence.
- Tenant isolation tests cover API, database, object storage, cache, queue and connector credentials.

## Roadmap operating rule

Implement phases in order. A phase can start early for discovery, but it cannot be marked complete until every required acceptance criterion is checked and verification evidence is attached to its implementation note.

