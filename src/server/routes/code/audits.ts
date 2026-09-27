import { AuditCommandSchema } from "../../../contracts";
import type { RunCodeAudit } from "../../../code/application/runCodeAudit";
import type { AuditConfig } from "../../../core/types";
import type { RouteHandler } from "../types";
import { routeProblem } from "../types";
import type { LocalProjectCatalog } from "../platform/projects";
export function createCodeAuditRoutes(catalog: LocalProjectCatalog, service: RunCodeAudit, makeConfig: (path: string, options: { fix: boolean; severity?: "low" | "medium" | "high" | "critical" }) => AuditConfig): RouteHandler { return async (method, pathname, input) => {
  if (pathname !== "/api/v1/code/audits") return undefined;
  if (method !== "POST") return routeProblem(405, "METHOD_NOT_ALLOWED", "Method not allowed");
  const parsed = AuditCommandSchema.safeParse(input);
  if (!parsed.success || parsed.data.kind !== "code") return routeProblem(400, "INVALID_CODE_AUDIT_COMMAND", "Code audit command is invalid", parsed.success ? "Expected kind=code" : parsed.error.message);
  const project = await catalog.get(parsed.data.codeProjectId);
  if (!project || project.public.kind !== "code" || !project.repositoryPath) return routeProblem(404, "CODE_PROJECT_NOT_FOUND", "Code project not found");
  return { status: 200, body: await service.execute(makeConfig(project.repositoryPath, parsed.data.options)) };
}; }
