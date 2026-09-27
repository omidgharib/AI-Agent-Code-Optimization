# ADR-003: Store reports as platform artifacts

- Status: Proposed
- Date: 2026-09-03

## Context

The CLI currently writes committed-repository-adjacent `ai-auditor-report/` directories. Team operation requires tenant isolation, retention, immutable evidence and storage independent of checkout lifetime.

## Decision

Reports, traces, crawl exports, snapshots and patch evidence are artifacts owned by the platform artifact service. The default destination is never the audited repository. An explicit CLI export may copy a selected artifact into a user-selected path.

## Alternatives

- Continue writing into repositories: rejected due to pollution, leakage and weak retention controls.
- Store all artifact bytes in the database: rejected due to cost and poor large-object behavior.

## Consequences

Artifact metadata and authorization remain in platform persistence. Existing committed report directories follow the migration policy in `docs/enterprise/e00/data-classification-retention.md`.
