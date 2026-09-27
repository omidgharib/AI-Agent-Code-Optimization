import type { PrioritizedIssue } from "../core/types";
import type { QualityGateResult } from "../core/qualityGate";
import type { SeoHealth } from "../analyzers/seoLab";
import type { ArchitectureReport } from "../analyzers/architecture";
import type { RootCauseGroup } from "../core/rootCause";
import type { SonarSummary } from "../core/types";

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
  schemaVersion: 1;
  generatedAt: string;
  summary: {
    total: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byTool: Record<string, number>;
  };
  topIssues: PrioritizedIssue[];
  tools: Record<string, PrioritizedIssue[]>;
  patches: { description: string; touches: string[]; unifiedDiff?: string; status?: "suggested" | "preview" | "ready" | "blocked" | "applied" | "rejected"; preflight?: { status: "ready" | "blocked"; attempts: number; error?: string }; changeSetId?: string; issueIds?: string[]; verification?: { passed: boolean; fixedIssueIds: string[]; beforeIssueCount: number; afterIssueCount: number; introducedSevere: number; checks: { eslint: "passed" | "failed"; typescript: "passed" | "failed"; relatedTests: "passed" | "failed" | "not-found" }; relatedTests: string[]; attempts: number; confidence?: { diagnosis: number; patch: number; behavioral: number; status: "green" | "yellow" | "red"; reasons: string[] }; impact?: { importers: string[]; routes: string[]; publicApis: string[]; relatedTests: string[]; sensitiveFiles: string[]; policyViolations: string[] }; sonar?: SonarSummary & { introducedSevere: number }; error?: string } }[];
  problemCards?: Array<{ id: string; title: string; explanation: string; technicalExplanation: string; rootCause: string; location: string; affectedFiles: string[]; dependencies: string[]; importance: string; proposedFix?: string; risk: "low" | "medium" | "high"; requiredValidation: string[]; status: "found" | "fixing" | "ready-for-approval" | "resolved" | "blocked"; changeSetId?: string }>;
  changeSets?: Array<{ id: string; description: string; issueIds: string[]; touches: string[]; status: "ready-for-approval" | "resolved" | "blocked"; result?: ReportData["patches"][number]["verification"] }>;
  recommendations: string[];
  fixSummary: {
    mechanical: number;
    mechanicalMode: "applied" | "dry-run";
    aiPatches: number;
    advisoryRecommendations: number;
  };
  verification: { passed: boolean; errors: string[] };
  agent?: { mode: string; provider: string; model: string; analysisModel?: string; requests: number; estimatedTokens?: number; estimatedCostUsd?: number; durationMs: number; changedFiles: number; specialists?: number; specialistStrategy?: string };
  qualityGate?: QualityGateResult;
  lighthouse?: LighthouseReport; // ← فیلد جدید (اختیاری)
  seoLab?: SeoHealth;
  lighthouseDesktop?: LighthouseReport;
  architecture?: ArchitectureReport;
  testHealth?: { score: number; testedSources: number; totalSources: number; gaps: unknown[] };
  performanceLab?: { performance: number; bundle: number };
  rootCauseGroups?: RootCauseGroup[];
  sonar?: SonarSummary;
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
