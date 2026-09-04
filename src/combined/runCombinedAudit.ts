import type { AuditConfig } from "../core/types";
import type { RunCodeAudit } from "../code/application/runCodeAudit";
import type { RunSeoAudit } from "../seo/application/runSeoAudit";
export class RunCombinedAudit {
  constructor(private readonly code: RunCodeAudit, private readonly seo: RunSeoAudit) {}
  async execute(input: { code: AuditConfig; seoUrl: string }) { const [code, seo] = await Promise.all([this.code.execute(input.code), this.seo.execute({ url: input.seoUrl })]); return { schemaVersion: 1 as const, kind: "combined" as const, code, seo }; }
}
