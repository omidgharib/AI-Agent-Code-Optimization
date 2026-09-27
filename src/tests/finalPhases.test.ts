import { groupDuplicatedLogic, generateRefactoringPlan, findBoundaryViolations, normalizeDuplicationToken } from "../analyzers/architectureRefactoring";
import type { ArchitectureReport } from "../analyzers/architecture";
import { diffFrames, regressionGate, sampleFrame } from "../verify/visualRegression";
import { suggestUnitTests, buildPlaywrightJourney, isJourneyWithinBudget } from "../verify/testIntelligence";
import { planSpecialistWork } from "../fix/specialistPlanner";
import { routeIssuesToSpecialists, modelArena, specialistInputBudget } from "../core/specialistAgents";
import { detectUnusedAssets, detectOversizedImages, comparePerformanceBeforeAfter, performanceRemediations } from "../analyzers/performanceLab";
import { reportToPdf, buildPdf } from "../report/pdf";
import { buildAnnotations } from "../report/annotations";
import { hasPermission, quorumRule, canApprove, authorizeChange } from "../platform/governance/roles";
import { createApprovalRequest, decideApproval } from "../platform/governance/approvals";
import { createMetricRegistry, totalRequests } from "../platform/observability/metrics";
import { createTelemetry, sloCoverage, enforceDurationBound } from "../platform/observability/telemetry";
import { runCorpus, type ValidationCase } from "../platform/validation/corpus";
import { launchWith, aggregate, manualApprovalFallback, profileFor } from "../platform/deployment/profiles";
import type { Issue, PrioritizedIssue } from "../core/types";

const report: ArchitectureReport = { nodes: [
  { file: "src/a.ts", imports: [], exports: [], lines: 300, incoming: 0, outgoing: 0, kind: "production" },
  { file: "src/app.ts", imports: ["src/a.ts", "src/b.ts"], exports: [], lines: 600, incoming: 0, outgoing: 2, kind: "production" },
  { file: "src/b.ts", imports: ["src/a.ts"], exports: [], lines: 40, incoming: 1, outgoing: 1, kind: "production" },
  { file: "src/tests/a.test.ts", imports: ["src/a.ts", "dist/a.js"], exports: [], lines: 30, incoming: 0, outgoing: 2, kind: "test" },
], cycles: [], findings: [], debtScore: 60, debtFactors: {} };

const duplicatedSource = `
function sum(x, y) { return x + y; }
function sum(a, b) { return a + b; }
const one = { width: 1, height: 2 };
const two = { width: 3, height: 4 };
export function render(title, body) { return title + body; }
export function render2(title, body) { return body + title; }
`;

describe("Phase 9 architecture refactoring", () => {
  it("tokenizes code into normalized structural tokens", () => {
    const tokens = normalizeDuplicationToken("const x = 1; return x + 2; // comment");
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens.some((t) => /[N0-9]/.test(t) || t === "N")).toBe(true);
  });
  it("groups duplicated logic across files", async () => {
    const groups = await groupDuplicatedLogic(report, (file) => (file.endsWith("a.ts") ? duplicatedSource : duplicatedSource));
    const shared = groups.find((g) => g.signature.includes("N") || g.signature.length > 0);
    expect(shared?.files.length).toBeGreaterThanOrEqual(2);
    expect(shared?.id).toMatch(/^[0-9a-f]{16}$/);
  });
  it("generates staged refactor plans for oversized modules", () => {
    const plan = generateRefactoringPlan(report, "src/app.ts");
    expect(plan.lines).toBe(600);
    expect(plan.stages.length).toBeGreaterThanOrEqual(1);
    expect(plan.stages.every((stage) => stage.preservesPublicApi && stage.validatesWith.length > 0)).toBe(true);
  });
  it("flags cross-boundary imports and test-to-dist imports", () => {
    const violations = findBoundaryViolations(report, [{ from: "src/app.ts", to: "src/b.ts" }]);
    expect(violations.some((v) => v.ruleId === "boundary-violation")).toBe(true);
    const testBoundary = findBoundaryViolations(report, []);
    expect(testBoundary.some((v) => v.ruleId === "test-production-boundary")).toBe(true);
  });
});

describe("Phase 10 visual regression + test intelligence", () => {
  it("diffs frames byte-for-byte and reports changed pixels", () => {
    const baseline = sampleFrame(8, 8, (x) => [x % 2 * 255, x % 2 * 255, x % 2 * 255, 255]);
    const changed = sampleFrame(8, 8, () => [255, 255, 255, 255]);
    const diff = diffFrames(baseline, changed, { threshold: 24 });
    expect(diff.changedPixels).toBeGreaterThan(0);
    expect(diff.difference).toBeGreaterThan(0);
  });
  it("identical frames pass regression gate", () => {
    const frame = sampleFrame(8, 8, () => [0, 0, 0, 255]);
    expect(regressionGate(diffFrames(frame, frame, { threshold: 24 }), 0.1).passed).toBe(true);
  });
  it("suggests unit tests for exported functions", () => {
    const suggestions = suggestUnitTests("export function add(a, b) { if (a < 0) throw new Error('negative'); return a + b; }");
    expect(suggestions.some((s) => s.kind === "unit")).toBe(true);
    expect(suggestions.some((s) => s.kind === "error")).toBe(true);
  });
  it("builds journeys with budget and checks them", () => {
    const journey = buildPlaywrightJourney(["/", "/checkout"], { selectors: ["#submit", "#email"] });
    expect(journey.steps.length).toBeGreaterThan(2);
    expect(journey.budgetMs).toBeGreaterThan(0);
    expect(isJourneyWithinBudget(journey, journey.budgetMs).met).toBe(true);
  });
});

describe("Phase 11 specialist planner + model arena", () => {
  const issues = [
    { category: "security", severity: "high" as const, message: "injection", id: "abc", ruleId: "xss", location: { filePath: "src/a.ts" } },
    { category: "performance", severity: "medium" as const, message: "slow", id: "def", ruleId: "lcp", location: { filePath: "src/a.ts" } },
  ] as unknown as PrioritizedIssue[];
  it("routes issues to specialists by category", () => {
    const routed = routeIssuesToSpecialists(issues);
    expect(routed.find((r) => r.specialist === "security")?.issues.length).toBe(1);
    expect(routed.find((r) => r.specialist === "performance")?.issues.length).toBe(1);
  });
  it("plans advisory-only specialists out of refactor strategy", () => {
    const plan = planSpecialistWork(issues, { strategy: "refactor" });
    expect(plan.tasks.length).toBeGreaterThanOrEqual(1);
    plan.tasks.forEach((task) => expect(task.canPatch).toBe(true));
  });
  it("ranks arena entries with verification-weighted scoring", () => {
    const verdict = modelArena([{ provider: "o", model: "m1", confidence: 90, changedLines: 10, verificationPassed: true, requests: 3, costUsd: 0.01, latencyMs: 200 }, { provider: "o", model: "m2", confidence: 60, changedLines: 200, verificationPassed: false, requests: 1, costUsd: 0.001, latencyMs: 50 }]);
    expect(verdict[0].model).toBe("m1");
  });
  it("exhausts remaining budget correctly", () => {
    const session = { budgets: { requests: 5, tokens: 1000, costUsd: 0.1 } };
    expect(specialistInputBudget(session as never, { requests: 2, tokens: 100, costUsd: 0.05 }).requests).toBe(2);
    expect(specialistInputBudget(session as never, { requests: 0, tokens: 100, costUsd: 0.05 }).exhausted).toBe(true);
  });
});

describe("Phase 12 performance lab extensions", () => {
  it("detects unreferenced assets from HTML", () => {
    const html = `<html><head><link rel="stylesheet" href="site.css"></head><body><img src="banner.png"><script src="app.js"></script></body></html>`;
    const unused = detectUnusedAssets(html, ["site.css", "app.js", "legacy.css", "images/hero.webp"], "https://example.com/");
    expect(unused.find((a) => a.ref === "legacy.css")?.referenced).toBe(false);
    expect(unused.find((a) => a.ref === "app.js")?.referenced).toBe(true);
  });
  it("flags oversized images and gives a recommendation", () => {
    const html = `<img srcset="hero.png 1200w, hero.png 2000w" src="hero.png">`;
    const metrics = detectOversizedImages(html, [{ url: "hero.png", bytes: 1_000_000 }]);
    expect(metrics[0].oversized).toBe(true);
    expect(metrics[0].recommendation).toContain("WebP");
  });
  it("compares before/after and collects regressions", () => {
    const before = [{ route: "/", profile: "mobile" as const, lcp: 1000, cls: 0, tbt: 100, speedIndex: 1200, performance: 90 }];
    const after = [{ route: "/", profile: "mobile" as const, lcp: 3000, cls: 0.2, tbt: 400, speedIndex: 1500, performance: 70 }];
    const result = comparePerformanceBeforeAfter(before, after);
    expect(result.regressed.length).toBe(1);
    expect(result.regressed[0].delta).toBe(-20);
  });
  it("emits remediations for budget violations", () => {
    const finding = performanceRemediations([{ route: "/", profile: "mobile", lcp: 4000, cls: 0.3, tbt: 500, speedIndex: 3000, performance: 40 }]);
    expect(finding.some((f) => f.ruleId === "lcp-budget")).toBe(true);
    expect(finding.some((f) => f.ruleId === "cls-budget")).toBe(true);
  });
});

describe("Phase 13 PDF + CI annotations", () => {
  it("produces a parseable PDF document", () => {
    const pdf = buildPdf("Title", [{ lines: ["hello world"] }]);
    expect(pdf.slice(0, 5).toString("ascii")).toBe("%PDF-");
    const body = pdf.toString("latin1");
    expect(body).toContain("hello world");
    expect(body).toContain("startxref");
    expect(body).toContain("%%EOF");
  });
  it("renders report data into PDF", () => {
    const pdf = reportToPdf({ summary: { total: 1, bySeverity: { high: 1 } }, topIssues: [{ severity: "high", ruleId: "xss", message: "unsafe", location: { filePath: "src/a.ts", startLine: 3 } }] });
    expect(pdf.toString("latin1")).toContain("[HIGH]");
  });
  it("emits GitHub and GitLab annotation artifacts", () => {
    const artifacts = buildAnnotations([{ id: "id1", severity: "high", ruleId: "xss", message: "unsafe", location: { filePath: "src/a.ts", startLine: 3 } }], { github: true, gitlab: true });
    expect(artifacts.github!.files[0].content).toContain("::error file=src/a.ts,line=3");
    expect(artifacts.gitlab!.files[0].content).toContain("fingerprint");
  });
});

describe("E09 team governance", () => {
  const members = [
    { actorId: "alice", tenantId: "acme", role: "security" as const },
    { actorId: "bob", tenantId: "acme", role: "admin" as const },
    { actorId: "mallory", tenantId: "acme", role: "developer" as const },
  ];
  it("enforces role-based permissions", () => {
    expect(hasPermission(members, "alice", "acme", "approve")).toBe(true);
    expect(hasPermission(members, "mallory", "acme", "approve")).toBe(false);
    expect(canApprove(members, "bob", "acme")).toBe(true);
  });
  it("denies authorization without membership", () => {
    expect(authorizeChange(members, { actorId: "eve", tenantId: "acme" }, "fix:apply").allowed).toBe(false);
  });
  it("requires senior quorum for approval", () => {
    expect(quorumRule(["security"], [{ approverId: "alice", roles: ["security"] }, { approverId: "bob", roles: ["admin"] }]).allowed).toBe(true);
    expect(quorumRule(["security"], [{ approverId: "mallory", roles: ["developer"] }]).allowed).toBe(false);
    expect(quorumRule(["security"], [{ approverId: "alice", roles: ["security"] }]).allowed).toBe(false);
  });
  it("finalizes approval requests through decisions", () => {
    const request = createApprovalRequest({ id: "r1", actorId: "mallory", tenantId: "acme", title: "patch config", filePaths: ["src/app.ts"] });
    const rolesByMember: Record<string, string[]> = { alice: ["security"], bob: ["admin"], mallory: ["developer"] };
    const first = decideApproval(request, { id: "d1", actorId: "reviewer", tenantId: "acme", approverId: "alice", approved: true, at: new Date() }, (who) => rolesByMember[who] ?? []);
    expect(first.request.state).toBe("pending");
    const second = decideApproval(first.request, { id: "d2", actorId: "reviewer", tenantId: "acme", approverId: "bob", approved: true, at: new Date() }, (who) => rolesByMember[who] ?? []);
    expect(second.request.state).toBe("approved");
  });
});

describe("E10 observability", () => {
  it("tracks counters and gauges with a prometheus snapshot", () => {
    const registry = createMetricRegistry([["http_requests", "counter"], ["http_requests", "counter"]]);
    registry.counter("http_requests").add(3);
    expect(totalRequests(registry, "http_requests")).toBe(3);
    registry.gauge("heap").set(42);
    expect(registry.snapshot()).toContain("heap 42");
  });
  it("reports SLO violations for slow spans", () => {
    const spans = [{ name: "audit", durationMs: 9000 }, { name: "render", durationMs: 50 }];
    expect(sloCoverage(spans, { audit: 5000 }).ok).toBe(false);
    expect(sloCoverage(spans, { render: 100 }).ok).toBe(true);
  });
  it("expires over-budget spans", () => {
    const span = { startedAt: Date.now() - 2000, budgetMs: 1000 };
    expect(enforceDurationBound(span).expired).toBe(true);
    expect(enforceDurationBound(span).overshootMs).toBeGreaterThan(0);
  });
  it("flushes spans from telemetry", () => {
    const telemetry = createTelemetry();
    const span = telemetry.span("analyze");
    span.end({ file: "a.ts" });
    const flushed = JSON.parse(telemetry.flush()) as Array<{ name: string; durationMs: number }>;
    expect(flushed[0].name).toBe("analyze");
    expect(flushed[0].durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe("E11 validation corpus", () => {
  it("scores fixture agreement against expectations", async () => {
    const cases: ValidationCase[] = [
      { id: "xss", fixture: "html", expectation: { xss: [{ severity: "high", messageIncludes: "unsafe" }] } },
      { id: "clean", fixture: "path", expectation: {} },
    ];
    const result = await runCorpus(async (fixture) => fixture === "html" ? [{ ruleId: "xss", severity: "high", message: "unsafe innerHTML" }] : [], cases);
    expect(result.score).toBe(2);
    expect(result.passed).toBe(true);
    expect(result.missing).toBe(0);
  });
  it("counts regressions when expectations no longer match", async () => {
    const cases = [{ id: "xss", fixture: "html", expectation: { xss: [{ severity: "high", messageIncludes: "unsafe" }] } }];
    const result = await runCorpus(async () => [], cases);
    expect(result.passed).toBe(false);
    expect(result.missing).toBe(1);
  });
});

describe("E12 deployment", () => {
  it("provides environment profiles", () => {
    expect(profileFor("local").persistence).toBe("sqlite");
    expect(profileFor("production").require2fa).toBe(true);
  });
  it("computes launch readiness from probes", () => {
    const checklist = launchWith(profileFor("production"), { canConnectPersistence: true, defaultUserExists: true, portFree: true, productionGate: { approvalsEnabled: true, telemetryReachable: true } });
    expect(aggregate(checklist.checks).ready).toBe(true);
  });
  it("blocks production deployments on failed probes", () => {
    const checklist = launchWith(profileFor("production"), { canConnectPersistence: false, defaultUserExists: true, portFree: true, productionGate: { approvalsEnabled: true, telemetryReachable: true } });
    expect(aggregate(checklist.checks).ready).toBe(false);
  });
  it("requires manual approval for secret file changes", () => {
    expect(manualApprovalFallback([".env"], profileFor("production")).needsHuman).toBe(true);
    expect(manualApprovalFallback(["src/app.ts"], profileFor("production")).needsHuman).toBe(false);
  });
});

const stubIssue = (): Issue => ({ id: "i", tool: "eslint", message: "m", severity: "low", category: "bug" });
describe("PDF regression guard", () => {
  it("pdf module exists and returns a buffer with a report", () => {
    expect(Buffer.isBuffer(reportToPdf({ topIssues: [{ severity: "low", message: String(stubIssue().message), location: { filePath: "x.ts" } }] }))).toBe(true);
  });
});