import { z } from "zod";
import type { CodeProjectId, EnvironmentId, SeoProjectId } from "./identifiers";

export const CodeProjectSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("code"), id: z.string().min(1), name: z.string().min(1) }).strict();
export const SeoProjectSchema = z.object({ schemaVersion: z.literal(1), kind: z.literal("seo"), id: z.string().min(1), name: z.string().min(1), environments: z.array(z.object({ id: z.string().min(1), name: z.string().min(1), baseUrl: z.string().url() }).strict()).min(1) }).strict();
export const ProjectSchema = z.discriminatedUnion("kind", [CodeProjectSchema, SeoProjectSchema]);
export type CodeProject = Omit<z.infer<typeof CodeProjectSchema>, "id"> & { id: CodeProjectId };
export type SeoProject = Omit<z.infer<typeof SeoProjectSchema>, "id" | "environments"> & { id: SeoProjectId; environments: Array<{ id: EnvironmentId; name: string; baseUrl: string }> };
export type Project = CodeProject | SeoProject;
