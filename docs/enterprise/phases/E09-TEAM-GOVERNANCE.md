# E09 - Team Workflows, RBAC and Governance

## Objective

Support multiple teams and projects with explicit ownership, approval boundaries and immutable decision history.

## Roles

- Viewer: read permitted projects, runs and reports.
- Analyst: create read-only jobs, triage findings and draft proposals.
- Approver: approve scoped code patches and policy exceptions.
- Project Admin: manage project settings, members, connectors and retention.
- Tenant Admin: manage tenant policy, identity provider and global integrations.

Permissions are capabilities, not hard-coded role-name checks. Custom roles can be added after the default matrix is stable.

## Workflow states

- Finding: open, acknowledged, suppressed, accepted risk, resolved, reopened.
- Proposal: draft, ready for review, approved, rejected, expired.
- Patch: preview, approved, applying, verified, failed, rolled back.
- Alert: open, acknowledged, snoozed, exception, assigned, resolved.

Every transition stores actor, timestamp, reason, previous state and related artifacts.

## Implementation tasks

- [ ] Add tenant, membership, role and capability models.
- [ ] Enforce authorization in application services and database access.
- [ ] Add SSO/OIDC support and local development identity mode.
- [ ] Add code owners and SEO owners at project, path, template and campaign scope.
- [ ] Add approval policies based on severity, protected files and environment.
- [ ] Add exception reason, owner and expiry.
- [ ] Add immutable decision and audit event views.
- [ ] Add comments and assignments without mixing them into evidence.
- [ ] Add notification preferences and preview-before-send behavior.
- [ ] Add project archive, export and deletion workflows.

## UX requirements

- Code and SEO dashboards remain separate in navigation and terminology.
- Cross-domain Combined Audit links to source runs instead of duplicating findings.
- Review views show evidence before recommendation and patch.
- Bulk actions display exact scope and require confirmation for mutation.
- All permission failures are explicit and do not reveal inaccessible resource existence.
- Persian/English and RTL/LTR behavior apply to all workflow states.

## Tests

- Capability matrix tests for every API action.
- Object-level authorization and IDOR tests.
- Approval race and expired-approval tests.
- Cross-tenant cache, queue and artifact access tests.
- Immutable event and exception-expiry tests.
- Browser journeys for analyst and approver roles.

## Acceptance criteria

- [ ] Every non-public API action is authorized against tenant and project membership.
- [ ] A user cannot approve their own protected change when separation-of-duties policy is enabled.
- [ ] Approval is bound to exact patch content and source hashes.
- [ ] Decision history is append-only and exportable.
- [ ] Expired suppressions and approvals cannot silently remain active.
- [ ] Tenant isolation passes automated API, database, cache, queue and artifact tests.

