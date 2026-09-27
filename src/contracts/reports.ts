import { z } from "zod";
import { IssueSchema } from "./schemas";
export const AuditReportContractSchema = z.object({ schemaVersion: z.literal(1), runId: z.string().min(1).optional(), projectId: z.string().min(1).optional(), generatedAt: z.string().datetime(), findings: z.array(IssueSchema) }).passthrough();
export type AuditReportContract = z.infer<typeof AuditReportContractSchema>;
