// FILE: src/platform/observability/telemetry.ts
export interface TraceSpan { name: string; startedAt: number; endedAt: number; durationMs: number; attributes: Record<string, string> }
export interface Telemetry {
  span(name: string): { end(attributes?: Record<string, string>): void };
  flush(): string;
}
export function createTelemetry(): Telemetry {
  const spans: TraceSpan[] = [];
  return {
    span(name) {
      const startedAt = Date.now();
      return { end: (attributes = {}) => { spans.push({ name, startedAt, endedAt: Date.now(), durationMs: Date.now() - startedAt, attributes }); } };
    },
    flush: () => JSON.stringify(spans, null, 2),
  };
}
export function sloCoverage(spans: Array<{ name: string; durationMs: number }>, targetsMs: Record<string, number>): { ok: boolean; violations: Array<{ name: string; budgetMs: number; actualMs: number }> } {
  const violations: Array<{ name: string; budgetMs: number; actualMs: number }> = [];
  for (const span of spans) { const budgetMs = targetsMs[span.name]; if (budgetMs !== undefined && span.durationMs > budgetMs) violations.push({ name: span.name, budgetMs, actualMs: span.durationMs }); }
  return { ok: violations.length === 0, violations };
}
export function enforceDurationBound(span: { startedAt: number; budgetMs: number }): { expired: boolean; overshootMs: number } { const elapsed = Date.now() - span.startedAt; return { expired: elapsed > span.budgetMs, overshootMs: Math.max(0, elapsed - span.budgetMs) }; }
export function enrichment(plus: TraceSpan, minus: TraceSpan): { deltaMs: number; slowsBy: string } { const deltaMs = plus.durationMs - minus.durationMs; return { deltaMs, slowsBy: deltaMs > 0 ? `${deltaMs}ms slower after change` : "no regression" }; }