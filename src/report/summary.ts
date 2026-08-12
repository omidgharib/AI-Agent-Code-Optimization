import type { PrioritizedIssue } from "../core/types";

export interface LighthouseCategory {
  id: string;
  title: string;
  score: number | null;
}

export interface LighthouseDetails {
  type?: string;
  headings?: {
    key?: string | null;
    label?: string;
    text?: string;
    valueType?: string;
    granularity?: number;
  }[];
  items?: Record<string, unknown>[];
  data?: string; // داده دودویی (final-screenshot / full-page-screenshot)
  overallSavingsMs?: number;
  overallSavingsBytes?: number;
  sortedBy?: string[];
  debugData?: Record<string, unknown>;
  fullPageScreenshot?: {
    data?: string;
    nodes?: Record<string, unknown>;
  };
}

export interface LighthouseAudit {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number;
  numericUnit?: string;
  warnings?: string[];
  errorMessage?: string;
  errorStack?: string;
  details?: LighthouseDetails;
}

export interface LighthouseReport {
  requestedUrl?: string;
  mainDocumentUrl?: string;
  finalDisplayedUrl?: string;
  fetchTime?: string;
  lighthouseVersion?: string;
  gatherMode?: string;
  categories: Record<string, LighthouseCategory>;
  audits: Record<string, LighthouseAudit>;
  timing?: { total?: number };
  environment?: {
    hostUserAgent?: string;
    networkUserAgent?: string;
    benchmarkIndex?: number;
  };
  configSettings?: {
    formFactor?: string;
    throttlingMethod?: string;
    screenEmulation?: {
      mobile?: boolean;
      width?: number;
      height?: number;
      deviceScaleFactor?: number;
      disabled?: boolean;
    };
  };
  runWarnings?: string[];
  runtimeError?: {
    code?: string;
    message?: string;
    errorStack?: string;
  };
  fullPageScreenshotFile?: string; // فایل PNG نوشته‌شده کنار گزارش
}

export interface ReportData {
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byTool: Record<string, number>;
  };
  topIssues: PrioritizedIssue[];
  tools: Record<string, PrioritizedIssue[]>;
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

export function groupByTool(
  issues: PrioritizedIssue[],
): Record<string, PrioritizedIssue[]> {
  const tools: Record<string, PrioritizedIssue[]> = {};
  for (const i of issues) {
    (tools[i.tool] ??= []).push(i);
  }
  return tools;
}
