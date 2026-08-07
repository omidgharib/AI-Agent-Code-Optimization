import fs from "node:fs/promises";
import path from "node:path";
import type { PrioritizedIssue, FixResponse } from "../core/types";
import { buildSummary, type ReportData } from "./summary";
import { toMarkdown } from "./markdown";
import { toHtml } from "./html";

export async function writeReport(
  issues: PrioritizedIssue[],
  patches: FixResponse["patches"],
  verification: { passed: boolean; errors: string[] },
  config: { json: boolean; md: boolean; html: boolean; outDir: string },
): Promise<void> {
  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const outDir = path.join(config.outDir, ts);
  await fs.mkdir(outDir, { recursive: true });

  const data: ReportData = {
    summary: buildSummary(issues),
    topIssues: issues.slice(0, 200),
    patches: patches.map((p) => ({
      description: p.description,
      touches: p.touches,
    })),
    verification,
  };

  const neither = !config.json && !config.md && !config.html;
  if (config.json || neither)
    await fs.writeFile(
      path.join(outDir, "report.json"),
      JSON.stringify(data, null, 2),
    );
  if (config.md || neither)
    await fs.writeFile(path.join(outDir, "report.md"), toMarkdown(data));
  if (config.html || neither)
    await fs.writeFile(path.join(outDir, "report.html"), toHtml(data));
}
