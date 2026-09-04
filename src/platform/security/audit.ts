import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { redactSensitive } from "./secrets";

export interface SecurityAuditEvent { actorId: string; tenantId: string; action: string; resourceId: string; decision: string; metadata?: Record<string, unknown>; }
export class AppendOnlySecurityAuditLog {
  constructor(private readonly file: string) {}
  async append(event: SecurityAuditEvent): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    let previousHash = "0".repeat(64);
    try { const lines = (await fs.readFile(this.file, "utf8")).trim().split(/\r?\n/); if (lines[0]) previousHash = JSON.parse(lines.at(-1)!).hash; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const payload = { schemaVersion: 1, ...event, metadata: event.metadata ? JSON.parse(redactSensitive(JSON.stringify(event.metadata))) : undefined, occurredAt: new Date().toISOString(), previousHash };
    const hash = crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    await fs.appendFile(this.file, `${JSON.stringify({ ...payload, hash })}\n`, { encoding: "utf8", flag: "a" });
  }
  async verify(): Promise<boolean> { let previousHash = "0".repeat(64); let text = ""; try { text = await fs.readFile(this.file, "utf8"); } catch { return true; } for (const line of text.trim().split(/\r?\n/).filter(Boolean)) { const entry = JSON.parse(line); const { hash, ...payload } = entry; if (payload.previousHash !== previousHash || crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex") !== hash) return false; previousHash = hash; } return true; }
}
