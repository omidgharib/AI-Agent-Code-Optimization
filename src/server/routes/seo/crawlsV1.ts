import { z } from "zod";
import { crawlSite } from "../../../analyzers/seoCrawler";
import type { RouteHandler } from "../types";
import { routeProblem } from "../types";
import type { LocalProjectCatalog } from "../platform/projects";

const CrawlCommand = z.object({ schemaVersion: z.literal(1), seoProjectId: z.string().uuid(), environmentId: z.string().uuid(), options: z.object({ maxPages: z.number().int().min(1).max(100).default(25), maxDepth: z.number().int().min(0).max(8).default(3) }).partial().default({}) }).strict();

export function createSeoCrawlRoutes(catalog: LocalProjectCatalog): RouteHandler { return async (method, pathname, input) => {
  if (pathname !== "/api/v1/seo/crawls") return undefined;
  if (method !== "POST") return routeProblem(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  const parsed = CrawlCommand.safeParse(input); if (!parsed.success) return routeProblem(400, "INVALID_SEO_CRAWL_COMMAND", "SEO crawl command is invalid", parsed.error.message);
  const project = await catalog.get(parsed.data.seoProjectId); if (!project || project.public.kind !== "seo") return routeProblem(404, "SEO_PROJECT_NOT_FOUND", "SEO project not found");
  const environment = project.public.environments.find((item) => item.id === parsed.data.environmentId); if (!environment) return routeProblem(404, "SEO_ENVIRONMENT_NOT_FOUND", "SEO environment not found");
  const result = await crawlSite(environment.baseUrl, { budget: { maxPages: parsed.data.options.maxPages ?? 25, maxDepth: parsed.data.options.maxDepth ?? 3, concurrency: 3, delayMs: 100, maxDurationMs: 60_000, maxResponseBytes: 2_000_000 } });
  return { status: 200, body: { schemaVersion: 1, projectId: parsed.data.seoProjectId, environmentId: parsed.data.environmentId, ...result } };
}; }
