// FILE: src/platform/observability/metrics.ts
export interface Counter { add(value?: number, labels?: Record<string, string>): void }
export interface Gauge { set(value: number): void }
export interface Histogram { observe(value: number, labels?: Record<string, string>): void }
export interface MetricDefinition { kind: "counter" | "gauge" | "histogram"; name: string; help?: string; bucketBounds?: number[] }
export interface MetricRegistry { counter(name: string, help?: string): Counter; gauge(name: string, help?: string): Gauge; histogram(name: string, help?: string, bounds?: number[]): Histogram; snapshot(format?: "prometheus" | "json"): string }
export interface MetricPoint { name: string; kind: MetricDefinition["kind"]; value: number; samples: number; labels?: Record<string, string> }

export function createMetricRegistry(definitions: Array<[string, MetricDefinition["kind"]]> = []): MetricRegistry {
  const counters = new Map<string, { help: string; value: number }>();
  const gauges = new Map<string, { help: string; value: number }>();
  const histograms = new Map<string, { help: string; bounds: number[]; values: number[]; sums: number[]; count: number }>();
  for (const [name, kind] of definitions) { if (kind === "counter") counters.set(name, { help: name, value: 0 }); else if (kind === "gauge") gauges.set(name, { help: name, value: 0 }); else histograms.set(name, { help: name, bounds: [], values: [], sums: [], count: 0 }); }
  const bucketIndex = (bounds: number[], value: number) => bounds.findIndex((bound) => value <= bound);
  return {
    counter(name, help = name) { const entry = counters.get(name) ?? (() => { const created = { help, value: 0 }; counters.set(name, created); return created; })(); return { add: (value = 1) => { entry.value += value; } }; },
    gauge(name, help = name) { const entry = gauges.get(name) ?? (() => { const created = { help, value: 0 }; gauges.set(name, created); return created; })(); return { set: (value) => { entry.value = value; } }; },
    histogram(name, help = name, bounds: number[] = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10_000]) { const entry = histograms.get(name) ?? (() => { const created = { help, bounds, values: new Array(bounds.length + 1).fill(0) as number[], sums: [], count: 0 }; histograms.set(name, created); return created; })(); return { observe: (value) => { const index = bucketIndex(entry.bounds, value); entry.values[index] += 1; entry.count += 1; entry.sums = [...entry.sums, value]; } }; },
    snapshot(format = "prometheus") {
      const points: MetricPoint[] = [];
      for (const [name, entry] of counters) points.push({ name, kind: "counter", value: entry.value, samples: entry.value === 0 ? 0 : 1 });
      for (const [name, entry] of gauges) points.push({ name, kind: "gauge", value: entry.value, samples: 1 });
      for (const [name, entry] of histograms) points.push({ name, kind: "histogram", value: entry.sums.reduce((a, b) => a + b, 0), samples: entry.count });
      if (format === "json") return JSON.stringify(points, null, 2);
      return points.map((p) => `${p.name} ${p.value}`).join("\n");
    },
  };
}
export function totalRequests(registry: MetricRegistry, counterName: string): number { return Number((JSON.parse(registry.snapshot("json")) as MetricPoint[]).find((p) => p.name === counterName)?.value ?? 0); }