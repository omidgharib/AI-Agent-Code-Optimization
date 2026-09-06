// FILE: src/core/types.ts
export type Tool =
  | "eslint"
  | "tsc"
  | "playwright"
  | "lighthouse"
  | "sonarqube"
  | "custom";
export type Severity = "low" | "medium" | "high" | "critical";
export type Category =
  | "bug"
  | "security"
  | "performance"
  | "maintainability"
  | "a11y"
  | "seo"
  | "style"
  | "test";
export type Effort = "xs" | "s" | "m" | "l";
export type FixStrategy =
  | "mechanical" // eslint --fix, no LLM, deterministic verify
  | "local" // LLM, single file, small context
  | "cross-file" // LLM, multiple files, needs care/approval
  | "advisory"; // lighthouse et al., recommendations only, NO diff
export type AgentMode = "suggest" | "dry-run" | "apply";

export interface Issue {
  id: string;
  tool: Tool;
  ruleId?: string;
  message: string;
  severity: Severity;
  category: Category;
  location?: {
    filePath: string;
    startLine?: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
  };
  evidence?: { snippet?: string; relatedFiles?: string[]; url?: string };
  fix?: { canAutoFix: boolean; hint?: string; strategy?: FixStrategy };
  meta?: Record<string, unknown>;
}

export interface PrioritizedIssue extends Issue {
  score: number;
  effort: Effort;
  rationale: string[];
}

export interface FixRequest {
  repoRoot: string;
  issues: PrioritizedIssue[];
  context: Array<{ filePath: string; excerpt: string }>;
  constraints: {
    maxFilesChanged: number;
    preferMinimalDiff: boolean;
    doNotChangePublicAPI: boolean;
    keepFormatting: boolean;
  };
}

export interface FixResponse {
  patches: Array<{
    description: string;
    unifiedDiff: string;
    touches: string[];
    preApplySha256?: string;
    preflight?: { status: "ready" | "blocked"; attempts: number; error?: string };
  }>;
  notes: string[];
}

export interface AuditConfig {
  path: string;
  url?: string;
  json: boolean;
  md: boolean;
  fix: boolean;
  maxFixIterations: number;
  fixBatch: number;
  include: string[];
  exclude: string[];
  severity?: Severity;
  model: string;
  provider: string;
  keyRequired: boolean;
  mechanicalAutofix: boolean;
  baseUrl: string;
  apiKey: string;
  dryRun: boolean;
  verbose: boolean;
  html?: boolean;
  patchRetries: number;
  agentMode: AgentMode;
  issueIds: string[];
  maxAiRequests: number;
  maxAgentSeconds: number;
  maxChangedFiles: number;
  analysisModel: string;
  maxAgentTokens: number;
  maxCostUsd: number;
  baselinePath?: string;
  maxCritical: number;
  maxHigh: number;
  failOnNew: boolean;
  minLighthouseScores: Record<string, number>;
  sarif: boolean;
  changedOnly: boolean;
  exportPath?: string;
}

// Compatibility surface: new consumers should import domain-neutral contracts
// from `src/contracts`; existing analyzer and CLI imports remain supported.
export type { AuditCommand, JobEvent, ProblemDetails, Project } from "../contracts";
