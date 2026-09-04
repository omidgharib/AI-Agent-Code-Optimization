import crypto from "node:crypto";

const patterns = [
  /-----BEGIN [^-\r\n]*PRIVATE KEY-----[\s\S]*?-----END [^-\r\n]*PRIVATE KEY-----/g,
  /\b(?:sk|rk|pk)-(?:live|test)?[_-]?[A-Za-z0-9_-]{16,}\b/g,
  /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[A-Z0-9]{16}\b/g,
  /\bAIza[0-9A-Za-z_-]{30,}\b/g,
  /\b(?:xox[baprs]-[A-Za-z0-9-]{10,}|glpat-[A-Za-z0-9_-]{20,})\b/g,
  /((?:api[_-]?key|token|secret|password|authorization)\s*[=:]\s*["']?)([^\s"']{8,})/gi,
];
const entropy = /\b[A-Za-z0-9+/=_-]{24,}\b/g;
const shannon = (value: string) => { const counts = new Map<string, number>(); for (const char of value) counts.set(char, (counts.get(char) ?? 0) + 1); return [...counts.values()].reduce((sum, count) => { const p = count / value.length; return sum - p * Math.log2(p); }, 0); };
export function redactSensitive(value: string, known: string[] = []): string {
  let output = value;
  for (const secret of known.filter((item) => item.length >= 4)) output = output.split(secret).join("<REDACTED>");
  for (const pattern of patterns) output = output.replace(pattern, (_match, prefix?: string) => `${prefix ?? ""}<REDACTED>`);
  return output.replace(entropy, (candidate) => shannon(candidate) >= 4.1 ? "<REDACTED:HIGH_ENTROPY>" : candidate);
}
export interface SecretStore { put(value: string): Promise<string>; get(reference: string): Promise<string>; revoke(reference: string): Promise<void>; rotate(reference: string, value: string): Promise<string>; }
export class InMemorySecretStore implements SecretStore {
  private values = new Map<string, string>();
  async put(value: string) { const ref = `secret://${crypto.randomUUID()}`; this.values.set(ref, value); return ref; }
  async get(reference: string) { const value = this.values.get(reference); if (!value) throw new Error("Secret reference is missing or revoked"); return value; }
  async revoke(reference: string) { this.values.delete(reference); }
  async rotate(reference: string, value: string) { await this.revoke(reference); return this.put(value); }
}
