import fs from "node:fs/promises";
import path from "node:path";
import type { PrioritizedIssue, FixResponse } from "../core/types";
import {
  buildSummary,
  type LighthouseAudit,
  type LighthouseDetails,
  type LighthouseReport,
  type ReportData,
} from "./summary";
import { toMarkdown } from "./markdown";
import { toHtml } from "./html";

async function extractFullPageScreenshot(
  lhr: LighthouseReport,
  outDir: string,
): Promise<void> {
  const audit = lhr.audits["full-page-screenshot"];
  const raw = audit?.details?.fullPageScreenshot?.data;
  if (typeof raw !== "string" || !raw.startsWith("data:image/png;base64,"))
    return;

  const b64 = raw.slice(raw.indexOf(",") + 1);
  if (!b64) return;

  await fs.writeFile(
    path.join(outDir, "lighthouse-fullpage.png"),
    Buffer.from(b64, "base64"),
  );

  // ذخیره داده دودویی بزرگ داخل فایل و فقط ارجاع را نگه‌داشتن
  if (audit?.details?.fullPageScreenshot)
    audit.details.fullPageScreenshot.data = "";
  lhr.fullPageScreenshotFile = "lighthouse-fullpage.png";
}

function stripDataUrls(lhr: LighthouseReport): LighthouseReport {
  const audits: Record<string, LighthouseAudit> = {};
  for (const [id, audit] of Object.entries(lhr.audits)) {
    if (!audit.details) {
      audits[id] = audit;
      continue;
    }
    const details: LighthouseDetails = { ...audit.details };
    if (details.data) details.data = undefined;
    if (details.fullPageScreenshot && details.fullPageScreenshot.data) {
      details.fullPageScreenshot = {
        ...details.fullPageScreenshot,
        data: undefined,
      };
    }
    if (Array.isArray(details.items)) {
      details.items = details.items.map((item) => {
        const copy: Record<string, unknown> = { ...item };
        if (typeof copy.data === "string") copy.data = undefined;
        return copy;
      });
    }
    audits[id] = { ...audit, details };
  }
  return { ...lhr, audits };
}

export async function writeReport(
  issues: PrioritizedIssue[],
  patches: FixResponse["patches"],
  verification: { passed: boolean; errors: string[] },
  config: { json: boolean; md: boolean; html: boolean; outDir: string },
  lighthouse?: LighthouseReport,
): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(config.outDir, ts);
  await fs.mkdir(outDir, { recursive: true });

  if (lighthouse) await extractFullPageScreenshot(lighthouse, outDir);

  const data: ReportData = {
    summary: buildSummary(issues),
    topIssues: issues.slice(0, 200),
    patches: patches.map((p) => ({
      description: p.description,
      touches: p.touches,
    })),
    verification,
    ...(lighthouse ? { lighthouse } : {}),
  };

  const jsonData: ReportData = lighthouse
    ? { ...data, lighthouse: stripDataUrls(lighthouse) }
    : data;

  const neither = !config.json && !config.md && !config.html;
  if (config.json || neither)
    await fs.writeFile(
      path.join(outDir, "report.json"),
      JSON.stringify(jsonData, null, 2),
    );
  if (config.md || neither)
    await fs.writeFile(path.join(outDir, "report.md"), toMarkdown(data));
  if (config.html || neither)
    await fs.writeFile(path.join(outDir, "report.html"), toHtml(data));
}
