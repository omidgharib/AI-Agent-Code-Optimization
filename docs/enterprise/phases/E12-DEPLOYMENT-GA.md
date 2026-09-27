# E12 - Deployment, Compliance and General Availability

## Objective

Provide repeatable local and team deployments, documented operational limits and a controlled enterprise launch process.

## Supported deployment profiles

### Local workstation

- Loopback-only API and local identity.
- SQLite and filesystem artifact storage.
- OS credential manager.
- Bounded local workers.
- No remote team access.

### Single-tenant team

- Containerized API and worker roles.
- PostgreSQL, durable queue and S3-compatible storage.
- OIDC/SSO and RBAC.
- Managed secrets, TLS and centralized telemetry.
- Optional private-network crawling through an explicitly deployed worker pool.

### Managed multi-tenant

Deferred until tenant isolation, data residency, abuse controls, cost isolation and independent security assessment are proven.

## Packaging and release

- Reproducible locked builds.
- Minimal runtime images and non-root execution.
- SBOM, dependency provenance and vulnerability scan.
- Signed images, packages and checksums.
- Database migration and rollback policy.
- Versioned API and documented compatibility window.
- Feature flags for risky capabilities.
- Staged rollout with canary tenants and rollback criteria.

## Compliance foundations

- Data inventory and processing purpose.
- Data retention, deletion, export and legal-hold behavior.
- Access review and least-privilege policy.
- Encryption and key-rotation documentation.
- Audit event retention and integrity.
- Subprocessor and external AI-provider disclosure.
- Incident response, vulnerability disclosure and security contact.
- Backup, recovery and business continuity evidence.

Do not claim a certification until an authorized assessment is complete. This phase creates controls and evidence; it does not self-certify SOC 2, ISO 27001 or another framework.

## Implementation tasks

- [ ] Create production Dockerfiles and deployment manifests.
- [ ] Add environment schema validation and startup failure on unsafe configuration.
- [ ] Add migration automation with preflight and rollback guidance.
- [ ] Generate and publish SBOM and signed artifacts.
- [ ] Add backup, restore and disaster recovery automation.
- [ ] Add data export and verified deletion workflows.
- [ ] Add admin controls for retention, connectors and feature flags.
- [ ] Document capacity planning and supported limits.
- [ ] Complete penetration test and dependency review.
- [ ] Run private beta, canary and general-availability checklists.

## GA checklist

- [ ] E00-E11 acceptance criteria are complete or explicitly waived by named owners.
- [ ] No unresolved critical/high security finding.
- [ ] SLO dashboards, alerts and runbooks are active.
- [ ] Backup restoration and worker recovery have been exercised.
- [ ] Tenant isolation and authorization suites pass in the release environment.
- [ ] Accuracy and performance results meet published targets.
- [ ] Documentation covers installation, upgrades, rollback and incident contact.
- [ ] Support ownership and escalation path are staffed.
- [ ] Release can be disabled or rolled back without data corruption.

## Post-GA controls

- Monthly dependency and analyzer compatibility review.
- Quarterly recovery, access and incident-response exercises.
- Rule-quality review using false positives and corpus regressions.
- Capacity review before raising project URL or repository limits.
- Explicit approval before enabling new connector scopes or autonomous mutations.
