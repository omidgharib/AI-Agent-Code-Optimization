import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

export interface NetworkPolicy { profile: "public-web" | "private-network" | "authenticated"; maxRedirects: number; maxResponseBytes: number; timeoutMs: number; maxDecompressionRatio: number; }
export const PUBLIC_WEB_POLICY: NetworkPolicy = { profile: "public-web", maxRedirects: 8, maxResponseBytes: 2_000_000, timeoutMs: 20_000, maxDecompressionRatio: 20 };

function ipv4Number(ip: string): number { return ip.split(".").reduce((value, part) => (value * 256 + Number(part)) >>> 0, 0); }
function inV4(ip: string, base: string, bits: number) { const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0; return (ipv4Number(ip) & mask) === (ipv4Number(base) & mask); }
export function isBlockedAddress(address: string): boolean {
  const ip = address.toLowerCase().split("%")[0];
  if (net.isIPv4(ip)) return [["0.0.0.0",8],["10.0.0.0",8],["100.64.0.0",10],["127.0.0.0",8],["169.254.0.0",16],["172.16.0.0",12],["192.0.0.0",24],["192.168.0.0",16],["198.18.0.0",15],["224.0.0.0",4],["240.0.0.0",4]].some(([base,bits]) => inV4(ip, String(base), Number(bits)));
  if (net.isIPv6(ip)) return ip === "::" || ip === "::1" || ip.startsWith("fc") || ip.startsWith("fd") || ip.startsWith("fe8") || ip.startsWith("fe9") || ip.startsWith("fea") || ip.startsWith("feb") || ip.startsWith("ff") || ip.startsWith("2001:db8:") || ip.startsWith("::ffff:") && isBlockedAddress(ip.slice(7));
  return true;
}

export async function resolveSafeAddresses(url: URL, policy: NetworkPolicy): Promise<Array<{ address: string; family: number }>> {
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Only credential-free HTTP(S) URLs are allowed");
  const results = net.isIP(url.hostname) ? [{ address: url.hostname, family: net.isIPv6(url.hostname) ? 6 : 4 }] : await dns.lookup(url.hostname, { all: true, verbatim: true });
  if (!results.length) throw new Error("DNS returned no addresses");
  const privateNetworkEnabled = policy.profile === "private-network" && process.env.AI_AUDITOR_ALLOW_PRIVATE_NETWORK === "true";
  if (!privateNetworkEnabled && results.some((item) => isBlockedAddress(item.address))) throw new Error(`SSRF policy blocked host ${url.hostname}`);
  return results;
}

export interface SafeResponse { status: number; ok: boolean; headers: Record<string,string>; body: Buffer; url: string; redirectChain: string[]; text(): string; }
async function requestOnce(url: URL, policy: NetworkPolicy, signal?: AbortSignal): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const addresses = await resolveSafeAddresses(url, policy); const pinned = addresses[0];
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(url, { method: "GET", headers: { "user-agent": "AI-Auditor/1.0", accept: "text/html,application/xml,text/plain;q=0.9,*/*;q=0.1", "accept-encoding": "identity" }, lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family as 4 | 6), ...(url.protocol === "https:" ? { servername: url.hostname } : {}) }, (res) => {
      const encoding = String(res.headers["content-encoding"] ?? "identity").toLowerCase(); if (encoding !== "identity") { req.destroy(); reject(new Error(`Compressed response encoding ${encoding} is not allowed`)); return; }
      const declared = Number(res.headers["content-length"] ?? 0); if (declared > policy.maxResponseBytes) { req.destroy(); reject(new Error("Response exceeds byte budget")); return; }
      const chunks: Buffer[] = []; let size = 0; res.on("data", (chunk: Buffer) => { size += chunk.length; if (size > policy.maxResponseBytes) { req.destroy(new Error("Response exceeds byte budget")); return; } chunks.push(Buffer.from(chunk)); }); res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    const timer = setTimeout(() => req.destroy(new Error("Network request timed out")), policy.timeoutMs); req.once("close", () => clearTimeout(timer)); req.once("error", reject);
    if (signal) { if (signal.aborted) req.destroy(new Error("Network request aborted")); else signal.addEventListener("abort", () => req.destroy(new Error("Network request aborted")), { once: true }); }
    req.end();
  });
}

export async function safeFetch(input: string, options: { policy?: Partial<NetworkPolicy>; signal?: AbortSignal } = {}): Promise<SafeResponse> {
  const policy = { ...PUBLIC_WEB_POLICY, ...options.policy }; let current = new URL(input); const chain: string[] = [];
  for (let hop = 0; hop <= policy.maxRedirects; hop++) {
    const result = await requestOnce(current, policy, options.signal); chain.push(current.href);
    const location = result.headers.location; if (result.status >= 300 && result.status < 400 && location) { const next = new URL(location, current); await resolveSafeAddresses(next, policy); if (chain.includes(next.href)) throw new Error("Redirect loop detected"); current = next; continue; }
    const headers = Object.fromEntries(Object.entries(result.headers).map(([key,value]) => [key, Array.isArray(value) ? value.join(", ") : String(value ?? "")]));
    return { status: result.status, ok: result.status >= 200 && result.status < 300, headers, body: result.body, url: current.href, redirectChain: chain, text: () => result.body.toString("utf8") };
  }
  throw new Error("Redirect budget exceeded");
}
