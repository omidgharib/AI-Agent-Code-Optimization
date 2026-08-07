// src/analyzers/lighthouse.ts
import type { Issue } from "../core/types";
import { createHash } from "node:crypto";

function makeId(url: string, audit: string) {
  return createHash("sha256")
    .update(`lighthouse:${audit}:${url}`)
    .digest("hex")
    .slice(0, 16);
}

function mapCategory(auditId: string): Issue["category"] {
  const seoAudits = new Set([
    "meta-description",
    "document-title",
    "html-has-lang",
    "hreflang",
    "canonical",
    "robots-txt",
    "link-text",
    "crawlable-anchors",
    "is-crawlable",
    "structured-data",
    "image-alt",
    "viewport",
  ]);
  const perfAudits = new Set([
    "render-blocking-resources",
    "unused-css-rules",
    "unused-javascript",
    "uses-optimized-images",
    "uses-webp-images",
    "uses-text-compression",
    "uses-responsive-images",
    "efficient-animated-content",
    "duplicated-javascript",
    "legacy-javascript",
    "total-blocking-time",
    "largest-contentful-paint",
    "cumulative-layout-shift",
    "first-contentful-paint",
  ]);
  if (seoAudits.has(auditId)) return "seo";
  if (perfAudits.has(auditId)) return "performance";
  return "maintainability";
}

function mapSeverity(score: number | null): Issue["severity"] {
  if (score === null) return "low";
  if (score < 0.5) return "high";
  if (score < 0.9) return "medium";
  return "low";
}

export async function runLighthouse(url: string): Promise<Issue[]> {
  try {
    const chromeLauncher = await import("chrome-launcher");
    const lighthouse = (await import("lighthouse")).default;

    const chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless", "--no-sandbox"],
    });

    const result = await lighthouse(url, {
      port: chrome.port,
      onlyCategories: ["performance", "seo", "best-practices", "accessibility"],
      output: "json",
    });

    await chrome.kill();

    if (!result?.lhr) return [];

    const issues: Issue[] = [];
    const audits = result.lhr.audits;

    for (const [auditId, audit] of Object.entries(audits)) {
      if (
        audit.score === 1 ||
        (audit.score === null && audit.scoreDisplayMode === "notApplicable")
      )
        continue;
      if (
        audit.scoreDisplayMode === "informative" ||
        audit.scoreDisplayMode === "manual"
      )
        continue;

      issues.push({
        id: makeId(url, auditId),
        tool: "lighthouse",
        ruleId: auditId,
        message: `[${url}] ${audit.title}: ${audit.description ?? ""}`.trim(),
        severity: mapSeverity(audit.score),
        category: mapCategory(auditId),
        location: { filePath: "-" },
        fix: { canAutoFix: false },
      });
    }

    return issues;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return [
      {
        id: makeId(url, "lighthouse-failure"),
        tool: "custom",
        message: `Lighthouse failed: ${detail}`,
        severity: "medium",
        category: "maintainability",
      },
    ];
  }
}
