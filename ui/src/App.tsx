import { FormEvent, useEffect, useMemo, useState } from "react";

type Lang = "fa" | "en";
type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
interface Job { id: string; projectPath: string; url?: string; status: JobStatus; createdAt: string; startedAt?: string; completedAt?: string; exitCode?: number; logs: string[]; reportPath?: string }
interface Issue { id: string; message: string; severity: string; category: string; tool: string; ruleId?: string; location?: { filePath: string; startLine?: number }; evidence?: { snippet?: string; url?: string } }
interface SeoFinding { ruleId: string; category: "metadata" | "indexability" | "structuredData" | "social" | "content"; severity: string; message: string; selector?: string; evidence?: string }
interface Report { summary: { total: number; bySeverity: Record<string, number>; byCategory?: Record<string, number>; byTool: Record<string, number> }; topIssues: Issue[]; patches: { description: string; touches: string[]; unifiedDiff?: string; status?: string }[]; recommendations: string[]; verification: { passed: boolean; errors: string[] }; agent?: { mode: string; requests: number; estimatedTokens?: number; durationMs: number }; qualityGate?: { passed: boolean; reasons: string[]; newIssueIds: string[]; resolvedIssueIds: string[] }; lighthouse?: { categories: Record<string, { score: number | null }>; audits?: Record<string, { numericValue?: number; displayValue?: string }> }; lighthouseDesktop?: { categories: Record<string, { score: number | null }>; audits?: Record<string, { numericValue?: number; displayValue?: string }> }; seoLab?: { score: number; deductions: Record<string, number>; findings: SeoFinding[]; page: { url: string; status: number; redirects: string[] }; robots?: { url: string; status: number; sitemap?: string }; sitemap?: { url: string; status: number } }; architecture?: { debtScore: number; debtFactors: Record<string, number>; cycles: string[][]; nodes: { file: string; imports: string[]; exports: string[]; lines: number; incoming: number; outgoing: number; kind: string }[]; findings: { ruleId: string; message: string; confidence: string; files: string[] }[] }; testHealth?: { score: number; testedSources: number; totalSources: number }; performanceLab?: { performance: number; bundle: number }; trust?: { snapshotId?: string } }
interface TrustAssessment { confidence: number; changedLines: number; files: string[]; approvalRequired: boolean; factors: string[]; blastRadius: { imports: string[]; tests: string[]; routes: string[]; score: number }; disclosure: { file: string | null; changedLines: string[] }[] }
interface CrawlJob { id: string; status: JobStatus; progress?: { discovered: number; completed: number; queued: number; elapsedMs: number }; resultPath?: string }
interface CrawlResult { status: string; records: { url: string; status: number; depth: number; indexable: boolean; blockedByRobots: boolean; canonical: string; title: string; description: string; issueCount: number }[]; issues: { ruleId: string; message: string; urls: string[]; severity: string }[] }
interface SeoProfileDraft { name: string; businessType: string; brand: { name: string; aliases: string[] }; domains: string[]; markets: string[]; languages: string[]; audiences: string[]; conversions: string[]; competitors: string[] }
interface HistoryPoint { id: string; summary?: { total: number }; qualityGate?: { passed: boolean }; lighthouseScores?: Record<string, number | null> }
interface DirectoryListing { current: string; parent: string | null; directories: { name: string; path: string }[]; isProject: boolean }
interface ModelProvider { id: string; label: string; defaultModel: string; baseUrl: string; keyRequired: boolean; keyConfigured: boolean; local: boolean }
interface DiscoveredModel { id: string; realModel?: string; reasoning?: boolean; webSearch?: boolean }

const copy = {
  fa: { product: "AI Auditor", subtitle: "ممیزی و بهینه‌سازی امن پروژه‌های JavaScript و TypeScript", newAudit: "ممیزی جدید", project: "مسیر پروژه", placeholder: "C:\\Projects\\my-app", browse: "انتخاب پوشه", browsing: "در حال باز کردن…", chooseProject: "انتخاب پروژه", selectThis: "انتخاب این پوشه", notProject: "این پوشه package.json ندارد", up: "پوشه بالاتر", close: "بستن", emptyFolder: "پوشه دیگری داخل این مسیر نیست.", lighthouseUrl: "آدرس اجرای پروژه برای Lighthouse", urlPlaceholder: "http://localhost:3000", urlHelp: "اختیاری — پروژه وب باید از قبل روی این آدرس اجرا شده و قابل دسترس باشد.", pathHelp: "پوشه باید فایل package.json داشته باشد. سورس پروژه از سیستم شما خارج نمی‌شود.", start: "شروع ممیزی", running: "در حال بررسی…", fix: "اصلاح خودکار با هوش مصنوعی", dry: "فقط پیش‌نمایش تغییرات", severity: "حداقل شدت", all: "همه", overview: "نمای کلی", issues: "مشکلات", activity: "اجرای زنده", history: "تاریخچه", total: "کل مشکلات", critical: "بحرانی", high: "شدید", medium: "متوسط", low: "کم", noReport: "یک پروژه را برای شروع ممیزی انتخاب کنید.", noIssues: "مشکلی با این فیلتر پیدا نشد.", recent: "اجراهای اخیر", status: "وضعیت", file: "فایل", tool: "ابزار", cancel: "توقف", reportReady: "گزارش آماده است", safe: "محلی و خصوصی", emptyLog: "خروجی اجرا اینجا نمایش داده می‌شود.", error: "خطا", queued: "در صف", completed: "تمام‌شده", failed: "ناموفق", cancelled: "متوقف‌شده" },
  en: { product: "AI Auditor", subtitle: "Secure auditing and optimization for JavaScript & TypeScript", newAudit: "New audit", project: "Project path", placeholder: "C:\\Projects\\my-app", browse: "Choose folder", browsing: "Opening…", chooseProject: "Choose project", selectThis: "Select this folder", notProject: "This folder has no package.json", up: "Parent folder", close: "Close", emptyFolder: "There are no folders inside this location.", lighthouseUrl: "Running project URL for Lighthouse", urlPlaceholder: "http://localhost:3000", urlHelp: "Optional — the web project must already be running and reachable at this URL.", pathHelp: "The folder must contain package.json. Your source code stays on this machine.", start: "Start audit", running: "Auditing…", fix: "AI auto-fix", dry: "Preview changes only", severity: "Minimum severity", all: "All", overview: "Overview", issues: "Issues", activity: "Live run", history: "History", total: "Total issues", critical: "Critical", high: "High", medium: "Medium", low: "Low", noReport: "Choose a project to start an audit.", noIssues: "No issues match this filter.", recent: "Recent runs", status: "Status", file: "File", tool: "Tool", cancel: "Stop", reportReady: "Report is ready", safe: "Local & private", emptyLog: "Live output will appear here.", error: "Error", queued: "Queued", completed: "Completed", failed: "Failed", cancelled: "Cancelled" },
} as const;

const agentCopy = {
  fa: { title: "عامل هوش مصنوعی", provider: "ارائه‌دهنده", model: "مدل", refresh: "دریافت مدل‌ها", connecting: "در حال اتصال…", online: "متصل", offline: "در دسترس نیست", local: "محلی", reasoning: "استدلال", search: "جستجوی وب", keyMissing: "توکن را وارد کنید یا روی سرور تنظیم کنید", token: "توکن دسترسی AIFA", userId: "شناسه کاربر AIFA", sessionId: "شناسه نشست AIFA (اختیاری)", hint: "برای اصلاح خودکار، ارائه‌دهنده و مدل عامل را انتخاب کنید." },
  en: { title: "AI agent", provider: "Provider", model: "Model", refresh: "Load models", connecting: "Connecting…", online: "Connected", offline: "Unavailable", local: "Local", reasoning: "Reasoning", search: "Web search", keyMissing: "Enter a token or configure it on the server", token: "AIFA access token", userId: "AIFA user ID", sessionId: "AIFA session ID (optional)", hint: "Choose the agent provider and model used for automatic fixes." },
} as const;

const toolCopy = {
  fa: { title: "ابزارهای تحلیل", all: "همه", findings: "یافته", ran: "اجرا شد", notRun: "نیازمند URL", urlLabel: "آدرس اجرای پروژه برای Lighthouse و Playwright", urlHelp: "با واردکردن URL، بررسی مرورگر Playwright و Lighthouse هر دو اجرا می‌شوند.", ignoreHelp: "فایل‌های lock، generated و موارد ثبت‌شده در .gitignore اسکن نمی‌شوند." },
  en: { title: "Analysis tools", all: "All", findings: "findings", ran: "Ran", notRun: "Requires URL", urlLabel: "Running project URL for Lighthouse and Playwright", urlHelp: "Providing a URL runs both Playwright browser checks and Lighthouse.", ignoreHelp: "Lockfiles, generated files, and .gitignore entries are skipped." },
} as const;

const reviewCopy = {
  fa: { mode: "حالت عامل", suggest: "فقط پیشنهاد", preview: "ساخت و اعتبارسنجی patch", apply: "اعمال خودکار با rollback", selected: "مشکلات انتخاب‌شده", review: "بازبینی تغییرات هوش مصنوعی", approve: "تأیید", reject: "رد", applyApproved: "اعمال تغییرات تأییدشده", noPatches: "هنوز patch قابل بازبینی ساخته نشده است.", search: "جستجو در مشکلات…", requests: "درخواست", tokens: "توکن تخمینی", endpoint: "آدرس API سازگار با OpenAI" },
  en: { mode: "Agent mode", suggest: "Suggestions only", preview: "Generate and validate patches", apply: "Auto-apply with rollback", selected: "Selected issues", review: "AI change review", approve: "Approve", reject: "Reject", applyApproved: "Apply approved changes", noPatches: "No reviewable patches have been generated yet.", search: "Search issues…", requests: "requests", tokens: "estimated tokens", endpoint: "OpenAI-compatible API endpoint" },
} as const;

const qualityCopy = {
  fa: { gate: "Quality Gate", passed: "قبول", failed: "رد", newIssues: "مشکل جدید", resolved: "رفع‌شده", trends: "روند اجراها", downloads: "دریافت گزارش", code: "کد", security: "امنیت", performance: "کارایی", seo: "SEO", a11y: "دسترس‌پذیری" },
  en: { gate: "Quality Gate", passed: "Passed", failed: "Failed", newIssues: "new issues", resolved: "resolved", trends: "Run trends", downloads: "Download report", code: "Code", security: "Security", performance: "Performance", seo: "SEO", a11y: "Accessibility" },
} as const;

const severityColor: Record<string, string> = { critical: "#ff5c7a", high: "#ff9f43", medium: "#ffd166", low: "#55d6be" };

function diffSides(diff = ""): { before: string; after: string } {
  const lines = diff.split("\n").filter((line) => !line.startsWith("---") && !line.startsWith("+++") && !line.startsWith("@@"));
  return {
    before: lines.filter((line) => !line.startsWith("+")).map((line) => line.startsWith("-") ? line.slice(1) : line.startsWith(" ") ? line.slice(1) : line).join("\n"),
    after: lines.filter((line) => !line.startsWith("-")).map((line) => line.startsWith("+") ? line.slice(1) : line.startsWith(" ") ? line.slice(1) : line).join("\n"),
  };
}

function App() {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("ai-auditor-lang") as Lang) || "fa");
  const [projectPath, setProjectPath] = useState("");
  const [auditUrl, setAuditUrl] = useState("");
  const [picking, setPicking] = useState(false);
  const [directory, setDirectory] = useState<DirectoryListing | null>(null);
  const [fix, setFix] = useState(false);
  const [agentMode, setAgentMode] = useState<"suggest" | "dry-run" | "apply">("dry-run");
  const [severity, setSeverity] = useState("low");
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [provider, setProvider] = useState("forgetmeai");
  const [baseUrl, setBaseUrl] = useState("http://127.0.0.1:9655");
  const [models, setModels] = useState<DiscoveredModel[]>([{ id: "deepseek-reasoner", reasoning: true }]);
  const [model, setModel] = useState("deepseek-reasoner");
  const [apiKey, setApiKey] = useState("");
  const [aifaUserId, setAifaUserId] = useState("");
  const [aifaSessionId, setAifaSessionId] = useState("");
  const [modelOnline, setModelOnline] = useState<boolean | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [active, setActive] = useState<Job | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [toolFilter, setToolFilter] = useState("all");
  const [issueSearch, setIssueSearch] = useState("");
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [approvedPatches, setApprovedPatches] = useState<Set<number>>(new Set());
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState("");
  const [trust, setTrust] = useState<TrustAssessment | null>(null);
  const [seoTab, setSeoTab] = useState<"overview" | "metadata" | "indexability" | "structuredData" | "vitals" | "recommendations">("overview");
  const [crawl, setCrawl] = useState<CrawlJob | null>(null); const [crawlResult, setCrawlResult] = useState<CrawlResult | null>(null); const [crawlSearch, setCrawlSearch] = useState("");
  const [architectureFile, setArchitectureFile] = useState("");
  const [seoProfile, setSeoProfile] = useState<SeoProfileDraft>({ name: "", businessType: "saas", brand: { name: "", aliases: [] }, domains: [], markets: [], languages: ["en"], audiences: [], conversions: [], competitors: [] }); const [profileSaved, setProfileSaved] = useState(false);
  const t = copy[lang];
  const a = agentCopy[lang];
  const tc = toolCopy[lang];
  const rc = reviewCopy[lang];
  const qc = qualityCopy[lang];

  useEffect(() => { document.documentElement.lang = lang; document.documentElement.dir = lang === "fa" ? "rtl" : "ltr"; localStorage.setItem("ai-auditor-lang", lang); }, [lang]);
  useEffect(() => { fetch("/api/jobs").then((r) => r.json()).then(setJobs).catch(() => undefined); }, []);
  useEffect(() => { fetch("/api/model-providers").then((r) => r.json()).then(setProviders).catch(() => undefined); }, []);

  const loadModels = async (providerId: string) => {
    setLoadingModels(true); setModelOnline(null); setError("");
    try {
      const response = await fetch(`/api/models?provider=${encodeURIComponent(providerId)}&baseUrl=${encodeURIComponent(baseUrl)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load models");
      const nextModels: DiscoveredModel[] = data.models ?? [];
      setModels(nextModels); setModelOnline(data.online === true);
      const preferred = nextModels.find((item) => item.id === "deepseek-reasoner")?.id ?? nextModels[0]?.id ?? "";
      setModel(preferred);
    } catch (cause) { setModelOnline(false); setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setLoadingModels(false); }
  };

  useEffect(() => { const timer = window.setTimeout(() => void loadModels(provider), 350); return () => window.clearTimeout(timer); }, [provider, baseUrl]);

  const connect = (job: Job) => {
    setActive(job); setLogs(job.logs ?? []); setReport(null);
    const events = new EventSource(`/api/jobs/${job.id}/events`);
    events.addEventListener("log", (event) => setLogs((current) => [...current.slice(-499), JSON.parse((event as MessageEvent).data)]));
    events.addEventListener("status", async (event) => {
      const next: Job = JSON.parse((event as MessageEvent).data); setActive(next);
      setJobs((current) => [next, ...current.filter((item) => item.id !== next.id)]);
      if (["completed", "failed", "cancelled"].includes(next.status)) {
        events.close();
        if (next.status === "completed" && next.reportPath) { const response = await fetch(`/api/jobs/${next.id}/report`); if (response.ok) { setReport(await response.json()); setApprovedPatches(new Set()); } }
      }
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath, url: auditUrl, fix, dryRun: agentMode !== "apply", agentMode: fix ? agentMode : undefined, severity, provider, model, baseUrl, apiKey: provider === "aifa" ? apiKey : undefined, aifaUserId: provider === "aifa" ? aifaUserId : undefined, aifaSessionId: provider === "aifa" ? aifaSessionId : undefined, analysisModel: model, issueIds: [...selectedIssueIds], maxAiRequests: 10, maxAgentSeconds: 300, maxChangedFiles: 5, maxAgentTokens: 100000, maxCritical: 0, maxHigh: 1000, sarif: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not start audit");
      connect(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };

  const openDirectory = async (path?: string) => {
    setPicking(true); setError("");
    try {
      const query = path ? `?path=${encodeURIComponent(path)}` : "";
      const response = await fetch(`/api/directories${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not browse folders");
      setDirectory(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
    finally { setPicking(false); }
  };

  const selectDirectory = () => {
    if (!directory?.isProject) return;
    setProjectPath(directory.current);
    setDirectory(null);
  };

  const loadJob = async (job: Job) => {
    connect(job);
    if (job.status === "completed" && job.reportPath) { const response = await fetch(`/api/jobs/${job.id}/report`); if (response.ok) setReport(await response.json()); }
  };

  const applyApproved = async () => {
    if (!active || approvedPatches.size === 0) return;
    setError("");
    const actorId = window.prompt(
      lang === "fa" ? "شناسه تأییدکننده را وارد کنید:" : "Enter the approver ID:",
      aifaUserId || localStorage.getItem("ai-auditor-approver-id") || "",
    )?.trim();
    if (!actorId) return;
    const approvalReason = window.prompt(
      lang === "fa" ? "دلیل اعمال این تغییرات را وارد کنید:" : "Enter the reason for applying these changes:",
    )?.trim();
    if (!approvalReason) return;
    localStorage.setItem("ai-auditor-approver-id", actorId);
    const response = await fetch(`/api/jobs/${active.id}/patches/apply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ indexes: [...approvedPatches], actorId, approvalReason }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Patch verification failed"); return; }
    const refreshed = await fetch(`/api/jobs/${active.id}/report`);
    if (refreshed.ok) setReport(await refreshed.json());
  };
  const undo = async () => { if (!active) return; const response = await fetch(`/api/jobs/${active.id}/undo`, { method: "POST" }); const data = await response.json(); if (!response.ok) return setError(data.error); const refreshed = await fetch(`/api/jobs/${active.id}/report`); if (refreshed.ok) setReport(await refreshed.json()); };
  const startCrawl = async (resumeId?: string) => { setError(""); setCrawlResult(null); const response = await fetch("/api/crawls", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath, url: auditUrl, maxPages: 100, maxDepth: 4, concurrency: 3, delayMs: 150, respectRobots: true, resumeId }) }); const data = await response.json(); if (!response.ok) return setError(data.error); setCrawl(data); const events = new EventSource(`/api/crawls/${data.id}/events`); events.addEventListener("progress", (event) => setCrawl((current) => current ? { ...current, progress: JSON.parse((event as MessageEvent).data) } : current)); events.addEventListener("status", async (event) => { const next = JSON.parse((event as MessageEvent).data) as CrawlJob; setCrawl(next); if (["completed", "failed", "cancelled"].includes(next.status)) { events.close(); if (next.resultPath) { const result = await fetch(`/api/crawls/${next.id}/result`); if (result.ok) setCrawlResult(await result.json()); } } }); };
  const cancelCrawl = async () => { if (crawl) await fetch(`/api/crawls/${crawl.id}/cancel`, { method: "POST" }); };
  const saveSeoProfile = async () => { const response = await fetch("/api/seo/profile", { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath, profile: seoProfile }) }); const data = await response.json(); if (!response.ok) return setError(data.error); setSeoProfile(data.profile); setProfileSaved(true); };
  useEffect(() => { if (!projectPath) return; fetch(`/api/seo/profile?path=${encodeURIComponent(projectPath)}`).then(async (response) => response.ok ? (await response.json()).profile : null).then((profile) => { if (profile) { setSeoProfile(profile); setProfileSaved(true); } }).catch(() => undefined); }, [projectPath]);

  const filtered = useMemo(() => report?.topIssues.filter((issue) => (filter === "all" || issue.severity === filter) && (toolFilter === "all" || issue.tool === toolFilter) && (!issueSearch || `${issue.message} ${issue.ruleId ?? ""} ${issue.location?.filePath ?? ""}`.toLowerCase().includes(issueSearch.toLowerCase()))) ?? [], [report, filter, toolFilter, issueSearch]);
  const analysisTools = [{ id: "eslint", label: "ESLint" }, { id: "tsc", label: "TypeScript" }, { id: "playwright", label: "Playwright" }, { id: "lighthouse", label: "Lighthouse" }];
  useEffect(() => { if (projectPath && report) fetch(`/api/history?path=${encodeURIComponent(projectPath)}`).then((response) => response.ok ? response.json() : []).then(setHistoryData).catch(() => undefined); }, [projectPath, report]);
  useEffect(() => { if (active?.reportPath) fetch(`/api/jobs/${active.id}/trust`).then((response) => response.ok ? response.json() : null).then(setTrust).catch(() => undefined); }, [active?.id, active?.reportPath, report]);
  const busy = active?.status === "running" || active?.status === "queued";
  const labelStatus = (status: JobStatus) => status === "running" ? t.running : t[status];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">A</div><div><strong>{t.product}</strong><span>JS / TS</span></div></div>
      <nav><a className="active" href="#overview"><span>◈</span>{t.overview}</a><a href="#seo-lab"><span>◎</span>{lang === "fa" ? "آزمایشگاه SEO" : "SEO Lab"}</a><a href="#crawler"><span>⌘</span>{lang === "fa" ? "خزنده SEO" : "SEO Crawler"}</a><a href="#architecture"><span>⌬</span>{lang === "fa" ? "معماری" : "Architecture"}</a><a href="#test-health"><span>✓</span>{lang === "fa" ? "سلامت تست" : "Test Health"}</a><a href="#trust"><span>⌾</span>{lang === "fa" ? "مرکز اعتماد" : "Trust Center"}</a><a href="#issues"><span>◇</span>{t.issues}</a><a href="#activity"><span>›_</span>{t.activity}</a><a href="#history"><span>↺</span>{t.history}</a></nav>
      <div className="privacy"><span className="pulse"/><div><strong>{t.safe}</strong><small>127.0.0.1</small></div></div>
    </aside>

    <main>
      <header><div><h1>{t.newAudit}</h1><p>{t.subtitle}</p></div></header>

      <section className="launch-card">
        <form onSubmit={submit}>
          <label htmlFor="project">{t.project}</label>
          <div className="path-row"><span className="folder">⌁</span><input id="project" data-testid="project-path" value={projectPath} onChange={(e) => setProjectPath(e.target.value)} placeholder={t.placeholder} required/><button className="browse-button" data-testid="folder-browser" type="button" onClick={() => openDirectory(projectPath || undefined)} disabled={picking || busy}>{picking ? t.browsing : t.browse}</button><button className="start-button" data-testid="start-audit" disabled={busy}>{busy ? t.running : t.start}<span>→</span></button></div>
          <p className="help">● {t.pathHelp} {tc.ignoreHelp}</p>
          <div className="url-field"><label htmlFor="audit-url">{tc.urlLabel}</label><div><span>◎</span><input id="audit-url" data-testid="audit-url" type="url" value={auditUrl} onChange={(e) => setAuditUrl(e.target.value)} placeholder={t.urlPlaceholder}/></div><p>{tc.urlHelp}</p></div>
          <section className={`agent-settings ${fix ? "enabled" : ""}`}><div className="agent-heading"><div><strong>{a.title}</strong><p>{a.hint}</p></div><span className={modelOnline ? "online" : "offline"} role="status" aria-live="polite">{loadingModels ? a.connecting : modelOnline ? a.online : a.offline}</span></div><div className="agent-grid"><label>{a.provider}<select data-testid="provider-select" value={provider} onChange={(event) => { const next = event.target.value; setProvider(next); setBaseUrl(providers.find((item) => item.id === next)?.baseUrl ?? ""); }}>{providers.map((item) => <option key={item.id} value={item.id}>{item.label}{item.local ? ` · ${a.local}` : ""}</option>)}</select></label><label>{a.model}<select data-testid="model-select" value={model} onChange={(event) => setModel(event.target.value)} disabled={loadingModels}>{models.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label><button type="button" onClick={() => loadModels(provider)} disabled={loadingModels}>↻ {a.refresh}</button></div><label className="endpoint-field">{rc.endpoint}<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} dir="ltr"/></label>{provider === "aifa" && <div className="aifa-fields"><label>{a.token}<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} required={fix}/></label><label>{a.userId}<input value={aifaUserId} onChange={(event) => setAifaUserId(event.target.value)} required={fix}/></label><label>{a.sessionId}<input value={aifaSessionId} onChange={(event) => setAifaSessionId(event.target.value)}/></label></div>}{models.find((item) => item.id === model) && <div className="model-detail"><code>{models.find((item) => item.id === model)?.realModel ?? model}</code>{models.find((item) => item.id === model)?.reasoning && <span>{a.reasoning}</span>}{models.find((item) => item.id === model)?.webSearch && <span>{a.search}</span>}</div>}{providers.find((item) => item.id === provider)?.keyRequired && !providers.find((item) => item.id === provider)?.keyConfigured && !(provider === "aifa" && apiKey) && <p className="key-warning">{a.keyMissing}</p>}</section>
          <div className="options"><label className="toggle"><input data-testid="fix-toggle" type="checkbox" checked={fix} onChange={(e) => setFix(e.target.checked)}/><span/>{t.fix}</label>{fix && <label className="select-label agent-mode">{rc.mode}<select data-testid="agent-mode" value={agentMode} onChange={(e) => setAgentMode(e.target.value as typeof agentMode)}><option value="suggest">{rc.suggest}</option><option value="dry-run">{rc.preview}</option><option value="apply">{rc.apply}</option></select></label>}<span className="selection-count">{selectedIssueIds.size} {rc.selected}</span><label className="select-label">{t.severity}<select data-testid="severity-select" value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="low">{t.low}</option><option value="medium">{t.medium}</option><option value="high">{t.high}</option><option value="critical">{t.critical}</option></select></label></div>
          {error && <div className="error" data-testid="form-error" role="alert">{t.error}: {error}</div>}
        </form>
      </section>

      <section id="overview" className="metrics">
        {(["total", "critical", "high", "medium", "low"] as const).map((key) => <article key={key} className={key}><span>{t[key]}</span><strong>{key === "total" ? report?.summary.total ?? "—" : report?.summary.bySeverity[key] ?? 0}</strong><i style={{background: key === "total" ? "#43e6b1" : severityColor[key]}}/></article>)}
      </section>

      <section className="tool-audits" aria-label={tc.title}><div><h2>{tc.title}</h2><button className={toolFilter === "all" ? "active" : ""} onClick={() => setToolFilter("all")}>{tc.all}</button></div>{analysisTools.map((tool) => { const requiresUrl = tool.id === "playwright" || tool.id === "lighthouse"; const ran = !requiresUrl || Boolean(active?.url); const count = report?.summary.byTool[tool.id] ?? 0; return <button key={tool.id} className={toolFilter === tool.id ? "active" : ""} onClick={() => setToolFilter(tool.id)}><span>{tool.label}</span><strong>{ran && report ? count : "—"}</strong><small>{ran ? `${tc.ran} · ${count} ${tc.findings}` : tc.notRun}</small></button>; })}</section>

      <section className="quality-row"><article className={`gate-card ${report?.qualityGate?.passed === false ? "failed" : "passed"}`}><span>{qc.gate}</span><strong>{report?.qualityGate ? (report.qualityGate.passed ? qc.passed : qc.failed) : "—"}</strong><small>{report?.qualityGate ? `${report.qualityGate.newIssueIds.length} ${qc.newIssues} · ${report.qualityGate.resolvedIssueIds.length} ${qc.resolved}` : ""}</small></article>{[{ key: "code", category: "maintainability" }, { key: "security", category: "security" }, { key: "performance", category: "performance" }, { key: "seo", category: "seo" }, { key: "a11y", category: "a11y" }].map(({ key, category }) => { const count = report?.summary.byCategory?.[category] ?? 0; const lighthouseKey = category === "a11y" ? "accessibility" : category; const lighthouseScore = report?.lighthouse?.categories[lighthouseKey]?.score; const score = typeof lighthouseScore === "number" ? Math.round(lighthouseScore * 100) : Math.max(0, 100 - count * 8); const previous = historyData[1]?.lighthouseScores?.[lighthouseKey]; const delta = typeof lighthouseScore === "number" && typeof previous === "number" ? Math.round((lighthouseScore - previous) * 100) : undefined; return <article key={key} className="score-card"><span>{qc[key as keyof typeof qc]}</span><strong>{report ? score : "—"}</strong><small>{delta === undefined ? "/ 100" : `${delta >= 0 ? "+" : ""}${delta} vs previous`}</small></article>; })}</section>

      <div className="content-grid">
        <section id="issues" className="panel issues-panel"><div className="panel-head"><div><h2>{t.issues}</h2><span>{report ? `${report.summary.total} ${t.total}` : t.noReport}</span></div><input className="issue-search" value={issueSearch} onChange={(event) => setIssueSearch(event.target.value)} placeholder={rc.search}/><div className="filters">{["all", "critical", "high", "medium", "low"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? t.all : t[item as keyof typeof t]}</button>)}</div></div>
          <div className="issue-list" data-testid="issue-list" aria-live="polite">{filtered.length ? filtered.map((issue) => <article className="issue" key={issue.id}><input className="issue-check" type="checkbox" checked={selectedIssueIds.has(issue.id)} onChange={(event) => setSelectedIssueIds((current) => { const next = new Set(current); if (event.target.checked) next.add(issue.id); else next.delete(issue.id); return next; })}/><span className="severity-dot" style={{background: severityColor[issue.severity]}}/><div><strong>{issue.message}</strong><p>{issue.location?.filePath ?? issue.ruleId ?? issue.category}{issue.location?.startLine ? `:${issue.location.startLine}` : ""}</p>{issue.evidence?.snippet && <details><summary>Evidence</summary><pre>{issue.evidence.snippet}</pre></details>}</div><div className="issue-meta"><span>{issue.tool}</span><b style={{color: severityColor[issue.severity]}}>{issue.severity}</b></div></article>) : <div className="empty"><div>✓</div><p>{report ? t.noIssues : t.noReport}</p></div>}</div>
        </section>

        <aside className="right-column"><section id="activity" className="panel terminal"><div className="panel-head"><div><h2>{t.activity}</h2><span role="status" aria-live="polite">{active ? labelStatus(active.status) : t.emptyLog}</span></div>{busy && <button onClick={() => fetch(`/api/jobs/${active!.id}/cancel`, {method:"POST"})}>{t.cancel}</button>}</div><pre data-testid="live-log" aria-live="polite">{logs.length ? logs.join("\n") : <span>{t.emptyLog}</span>}</pre></section>
          <section id="history" className="panel history"><div className="panel-head"><h2>{t.recent}</h2></div>{jobs.slice(0, 5).map((job) => <button key={job.id} onClick={() => loadJob(job)}><span className={`job-status ${job.status}`}/><div><strong>{job.projectPath.split(/[\\/]/).pop()}</strong><small>{new Date(job.createdAt).toLocaleString(lang === "fa" ? "fa-IR" : "en-US")}</small></div><em>{labelStatus(job.status)}</em></button>)}{!jobs.length && <p className="muted">{t.noReport}</p>}</section>
        </aside>
      </div>

      <section className="panel patch-review" data-testid="patch-review"><div className="panel-head"><div><h2>{rc.review}</h2><span>{report?.agent ? `${report.agent.requests} ${rc.requests} · ${report.agent.estimatedTokens ?? 0} ${rc.tokens}` : rc.noPatches}</span></div><button className="apply-approved" disabled={!active || active.status !== "completed" || approvedPatches.size === 0} onClick={applyApproved}>{rc.applyApproved} ({approvedPatches.size})</button></div>{report?.patches.length ? <div className="patch-list">{report.patches.map((patch, index) => { const sides = diffSides(patch.unifiedDiff); const approved = approvedPatches.has(index); return <article key={`${patch.description}-${index}`} className={`patch-card ${approved ? "approved" : ""}`}><header><div><strong>{patch.description}</strong><small>{patch.touches.join(", ")} · {patch.status}</small></div><div><button onClick={() => setApprovedPatches((current) => { const next = new Set(current); next.add(index); return next; })}>{rc.approve}</button><button onClick={() => setApprovedPatches((current) => { const next = new Set(current); next.delete(index); return next; })}>{rc.reject}</button></div></header><div className="diff-grid"><pre className="before">{sides.before}</pre><pre className="after">{sides.after}</pre></div></article>; })}</div> : <p className="review-empty">{rc.noPatches}</p>}</section>
      <section id="trust" className="panel" data-testid="trust-center"><div className="panel-head"><div><h2>{lang === "fa" ? "مرکز اعتماد" : "Trust Center"}</h2><span>{lang === "fa" ? "داده‌های ارسالی، اطمینان و دامنه اثر" : "Model disclosure, confidence and blast radius"}</span></div>{report?.trust?.snapshotId && <button className="apply-approved" onClick={undo}>{lang === "fa" ? "بازگردانی تغییرات" : "Undo changes"}</button>}</div>{trust ? <div className="stats"><article><span>{lang === "fa" ? "اطمینان اصلاح" : "Fix confidence"}</span><strong>{trust.confidence}%</strong></article><article><span>{lang === "fa" ? "خطوط تغییرکرده" : "Changed lines"}</span><strong>{trust.changedLines}</strong></article><article><span>{lang === "fa" ? "دامنه اثر" : "Blast radius"}</span><strong>{trust.blastRadius.score}</strong></article></div> : <p className="review-empty">{lang === "fa" ? "پس از ساخت patch، جزئیات اعتماد نمایش داده می‌شود." : "Trust details appear after patches are generated."}</p>}{trust && <div className="review-empty"><strong>{lang === "fa" ? "فایل‌های قابل ارسال به مدل:" : "Files eligible for model disclosure:"}</strong> {trust.files.join(", ") || "—"}<br/>{trust.factors.join(" · ")}</div>}</section>
      <section id="seo-lab" className="panel" data-testid="seo-lab"><div className="panel-head"><div><h2>{lang === "fa" ? "آزمایشگاه SEO" : "SEO Lab"}</h2><span>{report?.seoLab ? `${report.seoLab.page.url} · HTTP ${report.seoLab.page.status}` : (lang === "fa" ? "برای فعال‌سازی URL وارد کنید" : "Provide a URL to activate")}</span></div><strong>{report?.seoLab ? `${report.seoLab.score}/100` : "—"}</strong></div><div className="filters">{(["overview", "metadata", "indexability", "structuredData", "vitals", "recommendations"] as const).map((tab) => <button key={tab} className={seoTab === tab ? "active" : ""} onClick={() => setSeoTab(tab)}>{lang === "fa" ? ({ overview: "نمای کلی", metadata: "متادیتا", indexability: "ایندکس‌پذیری", structuredData: "داده ساخت‌یافته", vitals: "Web Vitals", recommendations: "پیشنهادها" } as const)[tab] : ({ overview: "Overview", metadata: "Metadata", indexability: "Indexability", structuredData: "Structured Data", vitals: "Web Vitals", recommendations: "Recommendations" } as const)[tab]}</button>)}</div>{!report?.seoLab ? <p className="review-empty">{lang === "fa" ? "هنوز ممیزی SEO اجرا نشده است." : "No SEO audit has run yet."}</p> : seoTab === "overview" ? <div className="stats">{Object.entries(report.seoLab.deductions).map(([key, value]) => <article key={key}><span>{key}</span><strong>-{value}</strong></article>)}</div> : seoTab === "vitals" ? <div className="stats">{["largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time", "speed-index"].map((metric) => <article key={metric}><span>{metric}</span><strong>{report.lighthouse?.audits?.[metric]?.displayValue ?? "—"}</strong><small>{lang === "fa" ? "موبایل" : "Mobile"}: {report.lighthouse?.audits?.[metric]?.numericValue?.toFixed(0) ?? "—"} · {lang === "fa" ? "دسکتاپ" : "Desktop"}: {report.lighthouseDesktop?.audits?.[metric]?.numericValue?.toFixed(0) ?? "—"}</small></article>)}</div> : <div className="issue-list">{(seoTab === "recommendations" ? report.seoLab.findings : report.seoLab.findings.filter((finding) => finding.category === seoTab || (seoTab === "metadata" && ["social", "content"].includes(finding.category)))).map((finding) => <article key={`${finding.ruleId}-${finding.message}`} className="issue"><div><strong>{finding.message}</strong><small>{finding.ruleId} · {finding.severity}{finding.selector ? ` · ${finding.selector}` : ""}</small>{finding.evidence && <p>{finding.evidence}</p>}</div></article>)}</div>}</section>
      <section id="crawler" className="panel crawler" data-testid="seo-crawler"><div className="panel-head"><div><h2>{lang === "fa" ? "خزنده کنترل‌شده SEO" : "Controlled SEO Crawler"}</h2><span>{crawl?.progress ? `${crawl.progress.completed}/${crawl.progress.discovered} · ${Math.round(crawl.progress.elapsedMs / 1000)}s` : (lang === "fa" ? "robots.txt به‌صورت پیش‌فرض رعایت می‌شود" : "robots.txt is respected by default")}</span></div><div>{crawl?.status === "running" ? <button className="apply-approved" onClick={cancelCrawl}>{t.cancel}</button> : <button className="apply-approved" disabled={!projectPath || !auditUrl} onClick={() => startCrawl()}>{lang === "fa" ? "شروع خزش" : "Start crawl"}</button>} {crawl?.status === "cancelled" && <button className="apply-approved" onClick={() => startCrawl(crawl.id)}>{lang === "fa" ? "ادامه" : "Resume"}</button>} {crawlResult && <a className="apply-approved" href={`/api/crawls/${crawl?.id}/result?format=csv`}>CSV</a>}</div></div>{crawlResult && <><div className="filters"><input className="issue-search" placeholder={lang === "fa" ? "جستجوی URL…" : "Search URLs…"} value={crawlSearch} onChange={(event) => setCrawlSearch(event.target.value)}/><span>{crawlResult.records.length} URLs · {crawlResult.issues.length} issues</span></div><div className="crawl-table"><table><thead><tr><th>URL</th><th>Status</th><th>Depth</th><th>Indexable</th><th>Issues</th></tr></thead><tbody>{crawlResult.records.filter((record) => record.url.toLowerCase().includes(crawlSearch.toLowerCase())).map((record) => <tr key={record.url}><td title={record.url}>{record.title || record.url}</td><td>{record.blockedByRobots ? "robots" : record.status}</td><td>{record.depth}</td><td>{record.indexable ? "✓" : "×"}</td><td>{record.issueCount}</td></tr>)}</tbody></table></div></>}</section>
      <section id="architecture" className="panel architecture" data-testid="architecture-lab"><div className="panel-head"><div><h2>{lang === "fa" ? "هوشمندی معماری" : "Architecture Intelligence"}</h2><span>{report?.architecture ? `${report.architecture.nodes.length} modules · ${report.architecture.cycles.length} cycles` : "—"}</span></div><strong>{report?.architecture ? `${report.architecture.debtScore}/100` : "—"}</strong></div>{report?.architecture && <><div className="stats">{Object.entries(report.architecture.debtFactors).map(([factor, value]) => <article key={factor}><span>{factor}</span><strong>-{value}</strong></article>)}</div><div className="architecture-grid"><div className="module-list">{report.architecture.nodes.map((node) => <button key={node.file} className={architectureFile === node.file ? "active" : ""} onClick={() => setArchitectureFile(node.file)}><strong>{node.file}</strong><small>{node.incoming} in · {node.outgoing} out · {node.lines} lines</small></button>)}</div><div className="module-detail">{(() => { const selected = report.architecture.nodes.find((node) => node.file === architectureFile) ?? report.architecture.nodes[0]; if (!selected) return null; const affected = new Set<string>(); const queue = [selected.file]; while (queue.length) { const file = queue.shift()!; report.architecture.nodes.filter((node) => node.imports.includes(file)).forEach((node) => { if (!affected.has(node.file)) { affected.add(node.file); queue.push(node.file); } }); } return <><h3>{selected.file}</h3><p>{lang === "fa" ? "دامنه اثر" : "Blast radius"}: {affected.size}</p><div className="dependency-map"><div className="node focus">{selected.file}</div>{[...affected].slice(0, 30).map((file) => <div className="node" key={file}>{file}</div>)}</div><h3>{lang === "fa" ? "وابستگی‌ها" : "Imports"}</h3><pre>{selected.imports.join("\n") || "—"}</pre></>; })()}</div></div></>}</section>
      <section className="monitor-grid"><article className="panel trend-panel"><div className="panel-head"><h2>{qc.trends}</h2></div><div className="trend-bars">{historyData.slice(0, 12).reverse().map((point) => <div key={point.id} title={`${point.id}: ${point.summary?.total ?? 0}`}><i style={{height: `${Math.max(8, Math.min(100, point.summary?.total ?? 0))}%`}}/><span>{point.summary?.total ?? 0}</span></div>)}</div></article><article className="panel downloads"><div className="panel-head"><h2>{qc.downloads}</h2></div><div>{active?.reportPath && ["json", "md", "html", "sarif"].map((format) => <a key={format} href={`/api/jobs/${active.id}/download?format=${format}`}>{format.toUpperCase()}</a>)}</div></article></section>
      <section id="seo-profile" className="panel seo-profile"><div className="panel-head"><div><h2>{lang === "fa" ? "پروفایل پروژه SEO" : "SEO Project Profile"}</h2><span>{profileSaved ? (lang === "fa" ? "ذخیره‌شده و ایزوله" : "Saved and isolated") : (lang === "fa" ? "تنظیم هویت و محدوده پروژه" : "Configure project identity and boundaries")}</span></div><button className="apply-approved" disabled={!projectPath} onClick={saveSeoProfile}>{lang === "fa" ? "ذخیره پروفایل" : "Save profile"}</button></div><div className="profile-grid"><label>{lang === "fa" ? "نام پروژه" : "Project name"}<input value={seoProfile.name} onChange={(event) => setSeoProfile({ ...seoProfile, name: event.target.value, brand: { ...seoProfile.brand, name: event.target.value } })}/></label><label>{lang === "fa" ? "نوع کسب‌وکار" : "Business type"}<select value={seoProfile.businessType} onChange={(event) => setSeoProfile({ ...seoProfile, businessType: event.target.value })}>{["saas","ecommerce","marketplace","local","publisher","documentation","multilingual","programmatic"].map((preset) => <option key={preset}>{preset}</option>)}</select></label><label>{lang === "fa" ? "دامنه‌ها" : "Domains"}<input dir="ltr" value={seoProfile.domains.join(", ")} onChange={(event) => setSeoProfile({ ...seoProfile, domains: event.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} placeholder="https://example.com"/></label><label>{lang === "fa" ? "زبان‌ها" : "Languages"}<input dir="ltr" value={seoProfile.languages.join(", ")} onChange={(event) => setSeoProfile({ ...seoProfile, languages: event.target.value.split(",").map((v) => v.trim()).filter(Boolean) })} placeholder="fa, en-US"/></label><label>{lang === "fa" ? "بازارها" : "Markets"}<input value={seoProfile.markets.join(", ")} onChange={(event) => setSeoProfile({ ...seoProfile, markets: event.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}/></label><label>{lang === "fa" ? "تبدیل‌ها" : "Conversions"}<input value={seoProfile.conversions.join(", ")} onChange={(event) => setSeoProfile({ ...seoProfile, conversions: event.target.value.split(",").map((v) => v.trim()).filter(Boolean) })}/></label></div>{profileSaved && <div className="resolved-preview"><strong>{lang === "fa" ? "پیکربندی نهایی" : "Resolved configuration"}</strong><code>{seoProfile.businessType} · {seoProfile.domains.join(" · ")} · {seoProfile.languages.join("/")}</code><a href={`/api/seo/profile/export?path=${encodeURIComponent(projectPath)}`}>{lang === "fa" ? "خروجی JSON" : "Export JSON"}</a></div>}</section>
    </main>
    {directory && <div className="file-manager-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDirectory(null); }}><section className="file-manager" data-testid="folder-dialog" role="dialog" aria-modal="true" aria-labelledby="file-manager-title"><header><div><h2 id="file-manager-title">{t.chooseProject}</h2><p title={directory.current}>{directory.current}</p></div><button type="button" aria-label={t.close} onClick={() => setDirectory(null)}>×</button></header><div className="file-manager-toolbar"><button type="button" disabled={!directory.parent || picking} onClick={() => directory.parent && openDirectory(directory.parent)}>↑ {t.up}</button><span className={directory.isProject ? "valid-project" : "invalid-project"}>{directory.isProject ? "✓ package.json" : t.notProject}</span></div><div className="directory-list">{directory.directories.map((entry) => <button type="button" key={entry.path} onClick={() => openDirectory(entry.path)}><span>▰</span><strong>{entry.name}</strong><em>›</em></button>)}{directory.directories.length === 0 && <p>{t.emptyFolder}</p>}</div><footer><button type="button" className="secondary" onClick={() => setDirectory(null)}>{t.close}</button><button type="button" className="primary" disabled={!directory.isProject} onClick={selectDirectory}>{t.selectThis}</button></footer></section></div>}
  </div>;
}

export default App;
