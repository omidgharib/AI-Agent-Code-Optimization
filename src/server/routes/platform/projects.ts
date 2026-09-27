import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Project } from "../../../contracts";
import type { RouteHandler } from "../types";
import { routeProblem } from "../types";
import type { PersistentProjectRepository } from "../../../platform/persistence/repositories";

const CreateProjectSchema = z.discriminatedUnion("kind", [
  z.object({ schemaVersion: z.literal(1), kind: z.literal("code"), name: z.string().min(1), repositoryPath: z.string().min(1) }).strict(),
  z.object({ schemaVersion: z.literal(1), kind: z.literal("seo"), name: z.string().min(1), environments: z.array(z.object({ name: z.string().min(1), baseUrl: z.string().url() }).strict()).min(1) }).strict(),
]);
type InternalProject = { public: Project; repositoryPath?: string };
export class LocalProjectCatalog {
  private readonly projects = new Map<string, InternalProject>();
  constructor(private readonly persistent?: PersistentProjectRepository, private readonly tenantId = "local", private readonly ready: Promise<unknown> = Promise.resolve()) {}
  async create(input: unknown): Promise<Project> {
    await this.ready;
    const value = CreateProjectSchema.parse(input);
    const id = randomUUID();
    const project: Project = value.kind === "code"
      ? { schemaVersion: 1, kind: "code", id: id as never, name: value.name }
      : { schemaVersion: 1, kind: "seo", id: id as never, name: value.name, environments: value.environments.map((environment) => ({ ...environment, id: randomUUID() as never })) };
    this.projects.set(id, { public: project, ...(value.kind === "code" ? { repositoryPath: value.repositoryPath } : {}) });
    if (this.persistent) await this.persistent.save(this.tenantId, project, value.kind === "code" ? { repositoryPath: value.repositoryPath } : {});
    return project;
  }
  async get(id: string): Promise<InternalProject | undefined> { await this.ready; const memory = this.projects.get(id); if (memory) return memory; const stored = await this.persistent?.get(this.tenantId, id); if (!stored) return undefined; const entry = { public: stored.public, repositoryPath: typeof stored.privateConfig.repositoryPath === "string" ? stored.privateConfig.repositoryPath : undefined }; this.projects.set(id, entry); return entry; }
  async list() { await this.ready; return this.persistent ? this.persistent.list(this.tenantId) : [...this.projects.values()].map((entry) => entry.public); }
}
export function createPlatformProjectRoutes(catalog: LocalProjectCatalog): RouteHandler { return async (method, pathname, input) => {
  if (pathname !== "/api/v1/platform/projects") return undefined;
  if (method === "GET") return { status: 200, body: { schemaVersion: 1, projects: await catalog.list() } };
  if (method === "POST") { try { return { status: 201, body: await catalog.create(input) }; } catch (error) { return routeProblem(400, "INVALID_PROJECT", "Project payload is invalid", error instanceof Error ? error.message : String(error)); } }
  return routeProblem(405, "METHOD_NOT_ALLOWED", "Method not allowed");
}; }
