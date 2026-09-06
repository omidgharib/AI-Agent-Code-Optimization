# E02 - Persistent Projects, Jobs and Artifacts

> Implementation status: complete; time-bound 24-hour soak and live team-infrastructure validation remain deployment gates. See the [implementation note](../e02/implementation-note.md).

## Objective

Replace in-memory job maps and repository-local report coupling with restart-safe persistence and idempotent orchestration.

## Storage model

### Relational data

- tenants, users and memberships
- code_projects, seo_projects, environments and repository_links
- jobs, job_attempts, job_steps and job_events
- findings, suppressions, baselines and quality_gates
- proposals, approvals, patches and verification_runs
- connector_accounts and sync_runs
- retention_policies and deletion_requests

### Artifact data

- reports and exports
- crawl response samples and bounded DOM snapshots
- screenshots and Lighthouse results
- patch previews and repository snapshots
- connector import files

## Job state machine

```text
queued -> leased -> running -> completed
                    |       -> failed
                    |       -> cancelled
                    -> retry_wait -> queued
```

Terminal states are immutable. Retrying creates a new attempt, not a rewritten history entry.

## Implementation tasks

- [x] Define repository interfaces for projects, jobs, events and artifacts.
- [x] Implement SQLite adapters for local mode.
- [x] Implement PostgreSQL adapters and migrations for team mode.
- [x] Add content-addressed artifact storage with checksums and size limits.
- [x] Add a durable queue abstraction with lease timeout and heartbeat.
- [x] Implement idempotency keys for job creation and external syncs.
- [x] Persist cancellation requests and make workers cooperatively stop.
- [x] Add checkpoint APIs for crawl frontier and long-running analysis.
- [x] Recover expired leases on startup.
- [x] Add transactional outbox events for job and notification changes.
- [x] Add retention, legal hold and project deletion workflows.
- [x] Stop writing reports inside target repositories by default; retain an explicit export option.

## Data integrity rules

- Every row includes tenant ID where team mode is supported.
- Artifact keys include tenant and project identity and are never user-composed paths.
- Job events are append-only.
- A completed job references immutable analyzer versions and configuration snapshots.
- Deletion is asynchronous, auditable and verified across database, cache and object storage.

## Tests

- Kill API and worker processes during every job state and verify recovery.
- Duplicate command and event delivery tests.
- Database migration forward and rollback tests.
- Tenant isolation tests for every repository query.
- Artifact checksum, partial upload and retention tests.
- Queue lease expiration and worker crash tests.

## Acceptance criteria

- [x] API restart loses no accepted job.
- [x] Worker restart resumes checkpointable jobs or safely retries the current step.
- [x] Duplicate job submissions return the original job for the same idempotency key.
- [x] Reports remain available after repository deletion or disconnection according to retention policy.
- [x] Local mode requires no external database service.
- [ ] Team mode passes tenant-isolation integration tests against provisioned PostgreSQL/S3 infrastructure.

## Verification

- Run a 24-hour soak with repeated API and worker restarts.
- Confirm 100% of accepted jobs reach a valid terminal or recoverable state.
- Confirm artifact checksums before and after backup/restore.
