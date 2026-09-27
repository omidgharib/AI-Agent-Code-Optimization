# E02 implementation note

- Implemented: 2026-09-03
- Runtime: local SQLite (Node 22 built-in driver); injectable PostgreSQL client in team mode
- Default local data root: `%USERPROFILE%/.ai-auditor/`

## Delivered

- Forward/rollback relational migrations for tenants, identities, projects, environments, links, jobs, attempts, steps, events, findings, governance, connectors, retention, deletion, artifacts, and outbox.
- Tenant-scoped project, job, event, artifact, and external-sync repositories.
- SQLite local adapter and PostgreSQL transaction/placeholder adapter. Team configuration rejects non-PostgreSQL databases or missing S3-compatible storage.
- Durable job state, attempts, leases, heartbeats, expiration recovery, immutable terminal transitions, cooperative cancellation requests, and JSON checkpoints.
- Job and sync idempotency with database uniqueness and duplicate-delivery handling.
- Transactional outbox written atomically with job acceptance and deletion changes.
- Content-addressed filesystem and S3-compatible artifact adapters with generated tenant/project keys, size limits, atomic partial-file publication, and SHA-256 verification.
- Retention, legal hold, asynchronous project deletion, deletion verification, and audit/outbox events.
- Explicit legacy report importer and explicit CLI `--export`; reports now default to platform artifact storage outside audited repositories.
- Versioned platform job APIs for listing, events, checkpoints, and cancellation.

## Verification evidence

- Automated persistence suite covers forward/rollback migration, restart persistence, duplicate command/event/sync delivery, tenant isolation, lease recovery, checkpoints, cancellation, terminal immutability, checksums, partial/oversized uploads, retention, legal hold, deletion, outbox, and backup corruption detection.
- Runtime restart probe created project `c7a9c426-d4d5-4817-b0de-7a27f1e42c18`, restarted the API, and retrieved the same ID from SQLite.
- Real CLI audit wrote to `%USERPROFILE%/.ai-auditor/artifacts/local/069873597aba3c136a321c82/...`, not the audited repository.

## Operational verification still time-bound

The 24-hour soak and a live PostgreSQL/S3 integration run require provisioned team infrastructure and elapsed wall-clock time. The adapters, guards, and tenant-isolation contract tests are implemented; these two deployment validations must be attached before a production team-mode approval.
