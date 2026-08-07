import type { PrioritizedIssue } from "../core/types";

export interface LighthouseAudit {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;
  details?: {
    type?: string;
    headings?: {
      key?: string | null;
      label?: string;
      text?: string;
      valueType?: string;
    }[];
    items?: Record<string, unknown>[];
    data?: string; // برای final-screenshot
    overallSavingsMs?: number;
  };
}

export interface LighthouseReport {
  requestedUrl?: string;
  finalDisplayedUrl?: string;
  fetchTime?: string;
  lighthouseVersion?: string;
  categories: Record<
    string,
    { id: string; title: string; score: number | null }
  >;
  audits: Record<string, LighthouseAudit>;
  timing?: { total?: number };
  environment?: {
    networkUserAgent?: string;
    hostUserAgent?: string;
    benchmarkIndex?: number;
  };
}

export interface ReportData {
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byTool: Record<string, number>;
  };
  topIssues: PrioritizedIssue[];
  patches: { description: string; touches: string[] }[];
  verification: { passed: boolean; errors: string[] };
  lighthouse?: LighthouseReport; // ← فیلد جدید (اختیاری)
}

export function buildSummary(
  issues: PrioritizedIssue[],
): ReportData["summary"] {
  const bySeverity: Record<string, number> = {};
  const byCategory: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  for (const i of issues) {
    bySeverity[i.severity] = (bySeverity[i.severity] ?? 0) + 1;
    byCategory[i.category] = (byCategory[i.category] ?? 0) + 1;
    byTool[i.tool] = (byTool[i.tool] ?? 0) + 1;
  }
  return { total: issues.length, bySeverity, byCategory, byTool };
}
