# ADR-006: SQLite locally and PostgreSQL for teams

- Status: Proposed
- Date: 2026-09-03

## Context

Local mode needs a zero-administration durable store. Team mode needs concurrency, operational tooling and reliable transactional coordination.

## Decision

SQLite is supported in local mode. PostgreSQL is required in team mode. Domain persistence is accessed through platform ports and shares migrations and behavioral contract tests across both adapters. Team mode refuses SQLite configuration.

## Alternatives

- PostgreSQL everywhere: rejected because it harms local/offline setup.
- SQLite everywhere: rejected because multi-instance team workloads exceed its intended topology.

## Consequences

Queries must use the supported common feature set or have tested adapters. Production migration, backup and recovery procedures target PostgreSQL.
