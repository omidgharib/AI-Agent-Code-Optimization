import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import type { Issue } from "../core/types";

function issue(url: string, ruleId: string, message: string, severity: Issue["severity"], category: Issue["category"], evidence?: Record<string, unknown>): Issue {
  return {
    id: createHash("sha256").update(`playwright:${ruleId}:${url}:${message}`).digest("hex").slice(0, 16),
    tool: "playwright", ruleId, message, severity, category,
    location: { filePath: "-" },
    evidence: { url, snippet: evidence ? JSON.stringify(evidence).slice(0, 1200) : undefined },
    fix: { canAutoFix: false, strategy: "advisory" },
    meta: { reproducible: { command: `Open ${url} in Chromium`, ...evidence } },
  };
}

async function fetchText(url: string): Promise<{ status: number; text: string }> {
  try {
    const response = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(8_000) });
    return { status: response.status, text: await response.text() };
  } catch { return { status: 0, text: "" }; }
}

/** Browser runtime, link and SEO smoke audit. */
export async function runPlaywright(_cwd: string, targetUrl?: string): Promise<Issue[]> {
  if (!targetUrl) return [];
  const findings: Issue[] = [];
  let playwright: typeof import("playwright");
  try { playwright = await import("playwright"); }
  catch { return [issue(targetUrl, "playwright-unavailable", "Playwright is not installed; runtime and deep SEO checks were skipped", "low", "maintainability", { install: "npm install playwright" })]; }

  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>> | undefined;
  try {
    const bundledExecutable = playwright.chromium.executablePath();
    const executablePath = existsSync(bundledExecutable)
      ? bundledExecutable
      : (await import("chrome-launcher")).Launcher.getInstallations()[0];
    browser = await playwright.chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath } : {}),
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: Array<{ url: string; reason: string }> = [];
    page.on("console", (entry) => { if (entry.type() === "error") consoleErrors.push(entry.text()); });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), reason: request.failure()?.errorText ?? "unknown" }));

    const response = await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30_000 });
    const finalUrl = page.url();
    const status = response?.status() ?? 0;
    const redirectChain: string[] = [];
    let redirected = response?.request();
    while (redirected?.redirectedFrom()) { redirectChain.unshift(redirected.redirectedFrom()!.url()); redirected = redirected.redirectedFrom()!; }
    redirectChain.push(finalUrl);
    if (status < 200 || status >= 400) findings.push(issue(finalUrl, "document-status", `Main document returned HTTP ${status}`, "high", "seo", { status }));
    if (redirectChain.length > 2) findings.push(issue(targetUrl, "redirect-chain", `Main navigation used ${redirectChain.length - 1} redirects`, "medium", "performance", { redirectChain }));

    const metadata = await page.evaluate(() => {
      const attr = (selector: string, name: string) => document.querySelector(selector)?.getAttribute(name)?.trim() ?? "";
      const content = (selector: string) => attr(selector, "content");
      return {
        title: document.title.trim(), description: content('meta[name="description"]'), canonical: attr('link[rel="canonical"]', "href"), robots: content('meta[name="robots"]'), lang: document.documentElement.lang,
        headings: Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6")).map((h) => ({ level: Number(h.tagName.slice(1)), text: h.textContent?.trim().slice(0, 160) ?? "" })),
        og: { title: content('meta[property="og:title"]'), description: content('meta[property="og:description"]'), image: content('meta[property="og:image"]'), url: content('meta[property="og:url"]'), type: content('meta[property="og:type"]') },
        twitter: { card: content('meta[name="twitter:card"]'), title: content('meta[name="twitter:title"]'), description: content('meta[name="twitter:description"]'), image: content('meta[name="twitter:image"]') },
        jsonLd: Array.from(document.querySelectorAll('script[type="application/ld+json"]')).map((s) => s.textContent ?? ""),
        links: Array.from(document.querySelectorAll("a[href]")).map((a) => (a as HTMLAnchorElement).href),
      };
    });

    if (!metadata.title) findings.push(issue(finalUrl, "document-title", "Document has no title", "high", "seo", { selector: "title" }));
    else if (metadata.title.length > 60) findings.push(issue(finalUrl, "title-length", `Document title is ${metadata.title.length} characters (recommended: 30-60)`, "low", "seo", { title: metadata.title }));
    if (!metadata.description) findings.push(issue(finalUrl, "meta-description", "Document has no meta description", "medium", "seo", { selector: 'meta[name="description"]' }));
    if (!metadata.canonical) findings.push(issue(finalUrl, "canonical", "Document has no canonical URL", "medium", "seo", { selector: 'link[rel="canonical"]' }));
    if (!metadata.lang) findings.push(issue(finalUrl, "html-lang", "HTML document has no lang attribute", "medium", "a11y", { selector: "html" }));
    const h1Count = metadata.headings.filter((h) => h.level === 1).length;
    if (h1Count !== 1) findings.push(issue(finalUrl, "heading-h1", `Expected exactly one H1, found ${h1Count}`, "medium", "seo", { headings: metadata.headings }));
    for (let i = 1; i < metadata.headings.length; i++) if (metadata.headings[i].level - metadata.headings[i - 1].level > 1) { findings.push(issue(finalUrl, "heading-order", `Heading level skips from H${metadata.headings[i - 1].level} to H${metadata.headings[i].level}`, "low", "a11y", { previous: metadata.headings[i - 1], current: metadata.headings[i] })); break; }
    for (const [group, values] of [["Open Graph", metadata.og], ["Twitter Card", metadata.twitter]] as const) {
      const missing = Object.entries(values).filter(([, value]) => !value).map(([key]) => key);
      if (missing.length) findings.push(issue(finalUrl, group === "Open Graph" ? "open-graph" : "twitter-card", `${group} metadata is incomplete: missing ${missing.join(", ")}`, "low", "seo", { values, missing }));
    }
    for (const [index, raw] of metadata.jsonLd.entries()) try { JSON.parse(raw); } catch (error) { findings.push(issue(finalUrl, "json-ld", `JSON-LD block ${index + 1} is invalid JSON`, "medium", "seo", { error: String(error), preview: raw.slice(0, 300) })); }
    if (!metadata.jsonLd.length) findings.push(issue(finalUrl, "json-ld-missing", "No JSON-LD structured data was found", "low", "seo", { selector: 'script[type="application/ld+json"]' }));

    if (consoleErrors.length) findings.push(issue(finalUrl, "console-error", `${consoleErrors.length} browser console error(s) occurred`, "high", "bug", { errors: consoleErrors.slice(0, 10) }));
    if (pageErrors.length) findings.push(issue(finalUrl, "page-error", `${pageErrors.length} uncaught page error(s) occurred`, "critical", "bug", { errors: pageErrors.slice(0, 10) }));
    if (failedRequests.length) findings.push(issue(finalUrl, "network-failure", `${failedRequests.length} network request(s) failed`, "high", "bug", { requests: failedRequests.slice(0, 20) }));

    const origin = new URL(finalUrl).origin;
    const internalLinks = [...new Set(metadata.links.filter((href) => { try { return new URL(href).origin === origin; } catch { return false; } }))].slice(0, 30);
    for (const href of internalLinks) {
      try { const linkResponse = await context.request.get(href, { timeout: 8_000, maxRedirects: 10 }); if (linkResponse.status() >= 400) findings.push(issue(href, "broken-internal-link", `Internal link returned HTTP ${linkResponse.status()}`, "high", "seo", { source: finalUrl, status: linkResponse.status() })); }
      catch (error) { findings.push(issue(href, "broken-internal-link", "Internal link could not be requested", "high", "seo", { source: finalUrl, error: String(error) })); }
    }

    const robotsUrl = new URL("/robots.txt", origin).href;
    const robots = await fetchText(robotsUrl);
    if (robots.status !== 200) findings.push(issue(robotsUrl, "robots-txt", `robots.txt returned HTTP ${robots.status || "network error"}`, "medium", "seo", { status: robots.status }));
    const sitemapMatch = robots.text.match(/^sitemap:\s*(.+)$/im);
    const sitemapUrl = sitemapMatch?.[1]?.trim() || new URL("/sitemap.xml", origin).href;
    const sitemap = await fetchText(sitemapUrl);
    if (sitemap.status !== 200 || !/<urlset|<sitemapindex/i.test(sitemap.text)) findings.push(issue(sitemapUrl, "sitemap", "A valid XML sitemap could not be found", "medium", "seo", { status: sitemap.status, discoveredFromRobots: Boolean(sitemapMatch) }));
    await context.close();
    return findings;
  } catch (error) {
    return [...findings, issue(targetUrl, "runtime-audit-failure", `Playwright runtime audit failed: ${error instanceof Error ? error.message : String(error)}`, "medium", "maintainability", { error: String(error) })];
  } finally { await browser?.close(); }
}
