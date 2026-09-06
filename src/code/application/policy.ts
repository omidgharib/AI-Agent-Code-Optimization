import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

export const CodeAuditPolicySchema = z.object({ schemaVersion: z.literal(1), minimumSeverity: z.enum(["low", "medium", "high", "critical"]).default("low"), maxNewFindings: z.number().int().min(0).default(0), changedOnly: z.boolean().default(false), suppressedFingerprints: z.array(z.string().regex(/^[a-f0-9]{24}$/)).default([]), acceptedRiskFingerprints: z.array(z.string().regex(/^[a-f0-9]{24}$/)).default([]), globalGates: z.array(z.string()).default([]) });
export type CodeAuditPolicy = z.infer<typeof CodeAuditPolicySchema>;
export async function loadCodeAuditPolicy(root: string): Promise<CodeAuditPolicy> { try { return CodeAuditPolicySchema.parse(JSON.parse(await fs.readFile(path.join(root, ".ai-auditor-policy.json"), "utf8"))); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return CodeAuditPolicySchema.parse({ schemaVersion: 1 }); throw error; } }
