# Data classification, retention, and report migration

Derived artifacts inherit the highest input level. Defaults yield to stricter policy/legal hold.

| Data | Level | Handling | Default |
| --- | --- | --- | --- |
| Public URL data | L1 Public | Integrity and crawl policy | 90 days |
| Audit metadata | L2 Internal | Tenant-scoped | 365 days |
| Source code | L3 Confidential | Encrypt, least privilege, no cross-tenant cache | 30 days |
| Personal data | L3 Confidential | Minimize, redact, delete workflow | 30 days unless required metadata |
| Secrets | L4 Restricted | Do not collect; redact before logs/model/artifacts | 0 days; quarantine/delete |

## `ai-auditor-report/` migration

Committed reports are legacy inputs, not the future store. E01/E02 will stop repository-local output by default, ignore new output, and provide explicit import recording tenant/project/run/hash/classification/provenance. Git history is never rewritten automatically. After verified import or explicit discard, tracked reports are removed in a dedicated review. Explicit `--export <path>` remains. Until migration reports are L3; detected secrets become L4 and trigger rotation/incident review.
