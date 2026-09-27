# ADR-004: Version job commands and events

- Status: Proposed
- Date: 2026-09-03

## Context

Jobs will eventually cross process boundaries and must survive rolling upgrades, retries and replay.

## Decision

Every job command and emitted event is a contracts-owned envelope containing `contractVersion`, `type`, `jobId`, `tenantId`, `workspaceId`, timestamps, correlation/causation identifiers and a typed payload. Consumers reject unsupported major versions; additive minor changes remain backward compatible. Persisted events are immutable. Idempotency keys apply to commands.

## Alternatives

- Share in-process TypeScript types only: rejected because types disappear at runtime.
- Unversioned JSON: rejected because compatibility cannot be enforced.

## Consequences

Schemas require runtime validation and compatibility tests. Producers cannot expose implementation classes in payloads. Contract evolution costs more up front but makes worker extraction safe.
