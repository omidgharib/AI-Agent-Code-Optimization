# ADR-001: Start as a modular monolith

- Status: Proposed
- Date: 2026-09-03

## Context

The current CLI, HTTP server, analyzers and reporting code share one process and repository. Splitting them before contracts, persistence and queue semantics stabilize would turn ordinary refactoring into distributed-systems work.

## Decision

Build the first enterprise release as one deployable modular monolith with enforceable package boundaries. Job commands and events are the extraction seams. Code, crawl, browser and AI workers may become independently deployable only after their contracts are versioned, jobs are durable and idempotency is demonstrated.

## Alternatives

- Microservices immediately: rejected because operational cost and unstable contracts outweigh isolation benefits.
- Preserve the unstructured CLI: rejected because it cannot enforce domain ownership.

## Consequences

Deployment stays simple while domain coupling becomes visible. Resource isolation is process-level initially; high-risk execution still needs sandboxing. Extraction remains possible without changing domain APIs.
