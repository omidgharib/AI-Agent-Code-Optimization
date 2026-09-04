# Security incident response

1. Contain: disable the affected connector/model endpoint, pause workers, revoke sessions and rotate the referenced credential in the OS or managed secret store. Do not copy secret values into tickets or logs.
2. Preserve: export the hash-chained security audit log, job metadata and content-addressed artifacts under legal-hold policy. Record UTC times and hashes.
3. Investigate: identify tenant, actor, resource, approval, patch hash, target revision and network destination. Verify the audit chain before relying on it.
4. Eradicate: revoke the old credential reference, provision a new version, update only `secret_ref`, invalidate sessions, rebuild from the locked dependency graph and signed release.
5. Recover: run E03 negative tests, full tests, vulnerability/license gates and a seeded-secret artifact scan before resuming workers.
6. Notify and review: follow contractual/regulatory timelines, document scope without secret material, and turn the root cause into a regression test.

## Credential rotation

- Local mode: credentials are supplied by OS-managed environment/credential injection and represented as `env://NAME`; the application never writes their values.
- Team mode: use a managed secret-store version reference. Grant workers read access only for the job lifetime; browsers receive neither values nor references.
- Rotate by creating a new version, testing it, atomically switching the reference, revoking the old version, and confirming the old value is rejected.
