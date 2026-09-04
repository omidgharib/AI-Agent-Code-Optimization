import type { Issue } from "../../contracts";
export interface SeoAuditResult { schemaVersion: 1; kind: "seo"; url: string; findings: Issue[]; healthScore?: number }
