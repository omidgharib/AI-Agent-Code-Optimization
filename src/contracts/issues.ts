export type Tool = "eslint" | "tsc" | "playwright" | "lighthouse" | "sonarqube" | "custom";
export type Severity = "low" | "medium" | "high" | "critical";
export type Category = "bug" | "security" | "performance" | "maintainability" | "a11y" | "seo" | "style" | "test";
export type Effort = "xs" | "s" | "m" | "l";
export type FixStrategy = "mechanical" | "local" | "cross-file" | "advisory";
export type AgentMode = "suggest" | "dry-run" | "apply";

export interface Issue { id: string; tool: Tool; ruleId?: string; message: string; severity: Severity; category: Category; location?: { filePath: string; startLine?: number; startColumn?: number; endLine?: number; endColumn?: number }; evidence?: { snippet?: string; relatedFiles?: string[]; url?: string }; fix?: { canAutoFix: boolean; hint?: string; strategy?: FixStrategy }; meta?: Record<string, unknown> }
export interface PrioritizedIssue extends Issue { score: number; effort: Effort; rationale: string[] }
export interface FixRequest { repoRoot: string; issues: PrioritizedIssue[]; context: Array<{ filePath: string; excerpt: string }>; constraints: { maxFilesChanged: number; preferMinimalDiff: boolean; doNotChangePublicAPI: boolean; keepFormatting: boolean } }
export interface FixResponse { patches: Array<{ description: string; unifiedDiff: string; touches: string[] }>; notes: string[] }
