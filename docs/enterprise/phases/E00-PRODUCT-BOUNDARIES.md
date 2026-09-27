# E00 - Product Boundaries and Architecture Baseline

> Implementation status: documentation complete; engineering, product and security approval pending. See the [implementation note](../e00/implementation-note.md).

## Objective

Define the enterprise product boundary before moving code. Establish Code Audit and SEO Workspace as separate domains on a shared platform.

## Required decisions

- ADR-001: modular monolith first; independently deployable workers later.
- ADR-002: CodeProject, SeoProject and optional RepositoryLink are distinct entities.
- ADR-003: reports live in platform artifact storage, not inside audited repositories by default.
- ADR-004: job commands and events are versioned contracts.
- ADR-005: local-only and server/team deployment modes have separate security profiles.
- ADR-006: SQLite is supported for local mode; PostgreSQL is required for team mode.
- ADR-007: filesystem artifacts are supported locally; S3-compatible object storage is required for team mode.

## Domain boundaries

### Platform

Owns tenant, user, project identity, jobs, artifacts, policies, approvals, audit events, retention and feature flags. It must not import an analyzer implementation.

### Code Audit

Owns repository detection, static analyzers, architecture analysis, test intelligence, patch planning, transactional application and verification. It may accept an optional URL only for runtime correlation.

### SEO Workspace

Owns domains, environments, crawl policy, technical SEO, rendered SEO, schema, content, site architecture, search data, campaigns and monitoring. It must accept URL-only projects.

### Combined Audit

Orchestrates existing Code and SEO jobs and correlates their findings. It owns no analyzer logic and cannot weaken either domain's policy.

## Implementation tasks

- [x] Write ADRs under `docs/adr/` with context, decision, alternatives and consequences.
- [x] Inventory all current imports and assign every module to platform, code, SEO or legacy.
- [x] Create a dependency rule: domain packages may import contracts and platform ports, never another domain's implementation.
- [x] Define terminology for tenant, workspace, project, repository, site, environment, run, finding, proposal and patch.
- [x] Define local-mode and team-mode capability matrices.
- [x] Mark stale architecture documents and link them to this roadmap.
- [x] Decide the migration policy for committed `ai-auditor-report/` directories.
- [x] Record data-classification levels: public URL data, source code, secrets, personal data and audit metadata.

## Deliverables

- Approved ADR set.
- Current-to-target module map.
- Domain glossary and ownership matrix.
- Initial data-classification and retention matrix.
- A list of intentionally deferred enterprise capabilities.

## Acceptance criteria

- [x] No entity requires a `package.json` unless it belongs to Code Audit.
- [x] SEO Workspace can be described without referring to a repository path.
- [x] Combined Audit is explicitly orchestration, not shared engine logic.
- [x] Every current source directory has a target owner.
- [x] Security boundaries are documented before persistence or network expansion.

## Baseline documents

- [ADR index](../../adr/README.md)
- [Module map](../e00/current-to-target-module-map.md)
- [Dependency rules](../e00/dependency-rules.md) and [graph](../e00/dependency-graph.md)
- [Glossary and ownership](../e00/glossary-and-ownership.md)
- [Capability matrix](../e00/capability-matrix.md)
- [Classification, retention and migration](../e00/data-classification-retention.md)
- [Deferred capabilities](../e00/deferred-capabilities.md)

## Verification

- Architecture review with engineering, product and security owners.
- Dependency graph snapshot stored with the implementation note.
- No code migration is required to complete this phase.
