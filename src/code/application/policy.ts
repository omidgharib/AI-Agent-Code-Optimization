import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const Severity = z.enum(["low", "medium", "high", "critical"]);
/** Repository-owned guardrails. All fields are optional so an existing policy
 * remains valid while a project can progressively tighten its change rules. */
export const SonarPolicySchema = z.object({ enabled: z.boolean().default(false), required: z.boolean().default(false), hostUrl: z.string().url().default("http://127.0.0.1:9000"), projectKey: z.string().default(""), sources: z.array(z.string()).default(["src"]), tests: z.array(z.string()).default([]), exclusions: z.array(z.string()).default(["**/node_modules/**", "**/dist/**", "**/coverage/**", "**/ai-auditor-report/**"]) });
export const CodeAuditPolicySchema = z.object({ schemaVersion: z.literal(1), minimumSeverity: Severity.default("low"), maxNewFindings: z.number().int().min(0).default(0), changedOnly: z.boolean().default(false), suppressedFingerprints: z.array(z.string().regex(/^[a-f0-9]{24}$/)).default([]), acceptedRiskFingerprints: z.array(z.string().regex(/^[a-f0-9]{24}$/)).default([]), globalGates: z.array(z.string()).default([]), forbiddenPaths: z.array(z.string()).default([]), maxFilesPerChangeSet: z.number().int().min(1).default(5), maxLinesPerChangeSet: z.number().int().min(1).default(300), sensitivePaths: z.array(z.string()).default([]), requiredTestsForPaths: z.array(z.object({ path: z.string(), tests: z.array(z.string()).min(1) })).default([]), protectedPublicApis: z.array(z.string()).default([]), autoApplySeverities: z.array(Severity).default([]), maxAiRequests: z.number().int().min(1).default(10), maxAiTokens: z.number().int().min(1).default(100000), sonar: SonarPolicySchema.default({}) });
export type CodeAuditPolicy = z.infer<typeof CodeAuditPolicySchema>;
export async function loadCodeAuditPolicy(root: string): Promise<CodeAuditPolicy> { try { return CodeAuditPolicySchema.parse(JSON.parse(await fs.readFile(path.join(root, ".ai-auditor-policy.json"), "utf8"))); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return CodeAuditPolicySchema.parse({ schemaVersion: 1 }); throw error; } }
