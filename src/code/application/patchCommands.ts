import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { auditArtifactRoot } from "../../platform/artifacts/paths";
import { applyDiff, getDiffTargetPath } from "../../fix/diffApplier";
import { PatchTransaction } from "../../fix/patchTransaction";
import { runEslint } from "../../analyzers/eslint";
import { runTsc } from "../../analyzers/tsc";
import { safeRead } from "../../platform/security/safeMutation";

interface StoredPatch { id?: string; unifiedDiff?: string; description?: string; preApplySha256?: string }
const runDirectory = (repoRoot: string, runId: string) => { if (!/^[0-9T:-]+(?:-[0-9]{2})?$/.test(runId)) throw new Error("Invalid run ID"); return path.join(auditArtifactRoot(repoRoot), runId); };
const patchId = (patch: StoredPatch, index: number) => patch.id ?? crypto.createHash("sha256").update(patch.unifiedDiff ?? String(index)).digest("hex").slice(0, 16);
export async function applyApprovedPatch(repoRoot: string, runId: string, requestedId: string, actor: string, reason: string) {
  if (!actor.trim() || !reason.trim()) throw new Error("--actor and --reason are required approval evidence");
  const dir = runDirectory(repoRoot, runId); const report = JSON.parse(await fs.readFile(path.join(dir, "report.json"), "utf8")) as { patches?: StoredPatch[] };
  const patches = report.patches ?? []; const index = patches.findIndex((item, i) => patchId(item, i) === requestedId); const patch = patches[index];
  if (!patch?.unifiedDiff) throw new Error(`Patch ${requestedId} not found`);
  const target = getDiffTargetPath(patch.unifiedDiff); if (!target || !patch.preApplySha256) throw new Error("Patch lacks preview hash and cannot be approved");
  try { if ((await safeRead(repoRoot, target)).sha256 !== patch.preApplySha256) throw new Error("Repository changed since preview; regenerate the patch"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT" || patch.preApplySha256 !== "absent") throw error; }
  const tx = new PatchTransaction(repoRoot, false); await tx.capture(patch.unifiedDiff); await tx.verifyUnchanged();
  const approval = { schemaVersion: 1, patchId: requestedId, actor, reason, approvedAt: new Date().toISOString(), target, preApplySha256: patch.preApplySha256 };
  await fs.writeFile(path.join(dir, `approval-${requestedId}.json`), JSON.stringify(approval, null, 2), { flag: "wx" });
  const result = await applyDiff(patch.unifiedDiff, repoRoot, false); if (!result.success) { await tx.rollback(); throw new Error(result.error); }
  return approval;
}
export async function verifyCodeRun(repoRoot: string, runId: string) {
  const dir = runDirectory(repoRoot, runId); await fs.access(path.join(dir, "report.json"));
  const [eslint, tsc] = await Promise.all([runEslint(repoRoot), runTsc(repoRoot)]); const result = { schemaVersion: 1, runId, verifiedAt: new Date().toISOString(), checks: { eslint: eslint.length, typescript: tsc.length }, passed: ![...eslint, ...tsc].some((item) => item.severity === "critical") };
  await fs.writeFile(path.join(dir, "verification.json"), JSON.stringify(result, null, 2)); return result;
}
