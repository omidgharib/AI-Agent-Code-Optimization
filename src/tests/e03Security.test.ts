import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { applyDiff, checkTargetPath } from "../fix/diffApplier";
import { resolveRepositoryPath } from "../platform/security/repositoryPolicy";
import { isBlockedAddress, resolveSafeAddresses } from "../platform/security/networkPolicy";
import { redactSensitive } from "../platform/security/secrets";
import { AppendOnlySecurityAuditLog } from "../platform/security/audit";
import { SessionSecurity } from "../platform/security/teamAuth";

describe("E03 security and isolation", () => {
  let root: string;
  beforeEach(async () => { delete process.env.AI_AUDITOR_ALLOW_PRIVATE_NETWORK; root = await fs.mkdtemp(path.join(os.tmpdir(), "e03-")); });
  afterEach(async () => { await fs.rm(root, { recursive: true, force: true }); });
  it.each(["../escape.ts", "/tmp/escape.ts", "C:/escape.ts", "file.txt:stream", ".git/config", ".env", "package-lock.json", "dist/out.js"])("rejects unsafe patch target %s", (target) => expect(checkTargetPath(target, root)).toBeTruthy());
  it("rejects symlink escapes and leaves the outside file unchanged", async () => { const outside = await fs.mkdtemp(path.join(os.tmpdir(), "e03-out-")); await fs.writeFile(path.join(outside, "victim.txt"), "safe\n"); try { await fs.symlink(outside, path.join(root, "link"), process.platform === "win32" ? "junction" : "dir"); await expect(resolveRepositoryPath(root, "link/victim.txt")).rejects.toThrow(/escape/i); const result = await applyDiff("--- a/link/victim.txt\n+++ b/link/victim.txt\n@@ -1,1 +1,1 @@\n-safe\n+pwned", root, false); expect(result.success).toBe(false); expect(await fs.readFile(path.join(outside, "victim.txt"), "utf8")).toBe("safe\n"); } finally { await fs.rm(outside, { recursive: true, force: true }); } });
  it.each(["127.0.0.1","10.1.2.3","169.254.169.254","192.168.1.1","::1","fd00::1","ff02::1"])("blocks address %s", (address) => expect(isBlockedAddress(address)).toBe(true));
  it("blocks literal metadata targets before connection", async () => { await expect(resolveSafeAddresses(new URL("http://169.254.169.254/latest/meta-data"), { profile: "public-web", maxRedirects: 1, maxResponseBytes: 10, timeoutMs: 10, maxDecompressionRatio: 1 })).rejects.toThrow(/SSRF/); });
  it("redacts known and high-entropy secrets", () => { const seeded = "token=sk-live_abcdefghijklmnopqrstuvwxyz012345 and ABCDEFGHIJKLMNOPQRSTUVWXYZ987654"; const redacted = redactSensitive(seeded); expect(redacted).not.toContain("abcdefghijklmnopqrstuvwxyz"); expect(redacted).not.toContain("ABCDEFGHIJKLMNOPQRSTUVWXYZ987654"); });
  it("detects audit-log tampering", async () => { const file = path.join(root, "security.jsonl"); const log = new AppendOnlySecurityAuditLog(file); await log.append({ actorId: "u", tenantId: "t", action: "apply", resourceId: "p", decision: "allow" }); expect(await log.verify()).toBe(true); await fs.appendFile(file, JSON.stringify({ hash: "fake" }) + "\n"); expect(await log.verify()).toBe(false); });
  it("binds sessions to tenant membership and CSRF", async () => { const auth = new SessionSecurity(crypto.randomBytes(32), { hasMembership: async (_actor, tenant) => tenant === "t1", ownsResource: async (tenant, _type, id) => tenant === "t1" && id === "owned" }); const issued = auth.issue("u1", "t1", ["member"]); const session = await auth.authenticate(issued.token, "t1"); expect(() => auth.requireCsrf(session, "POST", "wrong", "https://app.example", "https://app.example")).toThrow(/CSRF/); auth.requireCsrf(session, "POST", session.csrfToken, "https://app.example", "https://app.example"); await expect(auth.authorizeObject(session, "job", "foreign")).rejects.toThrow(/denied/); });
});
