import fs from "node:fs";
import path from "node:path";
import { AuditCommandSchema, JobEventSchema, ProblemDetailsSchema, ProjectSchema } from "../contracts";
import { RunCodeAudit } from "../code/application/runCodeAudit";
import { RunSeoAudit } from "../seo/application/runSeoAudit";
import { buildConfig } from "../core/config";
import { LocalProjectCatalog } from "../server/routes/platform/projects";
import { createSeoAuditRoutes } from "../server/routes/seo/audits";

describe("E01 versioned contracts", () => {
  it("round-trips each discriminated audit command and rejects unversioned input", () => {
    const commands = [
      { schemaVersion: 1, kind: "code", codeProjectId: "code-1", options: { fix: false } },
      { schemaVersion: 1, kind: "seo", seoProjectId: "seo-1", environmentId: "prod", options: { lighthouse: true } },
      { schemaVersion: 1, kind: "combined", codeProjectId: "code-1", seoProjectId: "seo-1", environmentId: "prod", options: { correlateRuntime: true } },
    ];
    for (const command of commands) expect(AuditCommandSchema.parse(JSON.parse(JSON.stringify(command)))).toEqual(command);
    expect(AuditCommandSchema.safeParse({ kind: "seo", seoProjectId: "x" }).success).toBe(false);
  });

  it("validates every public contract with schemaVersion", () => {
    expect(ProjectSchema.parse({ schemaVersion: 1, kind: "code", id: "c", name: "Code" }).schemaVersion).toBe(1);
    expect(JobEventSchema.parse({ schemaVersion: 1, type: "job.queued", jobId: "j", occurredAt: new Date().toISOString(), payload: {} }).schemaVersion).toBe(1);
    expect(ProblemDetailsSchema.parse({ schemaVersion: 1, type: "urn:test", title: "Bad", status: 400, code: "BAD_INPUT" }).schemaVersion).toBe(1);
  });

  it("keeps Code and SEO application services independently injectable", async () => {
    const code = new RunCodeAudit({ run: async () => ({ exitCode: 0 }) });
    const seo = new RunSeoAudit({ analyze: async () => ({ issues: [], healthScore: 100 }) });
    await expect(code.execute(buildConfig({ path: "." }))).resolves.toMatchObject({ schemaVersion: 1, kind: "code", exitCode: 0 });
    await expect(seo.execute({ url: "https://example.com" })).resolves.toMatchObject({ schemaVersion: 1, kind: "seo", healthScore: 100 });
  });

  it("runs a URL-only SEO route without projectPath or package.json", async () => {
    const catalog = new LocalProjectCatalog();
    const project = await catalog.create({ schemaVersion: 1, kind: "seo", name: "Site", environments: [{ name: "production", baseUrl: "https://example.com" }] });
    if (project.kind !== "seo") throw new Error("Expected SEO project");
    const route = createSeoAuditRoutes(catalog, new RunSeoAudit({ analyze: async () => ({ issues: [] }) }));
    const result = await route("POST", "/api/v1/seo/audits", { schemaVersion: 1, kind: "seo", seoProjectId: project.id, environmentId: project.environments[0].id, options: { lighthouse: false } });
    expect(result).toMatchObject({ status: 200, body: { schemaVersion: 1, kind: "seo", url: "https://example.com/" } });
  });
});

describe("E01 import boundaries", () => {
  it("prevents Code domain/application from importing SEO implementations", () => {
    const roots = [path.resolve("src/code/domain"), path.resolve("src/code/application")];
    for (const root of roots) for (const file of fs.readdirSync(root).filter((name) => name.endsWith(".ts"))) {
      const source = fs.readFileSync(path.join(root, file), "utf8");
      expect(source).not.toMatch(/from\s+["'][^"']*(?:\/seo\/|\/analyzers\/(?:seo|lighthouse)|\/seo$)/);
    }
  });

  it("keeps platform free of analyzer implementations", () => {
    const files: string[] = [];
    const visit = (directory: string) => { for (const entry of fs.readdirSync(directory, { withFileTypes: true })) entry.isDirectory() ? visit(path.join(directory, entry.name)) : entry.name.endsWith(".ts") && files.push(path.join(directory, entry.name)); };
    visit(path.resolve("src/platform"));
    for (const file of files) expect(fs.readFileSync(file, "utf8")).not.toMatch(/from\s+["'][^"']*\/analyzers\//);
  });
});
