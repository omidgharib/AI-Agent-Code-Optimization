import type { PrioritizedIssue } from "../core/types";
import type {
  LighthouseAudit,
  LighthouseCategory,
  LighthouseDetails,
  LighthouseReport,
  ReportData,
} from "./summary";

export function severityColor(s: string): string {
  return (
    { critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#65a30d" }[
      s
    ] ?? "#6b7280"
  );
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function scoreColor(s: number | null): string {
  if (s === null) return "#64748b";
  if (s >= 0.9) return "#22c55e";
  if (s >= 0.5) return "#eab308";
  return "#ef4444";
}

function pct(s: number | null): string {
  return s === null ? "–" : `${Math.round(s * 100)}%`;
}

function link(url: string): string {
  return `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(url)}</a>`;
}

function formatBytes(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "–";
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${Math.round(n)} B`;
}

function formatMs(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return "–";
  if (n >= 1000) return `${(n / 1000).toFixed(2)} s`;
  return `${Math.round(n)} ms`;
}

function meta(label: string, value: string): string {
  return `<div class="meta-item"><span class="meta-label">${esc(label)}</span><span class="meta-value">${value}</span></div>`;
}

/* ------------------------------------------------------------------ */
/* Lighthouse sections                                                 */
/* ------------------------------------------------------------------ */

const CATEGORY_ORDER: Array<[string, string]> = [
  ["performance", "Performance"],
  ["accessibility", "Accessibility"],
  ["best-practices", "Best Practices"],
  ["seo", "SEO"],
  ["pwa", "PWA"],
];

function renderKpis(lhr: LighthouseReport): string {
  const cards = CATEGORY_ORDER.map(([id]) => lhr.categories[id])
    .flatMap((c): LighthouseCategory[] => (c ? [c] : []))
    .map((c) => {
      const color = scoreColor(c.score);
      return `<div class="kpi-card" style="border-top:4px solid ${color}">
        <div class="kpi-title">${esc(c.title ?? c.id)}</div>
        <div class="kpi-score" style="color:${color}">${pct(c.score)}</div>
        <div class="kpi-sub">${esc(c.id)}</div>
      </div>`;
    })
    .join("");
  return `<div class="section"><div class="section-header">Lighthouse Scores</div><div class="kpi-grid">${cards}</div></div>`;
}

function renderMeta(lhr: LighthouseReport): string {
  const cs = lhr.configSettings;
  const env = lhr.environment;
  const se = cs?.screenEmulation;
  const items: string[] = [];

  if (lhr.requestedUrl) items.push(meta("Requested URL", link(lhr.requestedUrl)));
  if (lhr.mainDocumentUrl) items.push(meta("Main document URL", link(lhr.mainDocumentUrl)));
  if (lhr.finalDisplayedUrl && lhr.finalDisplayedUrl !== lhr.mainDocumentUrl)
    items.push(meta("Final displayed URL", link(lhr.finalDisplayedUrl)));
  if (lhr.fetchTime)
    items.push(meta("Fetch time", esc(new Date(lhr.fetchTime).toLocaleString())));
  if (lhr.lighthouseVersion)
    items.push(meta("Lighthouse version", esc(lhr.lighthouseVersion)));
  if (lhr.gatherMode) items.push(meta("Gather mode", esc(lhr.gatherMode)));
  if (lhr.timing?.total !== undefined)
    items.push(meta("Total runtime", esc(formatMs(lhr.timing.total))));

  if (cs?.formFactor) items.push(meta("Form factor", esc(cs.formFactor)));
  if (cs?.throttlingMethod)
    items.push(meta("Throttling method", esc(cs.throttlingMethod)));
  if (se) {
    const dims = se.disabled
      ? "Disabled"
      : `${se.width ?? "?"}×${se.height ?? "?"}${se.deviceScaleFactor ? ` @${se.deviceScaleFactor}x` : ""}${se.mobile ? " (mobile)" : ""}`;
    items.push(meta("Screen emulation", esc(dims)));
  }

  if (env?.hostUserAgent) items.push(meta("Host user agent", esc(env.hostUserAgent)));
  if (env?.networkUserAgent) items.push(meta("Network user agent", esc(env.networkUserAgent)));
  if (env?.benchmarkIndex !== undefined)
    items.push(meta("CPU benchmark index", esc(String(env.benchmarkIndex))));

  if (items.length === 0) return "";
  return `<div class="section"><div class="section-header">Report Metadata</div><div class="meta-grid">${items.join("")}</div></div>`;
}

const CWV_METRICS: Array<[string, string, string]> = [
  ["first-contentful-paint", "FCP", "First Contentful Paint"],
  ["largest-contentful-paint", "LCP", "Largest Contentful Paint"],
  ["total-blocking-time", "TBT", "Total Blocking Time"],
  ["cumulative-layout-shift", "CLS", "Cumulative Layout Shift"],
  ["speed-index", "SI", "Speed Index"],
  ["interactive", "TTI", "Time to Interactive"],
];

function cwvStatus(s: number | null): string {
  if (s === null) return '<span class="dim">–</span>';
  if (s >= 0.9) return '<span class="status-good">Good</span>';
  if (s >= 0.5) return '<span class="status-moderate">Moderate</span>';
  return '<span class="status-poor">Poor</span>';
}

function renderCwv(lhr: LighthouseReport): string {
  const rows = CWV_METRICS.map(([id, short, full]) => {
    const a = lhr.audits[id];
    if (!a) return "";
    const score = a.score ?? null;
    const color = scoreColor(score);
    const width = score === null ? 0 : Math.max(2, Math.round(score * 100));
    return `<tr>
      <td><span class="cwv-name">${esc(short)}</span><span class="cwv-full">${esc(full)}</span></td>
      <td><div class="bar"><div class="bar-fill" style="width:${width}%;background:${color}"></div></div></td>
      <td style="color:${color};font-weight:600">${pct(score)}</td>
      <td class="disp">${esc(a.displayValue ?? "–")}</td>
      <td>${cwvStatus(score)}</td>
    </tr>`;
  }).filter(Boolean).join("");
  if (!rows) return "";
  return `<div class="section"><div class="section-header">Core Web Vitals</div>
    <table><thead><tr><th>Metric</th><th>Score</th><th>Value</th><th>Measured</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

function bucketOf(a: LighthouseAudit): string {
  const m = a.scoreDisplayMode ?? "";
  if (m === "error") return "error";
  if (m === "notApplicable" || m === "manual") return "na";
  if (m === "informative") return "diagnostic";
  if (a.score === 1) return "passed";
  if (a.score === null) return "diagnostic";
  return "opportunity";
}

const BUCKET_LABELS: Array<[string, string]> = [
  ["all", "All"],
  ["opportunity", "Opportunities"],
  ["diagnostic", "Diagnostics"],
  ["passed", "Passed"],
  ["na", "Not Applicable"],
  ["error", "Errors"],
];

function cellValue(v: unknown): string {
  if (v === null || v === undefined) return '<span class="dim">–</span>';
  if (typeof v === "number")
    return esc(Number.isFinite(v) ? v.toLocaleString("en-US") : String(v));
  if (typeof v === "boolean") return v ? "✓" : "✗";
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if (typeof o.selector === "string") {
      let html = `<code>${esc(o.selector)}</code>`;
      if (typeof o.snippet === "string")
        html += `<div class="snippet">${esc(o.snippet)}</div>`;
      if (typeof o.text === "string") html += `<div class="dim">${esc(o.text)}</div>`;
      return html;
    }
    if (typeof o.url === "string") return link(o.url);
    if (typeof o.path === "string") return link(o.path);
    if (typeof o.text === "string") return esc(o.text);
    const s = JSON.stringify(o);
    return s && s.length > 120 ? `<pre class="mini">${esc(s)}</pre>` : esc(s ?? "{}");
  }
  if (typeof v === "string" && /^https?:\/\//i.test(v)) return link(v);
  return esc(String(v));
}

function itemsTable(d: LighthouseDetails): string {
  const items = d.items ?? [];
  if (items.length === 0) return "";
  const headings = d.headings ?? [];
  if (headings.length === 0) {
    return `<div class="objdump">${items
      .map(
        (it) =>
          Object.entries(it)
            .filter(([k]) => k !== "node" && typeof it[k] !== "object")
            .map(
              ([k, val]) =>
                `<div class="pair"><span class="k">${esc(k)}</span><span>${cellValue(val)}</span></div>`,
            )
            .join(""),
      )
      .join('<hr class="sep">')}</div>`;
  }
  return `<table class="items-table">
    <thead><tr>${headings
      .map((h) => `<th>${esc(h.label ?? h.key ?? "?")}</th>`)
      .join("")}</tr></thead>
    <tbody>${items
      .map(
        (it) =>
          `<tr>${headings
            .map((h) => {
              const k = h.key;
              return k ? `<td>${cellValue(it[k])}</td>` : '<td class="dim">–</td>';
            })
            .join("")}</tr>`,
      )
      .join("")}</tbody>
  </table>`;
}

function renderFilmstrip(d: LighthouseDetails): string {
  const frames = (d.items ?? [])
    .map((it) => {
      const src = typeof it.data === "string" ? it.data : "";
      const ts =
        typeof it.timestamp === "number" ? `${(it.timestamp / 1000).toFixed(1)}s` : "";
      return src
        ? `<img class="frame" src="${esc(src)}" title="${esc(ts)}" alt="frame ${esc(ts)}">`
        : "";
    })
    .filter(Boolean)
    .join("");
  return frames ? `<div class="filmstrip">${frames}</div>` : "";
}

function renderAuditDetail(a: LighthouseAudit, lhr: LighthouseReport): string {
  const parts: string[] = [];

  if (a.description) parts.push(`<p class="adesc">${esc(a.description)}</p>`);

  if (a.warnings?.length) {
    parts.push(
      `<div class="awarn"><b>Warnings</b><ul>${a.warnings
        .map((w) => `<li>${esc(w)}</li>`)
        .join("")}</ul></div>`,
    );
  }

  const d = a.details;
  if (d?.overallSavingsMs !== undefined || d?.overallSavingsBytes !== undefined) {
    const chips: string[] = [];
    if (d.overallSavingsMs !== undefined)
      chips.push(
        `<span class="chip chip-ms">${formatMs(d.overallSavingsMs)} potential saving</span>`,
      );
    if (d.overallSavingsBytes !== undefined)
      chips.push(
        `<span class="chip chip-bytes">${formatBytes(d.overallSavingsBytes)} wasted</span>`,
      );
    parts.push(`<div class="chips">${chips.join("")}</div>`);
  }

  if (d?.type === "full-page-screenshot") {
    if (lhr.fullPageScreenshotFile)
      parts.push(
        `<a class="shot-link" href="${esc(lhr.fullPageScreenshotFile)}" target="_blank" rel="noopener">Open full page screenshot ↗</a>`,
      );
  } else if (d?.type === "filmstrip") {
    const frames = renderFilmstrip(d);
    if (frames) parts.push(frames);
  } else if (d?.type === "screenshot" && d.data) {
    parts.push(`<img class="shot" src="${esc(d.data)}" alt="${esc(a.title)}">`);
  } else if (d?.items?.length) {
    parts.push(itemsTable(d));
  } else if (d?.data) {
    parts.push(`<img class="shot" src="${esc(d.data)}" alt="${esc(a.title)}">`);
  }

  if (a.errorMessage) {
    parts.push(`<p class="err">${esc(a.errorMessage)}</p>`);
    if (a.errorStack) parts.push(`<pre class="stack">${esc(a.errorStack)}</pre>`);
  }

  if (d?.debugData && Object.keys(d.debugData).length > 0) {
    parts.push(`<pre class="mini">${esc(JSON.stringify(d.debugData, null, 2))}</pre>`);
  }

  if (parts.length === 0) parts.push('<span class="dim">No additional details.</span>');
  return parts.join("");
}

function renderAudits(lhr: LighthouseReport): string {
  const entries = Object.entries(lhr.audits);
  const counts: Record<string, number> = {};
  for (const [, a] of entries) {
    const b = bucketOf(a);
    counts.all = (counts.all ?? 0) + 1;
    counts[b] = (counts[b] ?? 0) + 1;
  }

  const buttons = BUCKET_LABELS.map(
    ([id, label]) =>
      `<button class="filter-btn${id === "all" ? " active" : ""}" data-bucket="${id}">${label} <span class="fcount">${counts[id] ?? 0}</span></button>`,
  ).join("");

  const rows = entries
    .map(([id, a]) => {
      const bucket = bucketOf(a);
      const search = esc(`${a.title} ${a.description ?? ""} ${id}`.toLowerCase());
      const color = scoreColor(a.score);
      return `<tr class="audit-row" data-bucket="${bucket}" data-search="${search}">
      <td class="toggle">▸</td>
      <td><span class="badge score" style="background:${color}">${pct(a.score)}</span></td>
      <td><span class="atitle">${esc(a.title)}</span>${a.displayValue ? `<span class="disp">${esc(a.displayValue)}</span>` : ""}</td>
      <td><span class="mode">${esc(a.scoreDisplayMode ?? "–")}</span></td>
      <td class="rule">${esc(id)}</td>
    </tr>
    <tr class="audit-detail" data-bucket="${bucket}">
      <td></td><td colspan="4">${renderAuditDetail(a, lhr)}</td>
    </tr>`;
    })
    .join("");

  return `<div class="section"><div class="section-header">Audits (${entries.length})</div>
    <div class="toolbar">
      <div class="filters">${buttons}</div>
      <input class="search" type="search" placeholder="Search audits…">
    </div>
    <table class="audit-table"><thead><tr><th></th><th>Score</th><th>Audit</th><th>Mode</th><th>ID</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </div>`;
}

function renderScreenshots(lhr: LighthouseReport): string {
  const parts: string[] = [];

  if (lhr.fullPageScreenshotFile) {
    parts.push(`<figure class="shot-block">
      <figcaption>Full page screenshot</figcaption>
      <img class="shot fullpage" src="${esc(lhr.fullPageScreenshotFile)}" alt="Full page screenshot">
    </figure>`);
  }

  const filmstrip = lhr.audits["screenshot-thumbnails"]?.details;
  if (filmstrip?.items?.length) {
    const frames = (filmstrip.items ?? [])
      .map((it) => {
        const src = typeof it.data === "string" ? it.data : "";
        const ts =
          typeof it.timestamp === "number" ? `${(it.timestamp / 1000).toFixed(1)}s` : "";
        return src
          ? `<img class="frame" src="${esc(src)}" title="${esc(ts)}" alt="frame ${esc(ts)}">`
          : "";
      })
      .filter(Boolean)
      .join("");
    if (frames)
      parts.push(`<figure class="shot-block"><figcaption>Filmstrip (page load timeline)</figcaption><div class="filmstrip">${frames}</div></figure>`);
  }

  const finalShot = lhr.audits["final-screenshot"]?.details;
  if (finalShot?.data) {
    parts.push(`<figure class="shot-block"><figcaption>Final screenshot</figcaption><img class="shot" src="${esc(finalShot.data)}" alt="Final screenshot"></figure>`);
  }

  if (parts.length === 0) return "";
  return `<div class="section"><div class="section-header">Screenshots</div><div class="shots">${parts.join("")}</div></div>`;
}

function renderWarnings(lhr: LighthouseReport): string {
  const parts: string[] = [];
  if (lhr.runWarnings?.length) {
    parts.push(`<div class="section"><div class="section-header">Run Warnings</div><ul class="warn-list">${lhr.runWarnings
      .map((w) => `<li>${esc(w)}</li>`)
      .join("")}</ul></div>`);
  }
  if (lhr.runtimeError) {
    const r = lhr.runtimeError;
    parts.push(`<div class="section"><div class="section-header">Runtime Error</div><div class="runtime-error">
      <p><b>${esc(r.code ?? "error")}</b> — ${esc(r.message ?? "")}</p>
      ${r.errorStack ? `<pre class="stack">${esc(r.errorStack)}</pre>` : ""}
    </div></div>`);
  }
  return parts.join("");
}

function lighthouseSections(lhr: LighthouseReport): string {
  return [
    renderKpis(lhr),
    renderMeta(lhr),
    renderCwv(lhr),
    renderAudits(lhr),
    renderScreenshots(lhr),
    renderWarnings(lhr),
  ].join("\n");
}

/* ------------------------------------------------------------------ */
/* Issue sections (ESLint / TypeScript / other tools)                  */
/* ------------------------------------------------------------------ */

function issueRow(issue: PrioritizedIssue, index: number): string {
  const loc = issue.location;
  const file = loc?.filePath ?? "-";
  const line = loc?.startLine ?? "-";
  const col = loc?.startColumn ?? "-";
  const end =
    loc?.endLine !== undefined
      ? `${loc.endLine}${loc.endColumn !== undefined ? `:${loc.endColumn}` : ""}`
      : "-";
  const color = severityColor(issue.severity);
  const rule = issue.ruleId ?? "-";
  const snippet = issue.evidence?.snippet;
  return `<tr>
      <td class="num">${index + 1}</td>
      <td><span class="badge" style="background:${color}">${esc(issue.severity)}</span></td>
      <td><span class="cat">${esc(issue.category)}</span></td>
      <td class="rule" title="${esc(rule)}">${esc(rule)}</td>
      <td class="filepath"><span class="file">${esc(file)}</span>${line !== "-" ? `<span class="loc">:${line}${col !== "-" ? `:${col}` : ""}</span>` : ""}</td>
      <td>${line}</td>
      <td>${col}</td>
      <td>${esc(String(end))}</td>
      <td>${issue.fix?.canAutoFix ? '<span class="fixable">✓</span>' : '<span class="dim">–</span>'}</td>
      <td class="msg">${esc(issue.message)}</td>
      <td>${snippet ? `<code class="snippet">${esc(snippet)}</code>` : '<span class="dim">–</span>'}</td>
    </tr>`;
}

function issuesTable(issues: PrioritizedIssue[]): string {
  const rows = issues.map((issue, i) => issueRow(issue, i)).join("\n");
  return `<table>
      <thead><tr><th>#</th><th>Severity</th><th>Category</th><th>Rule / Code</th><th>File:Line:Col</th><th>Line</th><th>Col</th><th>End</th><th>Fixable</th><th>Message</th><th>Snippet</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function toolSection(title: string, issues: PrioritizedIssue[]): string {
  if (issues.length === 0) return "";
  return `<div class="section">
    <div class="section-header">${esc(title)} (${issues.length})</div>
    ${issuesTable(issues)}
  </div>`;
}

/* ------------------------------------------------------------------ */
/* Main report                                                         */
/* ------------------------------------------------------------------ */

const UI_SCRIPT = `
(function () {
  var search = document.querySelector('.search');
  var buttons = Array.prototype.slice.call(document.querySelectorAll('.filter-btn'));
  var rows = Array.prototype.slice.call(document.querySelectorAll('.audit-row'));

  function apply() {
    var q = search ? search.value.trim().toLowerCase() : '';
    var active = 'all';
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i].classList.contains('active')) {
        active = buttons[i].getAttribute('data-bucket');
        break;
      }
    }
    rows.forEach(function (row) {
      var bucketOk = active === 'all' || row.getAttribute('data-bucket') === active;
      var searchOk = q === '' || (row.getAttribute('data-search') || '').indexOf(q) !== -1;
      row.style.display = bucketOk && searchOk ? '' : 'none';
    });
    Array.prototype.slice.call(document.querySelectorAll('.audit-detail')).forEach(function (d) {
      d.style.display = 'none';
    });
    Array.prototype.slice.call(document.querySelectorAll('.audit-row.open')).forEach(function (r) {
      r.classList.remove('open');
      r.querySelector('.toggle').textContent = '\\u25B8';
    });
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      buttons.forEach(function (x) { x.classList.remove('active'); });
      b.classList.add('active');
      apply();
    });
  });

  if (search) search.addEventListener('input', apply);

  document.addEventListener('click', function (e) {
    var row = e.target.closest ? e.target.closest('.audit-row') : null;
    if (!row) return;
    var detail = row.nextElementSibling;
    if (!detail || !detail.classList.contains('audit-detail')) return;
    var isOpen = row.classList.contains('open');
    Array.prototype.slice.call(document.querySelectorAll('.audit-row.open')).forEach(function (r) {
      r.classList.remove('open');
      var d = r.nextElementSibling;
      if (d && d.classList.contains('audit-detail')) d.style.display = 'none';
      r.querySelector('.toggle').textContent = '\\u25B8';
    });
    if (!isOpen) {
      row.classList.add('open');
      row.querySelector('.toggle').textContent = '\\u25BE';
      detail.style.display = '';
    }
  });
})();
`;

export function toHtml(data: ReportData): string {
  const severityOrder = ["critical", "high", "medium", "low"];

  const severityBadges = severityOrder
    .filter((s) => data.summary.bySeverity[s])
    .map(
      (s) =>
        `<div class="stat-card"><span class="badge lg" style="background:${severityColor(s)}">${s}</span><span class="count">${data.summary.bySeverity[s]}</span></div>`,
    )
    .join("");

  const toolCards = Object.entries(data.summary.byTool)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([tool, count]) =>
        `<div class="stat-card"><span class="badge lg tool">${esc(tool)}</span><span class="count">${count}</span></div>`,
    )
    .join("");

  const patchRows = data.patches
    .map(
      (p) =>
        `<tr><td>${esc(p.description)}</td><td>${p.touches.map((f) => `<code>${esc(f)}</code>`).join(", ")}</td></tr>`,
    )
    .join("");

  const lighthouseHtml = data.lighthouse ? lighthouseSections(data.lighthouse) : "";

  const tools = data.tools ?? {};
  const toolSections = [
    toolSection("ESLint", tools.eslint ?? []),
    toolSection("TypeScript (tsc)", tools.tsc ?? []),
    toolSection(
      "Other Tools",
      Object.entries(tools)
        .filter(([t]) => t !== "eslint" && t !== "tsc")
        .flatMap(([, list]) => list),
    ),
  ].join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI Auditor Report</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;min-height:100vh}
  header{background:linear-gradient(135deg,#1e293b,#0f172a);border-bottom:1px solid #1e293b;padding:24px 32px;display:flex;align-items:center;gap:16px}
  header h1{font-size:1.5rem;font-weight:700;color:#f8fafc}
  header .subtitle{color:#94a3b8;font-size:.875rem;margin-top:2px}
  .badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.05em}
  .badge.lg{font-size:.875rem;padding:4px 12px}
  .badge.tool{background:#1d4ed8}
  .container{max-width:1400px;margin:0 auto;padding:24px 32px}
  .stats{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:24px}
  .stat-card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:12px;min-width:140px}
  .stat-card .count{font-size:1.5rem;font-weight:700;color:#f8fafc}
  .total-card{background:#1e293b;border:1px solid #334155;border-radius:8px;padding:16px 20px;display:flex;align-items:center;gap:8px}
  .total-card .label{color:#94a3b8;font-size:.875rem}
  .total-card .num{font-size:2rem;font-weight:800;color:#38bdf8}
  .section{background:#1e293b;border:1px solid #334155;border-radius:10px;margin-bottom:20px;overflow:hidden}
  .section-header{padding:14px 20px;background:#162032;border-bottom:1px solid #334155;font-weight:600;font-size:.9rem;color:#94a3b8;text-transform:uppercase;letter-spacing:.08em}
  table{width:100%;border-collapse:collapse;font-size:.85rem}
  th{padding:10px 14px;text-align:left;color:#64748b;font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid #334155;background:#162032}
  td{padding:10px 14px;border-bottom:1px solid #1e293b;vertical-align:top}
  tr:last-child td{border-bottom:none}
  tr:hover td{background:#162032}
  .num{color:#64748b;font-size:.8rem;width:36px}
  .rule{font-family:'SF Mono',Consolas,monospace;font-size:.78rem;color:#7dd3fc;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .filepath{font-family:'SF Mono',Consolas,monospace;font-size:.78rem;max-width:300px}
  .file{color:#a5b4fc}
  .loc{color:#f472b6;font-weight:600}
  .msg{color:#cbd5e1;max-width:400px;line-height:1.4}
  .cat{display:inline-block;padding:1px 7px;border-radius:3px;font-size:.72rem;background:#0f172a;color:#94a3b8;border:1px solid #334155}
  .fixable{color:#4ade80;font-weight:700}
  .verification{padding:16px 20px;display:flex;align-items:center;gap:10px}
  .pass{color:#4ade80;font-weight:600}
  .fail{color:#f87171;font-weight:600}
  code{background:#0f172a;padding:1px 5px;border-radius:3px;font-size:.8rem;color:#a5b4fc}
  .empty{padding:24px;text-align:center;color:#475569}
  .icon{font-size:1.4rem}
  /* Lighthouse */
  .kpi-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px;padding:20px}
  .kpi-card{background:#162032;border:1px solid #334155;border-radius:8px;padding:16px}
  .kpi-title{color:#94a3b8;font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px}
  .kpi-score{font-size:2.1rem;font-weight:800}
  .kpi-sub{color:#475569;font-size:.72rem;margin-top:2px}
  .meta-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:10px 24px;padding:16px 20px}
  .meta-item{display:flex;flex-direction:column;gap:2px;border-bottom:1px dashed #1e293b;padding-bottom:8px}
  .meta-label{color:#64748b;font-size:.7rem;text-transform:uppercase;letter-spacing:.05em}
  .meta-value{color:#e2e8f0;font-size:.85rem;word-break:break-all;line-height:1.4}
  .bar{background:#0f172a;border-radius:4px;height:10px;min-width:120px;overflow:hidden}
  .bar-fill{height:100%;border-radius:4px}
  .status-good{color:#4ade80;font-weight:600}
  .status-moderate{color:#eab308;font-weight:600}
  .status-poor{color:#ef4444;font-weight:600}
  .badge.score{min-width:52px;text-align:center}
  .toolbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 16px;border-bottom:1px solid #334155}
  .filters{display:flex;flex-wrap:wrap;gap:8px}
  .filter-btn{background:#0f172a;border:1px solid #334155;color:#94a3b8;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:.78rem}
  .filter-btn.active{background:#1d4ed8;border-color:#2563eb;color:#fff}
  .filter-btn .fcount{opacity:.7;font-size:.7rem}
  .search{background:#0f172a;border:1px solid #334155;color:#e2e8f0;padding:6px 12px;border-radius:6px;font-size:.8rem;width:240px}
  .search::placeholder{color:#475569}
  .audit-row{cursor:pointer}
  .audit-row:hover td{background:#162032}
  .audit-row.open td{background:#0f172a}
  .toggle{color:#64748b;width:28px}
  .atitle{color:#e2e8f0}
  .disp{color:#94a3b8;margin-left:8px;font-size:.78rem}
  .mode{font-size:.7rem;color:#475569;background:#0f172a;border:1px solid #334155;padding:1px 6px;border-radius:4px;white-space:nowrap}
  .audit-detail{display:none}
  .audit-detail td{background:#0f172a}
  .adesc{color:#cbd5e1;font-size:.82rem;line-height:1.5;margin-bottom:8px;max-width:900px}
  .awarn{margin:6px 0;font-size:.8rem;color:#facc15}
  .awarn ul{margin:4px 0 0 18px}
  .chips{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}
  .chip{font-size:.75rem;padding:3px 10px;border-radius:999px;font-weight:600}
  .chip-ms{background:#0f172a;color:#38bdf8;border:1px solid #0ea5e9}
  .chip-bytes{background:#0f172a;color:#f472b6;border:1px solid #ec4899}
  .items-table{width:100%;margin-top:8px;font-size:.78rem}
  .items-table th{background:#162032}
  .items-table td{word-break:break-all}
  .dim{color:#475569}
  .snippet{color:#f59e0b;font-family:'SF Mono',Consolas,monospace;font-size:.72rem;white-space:pre-wrap;margin-top:2px}
  .mini{font-size:.72rem;color:#94a3b8;white-space:pre-wrap;word-break:break-all;background:#0f172a;padding:8px;border-radius:6px;margin-top:6px;max-height:180px;overflow:auto}
  .stack{font-size:.72rem;color:#f87171;white-space:pre-wrap;background:#0f172a;padding:10px;border-radius:6px;margin-top:8px;overflow:auto}
  .objdump{padding:4px 0}
  .pair{display:flex;gap:10px;padding:3px 0;font-size:.8rem;border-bottom:1px dashed #1e293b}
  .pair .k{color:#64748b;min-width:140px}
  .sep{border:0;border-top:1px solid #334155;margin:8px 0}
  .shots{display:flex;flex-direction:column;gap:16px;padding:16px 20px}
  .shot-block figcaption{color:#94a3b8;font-size:.78rem;margin-bottom:8px;text-transform:uppercase;letter-spacing:.05em}
  .shot{max-width:100%;border:1px solid #334155;border-radius:6px}
  .shot.fullpage{width:100%;height:auto}
  .filmstrip{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px}
  .frame{border:1px solid #334155;border-radius:4px;height:90px;width:auto;flex-shrink:0}
  .warn-list{padding:12px 20px 12px 40px;color:#facc15;font-size:.85rem;line-height:1.6}
  .warn-list li{margin-bottom:4px}
  .runtime-error{padding:14px 20px;color:#f87171;font-size:.85rem}
  .err{color:#ef4444;font-weight:600;font-size:.85rem}
  .shot-link{color:#38bdf8;font-size:.82rem}
  .cwv-name{font-weight:700;color:#e2e8f0;margin-right:8px}
  .cwv-full{color:#64748b;font-size:.75rem}
</style>
</head>
<body>
<header>
  <span class="icon">🔍</span>
  <div>
    <h1>AI Auditor Report</h1>
    <div class="subtitle">Generated ${new Date().toISOString()}</div>
  </div>
</header>
<div class="container">
  <div class="stats">
    <div class="total-card"><span class="label">Total Issues</span><span class="num">${data.summary.total}</span></div>
    ${severityBadges}
    ${toolCards}
  </div>
  ${lighthouseHtml}
  ${
    data.summary.total === 0
      ? '<div class="section"><div class="section-header">Issues</div><div class="empty">No issues found 🎉</div></div>'
      : toolSections
  }
  ${
    data.patches.length > 0
      ? `<div class="section">
    <div class="section-header">Applied Patches (${data.patches.length})</div>
    <table>
      <thead><tr><th>Description</th><th>Files Touched</th></tr></thead>
      <tbody>${patchRows}</tbody>
    </table>
  </div>`
      : ""
  }
  <div class="section">
    <div class="section-header">Verification</div>
    <div class="verification">
      ${data.verification.passed ? '<span class="pass">✓ Passed</span>' : '<span class="fail">✗ Failed</span>'}
      ${data.verification.errors.map((e) => `<span style="color:#f87171;font-size:.85rem">${e}</span>`).join("")}
    </div>
  </div>
</div>
<script>${UI_SCRIPT}</script>
</body>
</html>`;
}
