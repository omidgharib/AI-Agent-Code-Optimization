import type { PrioritizedIssue } from "../../contracts";
export interface CodeAuditResult { schemaVersion: 1; kind: "code"; exitCode: number; findings?: PrioritizedIssue[] }
