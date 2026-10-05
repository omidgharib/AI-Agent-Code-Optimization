import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { discoverBundleMetadata, parseBundleMetadata } from "../analyzers/performanceLab";

describe("bundle metadata integration", () => {
  let root: string;
  beforeEach(async () => { root = await fs.mkdtemp(path.join(os.tmpdir(), "bundle-test-")); });
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
  it("discovers esbuild weights and identifies shared modules", async () => {
    await fs.writeFile(path.join(root, "esbuild-meta.json"), JSON.stringify({ outputs: { "a.js": { inputs: { "shared.ts": { bytesInOutput: 100 }, "a.ts": { bytesInOutput: 40 } } }, "b.js": { inputs: { "shared.ts": { bytesInOutput: 60 } } } } }));
    const { report } = await discoverBundleMetadata(root);
    expect(report?.totalBytes).toBe(200);
    expect(report?.duplicatedBytes).toBe(160);
    expect(report?.modules[0].chunks).toEqual(["a.js", "b.js"]);
  });
  it("reads nested webpack modules without double counting containers", async () => {
    const file = path.join(root, "bundle-stats.json");
    await fs.writeFile(file, JSON.stringify({ modules: [{ name: "container", size: 999, chunks: [1, 2], modules: [{ name: "node_modules/lib/index.js", size: 80 }] }] }));
    const report = await parseBundleMetadata(file);
    expect(report.totalBytes).toBe(80);
    expect(report.modules[0]).toMatchObject({ duplicated: true, chunks: ["1", "2"] });
  });
  it("reports malformed and negative weights as unavailable", async () => {
    const file = path.join(root, "bundle-stats.json");
    await fs.writeFile(file, "{");
    expect((await discoverBundleMetadata(root)).error).toBeTruthy();
    await fs.writeFile(file, JSON.stringify({ modules: [{ name: "bad", size: -1 }] }));
    expect((await discoverBundleMetadata(root)).error).toContain("Invalid module weight");
  });
  it("does not invent data when metadata is absent", async () => {
    expect(await discoverBundleMetadata(root)).toEqual({});
  });
  it("supports Vite/Rollup rendered chunk lengths", async () => {
    const file = path.join(root, "bundle-stats.json");
    await fs.writeFile(file, JSON.stringify({ tool: "vite", chunks: [{ fileName: "app.js", modules: { "src/app.ts": { renderedLength: 120 } } }] }));
    expect(await parseBundleMetadata(file)).toMatchObject({ tool: "vite", totalBytes: 120 });
  });
});
