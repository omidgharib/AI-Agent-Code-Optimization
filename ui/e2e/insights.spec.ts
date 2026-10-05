import { test, expect } from "@playwright/test";

for (const lang of ["en", "fa"]) {
  test(`architecture and bundle exploration (${lang})`, async ({ page }) => {
    await page.addInitScript(language => localStorage.setItem("ai-auditor-lang", language), lang);
    const job = { id: "insight-fixture", projectPath: "C:/fixtures/insight-demo", createdAt: "2026-10-05T10:00:00Z", status: "completed", reportPath: "fixture", logs: [] };
    await page.route("**/api/jobs", route => route.fulfill({ json: [job] }));
    await page.route("**/api/jobs/insight-fixture/events", route => route.fulfill({ contentType: "text/event-stream", body: "" }));
    await page.route("**/api/jobs/insight-fixture/report", route => route.fulfill({ json: {
      summary: { total: 0, bySeverity: {}, byTool: {} }, topIssues: [], patches: [], recommendations: [], verification: { passed: true, errors: [] },
      architecture: { debtScore: 88, debtFactors: { cycles: 12 }, findings: [], cycles: [["a.ts", "b.ts", "a.ts"]], nodes: [
        { file: "a.ts", imports: ["b.ts"], exports: [], incoming: 1, outgoing: 1, lines: 10, kind: "production" },
        { file: "b.ts", imports: ["a.ts"], exports: [], incoming: 1, outgoing: 1, lines: 10, kind: "production" },
        { file: "c.ts", imports: ["a.ts"], exports: [], incoming: 0, outgoing: 1, lines: 10, kind: "test" },
      ] }, performanceLab: { performance: 0, bundle: 99, bundleReport: { tool: "esbuild", totalBytes: 150, duplicatedBytes: 100, modules: [
        { name: "shared.ts", bytes: 100, chunks: ["a.js", "b.js"], duplicated: true },
        { name: "entry.ts", bytes: 50, chunks: ["a.js"], duplicated: false },
      ] } },
    } }));
    await page.goto("/code");
    await page.locator("#history button").filter({ hasText: "insight-demo" }).click();
    const graph = page.getByTestId("architecture-graph");
    await expect(graph.locator("svg")).toBeVisible();
    await expect(graph.locator("line")).toHaveCount(2);
    await graph.locator("svg [role=button]").filter({ hasText: "b.ts" }).click();
    await expect(graph.locator("select")).toHaveValue("b.ts");
    await graph.locator("input[type=checkbox]").check();
    await expect(graph.locator("option")).toHaveCount(2);
    await graph.locator("input:not([type=checkbox])").fill("missing");
    await expect(graph.locator("svg")).toHaveCount(0);
    const bundle = page.getByTestId("bundle-lab");
    await bundle.locator("input[type=checkbox]").check();
    await expect(bundle.locator(".bundle-rows button")).toHaveCount(1);
    await bundle.locator(".bundle-rows button").click();
    await expect(bundle.locator("pre")).toContainText("b.js");
  });
}
