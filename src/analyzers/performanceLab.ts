import fs from "node:fs/promises";
import path from "node:path";

/** Only discover explicit metadata files; never traverse a linked path outside the repository. */
export async function discoverBundleMetadata(root: string): Promise<{ report?: BundleReport; error?: string }> {
  const canonicalRoot = await fs.realpath(root);
  for (const name of ["bundle-stats.json", "esbuild-meta.json"]) {
    const candidate = path.join(canonicalRoot, name);
    try {
      const canonicalFile = await fs.realpath(candidate);
      if (path.dirname(canonicalFile) !== canonicalRoot) return { error: `Bundle metadata ${name} points outside the repository root` };
      const stat = await fs.stat(canonicalFile);
      if (!stat.isFile() || stat.size > 10 * 1024 * 1024) return { error: `Bundle metadata ${name} must be a file under 10 MB` };
      const report = await parseBundleMetadata(canonicalFile);
      if (report.tool === "unknown" || !report.modules.length) return { error: `Bundle metadata ${name} has no supported module weights` };
      return { report };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      return { error: `Unable to read bundle metadata ${name}: ${error instanceof Error ? error.message : String(error)}` };
    }
  }
  return {};
}
export interface RouteMetrics { route: string; profile: "mobile" | "desktop"; lcp: number; cls: number; tbt: number; speedIndex: number; performance: number }
export interface PerformanceBudget { route?: string; profile?: "mobile" | "desktop"; maxLcp?: number; maxCls?: number; maxTbt?: number; maxSpeedIndex?: number; minScore?: number; maxBundleBytes?: number }
export interface BundleModule { name: string; bytes: number; chunks: string[]; duplicated: boolean }
export interface BundleReport { tool: "vite" | "webpack" | "rollup" | "esbuild" | "unknown"; modules: BundleModule[]; totalBytes: number; duplicatedBytes: number }
export function metricsFromLighthouse(route: string, profile: "mobile" | "desktop", lhr: { categories?: Record<string, { score?: number | null }>; audits?: Record<string, { numericValue?: number }> }): RouteMetrics { const value = (id: string) => lhr.audits?.[id]?.numericValue ?? 0; return { route, profile, lcp: value("largest-contentful-paint"), cls: value("cumulative-layout-shift"), tbt: value("total-blocking-time"), speedIndex: value("speed-index"), performance: Math.round((lhr.categories?.performance?.score ?? 0) * 100) }; }
export async function parseBundleMetadata(file: string): Promise<BundleReport> {
  const raw = JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown>;
  const modules = new Map<string, { bytes: number; chunks: string[] }>();
  let tool: BundleReport["tool"] = "unknown";
  const add = (name: string, bytes: unknown, chunks: string[]) => {
    if (typeof bytes !== "number" || !Number.isFinite(bytes) || bytes < 0) throw new Error("Invalid module weight");
    const current = modules.get(name) ?? { bytes: 0, chunks: [] };
    current.bytes += bytes; current.chunks = [...new Set([...current.chunks, ...chunks])]; modules.set(name, current);
  };
  if (raw.outputs && typeof raw.outputs === "object") {
    tool = "esbuild";
    for (const [chunk, data] of Object.entries(raw.outputs as Record<string, { inputs?: Record<string, { bytesInOutput?: number }> }>))
      for (const [name, item] of Object.entries(data.inputs ?? {})) add(name, item.bytesInOutput ?? 0, [chunk]);
  } else if (Array.isArray(raw.modules)) {
    tool = "webpack";
    type WebpackModule = { name?: string; size?: number; chunks?: Array<string | number>; modules?: WebpackModule[] };
    const visit = (items: WebpackModule[], parentChunks: string[] = []) => {
      for (const item of items) {
        const chunks = item.chunks?.length ? item.chunks.map(String) : parentChunks;
        if (item.modules?.length) visit(item.modules, chunks);
        else if (item.name) add(item.name, item.size ?? 0, chunks);
      }
    };
    visit(raw.modules as WebpackModule[]);
  } else if (Array.isArray(raw.chunks)) {
    tool = raw.tool === "vite" ? "vite" : "rollup";
    for (const chunk of raw.chunks as Array<{ fileName?: string; modules?: Record<string, { renderedLength?: number }> }>)
      for (const [name, item] of Object.entries(chunk.modules ?? {})) add(name, item.renderedLength ?? 0, [chunk.fileName ?? "chunk"]);
  } else if (Array.isArray(raw.assets)) {
    tool = "webpack";
    for (const asset of raw.assets as Array<{ name?: string; size?: number; chunks?: Array<string | number> }>)
      if (asset.name) add(asset.name, asset.size ?? 0, (asset.chunks ?? []).map(String));
  }
  const result = [...modules].map(([name, value]) => ({ name, ...value, duplicated: value.chunks.length > 1 }));
  return { tool, modules: result.sort((a, b) => b.bytes - a.bytes || a.name.localeCompare(b.name)), totalBytes: result.reduce((sum, item) => sum + item.bytes, 0), duplicatedBytes: result.filter(item => item.duplicated).reduce((sum, item) => sum + item.bytes, 0) };
}
export function evaluatePerformanceBudgets(metrics: RouteMetrics[], bundle: BundleReport | undefined, budgets: PerformanceBudget[]) { const failures: string[] = []; for (const budget of budgets) for (const metric of metrics.filter((m) => (!budget.route || budget.route === m.route) && (!budget.profile || budget.profile === m.profile))) { if (budget.maxLcp !== undefined && metric.lcp > budget.maxLcp) failures.push(`${metric.route}/${metric.profile}: LCP ${metric.lcp} > ${budget.maxLcp}`); if (budget.maxCls !== undefined && metric.cls > budget.maxCls) failures.push(`${metric.route}/${metric.profile}: CLS ${metric.cls} > ${budget.maxCls}`); if (budget.maxTbt !== undefined && metric.tbt > budget.maxTbt) failures.push(`${metric.route}/${metric.profile}: TBT ${metric.tbt} > ${budget.maxTbt}`); if (budget.maxSpeedIndex !== undefined && metric.speedIndex > budget.maxSpeedIndex) failures.push(`${metric.route}/${metric.profile}: Speed Index ${metric.speedIndex} > ${budget.maxSpeedIndex}`); if (budget.minScore !== undefined && metric.performance < budget.minScore) failures.push(`${metric.route}/${metric.profile}: score ${metric.performance} < ${budget.minScore}`); } const maxBundle = Math.min(...budgets.map((b) => b.maxBundleBytes ?? Infinity)); if (bundle && bundle.totalBytes > maxBundle) failures.push(`Bundle ${bundle.totalBytes} bytes > ${maxBundle}`); return { passed: failures.length === 0, failures }; }
export function performanceScores(metrics: RouteMetrics[], bundle?: BundleReport) { const performance = metrics.length ? Math.round(metrics.reduce((sum, m) => sum + m.performance, 0) / metrics.length) : 0; const bundleScore = bundle ? Math.max(0, Math.round(100 - bundle.totalBytes / 50_000 - bundle.duplicatedBytes / 20_000)) : 0; return { performance, bundle: bundleScore }; }
export interface AssetUsage { ref: string; kind: "script" | "stylesheet" | "image"; referenced: boolean; path?: string }
export function detectUnusedAssets(html: string, manifest: string[] = [], baseUrl = ""): AssetUsage[] {
  const refs = html.match(/<script\b[^>]*src=["']([^"']+)["']/gi) ?? [];
  const styles = html.match(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi) ?? [];
  const images = html.match(/<img\b[^>]*src=["']([^"']+)["']/gi) ?? [];
  const used = new Set<string>();
  for (const match of [...refs, ...styles, ...images]) { const src = /(?:src|href)=["']([^"']+)["']/i.exec(match)?.[1]; if (src) { try { used.add(new URL(src, baseUrl).href); } catch { used.add(src); } } }
  const result: AssetUsage[] = [];
  for (const ref of manifest) { const display = ref.startsWith(".") && baseUrl ? new URL(ref.slice(1), baseUrl).href : ref; const normalized = baseUrl && !/^https?:/.test(ref) ? new URL(ref.replace(/^\.?\//, ""), baseUrl).href : ref; result.push({ ref, kind: /\.css$/i.test(display) ? "stylesheet" : /\.(?:png|jpe?g|gif|webp|svg|avif)$/i.test(display) ? "image" : "script", referenced: used.has(normalized) || used.has(display), path: display }); }
  return result;
}
export interface ImageMetric { src: string; bytes: number; width: number; height: number; kbps: number; oversized: boolean; recommendation?: string }
export function detectOversizedImages(html: string, sources: Array<{ url: string; bytes: number }>): ImageMetric[] {
  const widthOf = new Map<string, number>();
  for (const match of html.matchAll(/(?=[^\s"']+)([^\s"']+?)\s+(\d{2,5})\s*[wx]/g)) widthOf.set(match[1], Number(match[2]));
  for (const match of html.matchAll(/<(?:img|source)\b[^>]*src=["']([^"']+)["']/gi)) if (!widthOf.has(match[1])) widthOf.set(match[1], 0);
  return sources.map((source) => { const width = widthOf.get(source.url) ?? 1000; const kbps = source.bytes / 1024; const oversized = source.bytes > 200_000 || kbps > 256; return { src: source.url, bytes: source.bytes, width, height: 800, kbps: Math.round(kbps), oversized, recommendation: oversized ? `Optimize to under ${Math.round(width * 1600 / 1024)} KB (WebP/AVIF, responsive srcset)` : undefined }; });
}
export interface PerformanceDelta { route: string; profile: "mobile" | "desktop"; before: number; after: number; delta: number; regressed: boolean }
export function comparePerformanceBeforeAfter(before: RouteMetrics[], after: RouteMetrics[]): { deltas: PerformanceDelta[]; regressed: PerformanceDelta[]; total: RouteMetrics } {
  const pairs = after.map((item) => { const prev = before.find((b) => b.route === item.route && b.profile === item.profile); return { item, prev }; });
  const deltas: PerformanceDelta[] = pairs.map(({ item, prev }) => ({ route: item.route, profile: item.profile, before: prev?.performance ?? item.performance, after: item.performance, delta: prev ? item.performance - prev.performance : 0, regressed: prev !== undefined && item.performance < prev.performance }));
  const regressed = deltas.filter((d) => d.regressed);
  return { deltas, regressed, total: { route: "<all>", profile: "mobile", lcp: 0, cls: 0, tbt: 0, speedIndex: 0, performance: Math.round(after.reduce((sum, m) => sum + m.performance, 0) / Math.max(1, after.length)) } };
}
export interface PerformanceRemediation { ruleId: string; severity: "low" | "medium" | "high"; message: string; evidence: Record<string, unknown>; action: string }
export function performanceRemediations(metrics: RouteMetrics[], bundle?: BundleReport, unused?: AssetUsage[]): PerformanceRemediation[] {
  const findings: PerformanceRemediation[] = [];
  for (const metric of metrics) { if (metric.lcp > 2500) findings.push({ ruleId: "lcp-budget", severity: "high", message: `${metric.route}/${metric.profile}: LCP ${metric.lcp}ms exceeds 2.5s`, evidence: { route: metric.route, profile: metric.profile, lcp: metric.lcp }, action: "Code-split the route, preload the hero image and defer non-critical scripts" }); if (metric.cls > .1) findings.push({ ruleId: "cls-budget", severity: "high", message: `${metric.route}/${metric.profile}: CLS ${metric.cls} exceeds 0.1`, evidence: { route: metric.route, profile: metric.profile, cls: metric.cls }, action: "Reserve layout space for late-loading content and fonts" }); if (metric.tbt > 300) findings.push({ ruleId: "long-task-budget", severity: "medium", message: `${metric.route}/${metric.profile}: TBT ${metric.tbt}ms indicates long main-thread tasks`, evidence: { route: metric.route, profile: metric.profile, tbt: metric.tbt }, action: "Break long tasks, coarsen loops and move work off the main thread" }); }
  if (bundle?.duplicatedBytes) findings.push({ ruleId: "duplicated-bundle", severity: "medium", message: `${bundle.duplicatedBytes} duplicated bundle byte(s)`, evidence: { duplicatedBytes: bundle.duplicatedBytes }, action: "Lift the duplicated module into a single shared chunk" });
  if (unused?.some((u) => !u.referenced)) findings.push({ ruleId: "unused-assets", severity: "low", message: `${unused.filter((u) => !u.referenced).length} asset(s) are not referenced by the document`, evidence: { unused: unused.filter((u) => !u.referenced).map((u) => u.ref) }, action: "Remove unreferenced CSS/JS/images or inline critical CSS" });
  return findings;
}
