import type { AuditConfig } from "../../core/types";
import type { CodeAuditResult } from "../domain/codeAudit";
export interface CodeAuditRunner { run(config: AuditConfig): Promise<{ exitCode: number }> }
export class RunCodeAudit {
  constructor(private readonly runner: CodeAuditRunner) {}
  async execute(config: AuditConfig): Promise<CodeAuditResult> { const result = await this.runner.run(config); return { schemaVersion: 1, kind: "code", exitCode: result.exitCode }; }
}
