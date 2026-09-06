import type { Issue } from "../../contracts";
import type { SeoAuditResult } from "../domain/seoAudit";
export interface SeoAuditAnalyzers { analyze(url: string): Promise<{ issues: Issue[]; healthScore?: number }> }
export class RunSeoAudit {
  constructor(private readonly analyzers: SeoAuditAnalyzers) {}
  async execute(input: { url: string }): Promise<SeoAuditResult> {
    const url = new URL(input.url);
    if (!(["http:", "https:"] as string[]).includes(url.protocol)) throw new Error("SEO URL must use HTTP or HTTPS");
    const result = await this.analyzers.analyze(url.toString());
    return { schemaVersion: 1, kind: "seo", url: url.toString(), findings: result.issues, healthScore: result.healthScore };
  }
}
