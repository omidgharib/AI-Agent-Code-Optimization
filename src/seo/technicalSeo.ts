export interface RobotsGroup { agents: string[]; rules: Array<{ directive: "allow" | "disallow"; pattern: string }>; crawlDelay?: number }
export interface ParsedRobots { groups: RobotsGroup[]; sitemaps: string[]; errors: string[] }

export function parseRobotsTxt(source: string): ParsedRobots {
  const groups: RobotsGroup[] = []; const sitemaps: string[] = []; const errors: string[] = []; let current: RobotsGroup | undefined; let hasRules = false;
  for (const [index, raw] of source.split(/\r?\n/).entries()) {
    const line = raw.replace(/\s*#.*$/, "").trim(); if (!line) continue;
    const split = line.indexOf(":"); if (split < 0) { errors.push(`Line ${index + 1} has no colon`); continue; }
    const key = line.slice(0, split).trim().toLowerCase(); const value = line.slice(split + 1).trim();
    if (key === "sitemap") { try { sitemaps.push(new URL(value).href); } catch { errors.push(`Invalid sitemap URL on line ${index + 1}`); } continue; }
    if (key === "user-agent") { if (!current || hasRules) { current = { agents: [], rules: [] }; groups.push(current); hasRules = false; } if (value) current.agents.push(value.toLowerCase()); else errors.push(`Empty user-agent on line ${index + 1}`); continue; }
    if (!current) continue;
    if (key === "allow" || key === "disallow") { if (value || key === "allow") current.rules.push({ directive: key, pattern: value }); hasRules = true; }
    else if (key === "crawl-delay") { const delay = Number(value); if (Number.isFinite(delay) && delay >= 0) current.crawlDelay = delay; }
  }
  return { groups, sitemaps: [...new Set(sitemaps)], errors };
}

function ruleRegex(pattern: string) { const anchored = pattern.endsWith("$"); const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*"); return new RegExp(`^${body}${anchored ? "$" : ""}`); }
export function isRobotsAllowed(pathWithQuery: string, parsed: ParsedRobots, userAgent = "ai-auditor") {
  const matching = parsed.groups.filter((group) => group.agents.some((agent) => agent === "*" || userAgent.toLowerCase().includes(agent)));
  const specific = matching.filter((group) => group.agents.some((agent) => agent !== "*")); const groups = specific.length ? specific : matching;
  const rules = groups.flatMap((group) => group.rules).filter((rule) => rule.pattern && ruleRegex(rule.pattern).test(pathWithQuery));
  rules.sort((a, b) => b.pattern.replace(/\*/g, "").length - a.pattern.replace(/\*/g, "").length || (a.directive === "allow" ? -1 : 1));
  return rules[0]?.directive !== "disallow";
}

export interface TechnicalPageSignal { url: string; status: number; finalUrl: string; redirectChain: string[]; mimeType: string; xRobotsTag: string; metaRobots: string; canonical: string; hreflang: Array<{ language: string; url: string }>; title: string; bodyText: string }
export interface TechnicalFinding { ruleId: string; severity: "low" | "medium" | "high"; urls: string[]; message: string; confidence: number; evidence: Record<string, unknown>; remediation: string }

export function analyzeTechnicalSignals(pages: TechnicalPageSignal[]): TechnicalFinding[] {
  const findings: TechnicalFinding[] = []; const byUrl = new Map(pages.map((page) => [page.url, page]));
  const add = (ruleId: string, severity: TechnicalFinding["severity"], urls: string[], message: string, confidence: number, evidence: Record<string, unknown>, remediation: string) => findings.push({ ruleId, severity, urls, message, confidence, evidence, remediation });
  for (const page of pages) {
    if (page.redirectChain.length > 3) add("redirect-chain", "medium", [page.url], "Redirect chain exceeds three hops", .95, { chain: page.redirectChain }, "Link directly to the final URL and collapse redirects.");
    if (!/text\/html|application\/xhtml\+xml/i.test(page.mimeType) && page.status < 400) add("unexpected-mime", "medium", [page.url], `HTML route returned ${page.mimeType || "no MIME type"}`, .9, { mimeType: page.mimeType }, "Return an HTML MIME type for indexable documents.");
    if (/\bnoindex\b/i.test(`${page.metaRobots},${page.xRobotsTag}`)) add("noindex", "high", [page.url], "Page is excluded by a robots directive", 1, { metaRobots: page.metaRobots, xRobotsTag: page.xRobotsTag }, "Remove noindex only when the page is intended for search.");
    if (page.status === 200 && /page not found|not found|404|صفحه.{0,8}یافت نشد/i.test(`${page.title} ${page.bodyText.slice(0, 1000)}`)) add("soft-404", "high", [page.url], "Page appears missing but returns HTTP 200", .8, { title: page.title }, "Return 404/410 or provide substantive page content.");
    if (page.canonical) { const seen = new Set<string>(); let cursor = page; while (cursor.canonical) { const nextUrl = new URL(cursor.canonical, cursor.finalUrl).href; if (seen.has(nextUrl)) { add("canonical-loop", "high", [page.url, ...seen], "Canonical loop detected", 1, { chain: [...seen, nextUrl] }, "Use one self-consistent canonical target."); break; } seen.add(nextUrl); const next = byUrl.get(nextUrl); if (!next) break; cursor = next; } if (seen.size > 1) add("canonical-chain", "medium", [page.url, ...seen], "Canonical resolves through multiple pages", .95, { chain: [...seen] }, "Point directly to the final canonical URL."); }
    for (const alternate of page.hreflang) { if (!/^(x-default|[a-z]{2,3}(?:-[A-Z]{2})?)$/.test(alternate.language)) add("hreflang-invalid", "medium", [page.url], `Invalid hreflang ${alternate.language}`, 1, { alternate }, "Use a valid ISO language and optional uppercase region code."); else { const target = byUrl.get(alternate.url); if (target && !target.hreflang.some((item) => item.url === page.url)) add("hreflang-return-link", "medium", [page.url, alternate.url], "Hreflang target does not link back", .95, { language: alternate.language }, "Add a reciprocal hreflang annotation."); } }
  }
  return findings;
}

export function validateSitemapXml(xml: string, sitemapUrl: string) {
  const findings: TechnicalFinding[] = []; const locs = [...xml.matchAll(/<loc>\s*([^<]+)\s*<\/loc>/gi)].map((match) => match[1].trim()); const isIndex = /<sitemapindex\b/i.test(xml);
  if (!/<(?:urlset|sitemapindex)\b/i.test(xml)) findings.push({ ruleId: "sitemap-root", severity: "high", urls: [sitemapUrl], message: "Invalid sitemap root element", confidence: 1, evidence: {}, remediation: "Use a urlset or sitemapindex root." });
  if (locs.length > 50_000) findings.push({ ruleId: "sitemap-limit", severity: "high", urls: [sitemapUrl], message: "Sitemap exceeds 50,000 URLs", confidence: 1, evidence: { count: locs.length }, remediation: "Split the sitemap and publish a sitemap index." });
  for (const loc of locs) try { new URL(loc); } catch { findings.push({ ruleId: "sitemap-relative-url", severity: "medium", urls: [sitemapUrl], message: `Sitemap contains a non-absolute URL: ${loc}`, confidence: 1, evidence: { loc }, remediation: "Use absolute canonical URLs in sitemaps." }); }
  return { isIndex, urls: locs, findings };
}
