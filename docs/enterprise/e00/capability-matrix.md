# Deployment capability matrix

| Capability | Local mode | Team mode |
| --- | --- | --- |
| Identity | Implicit OS user/tenant | Authentication, membership, RBAC |
| Network | Loopback default | TLS authenticated API |
| Projects | Code and URL-only SEO | Code and URL-only SEO |
| Database | SQLite supported | PostgreSQL required; reject SQLite |
| Artifacts | Platform filesystem | S3-compatible required |
| Placement | Outside target repo; explicit export | Tenant-prefixed; no authoritative worker copy |
| Secrets | Environment/local provider | Managed references, scoped access, rotation |
| Jobs | In-process/child process | Durable queue, isolated workers |
| Authorization | Explicit path/URL consent | Tenant/project policy; fail closed |
| Audit history | Local structured events | Immutable actor-attributed events |
| Egress | SSRF-protected | Policy-controlled SSRF/DNS/redirect checks |
| Retention | User-configurable purge | Tenant policy/legal holds/lifecycle |
| Scale | Single instance | Multi-instance/backups/recovery |

Mode is explicit at startup. Team mode cannot fall back to local capabilities.
