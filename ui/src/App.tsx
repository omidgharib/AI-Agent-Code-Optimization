import { FormEvent, useEffect, useMemo, useState } from "react";
import { useLanguage, type Lang } from "./i18n";

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
interface Job { id: string; projectPath: string; url?: string; status: JobStatus; createdAt: string; startedAt?: string; completedAt?: string; exitCode?: number; logs: string[]; reportPath?: string }
interface Issue { id: string; message: string; severity: string; category: string; tool: string; ruleId?: string; location?: { filePath: string; startLine?: number }; evidence?: { snippet?: string; url?: string }; fix?: { canAutoFix: boolean; hint?: string; strategy?: string } }
interface PatchVerification { passed: boolean; fixedIssueIds: string[]; beforeIssueCount: number; afterIssueCount: number; introducedSevere: number; checks: { eslint: string; typescript: string; relatedTests: "passed" | "failed" | "not-found" }; relatedTests: string[]; attempts: number; sonar?: { status: "passed" | "failed" | "not-run"; qualityGate?: string; issueCount: number; introducedSevere: number; reason?: string }; error?: string }
interface Patch { description: string; touches: string[]; unifiedDiff?: string; status?: string; changeSetId?: string; issueIds?: string[]; preflight?: { status: "ready" | "blocked"; attempts: number; error?: string }; verification?: PatchVerification }
interface Report { summary: { total: number; bySeverity: Record<string, number>; byCategory?: Record<string, number>; byTool: Record<string, number> }; topIssues: Issue[]; patches: Patch[]; problemCards?: { id: string; title: string; explanation: string; technicalExplanation: string; rootCause: string; affectedFiles: string[]; dependencies: string[]; proposedFix?: string; risk: string; requiredValidation: string[]; status: string }[]; recommendations: string[]; verification: { passed: boolean; errors: string[] }; sonar?: { status: "passed" | "failed" | "not-run"; hostUrl: string; projectKey: string; qualityGate?: string; issueCount: number; reason?: string }; agent?: { mode: string; requests: number; estimatedTokens?: number; estimatedCostUsd?: number; durationMs: number }; qualityGate?: { passed: boolean; reasons: string[]; newIssueIds: string[]; resolvedIssueIds: string[] }; lighthouse?: { categories: Record<string, { score: number | null }>; audits?: Record<string, { numericValue?: number; displayValue?: string }> }; lighthouseDesktop?: { categories: Record<string, { score: number | null }>; audits?: Record<string, { numericValue?: number; displayValue?: string }> }; architecture?: { debtScore: number; debtFactors: Record<string, number>; cycles: string[][]; nodes: { file: string; imports: string[]; exports: string[]; lines: number; incoming: number; outgoing: number; kind: string }[]; findings: { ruleId: string; message: string; confidence: string; files: string[] }[] }; architectureOpinion?: { model: string; provider: string; generatedAt: string; opinion: string }; testHealth?: { score: number; testedSources: number; totalSources: number }; performanceLab?: { performance: number; bundle: number }; trust?: { snapshotId?: string } }
interface TrustAssessment { confidence: number; changedLines: number; files: string[]; approvalRequired: boolean; factors: string[]; blastRadius: { imports: string[]; tests: string[]; routes: string[]; score: number }; disclosure: { file: string | null; changedLines: string[] }[] }
interface HistoryPoint { id: string; summary?: { total: number }; qualityGate?: { passed: boolean }; lighthouseScores?: Record<string, number | null> }
interface DirectoryListing { current: string; parent: string | null; directories: { name: string; path: string }[]; isProject: boolean }
interface ModelProvider { id: string; label: string; defaultModel: string; baseUrl: string; keyRequired: boolean; keyConfigured: boolean; local: boolean }
interface DiscoveredModel { id: string; realModel?: string; reasoning?: boolean; webSearch?: boolean }

const copy = {
  fa: { product: "AI Auditor", subtitle: "ممیزی و بهینه‌سازی امن پروژه‌های JavaScript و TypeScript", newAudit: "ممیزی جدید", project: "مسیر پروژه", placeholder: "C:\\Projects\\my-app", browse: "انتخاب پوشه", browsing: "در حال باز کردن…", chooseProject: "انتخاب پروژه", selectThis: "انتخاب این پوشه", notProject: "این پوشه package.json ندارد", up: "پوشه بالاتر", close: "بستن", emptyFolder: "پوشه دیگری داخل این مسیر نیست.", lighthouseUrl: "آدرس اجرای پروژه برای Lighthouse", urlPlaceholder: "http://localhost:3000", urlHelp: "اختیاری — پروژه وب باید از قبل روی این آدرس اجرا شده و قابل دسترس باشد.", pathHelp: "پوشه باید فایل package.json داشته باشد. سورس پروژه از سیستم شما خارج نمی‌شود.", start: "شروع ممیزی", running: "در حال بررسی…", fix: "اصلاح خودکار با هوش مصنوعی", dry: "فقط پیش‌نمایش تغییرات", severity: "حداقل شدت", all: "همه", overview: "نمای کلی", issues: "مشکلات", activity: "اجرای زنده", history: "تاریخچه", total: "کل مشکلات", critical: "بحرانی", high: "شدید", medium: "متوسط", low: "کم", noReport: "یک پروژه را برای شروع ممیزی انتخاب کنید.", noIssues: "مشکلی با این فیلتر پیدا نشد.", recent: "اجراهای اخیر", status: "وضعیت", file: "فایل", tool: "ابزار", cancel: "توقف", reportReady: "گزارش آماده است", safe: "محلی و خصوصی", emptyLog: "خروجی اجرا اینجا نمایش داده می‌شود.", error: "خطا", queued: "در صف", completed: "تمام‌شده", failed: "ناموفق", cancelled: "متوقف‌شده", lightTheme: "تم روشن", darkTheme: "تم تیره", issueDetails: "جزئیات مشکل", sourceExcerpt: "کد منبع", sourceUnavailable: "برای این یافته، کد منبع قابل نمایش نیست", loadingExcerpt: "در حال بارگذاری کد…" },
  en: { product: "AI Auditor", subtitle: "Secure auditing and optimization for JavaScript & TypeScript", newAudit: "New audit", project: "Project path", placeholder: "C:\\Projects\\my-app", browse: "Choose folder", browsing: "Opening…", chooseProject: "Choose project", selectThis: "Select this folder", notProject: "This folder has no package.json", up: "Parent folder", close: "Close", emptyFolder: "There are no folders inside this location.", lighthouseUrl: "Running project URL for Lighthouse", urlPlaceholder: "http://localhost:3000", urlHelp: "Optional — the web project must already be running and reachable at this URL.", pathHelp: "The folder must contain package.json. Your source code stays on this machine.", start: "Start audit", running: "Auditing…", fix: "AI auto-fix", dry: "Preview changes only", severity: "Minimum severity", all: "All", overview: "Overview", issues: "Issues", activity: "Live run", history: "History", total: "Total issues", critical: "Critical", high: "High", medium: "Medium", low: "Low", noReport: "Choose a project to start an audit.", noIssues: "No issues match this filter.", recent: "Recent runs", status: "Status", file: "File", tool: "Tool", cancel: "Stop", reportReady: "Report is ready", safe: "Local & private", emptyLog: "Live output will appear here.", error: "Error", queued: "Queued", completed: "Completed", failed: "Failed", cancelled: "Cancelled", lightTheme: "Light theme", darkTheme: "Dark theme", issueDetails: "Issue details", sourceExcerpt: "Source", sourceUnavailable: "Source context is not available for this finding", loadingExcerpt: "Loading source…" },
} as const;

const agentCopy = {
  fa: { title: "عامل هوش مصنوعی", provider: "ارائه‌دهنده", model: "مدل", refresh: "دریافت مدل‌ها", connecting: "در حال اتصال…", online: "متصل", offline: "در دسترس نیست", local: "محلی", reasoning: "استدلال", search: "جستجوی وب", keyMissing: "توکن را وارد کنید یا روی سرور تنظیم کنید", token: "توکن دسترسی AIFA", hint: "برای اصلاح خودکار، ارائه‌دهنده و مدل عامل را انتخاب کنید." },
  en: { title: "AI agent", provider: "Provider", model: "Model", refresh: "Load models", connecting: "Connecting…", online: "Connected", offline: "Unavailable", local: "Local", reasoning: "Reasoning", search: "Web search", keyMissing: "Enter a token or configure it on the server", token: "AIFA access token", hint: "Choose the agent provider and model used for automatic fixes." },
} as const;

const toolCopy = {
  fa: { title: "ابزارهای تحلیل", all: "همه", findings: "یافته", ran: "اجرا شد", notRun: "نیازمند URL", urlLabel: "آدرس اجرای پروژه برای Lighthouse و Playwright", urlHelp: "با واردکردن URL، بررسی مرورگر Playwright و Lighthouse هر دو اجرا می‌شوند.", ignoreHelp: "فایل‌های lock، generated و موارد ثبت‌شده در .gitignore اسکن نمی‌شوند." },
  en: { title: "Analysis tools", all: "All", findings: "findings", ran: "Ran", notRun: "Requires URL", urlLabel: "Running project URL for Lighthouse and Playwright", urlHelp: "Providing a URL runs both Playwright browser checks and Lighthouse.", ignoreHelp: "Lockfiles, generated files, and .gitignore entries are skipped." },
} as const;

const reviewCopy = {
  fa: { mode: "حالت عامل", suggest: "فقط پیشنهاد", preview: "ساخت و اعتبارسنجی patch", apply: "اعمال خودکار با rollback", selected: "مشکل انتخاب‌شده", review: "پیش‌نمایش تغییرات هوش مصنوعی", approve: "تأیید", reject: "رد", applyApproved: "اعمال تغییرات تأییدشده", noPatches: "هنوز patch قابل بازبینی ساخته نشده است.", search: "جستجو در مشکلات…", requests: "درخواست", tokens: "توکن تخمینی", endpoint: "آدرس API سازگار با OpenAI", fixSelected: "اصلاح با هوش مصنوعی", selectionLimit: "حداکثر ۱۰ مورد در هر درخواست", advisory: "این مورد فایل قابل‌تغییر ندارد و فقط راهنمایی ارائه می‌شود.", testsMissing: "تست مرتبط پیدا نشد", selectedBar: "مشکل انتخاب شده", previewResult: "نتیجه پیش‌نمایش" },
  en: { mode: "Agent mode", suggest: "Suggestions only", preview: "Generate and validate patches", apply: "Auto-apply with rollback", selected: "selected issue(s)", review: "AI change preview", approve: "Approve", reject: "Reject", applyApproved: "Apply approved changes", noPatches: "No reviewable patches have been generated yet.", search: "Search issues…", requests: "requests", tokens: "estimated tokens", endpoint: "OpenAI-compatible API endpoint", fixSelected: "Fix with AI", selectionLimit: "Maximum 10 items per request", advisory: "This finding has no editable source file and supports guidance only.", testsMissing: "No related tests found", selectedBar: "issues selected", previewResult: "Preview result" },
} as const;

const qualityCopy = {
  fa: { gate: "دروازه کیفیت", passed: "قبول", failed: "رد", newIssues: "مشکل جدید", resolved: "رفع‌شده", trends: "روند اجراها", downloads: "دریافت گزارش", code: "کد", security: "امنیت", performance: "کارایی", seo: "سئو", a11y: "دسترس‌پذیری" },
  en: { gate: "Quality Gate", passed: "Passed", failed: "Failed", newIssues: "new issues", resolved: "resolved", trends: "Run trends", downloads: "Download report", code: "Code", security: "Security", performance: "Performance", seo: "سئو", a11y: "Accessibility" },
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
  const lang = useLanguage();
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
  const [modelOnline, setModelOnline] = useState<boolean | null>(null);
  const [loadingModels, setLoadingModels] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() => (typeof localStorage !== "undefined" && localStorage.getItem("ai-auditor-theme") === "light" ? "light" : "dark"));
  const [jobs, setJobs] = useState<Job[]>([]);
  const [active, setActive] = useState<Job | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [filter, setFilter] = useState("all");
  const [toolFilter, setToolFilter] = useState("all");
  const [issueSearch, setIssueSearch] = useState("");
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(new Set());
  const [approvedChangeSets, setApprovedChangeSets] = useState<Set<string>>(new Set());
  const [historyData, setHistoryData] = useState<HistoryPoint[]>([]);
  const [error, setError] = useState("");
  const [trust, setTrust] = useState<TrustAssessment | null>(null);
  const [architectureFile, setArchitectureFile] = useState("");
  const [architectureReviewing, setArchitectureReviewing] = useState(false);
  const [sonarEnabled, setSonarEnabled] = useState(false);
  const [sonarHostUrl, setSonarHostUrl] = useState("http://127.0.0.1:9000");
  const [sonarProjectKey, setSonarProjectKey] = useState("");
  const [sonarToken, setSonarToken] = useState("");
  const [sonarConnection, setSonarConnection] = useState<"idle" | "checking" | "connected" | "failed">("idle");
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null);
  const [excerpt, setExcerpt] = useState<{ file: string; line: number; lines: { n: number; content: string; focus: boolean }[]; truncated?: boolean; totalLines?: number } | null>(null);
  const [excerptError, setExcerptError] = useState("");
  const t = copy[lang];
  const a = agentCopy[lang];
  const tc = toolCopy[lang];
  const rc = reviewCopy[lang];
  const qc = qualityCopy[lang];

  useEffect(() => { fetch("/api/jobs").then((r) => r.json()).then(setJobs).catch(() => undefined); }, []);
  useEffect(() => { fetch("/api/model-providers").then((r) => r.json()).then(setProviders).catch(() => undefined); }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ai-auditor-theme", theme);
  }, [theme]);

  const loadModels = async (providerId: string) => {
    setLoadingModels(true); setModelOnline(null); setError("");
    try {
      const response = await fetch(`/api/models?provider=${encodeURIComponent(providerId)}&baseUrl=${encodeURIComponent(baseUrl)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (lang === "fa" ? "دریافت مدل‌ها ممکن نشد" : "Could not load models"));
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
        if (next.status === "completed" && next.reportPath) { const response = await fetch(`/api/jobs/${next.id}/report`); if (response.ok) { setReport(await response.json()); setApprovedChangeSets(new Set()); } }
      }
    });
  };

  const startAudit = async (fixRequested: boolean) => {
    setError("");
    try {
      const response = await fetch("/api/jobs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ projectPath, url: auditUrl, fix: fixRequested, dryRun: fixRequested ? agentMode !== "apply" : true, agentMode: fixRequested ? agentMode : undefined, severity, provider, model, baseUrl, apiKey: provider === "aifa" ? apiKey : undefined, sonarEnabled, sonarHostUrl, sonarProjectKey, sonarToken: sonarToken || undefined, analysisModel: model, issueIds: [...selectedIssueIds], maxAiRequests: 10, maxAgentSeconds: 300, maxChangedFiles: 5, maxAgentTokens: 100000, maxCritical: 0, maxHigh: 1000, sarif: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (lang === "fa" ? "شروع ممیزی ممکن نشد" : "Could not start audit"));
      connect(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); }
  };
  const submit = async (event: FormEvent) => { event.preventDefault(); await startAudit(fix); };
  const fixSelected = async () => { if (selectedIssueIds.size) await startAudit(true); };

  const openDirectory = async (path?: string) => {
    setPicking(true); setError("");
    try {
      const query = path ? `?path=${encodeURIComponent(path)}` : "";
      const response = await fetch(`/api/directories${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (lang === "fa" ? "نمایش پوشه‌ها ممکن نشد" : "Could not browse folders"));
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
    if (!active || approvedChangeSets.size === 0) return;
    setError("");
        const response = await fetch(`/api/jobs/${active.id}/patches/apply`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ changeSetIds: [...approvedChangeSets] }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || (lang === "fa" ? "اعتبارسنجی تغییر ناموفق بود" : "Patch verification failed")); return; }
    const refreshed = await fetch(`/api/jobs/${active.id}/report`);
    if (refreshed.ok) setReport(await refreshed.json());
  };
  const undo = async () => { if (!active) return; const response = await fetch(`/api/jobs/${active.id}/undo`, { method: "POST" }); const data = await response.json(); if (!response.ok) return setError(data.error); const refreshed = await fetch(`/api/jobs/${active.id}/report`); if (refreshed.ok) setReport(await refreshed.json()); };
  const requestArchitectureOpinion = async () => { if (!active || !report?.architecture) return; setArchitectureReviewing(true); setError(""); try { const response = await fetch(`/api/jobs/${active.id}/architecture-opinion`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ language: lang }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Architecture review failed"); setReport((current) => current ? { ...current, architectureOpinion: data } : current); } catch (cause) { setError(cause instanceof Error ? cause.message : String(cause)); } finally { setArchitectureReviewing(false); } };
  const checkSonar = async () => { setSonarConnection("checking"); try { const response = await fetch("/api/sonar/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ hostUrl: sonarHostUrl, token: sonarToken || undefined }) }); setSonarConnection(response.ok ? "connected" : "failed"); } catch { setSonarConnection("failed"); } };
  const openIssueDetail = async (issue: Issue) => {
    setDetailIssue(issue); setExcerpt(null); setExcerptError("");
    if (!active?.reportPath || !issue.location?.filePath || issue.location.filePath === "-" || !issue.location.startLine) { setExcerptError(t.sourceUnavailable); return; }
    try {
      const query = `${encodeURIComponent(issue.location.filePath)}&line=${issue.location.startLine}`;
      const response = await fetch(`/api/jobs/${active.id}/excerpt?file=${query}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (lang === "fa" ? "نمایش کد ممکن نشد" : "Could not load source"));
      setExcerpt(data);
    } catch (cause) { setExcerptError(cause instanceof Error ? cause.message : String(cause)); }
  };

  const filtered = useMemo(() => report?.topIssues.filter((issue) => (filter === "all" || issue.severity === filter) && (toolFilter === "all" || issue.tool === toolFilter) && (!issueSearch || `${issue.message} ${issue.ruleId ?? ""} ${issue.location?.filePath ?? ""}`.toLowerCase().includes(issueSearch.toLowerCase()))) ?? [], [report, filter, toolFilter, issueSearch]);
  const isFixable = (issue: Issue) => Boolean(issue.location?.filePath && issue.location.filePath !== "-" && issue.fix?.strategy !== "advisory" && issue.tool !== "lighthouse");
  const changeSets = useMemo(() => {
    const groups = new Map<string, Patch[]>();
    for (const patch of report?.patches ?? []) {
      const id = patch.changeSetId ?? `legacy-${patch.description}`;
      groups.set(id, [...(groups.get(id) ?? []), patch]);
    }
    return [...groups.entries()].map(([id, patches]) => ({ id, patches, first: patches[0], ready: patches.every((patch) => patch.preflight?.status === "ready"), files: [...new Set(patches.flatMap((patch) => patch.touches))] }));
  }, [report]);
  const analysisTools = [{ id: "eslint", label: "ESLint" }, { id: "tsc", label: "TypeScript" }, { id: "sonar", label: "SonarQube" }, { id: "playwright", label: "Playwright" }, { id: "lighthouse", label: "Lighthouse" }];
  useEffect(() => { if (projectPath && report) fetch(`/api/history?path=${encodeURIComponent(projectPath)}`).then((response) => response.ok ? response.json() : []).then(setHistoryData).catch(() => undefined); }, [projectPath, report]);
  useEffect(() => { if (active?.reportPath) fetch(`/api/jobs/${active.id}/trust`).then((response) => response.ok ? response.json() : null).then(setTrust).catch(() => undefined); }, [active?.id, active?.reportPath, report]);
  const busy = active?.status === "running" || active?.status === "queued";
  const labelStatus = (status: JobStatus) => status === "running" ? t.running : t[status];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">A</div><div><strong>{t.product}</strong><span>JS / TS</span></div></div>
      <nav aria-label={lang === "fa" ? "ناوبری ممیزی کد" : "Code audit navigation"}>
        <div className="sidebar-nav-group"><span className="sidebar-nav-label">{lang === "fa" ? "ممیزی" : "Audit"}</span><a className="active" aria-current="page" href="#overview"><span>◈</span>{t.overview}</a><a href="#issues"><span>◇</span>{t.issues}</a><a href="#activity"><span>›_</span>{t.activity}</a><a href="#history"><span>↺</span>{t.history}</a></div>
        <div className="sidebar-nav-group"><span className="sidebar-nav-label">{lang === "fa" ? "بینش و اعتماد" : "Insights & trust"}</span><a href="#trust"><span>⌾</span>{lang === "fa" ? "مرکز اعتماد" : "Trust Center"}</a><a href="#architecture"><span>⌬</span>{lang === "fa" ? "معماری" : "Architecture"}</a></div>
      </nav>
      <div className="privacy"><span className="pulse"/><div><strong>{t.safe}</strong><small>127.0.0.1</small></div></div>
    </aside>

    <main>
      <header><div><h1>{t.newAudit}</h1><p>{t.subtitle}</p></div><button className="theme-toggle" data-testid="theme-toggle" type="button" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-pressed={theme === "light"} aria-label={theme === "dark" ? t.lightTheme : t.darkTheme}><span aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>{theme === "dark" ? t.lightTheme : t.darkTheme}</button></header>

      <section className="launch-card">
        <form onSubmit={submit}>
          <label htmlFor="project">{t.project}</label>
          <div className="path-row"><span className="folder">⌁</span><input id="project" data-testid="project-path" value={projectPath} onChange={(e) => setProjectPath(e.target.value)} placeholder={t.placeholder} required/><button className="browse-button" data-testid="folder-browser" type="button" onClick={() => openDirectory(projectPath || undefined)} disabled={picking || busy}>{picking ? t.browsing : t.browse}</button><button className="start-button" data-testid="start-audit" disabled={busy}>{busy ? t.running : t.start}<span>→</span></button></div>
          <p className="help">● {t.pathHelp} {tc.ignoreHelp}</p>
          <div className="url-field"><label htmlFor="audit-url">{tc.urlLabel}</label><div><span>◎</span><input id="audit-url" data-testid="audit-url" type="url" value={auditUrl} onChange={(e) => setAuditUrl(e.target.value)} placeholder={t.urlPlaceholder}/></div><p>{tc.urlHelp}</p></div>
          <section className={`agent-settings ${fix ? "enabled" : ""}`}><div className="agent-heading"><div><strong>{a.title}</strong><p>{a.hint}</p></div><span className={modelOnline ? "online" : "offline"} role="status" aria-live="polite">{loadingModels ? a.connecting : modelOnline ? a.online : a.offline}</span></div><div className="agent-grid"><label>{a.provider}<select data-testid="provider-select" value={provider} onChange={(event) => { const next = event.target.value; setProvider(next); setBaseUrl(providers.find((item) => item.id === next)?.baseUrl ?? ""); }}>{providers.map((item) => <option key={item.id} value={item.id}>{item.label}{item.local ? ` · ${a.local}` : ""}</option>)}</select></label><label>{a.model}<select data-testid="model-select" value={model} onChange={(event) => setModel(event.target.value)} disabled={loadingModels}>{models.map((item) => <option key={item.id} value={item.id}>{item.id}</option>)}</select></label><button type="button" onClick={() => loadModels(provider)} disabled={loadingModels}>↻ {a.refresh}</button></div><label className="endpoint-field">{rc.endpoint}<input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} dir="ltr"/></label>{provider === "aifa" && <div className="aifa-fields"><label>{a.token}<input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} required={fix}/></label></div>}{models.find((item) => item.id === model) && <div className="model-detail"><code>{models.find((item) => item.id === model)?.realModel ?? model}</code>{models.find((item) => item.id === model)?.reasoning && <span>{a.reasoning}</span>}{models.find((item) => item.id === model)?.webSearch && <span>{a.search}</span>}</div>}{providers.find((item) => item.id === provider)?.keyRequired && !providers.find((item) => item.id === provider)?.keyConfigured && !(provider === "aifa" && apiKey) && <p className="key-warning">{a.keyMissing}</p>}</section>
          <div className="options"><label className="toggle"><input data-testid="fix-toggle" type="checkbox" checked={fix} onChange={(e) => setFix(e.target.checked)}/><span/>{t.fix}</label>{fix && <label className="select-label agent-mode">{rc.mode}<select data-testid="agent-mode" value={agentMode} onChange={(e) => setAgentMode(e.target.value as typeof agentMode)}><option value="suggest">{rc.suggest}</option><option value="dry-run">{rc.preview}</option><option value="apply">{rc.apply}</option></select></label>}<span className="selection-count">{selectedIssueIds.size} {rc.selected}</span><label className="select-label">{t.severity}<select data-testid="severity-select" value={severity} onChange={(e) => setSeverity(e.target.value)}><option value="low">{t.low}</option><option value="medium">{t.medium}</option><option value="high">{t.high}</option><option value="critical">{t.critical}</option></select></label></div>
          {error && <div className="error" data-testid="form-error" role="alert">{t.error}: {error}</div>}
        </form>
      </section>

      <section id="overview" className="metrics">
        {(["total", "critical", "high", "medium", "low"] as const).map((key) => <article key={key} className={key}><span>{t[key]}</span><strong>{key === "total" ? report?.summary.total ?? "—" : report?.summary.bySeverity[key] ?? 0}</strong><i style={{background: key === "total" ? "#43e6b1" : severityColor[key]}}/></article>)}
      </section>

      <section className="sonar-settings"><label><input type="checkbox" checked={sonarEnabled} onChange={(event) => setSonarEnabled(event.target.checked)}/>{lang === "fa" ? "SonarQube محلی" : "Local SonarQube"}</label><input aria-label="SonarQube URL" value={sonarHostUrl} onChange={(event) => { setSonarHostUrl(event.target.value); setSonarConnection("idle"); }}/><input aria-label="SonarQube project key" placeholder="Project key" value={sonarProjectKey} onChange={(event) => setSonarProjectKey(event.target.value)}/><input aria-label="SonarQube token" type="password" autoComplete="off" placeholder="Token" value={sonarToken} onChange={(event) => setSonarToken(event.target.value)}/><button type="button" onClick={checkSonar} disabled={sonarConnection === "checking"}>{lang === "fa" ? "بررسی اتصال" : "Check connection"}</button><span className={sonarConnection}>{sonarConnection === "connected" ? (lang === "fa" ? "SonarQube محلی متصل است" : "Local SonarQube connected") : sonarConnection === "failed" ? (lang === "fa" ? "اتصال ممکن نشد؛ اسکن اجرا نمی‌شود" : "Connection failed; scan will not run") : sonarEnabled ? (lang === "fa" ? "آماده بررسی اتصال" : "Ready to check") : (lang === "fa" ? "Sonar فعال نیست" : "Sonar is disabled")}</span></section>
      <section className="tool-audits" aria-label={tc.title}><div><h2>{tc.title}</h2><button className={toolFilter === "all" ? "active" : ""} onClick={() => setToolFilter("all")}>{tc.all}</button></div>{analysisTools.map((tool) => { const requiresUrl = tool.id === "playwright" || tool.id === "lighthouse"; const ran = tool.id === "sonar" ? report?.sonar?.status !== "not-run" : !requiresUrl || Boolean(active?.url); const count = tool.id === "sonar" && report?.sonar ? report.sonar.issueCount : report?.summary.byTool[tool.id] ?? 0; return <button key={tool.id} className={toolFilter === tool.id ? "active" : ""} onClick={() => setToolFilter(tool.id)}><span>{tool.label}</span><strong>{ran && report ? count : "—"}</strong><small>{tool.id === "sonar" && report?.sonar ? `${report.sonar.status} · ${report.sonar.qualityGate ?? "NONE"}` : ran ? `${tc.ran} · ${count} ${tc.findings}` : tc.notRun}</small></button>; })}</section>

      <section className="quality-row"><article className={`gate-card ${report?.qualityGate?.passed === false ? "failed" : "passed"}`}><span>{qc.gate}</span><strong>{report?.qualityGate ? (report.qualityGate.passed ? qc.passed : qc.failed) : "—"}</strong><small>{report?.qualityGate ? `${report.qualityGate.newIssueIds.length} ${qc.newIssues} · ${report.qualityGate.resolvedIssueIds.length} ${qc.resolved}` : ""}</small></article>{[{ key: "code", category: "maintainability" }, { key: "security", category: "security" }, { key: "performance", category: "performance" }, { key: "seo", category: "seo" }, { key: "a11y", category: "a11y" }].map(({ key, category }) => { const count = report?.summary.byCategory?.[category] ?? 0; const lighthouseKey = category === "a11y" ? "accessibility" : category; const lighthouseScore = report?.lighthouse?.categories[lighthouseKey]?.score; const score = typeof lighthouseScore === "number" ? Math.round(lighthouseScore * 100) : Math.max(0, 100 - count * 8); const previous = historyData[1]?.lighthouseScores?.[lighthouseKey]; const delta = typeof lighthouseScore === "number" && typeof previous === "number" ? Math.round((lighthouseScore - previous) * 100) : undefined; return <article key={key} className="score-card"><span>{qc[key as keyof typeof qc]}</span><strong>{report ? score : "—"}</strong><small>{delta === undefined ? "/ 100" : `${delta >= 0 ? "+" : ""}${delta} ${lang === "fa" ? "نسبت به قبل" : "vs previous"}`}</small></article>; })}</section>
      {report?.problemCards?.length ? <section className="decision-paths"><header><h2>{lang === "fa" ? "مسیر تصمیم برای تغییر امن" : "Safe change decisions"}</h2><span>{lang === "fa" ? "علت، اثر، ریسک و اعتبارسنجی هر یافته" : "Cause, impact, risk and validation per finding"}</span></header><div>{report.problemCards.map((card) => <article key={card.id} className={`decision-card ${card.status}`}><strong>{card.title}</strong><p>{card.explanation}</p><small>{lang === "fa" ? "علت ریشه‌ای: " : "Root cause: "}{card.rootCause}</small><small>{lang === "fa" ? "اثر: " : "Impact: "}{[...card.affectedFiles, ...card.dependencies].join(" · ") || "—"}</small><small>{lang === "fa" ? "اعتبارسنجی: " : "Validation: "}{card.requiredValidation.join(" · ")}</small><em>{card.status} · {lang === "fa" ? "ریسک " : "risk "}{card.risk}</em></article>)}</div></section> : null}
      {selectedIssueIds.size > 0 && <div className="fix-selection-bar" role="status"><strong>{selectedIssueIds.size} {rc.selectedBar}</strong><span>{model} · {rc.selectionLimit} · {10 - selectedIssueIds.size} {lang === "fa" ? "جای خالی" : "slots left"}</span><span>{lang === "fa" ? "بودجه: حداکثر ۱۰ درخواست AI / ۱۰۰٬۰۰۰ توکن" : "Budget: up to 10 AI requests / 100,000 tokens"}</span><button type="button" onClick={fixSelected} disabled={busy || selectedIssueIds.size === 0}>{busy ? t.running : rc.fixSelected}</button></div>}

      <div className="content-grid">
        <section id="issues" className="panel issues-panel"><div className="panel-head"><div><h2>{t.issues}</h2><span>{report ? `${report.summary.total} ${t.total}` : t.noReport}</span></div><input className="issue-search" value={issueSearch} onChange={(event) => setIssueSearch(event.target.value)} placeholder={rc.search}/><div className="filters">{["all", "critical", "high", "medium", "low"].map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? t.all : t[item as keyof typeof t]}</button>)}</div></div>
          <div className="issue-list" data-testid="issue-list" aria-live="polite">{filtered.length ? filtered.map((issue) => { const fixable = isFixable(issue); const disabled = !fixable || (!selectedIssueIds.has(issue.id) && selectedIssueIds.size >= 10); const reason = !fixable ? rc.advisory : rc.selectionLimit; return <article className={`issue ${!fixable ? "advisory-issue" : ""}`} key={issue.id}><input className="issue-check" type="checkbox" checked={selectedIssueIds.has(issue.id)} disabled={disabled} title={disabled ? reason : ""} onChange={(event) => setSelectedIssueIds((current) => { const next = new Set(current); if (event.target.checked) next.add(issue.id); else next.delete(issue.id); return next; })}/><span className="severity-dot" style={{background: severityColor[issue.severity]}}/><div><strong>{issue.message}</strong><p>{issue.location?.filePath ?? issue.ruleId ?? issue.category}{issue.location?.startLine ? `:${issue.location.startLine}` : ""}</p>{!fixable && <small className="advisory-reason">{rc.advisory}</small>}{issue.evidence?.snippet && <details><summary>{lang === "fa" ? "شواهد" : "Evidence"}</summary><pre>{issue.evidence.snippet}</pre></details>}</div><div className="issue-meta"><span>{issue.tool}</span><button type="button" className="issue-detail-trigger" data-testid="issue-detail-trigger" onClick={() => openIssueDetail(issue)} aria-haspopup="dialog">{t.issueDetails}</button><b style={{color: severityColor[issue.severity]}}>{issue.severity}</b></div></article>; }) : <div className="empty"><div>✓</div><p>{report ? t.noIssues : t.noReport}</p></div>}</div>
        </section>

        <aside className="right-column"><section id="activity" className="panel terminal"><div className="panel-head"><div><h2>{t.activity}</h2><span role="status" aria-live="polite">{active ? labelStatus(active.status) : t.emptyLog}</span></div>{busy && <button onClick={() => fetch(`/api/jobs/${active!.id}/cancel`, {method:"POST"})}>{t.cancel}</button>}</div><pre data-testid="live-log" aria-live="polite">{logs.length ? logs.join("\n") : <span>{t.emptyLog}</span>}</pre></section>
          <section id="history" className="panel history"><div className="panel-head"><h2>{t.recent}</h2></div>{jobs.slice(0, 5).map((job) => <button key={job.id} onClick={() => loadJob(job)}><span className={`job-status ${job.status}`}/><div><strong>{job.projectPath.split(/[\\/]/).pop()}</strong><small>{new Date(job.createdAt).toLocaleString(lang === "fa" ? "fa-IR" : "en-US")}</small></div><em>{labelStatus(job.status)}</em></button>)}{!jobs.length && <p className="muted">{t.noReport}</p>}</section>
        </aside>
      </div>

      {report?.patches.some((patch) => patch.verification?.sonar) && <section className="sonar-preview"><strong>SonarQube</strong>{(() => { const sonar = report.patches.find((patch) => patch.verification?.sonar)?.verification?.sonar; if (!sonar) return null; return <><span className={sonar.status}>{sonar.status} · Quality Gate: {sonar.qualityGate ?? "NONE"}</span><span>{sonar.status === "not-run" ? (lang === "fa" ? `SonarQube اجرا نشد؛ اطمینان پیش‌نمایش محدود است. ${sonar.reason ?? ""}` : `SonarQube did not run; preview confidence is limited. ${sonar.reason ?? ""}`) : sonar.introducedSevere ? (lang === "fa" ? `${sonar.introducedSevere} باگ یا آسیب‌پذیری شدید جدید؛ تغییر قابل Apply نیست` : `${sonar.introducedSevere} new severe bug or vulnerability; change cannot be applied`) : (lang === "fa" ? "باگ یا آسیب‌پذیری شدید جدید پیدا نشد" : "No new severe bug or vulnerability found")}</span></>; })()}</section>}
      <section className="panel patch-review" data-testid="patch-review"><div className="panel-head"><div><h2>{rc.review}</h2><span>{report?.agent ? `${report.agent.requests} ${rc.requests} · ${report.agent.estimatedTokens ?? 0} ${rc.tokens}` : rc.noPatches}</span></div><button className="apply-approved" disabled={!active || active.status !== "completed" || !changeSets.some((change) => change.ready && approvedChangeSets.has(change.id))} onClick={applyApproved}>{rc.applyApproved} ({approvedChangeSets.size})</button></div>{changeSets.length ? <div className="patch-list">{changeSets.map((change) => { const verification = change.first.verification; const ready = change.ready; const approved = ready && approvedChangeSets.has(change.id); const resolvedCount = ready ? verification?.fixedIssueIds.length ?? 0 : 0; return <article key={change.id} className={`patch-card ${approved ? "approved" : ""}`}><header><div><strong>{change.first.description}</strong><small>{change.files.join(", ")} · {ready ? "ready" : "blocked"}</small></div><div><button disabled={!ready} title={change.first.preflight?.error} onClick={() => setApprovedChangeSets((current) => new Set(current).add(change.id))}>{ready ? rc.approve : (lang === "fa" ? "نیازمند اصلاح" : "Needs repair")}</button><button onClick={() => setApprovedChangeSets((current) => { const next = new Set(current); next.delete(change.id); return next; })}>{rc.reject}</button></div></header><div className="preview-result"><strong>{rc.previewResult}</strong><span>{ready ? `${resolvedCount} ${lang === "fa" ? "مشکل با اطمینان رفع می‌شود" : "issues are safely resolved"}` : (lang === "fa" ? "پیش‌نمایش رد شد؛ هیچ تغییری قابل اعمال نیست" : "Preview rejected; no changes are safe to apply")} · {verification?.introducedSevere ?? 0} {lang === "fa" ? "مشکل شدید جدید" : "new severe issues"}</span><span>ESLint: {verification?.checks.eslint ?? "—"} · TypeScript: {verification?.checks.typescript ?? "—"}</span><span>{verification?.checks.relatedTests === "not-found" ? rc.testsMissing : `${verification?.relatedTests.length ?? 0} related tests: ${verification?.checks.relatedTests ?? "—"}`}</span></div>{change.first.preflight?.error && <p className="patch-validation-error">{change.first.preflight.error}</p>}{change.patches.map((patch, index) => { const sides = diffSides(patch.unifiedDiff); return <div className="diff-grid" key={`${change.id}-${index}`}><pre className="before">{sides.before}</pre><pre className="after">{sides.after}</pre></div>; })}</article>; })}</div> : <p className="review-empty">{rc.noPatches}</p>}</section>
      <section id="trust" className="panel" data-testid="trust-center"><div className="panel-head"><div><h2>{lang === "fa" ? "مرکز اعتماد" : "Trust Center"}</h2><span>{lang === "fa" ? "داده‌های ارسالی، اطمینان و دامنه اثر" : "Model disclosure, confidence and blast radius"}</span></div>{report?.trust?.snapshotId && <button className="apply-approved" onClick={undo}>{lang === "fa" ? "بازگردانی تغییرات" : "Undo changes"}</button>}</div>{trust ? <div className="stats"><article><span>{lang === "fa" ? "اطمینان اصلاح" : "Fix confidence"}</span><strong>{trust.confidence}%</strong></article><article><span>{lang === "fa" ? "خطوط تغییرکرده" : "Changed lines"}</span><strong>{trust.changedLines}</strong></article><article><span>{lang === "fa" ? "دامنه اثر" : "Blast radius"}</span><strong>{trust.blastRadius.score}</strong></article></div> : <p className="review-empty">{lang === "fa" ? "پس از ساخت patch، جزئیات اعتماد نمایش داده می‌شود." : "Trust details appear after patches are generated."}</p>}{trust && <div className="review-empty"><strong>{lang === "fa" ? "فایل‌های قابل ارسال به مدل:" : "Files eligible for model disclosure:"}</strong> {trust.files.join(", ") || "—"}<br/>{trust.factors.join(" · ")}</div>}</section>
      <section id="architecture" className="panel architecture" data-testid="architecture-lab"><div className="panel-head"><div><div className="architecture-title"><h2>{lang === "fa" ? "هوشمندی معماری" : "Architecture Intelligence"}</h2><details className="architecture-info"><summary aria-label={lang === "fa" ? "معیارهای ارزیابی معماری" : "Architecture assessment criteria"}>i</summary><div><strong>{lang === "fa" ? "معیارهای امتیاز معماری" : "Architecture score criteria"}</strong><p>{lang === "fa" ? "امتیاز از ۱۰۰ شروع می‌شود و بابت وابستگی‌های چرخشی (هر چرخه ۱۲-)، فایل‌های بزرگ‌تر از ۵۰۰ خط (۶-)، coupling بالا یعنی ورودی بیش از ۲۵ یا خروجی بیش از ۱۵ (۵-)، و فایل، export یا dependency بلااستفاده (۲-) کاهش می‌یابد. فهرست ماژول‌ها نیز تعداد وابستگی‌های ورودی/خروجی و دامنه اثر تغییر هر فایل را نشان می‌دهد." : "The score starts at 100 and is reduced for circular dependencies (-12 each), modules over 500 lines (-6), high coupling with more than 25 incoming or 15 outgoing dependencies (-5), and unused files, exports, or dependencies (-2). Module details also show incoming/outgoing dependencies and each file's change blast radius."}</p></div></details></div><span>{report?.architecture ? `${report.architecture.nodes.length} ${lang === "fa" ? "ماژول" : "modules"} · ${report.architecture.cycles.length} ${lang === "fa" ? "چرخه" : "cycles"}` : "—"}</span></div><strong>{report?.architecture ? `${report.architecture.debtScore}/100` : "—"}</strong></div>{report?.architecture && <><div className="stats">{Object.entries(report.architecture.debtFactors).map(([factor, value]) => <article key={factor}><span>{factor}</span><strong>-{value}</strong></article>)}</div><div className="architecture-grid"><div className="module-list">{report.architecture.nodes.map((node) => <button key={node.file} className={architectureFile === node.file ? "active" : ""} onClick={() => setArchitectureFile(node.file)}><strong>{node.file}</strong><small>{node.incoming} in · {node.outgoing} out · {node.lines} lines</small></button>)}</div><div className="module-detail">{(() => { const selected = report.architecture.nodes.find((node) => node.file === architectureFile) ?? report.architecture.nodes[0]; if (!selected) return null; const affected = new Set<string>(); const queue = [selected.file]; while (queue.length) { const file = queue.shift()!; report.architecture.nodes.filter((node) => node.imports.includes(file)).forEach((node) => { if (!affected.has(node.file)) { affected.add(node.file); queue.push(node.file); } }); } return <><h3>{selected.file}</h3><p>{lang === "fa" ? "دامنه اثر" : "Blast radius"}: {affected.size}</p><div className="dependency-map"><div className="node focus">{selected.file}</div>{[...affected].slice(0, 30).map((file) => <div className="node" key={file}>{file}</div>)}</div><h3>{lang === "fa" ? "وابستگی‌ها" : "Imports"}</h3><pre>{selected.imports.join("\n") || "—"}</pre></>; })()}</div></div></>}</section>
      <section className="monitor-grid"><article className="panel trend-panel"><div className="panel-head"><h2>{qc.trends}</h2></div><div className="trend-bars">{historyData.slice(0, 12).reverse().map((point) => <div key={point.id} title={`${point.id}: ${point.summary?.total ?? 0}`}><i style={{height: `${Math.max(8, Math.min(100, point.summary?.total ?? 0))}%`}}/><span>{point.summary?.total ?? 0}</span></div>)}</div></article><article className="panel downloads"><div className="panel-head"><h2>{qc.downloads}</h2></div><div>{active?.reportPath && ["json", "md", "html", "sarif"].map((format) => <a key={format} href={`/api/jobs/${active.id}/download?format=${format}`}>{format.toUpperCase()}</a>)}</div></article></section>
    </main>
    {directory && <div className="file-manager-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDirectory(null); }}><section className="file-manager" data-testid="folder-dialog" role="dialog" aria-modal="true" aria-labelledby="file-manager-title"><header><div><h2 id="file-manager-title">{t.chooseProject}</h2><p title={directory.current}>{directory.current}</p></div><button type="button" aria-label={t.close} onClick={() => setDirectory(null)}>×</button></header><div className="file-manager-toolbar"><button type="button" disabled={!directory.parent || picking} onClick={() => directory.parent && openDirectory(directory.parent)}>↑ {t.up}</button><span className={directory.isProject ? "valid-project" : "invalid-project"}>{directory.isProject ? "✓ package.json" : t.notProject}</span></div><div className="directory-list">{directory.directories.map((entry) => <button type="button" key={entry.path} onClick={() => openDirectory(entry.path)}><span>▰</span><strong>{entry.name}</strong><em>›</em></button>)}{directory.directories.length === 0 && <p>{t.emptyFolder}</p>}</div><footer><button type="button" className="secondary" onClick={() => setDirectory(null)}>{t.close}</button><button type="button" className="primary" disabled={!directory.isProject} onClick={selectDirectory}>{t.selectThis}</button></footer></section></div>}
    {detailIssue && <div className="file-manager-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setDetailIssue(null); }}><section className="issue-detail" data-testid="issue-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="issue-detail-title"><header><div><h2 id="issue-detail-title">{t.issueDetails}</h2><p title={detailIssue.message}>{detailIssue.message}</p></div><button type="button" aria-label={t.close} onClick={() => setDetailIssue(null)}>×</button></header><div className="issue-detail-body"><div className="issue-detail-meta"><span>{detailIssue.tool}{detailIssue.ruleId ? ` · ${detailIssue.ruleId}` : ""}</span><b style={{color: severityColor[detailIssue.severity]}}>{detailIssue.severity}</b></div><p>{detailIssue.location?.filePath ? `${detailIssue.location.filePath}${detailIssue.location.startLine ? `:${detailIssue.location.startLine}` : ""}` : detailIssue.category}</p>{detailIssue.evidence?.snippet && <details open><summary>{lang === "fa" ? "شواهد" : "Evidence"}</summary><pre>{detailIssue.evidence.snippet}</pre></details>}{detailIssue.fix?.hint && <p className="fix-hint">{lang === "fa" ? "راهنمای اصلاح: " : "Fix hint: "}{detailIssue.fix.hint}</p>}</div>{excerptError ? <div className="review-empty">{t.sourceUnavailable}{excerptError ? ` · ${excerptError}` : ""}</div> : excerpt ? <div className="source-excerpt"><div className="source-head"><span>{t.sourceExcerpt}</span><code>{excerpt.file}</code><em>{lang === "fa" ? `خط ${excerpt.line} از ${excerpt.totalLines}` : `line ${excerpt.line} of ${excerpt.totalLines}`}</em></div><pre>{excerpt.lines.map((item) => <span key={item.n} className={item.focus ? "focus" : ""}><i>{item.n}</i><code>{item.content.length ? item.content : " "}</code></span>)}</pre>{excerpt.truncated && <small>{lang === "fa" ? "بقیه فایل نمایش داده نمی‌شود" : "Rest of the file is not shown"}</small>}</div> : <div className="review-empty">{t.loadingExcerpt}</div>}<footer><button type="button" className="primary" onClick={() => setDetailIssue(null)}>{t.close}</button></footer></section></div>}
  </div>;
}

export default App;
