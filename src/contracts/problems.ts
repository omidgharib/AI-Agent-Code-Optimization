import { z } from "zod";
export const ProblemDetailsSchema = z.object({ schemaVersion: z.literal(1), type: z.string().min(1), title: z.string().min(1), status: z.number().int().min(400).max(599), code: z.string().regex(/^[A-Z][A-Z0-9_]+$/), detail: z.string().optional(), instance: z.string().optional() }).strict();
export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>;
export function problem(status: number, code: string, title: string, detail?: string): ProblemDetails { return ProblemDetailsSchema.parse({ schemaVersion: 1, type: `urn:ai-auditor:problem:${code.toLowerCase()}`, title, status, code, detail }); }
