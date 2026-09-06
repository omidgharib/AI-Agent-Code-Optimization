import { z } from "zod";

export const CodeAuditOptionsSchema = z.object({ fix: z.boolean().default(false), severity: z.enum(["low", "medium", "high", "critical"]).optional() }).strict();
export const SeoAuditOptionsSchema = z.object({ lighthouse: z.boolean().default(true) }).strict();
export const CombinedAuditOptionsSchema = z.object({ correlateRuntime: z.boolean().default(true) }).strict();
export const AuditCommandSchema = z.discriminatedUnion("kind", [
  z.object({ schemaVersion: z.literal(1), kind: z.literal("code"), codeProjectId: z.string().min(1), options: CodeAuditOptionsSchema }).strict(),
  z.object({ schemaVersion: z.literal(1), kind: z.literal("seo"), seoProjectId: z.string().min(1), environmentId: z.string().min(1), options: SeoAuditOptionsSchema }).strict(),
  z.object({ schemaVersion: z.literal(1), kind: z.literal("combined"), codeProjectId: z.string().min(1), seoProjectId: z.string().min(1), environmentId: z.string().min(1), options: CombinedAuditOptionsSchema }).strict(),
]);
export type AuditCommand = z.infer<typeof AuditCommandSchema>;

export const JobEventSchema = z.object({ schemaVersion: z.literal(1), type: z.enum(["job.queued", "job.started", "job.completed", "job.failed"]), jobId: z.string().min(1), occurredAt: z.string().datetime(), payload: z.record(z.unknown()) }).strict();
export type JobEvent = z.infer<typeof JobEventSchema>;
