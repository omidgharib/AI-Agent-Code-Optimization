// src/analyzers/lighthouse.ts
import { createHash } from "node:crypto";
import { logger } from "../core/logger";
import type { Issue } from "../core/types";
import type { LighthouseAudit, LighthouseReport } from "../report/summary";

export interface LighthouseRunResult {
  issues: Issue[];
  lhr?: LighthouseReport;
}

const LIGHTHOUSE_CATEGORIES = [
  "performance",
  "accessibility",
  "best-practices",
  "seo",
  "pwa",
];

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

function buildIssues(url: string, audits: Record<string, LighthouseAudit>): Issue[] {
  const issues: Issue[] = [];

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
}

export async function runLighthouse(url: string): Promise<LighthouseRunResult> {
  try {
    const chromeLauncher = await import("chrome-launcher");
    const lighthouse = (await import("lighthouse")).default;

    const chrome = await chromeLauncher.launch({
      chromeFlags: ["--headless", "--no-sandbox"],
    });

    try {
      const result = await lighthouse(url, {
        port: chrome.port,
        onlyCategories: LIGHTHOUSE_CATEGORIES,
        output: "json",
      });

      if (!result?.lhr) return { issues: [] };

      const lhr = result.lhr as unknown as LighthouseReport;
      const issues = buildIssues(url, lhr.audits);

      const categoryScores = Object.entries(lhr.categories)
        .map(([id, c]) => `${id}=${c.score?.toFixed(2) ?? "n/a"}`)
        .join(", ");
      logger.info(`Lighthouse: ${issues.length} issues (${categoryScores})`);

      return { issues, lhr };
    } finally {
      await chrome.kill();
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return {
      issues: [
        {
          id: makeId(url, "lighthouse-failure"),
          tool: "custom",
          message: `Lighthouse failed: ${detail}`,
          severity: "medium",
          category: "maintainability",
        },
      ],
    };
  }
}
