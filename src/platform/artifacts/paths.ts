import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
export function platformDataRoot(): string { return path.resolve(process.env.AI_AUDITOR_DATA_DIR ?? path.join(os.homedir(), ".ai-auditor")); }
export function auditArtifactRoot(repositoryPath: string): string { const key = createHash("sha256").update(path.resolve(repositoryPath).toLowerCase()).digest("hex").slice(0, 24); return path.join(platformDataRoot(), "artifacts", "local", key); }
