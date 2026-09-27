import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stableFindingFingerprint, correlateFindings } from "../code/domain/analyzer";
import { detectWorkspaceGraph } from "../code/domain/workspaceGraph";
import { CODE_ANALYZERS } from "../code/application/analyzerManifest";
import { loadCodeAuditPolicy } from "../code/application/policy";
import { allowedEnvironment } from "../platform/security/sandboxRunner";
import { atomicReplace, safeRead } from "../platform/security/safeMutation";
import type { Issue } from "../core/types";

const issue = (message: string): Issue => ({ id: "legacy", tool: "eslint", ruleId: "no-eval", message, severity: "high", category: "security", location: { filePath: "src/a.ts", startLine: 4, startColumn: 2 }, meta: { messageId: "unexpected" } });
describe("E04 production code audit", () => {
  it("uses pinned manifests and stable fingerprints independent of wording", () => { expect(CODE_ANALYZERS.map((item) => item.id)).toEqual(["eslint", "typescript"]); expect(CODE_ANALYZERS.every((item) => /^\d+\./.test(item.version))).toBe(true); expect(stableFindingFingerprint(issue("first wording"))).toBe(stableFindingFingerprint(issue("rewritten message"))); });
  it("tracks introduced, recurring and resolved findings", () => { const fingerprint = stableFindingFingerprint(issue("x")); const result = correlateFindings([issue("y")], [fingerprint, "aaaaaaaaaaaaaaaaaaaaaaaa"]); expect(result.active[0].state).toBe("recurring"); expect(result.resolved).toHaveLength(1); });
  it("detects pnpm monorepo boundaries without executing scripts", async () => { const root = await fs.mkdtemp(path.join(os.tmpdir(), "e04-workspace-")); await fs.mkdir(path.join(root, "packages", "a"), { recursive: true }); await fs.writeFile(path.join(root, "package.json"), JSON.stringify({ name: "root", workspaces: ["packages/*"], scripts: { postinstall: "exit 99" } })); await fs.writeFile(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: 9"); await fs.writeFile(path.join(root, "packages", "a", "package.json"), JSON.stringify({ name: "a" })); const graph = await detectWorkspaceGraph(root); expect(graph.packageManager).toBe("pnpm"); expect(graph.packages.map((item) => item.name)).toEqual(["root", "a"]); });
  it("loads a versioned default policy", async () => { const root = await fs.mkdtemp(path.join(os.tmpdir(), "e04-policy-")); expect(await loadCodeAuditPolicy(root)).toMatchObject({ schemaVersion: 1, maxNewFindings: 0 }); });
  it("does not inherit NODE_OPTIONS or credentials into analyzer workers", () => { const previous = process.env.NODE_OPTIONS; process.env.NODE_OPTIONS = "--require=evil"; const env = allowedEnvironment(); expect(env.NODE_OPTIONS).toBeUndefined(); expect(Object.keys(env).some((key) => /KEY|TOKEN|SECRET/.test(key))).toBe(false); if (previous === undefined) delete process.env.NODE_OPTIONS; else process.env.NODE_OPTIONS = previous; });
  it("rejects a stale source hash and preserves exact bytes", async () => { const root = await fs.mkdtemp(path.join(os.tmpdir(), "e04-write-")); await fs.mkdir(path.join(root, "src")); const file = path.join(root, "src", "a.ts"); await fs.writeFile(file, Buffer.from([0xef,0xbb,0xbf,0x61,0x0d,0x0a])); const before = await safeRead(root, "src/a.ts"); await fs.writeFile(file, "changed"); await expect(atomicReplace(root, "src/a.ts", "new", before.sha256)).rejects.toThrow(/concurrent modification/); expect(await fs.readFile(file, "utf8")).toBe("changed"); });
});
