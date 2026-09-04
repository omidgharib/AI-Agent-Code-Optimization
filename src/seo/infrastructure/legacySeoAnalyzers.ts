import { runSeoLab } from "../../analyzers/seoLab";
import type { SeoAuditAnalyzers } from "../application/runSeoAudit";
import { createHash } from "node:crypto";
import { describeNetworkError } from "../../core/errorDiagnosis";
export const legacySeoAnalyzers: SeoAuditAnalyzers = { async analyze(url) { try { const result = await runSeoLab(url); return { issues: result.issues, healthScore: result.health.score }; } catch (error) { const message = `Target URL could not be reached: ${describeNetworkError(error, 15_000)}`; return { healthScore: 0, issues: [{ id: createHash("sha256").update(`seo:network:${url}:${message}`).digest("hex").slice(0, 16), tool: "custom", ruleId: "seo-target-unreachable", message, severity: "high", category: "seo", location: { filePath: "-" }, evidence: { url }, fix: { canAutoFix: false, strategy: "advisory" } }] }; } } };
