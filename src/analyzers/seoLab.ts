import { createHash } from "node:crypto";
import type { Issue, Severity } from "../core/types";
import { validateStructuredData } from "../seo/structuredData";

export type SeoCategory = "metadata" | "indexability" | "structuredData" | "social" | "content";
export interface SeoFinding { ruleId: string; category: SeoCategory; severity: Severity; message: string; selector?: string; evidence?: string }
export interface SeoHealth { score: number; deductions: Record<SeoCategory, number>; findings: SeoFinding[]; page: { url: string; status: number; redirects: string[] }; robots?: { url: string; status: number; sitemap?: string }; sitemap?: { url: string; status: number } }

const weight: Record<Severity, number> = { critical: 25, high: 15, medium: 8, low: 3 };
const text = (html: string, pattern: RegExp) => pattern.exec(html)?.[1]?.replace(/\s+/g, " ").trim() ?? "";
const attr = (tag: string, name: string) => new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag)?.[1]?.trim() ?? "";

export function analyzeSeoHtml(html: string, url: string, status = 200, redirects: string[] = []): SeoHealth {
  const findings: SeoFinding[] = [];
  const add = (ruleId: string, category: SeoCategory, severity: Severity, message: string, selector?: string, evidence?: string) => findings.push({ ruleId, category, severity, message, selector, evidence });
  const title = text(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metas = [...html.matchAll(/<meta\b[^>]*>/gi)].map((m) => m[0]);
  const meta = (name: string, property = false) => attr(metas.find((tag) => attr(tag, property ? "property" : "name").toLowerCase() === name) ?? "", "content");
  const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
  const canonical = attr(links.find((tag) => attr(tag, "rel").toLowerCase().split(/\s+/).includes("canonical")) ?? "", "href");
  const language = attr(/<html\b[^>]*>/i.exec(html)?.[0] ?? "", "lang");
  const robots = meta("robots").toLowerCase(); const viewport = meta("viewport");
  if (status < 200 || status >= 400) add("document-status", "indexability", "high", `Document returned HTTP ${status}`, undefined, String(status));
  if (redirects.length > 2) add("redirect-chain", "indexability", "medium", `${redirects.length - 1} redirects before the final page`, undefined, redirects.join(" → "));
  if (!title) add("document-title", "metadata", "high", "Document title is missing", "title"); else if (title.length < 30 || title.length > 60) add("title-length", "metadata", "low", `Title length is ${title.length}; recommended 30–60`, "title", title);
  const description = meta("description"); if (!description) add("meta-description", "metadata", "medium", "Meta description is missing", 'meta[name="description"]'); else if (description.length < 70 || description.length > 160) add("description-length", "metadata", "low", `Description length is ${description.length}; recommended 70–160`, 'meta[name="description"]');
  if (!canonical) add("canonical", "indexability", "medium", "Canonical URL is missing", 'link[rel="canonical"]'); else { try { const resolved = new URL(canonical, url); if (resolved.origin !== new URL(url).origin) add("cross-domain-canonical", "indexability", "medium", "Canonical points to another origin", 'link[rel="canonical"]', resolved.href); } catch { add("canonical-invalid", "indexability", "high", "Canonical URL is invalid", 'link[rel="canonical"]', canonical); } }
  if (/\bnoindex\b/.test(robots)) add("noindex", "indexability", "high", "Page declares noindex", 'meta[name="robots"]', robots);
  if (/\bnoindex\b/.test(robots) && canonical && new URL(canonical, url).href !== url) add("indexability-conflict", "indexability", "high", "noindex conflicts with a canonical pointing elsewhere", 'meta[name="robots"]');
  if (!viewport) add("viewport", "metadata", "medium", "Viewport metadata is missing", 'meta[name="viewport"]');
  if (!language) add("html-lang", "metadata", "medium", "HTML language is missing", "html[lang]");
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => ({ level: Number(m[1]), text: m[2].replace(/<[^>]+>/g, "").trim() }));
  if (headings.filter((h) => h.level === 1).length !== 1) add("heading-h1", "content", "medium", `Expected one H1; found ${headings.filter((h) => h.level === 1).length}`, "h1");
  if (headings.some((h, i) => i > 0 && h.level > headings[i - 1].level + 1)) add("heading-order", "content", "low", "Heading hierarchy skips a level", "h1,h2,h3,h4,h5,h6");
  const images = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]); const missingAlt = images.filter((tag) => !/\balt\s*=/.test(tag)); if (missingAlt.length) add("image-alt", "content", "medium", `${missingAlt.length} image(s) have no alt attribute`, "img:not([alt])");
  const socialRules = [["og:title", true], ["og:description", true], ["og:image", true], ["og:url", true], ["twitter:card", false], ["twitter:title", false], ["twitter:description", false], ["twitter:image", false]] as const;
  const missingSocial = socialRules.filter(([name, property]) => !meta(name, property)).map(([name]) => name); if (missingSocial.length) add("social-preview", "social", "low", `Social preview is incomplete: ${missingSocial.join(", ")}`, "meta[property^=\"og:\"],meta[name^=\"twitter:\"]");
  const jsonLd = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  if (!jsonLd.length) add("json-ld-missing", "structuredData", "low", "No JSON-LD block was found", 'script[type="application/ld+json"]');
  jsonLd.forEach((match, index) => { try { const value = JSON.parse(match[1]); const nodes = Array.isArray(value?.["@graph"]) ? value["@graph"] : [value]; if (!nodes.some((node: unknown) => node && typeof node === "object" && "@type" in node)) add("json-ld-type", "structuredData", "medium", `JSON-LD block ${index + 1} has no Schema.org @type`, 'script[type="application/ld+json"]'); } catch (error) { add("json-ld-invalid", "structuredData", "medium", `JSON-LD block ${index + 1} is invalid`, 'script[type="application/ld+json"]', String(error)); } });
  const deductions = { metadata: 0, indexability: 0, structuredData: 0, social: 0, content: 0 }; findings.forEach((finding) => deductions[finding.category] += weight[finding.severity]);
  return { score: Math.max(0, 100 - Object.values(deductions).reduce((a, b) => a + b, 0)), deductions, findings, page: { url, status, redirects } };
}

async function fetchWithChain(url: string): Promise<{ status: number; html: string; redirects: string[]; finalUrl: string }> {
  const redirects: string[] = []; let current = url;
  for (let i = 0; i < 10; i++) { const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "user-agent": "AI-Auditor/1.0" } }); const location = response.headers.get("location"); if (response.status >= 300 && response.status < 400 && location) { redirects.push(current); current = new URL(location, current).href; continue; } return { status: response.status, html: await response.text(), redirects: [...redirects, current], finalUrl: current }; }
  throw new Error("Redirect loop or chain exceeds 10 hops");
}

export async function runSeoLab(url: string): Promise<{ issues: Issue[]; health: SeoHealth }> {
  const page = await fetchWithChain(url); const health = analyzeSeoHtml(page.html, page.finalUrl, page.status, page.redirects);
  const visibleText = page.html.replace(/<script\b[\s\S]*?<\/script>/gi, " ").replace(/<style\b[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const structured = validateStructuredData(page.html, page.finalUrl, visibleText);
  for (const finding of structured.findings) health.findings.push({ ruleId: finding.ruleId, category: "structuredData", severity: finding.severity, message: finding.message, selector: 'script[type="application/ld+json"], [itemscope], [typeof]', evidence: JSON.stringify({ entityId: finding.entityId, evidence: finding.evidence, richResultGuaranteed: false }) });
  const origin = new URL(page.finalUrl).origin; const robotsUrl = `${origin}/robots.txt`; const robotsResponse = await fetch(robotsUrl, { signal: AbortSignal.timeout(8_000) }).catch(() => undefined); const robotsText = robotsResponse ? await robotsResponse.text() : ""; const sitemap = /^sitemap:\s*(.+)$/im.exec(robotsText)?.[1]?.trim() ?? `${origin}/sitemap.xml`; const sitemapResponse = await fetch(sitemap, { signal: AbortSignal.timeout(8_000) }).catch(() => undefined);
  health.robots = { url: robotsUrl, status: robotsResponse?.status ?? 0, sitemap }; health.sitemap = { url: sitemap, status: sitemapResponse?.status ?? 0 };
  if (!robotsResponse?.ok) health.findings.push({ ruleId: "robots-txt", category: "indexability", severity: "medium", message: "robots.txt is unavailable", evidence: String(robotsResponse?.status ?? 0) });
  if (!sitemapResponse?.ok) health.findings.push({ ruleId: "sitemap", category: "indexability", severity: "medium", message: "XML sitemap is unavailable", evidence: String(sitemapResponse?.status ?? 0) });
  health.deductions = { metadata: 0, indexability: 0, structuredData: 0, social: 0, content: 0 }; health.findings.forEach((finding) => health.deductions[finding.category] += weight[finding.severity]); health.score = Math.max(0, 100 - Object.values(health.deductions).reduce((a, b) => a + b, 0));
  const issues = health.findings.map((finding) => ({ id: createHash("sha256").update(`seo:${finding.ruleId}:${page.finalUrl}:${finding.message}`).digest("hex").slice(0, 16), tool: "custom" as const, ruleId: finding.ruleId, message: finding.message, severity: finding.severity, category: "seo" as const, location: { filePath: "-" }, evidence: { url: page.finalUrl, snippet: JSON.stringify({ category: finding.category, selector: finding.selector, evidence: finding.evidence }).slice(0, 1200) }, fix: { canAutoFix: false, hint: "Produce a framework-aware recommendation and require review before applying", strategy: "advisory" as const }, meta: { seoCategory: finding.category, selector: finding.selector } }));
  return { issues, health };
}
