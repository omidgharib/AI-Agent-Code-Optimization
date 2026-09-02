import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runDependencyAudit, runProjectHealth } from "../analyzers/projectHealth";
import { runPlaywright } from "../analyzers/playwright";
import { toMarkdown } from "../report/markdown";
import type { ReportData } from "../report/summary";
import { loadProjectIgnore } from "../core/projectIgnore";

describe("Phase 2 analyzers", () => {
  it("honors .gitignore and always ignores lock/generated files", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-auditor-ignore-"));
    try {
      await fs.writeFile(path.join(root, ".gitignore"), "private/\n*.generated.ts\n");
      const projectIgnore = await loadProjectIgnore(root);
      expect(projectIgnore.ignores("private/secret.ts")).toBe(true);
      expect(projectIgnore.ignores("src/schema.generated.ts")).toBe(true);
      expect(projectIgnore.ignores("package-lock.json")).toBe(true);
      expect(projectIgnore.ignores("pnpm-lock.yaml")).toBe(true);
      expect(projectIgnore.ignores("src/index.ts")).toBe(false);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it("detects unused imports, oversized bundles and framework rules with evidence", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-auditor-phase2-"));
    try {
      await fs.mkdir(path.join(root, "src"));
      await fs.mkdir(path.join(root, "dist"));
      await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { react: "18.0.0", vite: "5.0.0" }, scripts: {} }));
      await fs.writeFile(path.join(root, "src", "main.ts"), 'import { unused } from "./util";\nconsole.log("ready");\n');
      await fs.writeFile(path.join(root, "src", "util.ts"), "export const unused = 1;\n");
      await fs.writeFile(path.join(root, "dist", "app.js"), "x".repeat(510_000));

      const issues = await runProjectHealth(root);
      expect(issues.some((item) => item.ruleId === "unused-import")).toBe(true);
      expect(issues.some((item) => item.ruleId === "oversized-bundle")).toBe(true);
      expect(issues.some((item) => item.ruleId === "react-a11y-rules")).toBe(true);
      expect(issues.some((item) => item.ruleId === "vite-build-script")).toBe(true);
      expect(issues.every((item) => item.evidence?.snippet && item.meta?.reproducible)).toBe(true);
    } finally { await fs.rm(root, { recursive: true, force: true }); }
  });

  it("does not launch Playwright when no runtime URL is configured", async () => {
    await expect(runPlaywright("C:\\sample")).resolves.toEqual([]);
  });

  it("maps registry advisories and latest versions without changing lockfiles", async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "ai-auditor-deps-"));
    const fetchMock = jest.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("advisories/bulk")) return new Response(JSON.stringify({ demo: [{ id: 42, title: "Demo advisory", severity: "high", vulnerable_versions: "<2", url: "https://example.test/42" }] }), { status: 200 });
      return new Response(JSON.stringify({ "dist-tags": { latest: "2.0.0" } }), { status: 200 });
    });
    try {
      await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ dependencies: { demo: "^1.0.0" } }));
      await fs.writeFile(path.join(root, "package-lock.json"), JSON.stringify({ lockfileVersion: 3, packages: { "": {}, "node_modules/demo": { version: "1.0.0" } } }));
      const before = await fs.readFile(path.join(root, "package-lock.json"), "utf8");
      const issues = await runDependencyAudit(root);
      expect(issues.some((item) => item.ruleId === "vulnerable-dependency" && item.severity === "high")).toBe(true);
      expect(issues.some((item) => item.ruleId === "outdated-dependency")).toBe(true);
      expect(await fs.readFile(path.join(root, "package-lock.json"), "utf8")).toBe(before);
    } finally {
      fetchMock.mockRestore();
      await fs.rm(root, { recursive: true, force: true });
    }
  });

  it("renders Lighthouse categories and audit evidence in Markdown", () => {
    const data: ReportData = {
      summary: { total: 0, bySeverity: {}, byCategory: {}, byTool: {} }, topIssues: [], tools: {}, patches: [], recommendations: [],
      fixSummary: { mechanical: 0, mechanicalMode: "dry-run", aiPatches: 0, advisoryRecommendations: 0 },
      verification: { passed: true, errors: [] },
      lighthouse: {
        requestedUrl: "http://localhost:3000", categories: { performance: { id: "performance", title: "Performance", score: 0.72 } },
        audits: { lcp: { id: "lcp", title: "Largest Contentful Paint", description: "LCP evidence", score: 0.5, scoreDisplayMode: "numeric", displayValue: "3.1 s", details: { overallSavingsMs: 500, items: [{ url: "/hero.png" }] } } },
      },
    };
    const markdown = toMarkdown(data);
    expect(markdown).toContain("## Lighthouse details");
    expect(markdown).toContain("Performance");
    expect(markdown).toContain("LCP evidence");
    expect(markdown).toContain("Savings: 500 ms");
  });
});
