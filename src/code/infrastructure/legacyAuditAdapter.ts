import { runAudit } from "../../core/engine";
import type { CodeAuditRunner } from "../application/runCodeAudit";
export const legacyCodeAuditRunner: CodeAuditRunner = { run: runAudit };
