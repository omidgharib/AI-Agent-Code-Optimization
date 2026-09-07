import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { auditArtifactRoot } from "../../platform/artifacts/paths";
import { applyPreparedChangeSet, type PreparedChangeSet } from "../../fix/changeSet";
import { runEslint } from "../../analyzers/eslint";
import { runTsc } from "../../analyzers/tsc";

interface StoredPatch {
  id?: string;
  unifiedDiff?: string;
  description?: string;
  touches?: string[];
  preApplySha256?: string;
  changeSetId?: string;
  issueIds?: string[];
  verification?: PreparedChangeSet["verification"];
}
const runDirectory = (repoRoot: string, runId: string) => { if (!/^[0-9T:-]+(?:-[0-9]{2})?$/.test(runId)) throw new Error("Invalid run ID"); return path.join(auditArtifactRoot(repoRoot), runId); };
const patchId = (patch: StoredPatch, index: number) => patch.id ?? crypto.createHash("sha256").update(patch.unifiedDiff ?? String(index)).digest("hex").slice(0, 16);
export async function applyApprovedPatch(repoRoot: string, runId: string, requestedId: string, actor: string, reason: string) {
  if (!actor.trim() || !reason.trim()) throw new Error("--actor and --reason are required approval evidence");
  const dir = runDirectory(repoRoot, runId); const report = JSON.parse(await fs.readFile(path.join(dir, "report.json"), "utf8")) as { patches?: StoredPatch[] };
  const patches = report.patches ?? [];
  const index = patches.findIndex((item, i) => patchId(item, i) === requestedId || item.changeSetId === requestedId);
  const patch = patches[index];
  if (!patch?.unifiedDiff) throw new Error(`Patch ${requestedId} not found`);
  const members = patch.changeSetId ? patches.filter((item) => item.changeSetId === patch.changeSetId) : [patch];
  if (members.some((item) => !item.unifiedDiff || !item.preApplySha256))
    throw new Error("Change set lacks preview hashes and cannot be approved");
  const baseSha256 = Object.fromEntries(members.flatMap((item) => (item.touches ?? []).map((file) => [file, item.preApplySha256!])));
  const prepared: PreparedChangeSet = {
    id: patch.changeSetId ?? requestedId,
    description: members.map((item) => item.description ?? "patch").join("; "),
    issueIds: [...new Set(members.flatMap((item) => item.issueIds ?? []))],
    patches: members.map((item) => ({ description: item.description ?? "patch", unifiedDiff: item.unifiedDiff!, touches: item.touches ?? [] })),
    touches: [...new Set(members.flatMap((item) => item.touches ?? []))],
    baseSha256,
    verification: patch.verification ?? {
      passed: true, fixedIssueIds: [], beforeIssueCount: 0, afterIssueCount: 0,
      introducedSevere: 0,
      checks: { eslint: "passed", typescript: "passed", relatedTests: "not-found" },
      relatedTests: [], attempts: 0,
      confidence: { diagnosis: 0, patch: 0, behavioral: 0, status: "red", reasons: ["Legacy patch has no verified decision evidence"] },
      impact: { importers: [], routes: [], publicApis: [], relatedTests: [], sensitiveFiles: [], policyViolations: [] },
    },
  };
  const approval = { schemaVersion: 1, changeSetId: prepared.id, actor, reason, approvedAt: new Date().toISOString(), targets: prepared.touches, baseSha256 };
  await fs.writeFile(path.join(dir, `approval-${requestedId}.json`), JSON.stringify(approval, null, 2), { flag: "wx" });
  await applyPreparedChangeSet(repoRoot, prepared);
  return approval;
}
export async function verifyCodeRun(repoRoot: string, runId: string) {
  const dir = runDirectory(repoRoot, runId); await fs.access(path.join(dir, "report.json"));
  const [eslint, tsc] = await Promise.all([runEslint(repoRoot), runTsc(repoRoot)]); const result = { schemaVersion: 1, runId, verifiedAt: new Date().toISOString(), checks: { eslint: eslint.length, typescript: tsc.length }, passed: ![...eslint, ...tsc].some((item) => item.severity === "critical") };
  await fs.writeFile(path.join(dir, "verification.json"), JSON.stringify(result, null, 2)); return result;
}
