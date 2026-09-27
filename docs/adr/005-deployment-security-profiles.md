# ADR-005: Separate local and team security profiles

- Status: Proposed
- Date: 2026-09-03

## Context

A single-user process operating on an explicitly selected checkout has a different trust boundary from a networked multi-tenant service.

## Decision

Local mode trusts the operating-system user boundary, binds services to loopback by default and uses explicit local paths. Team mode requires authentication, tenant-scoped authorization, TLS at ingress, network egress controls, isolated job execution, managed secret references, immutable audit events and per-tenant storage prefixes. Team mode must fail closed when any required control is absent.

## Alternatives

- One permissive profile: rejected because local convenience would weaken team isolation.
- Team controls everywhere: rejected because it makes offline local use unnecessarily complex.

## Consequences

Deployment mode is explicit and immutable for a running process. Configuration validation and security tests differ by profile; policy decisions cannot silently downgrade.
