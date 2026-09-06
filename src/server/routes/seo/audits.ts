import { AuditCommandSchema } from "../../../contracts";
import type { RunSeoAudit } from "../../../seo/application/runSeoAudit";
import type { RouteHandler } from "../types";
import { routeProblem } from "../types";
import type { LocalProjectCatalog } from "../platform/projects";
export function createSeoAuditRoutes(catalog: LocalProjectCatalog, service: RunSeoAudit): RouteHandler { return async (method, pathname, input) => {
  if (pathname !== "/api/v1/seo/audits") return undefined;
  if (method !== "POST") return routeProblem(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  const parsed = AuditCommandSchema.safeParse(input);
  if (!parsed.success || parsed.data.kind !== "seo") return routeProblem(400, "INVALID_SEO_AUDIT_COMMAND", "SEO audit command is invalid", parsed.success ? "Expected kind=seo" : parsed.error.message);
  const command = parsed.data;
  const entry = await catalog.get(command.seoProjectId);
  if (!entry || entry.public.kind !== "seo") return routeProblem(404, "SEO_PROJECT_NOT_FOUND", "SEO project not found");
  const environment = entry.public.environments.find((item) => item.id === command.environmentId);
  if (!environment) return routeProblem(404, "SEO_ENVIRONMENT_NOT_FOUND", "SEO environment not found");
  return { status: 200, body: await service.execute({ url: environment.baseUrl }) };
}; }
