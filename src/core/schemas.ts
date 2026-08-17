// FILE: src/core/schemas.ts
import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high", "critical"]);
export const CategorySchema = z.enum([
  "bug",
  "security",
  "performance",
  "maintainability",
  "a11y",
  "seo",
  "style",
  "test",
]);
export const ToolSchema = z.enum([
  "eslint",
  "tsc",
  "playwright",
  "lighthouse",
  "sonarqube",
  "custom",
]);

export const IssueSchema = z.object({
  id: z.string(),
  tool: ToolSchema,
  ruleId: z.string().optional(),
  message: z.string(),
  severity: SeveritySchema,
  category: CategorySchema,
  location: z
    .object({
      filePath: z.string(),
      startLine: z.number().optional(),
      startColumn: z.number().optional(),
      endLine: z.number().optional(),
      endColumn: z.number().optional(),
    })
    .optional(),
  evidence: z
    .object({
      snippet: z.string().optional(),
      relatedFiles: z.array(z.string()).optional(),
      url: z.string().optional(),
    })
    .optional(),
  fix: z
    .object({
      canAutoFix: z.boolean(),
      hint: z.string().optional(),
    })
    .optional(),
  meta: z.record(z.unknown()).optional(),
});

export const FixResponseSchema = z.object({
  patches: z.array(
    z.object({
      description: z.string(),
      unifiedDiff: z.string(),
      touches: z.array(z.string()),
    }),
  ),
  notes: z.array(z.string()).default([]),
});
