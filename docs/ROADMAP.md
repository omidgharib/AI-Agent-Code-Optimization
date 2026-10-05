# AI Auditor development roadmap

This roadmap is the durable entry point for future implementation sessions.
The product supports JavaScript and TypeScript projects only.

For the production and enterprise architecture track, including the separation of Code Audit and SEO Workspace inside one product, use [AI Auditor Enterprise Roadmap](enterprise/ROADMAP.md).

## How to continue a phase

1. Open this file and the matching file under `docs/phases/`.
2. Implement only unchecked acceptance criteria unless scope is explicitly changed.
3. Run the verification commands listed in that phase.
4. Mark completed checklist items and append a dated implementation note.
5. Do not mark a phase complete while any acceptance criterion is unchecked.

## Status

| Phase | Goal | Status | File |
| --- | --- | --- | --- |
| 1 | Trusted JS/TS audit and fix foundation | Complete | [PHASE-01-TRUSTED-CORE.md](phases/PHASE-01-TRUSTED-CORE.md) |
| 2 | Deeper code, SEO and runtime analysis | Complete | [PHASE-02-ANALYZERS.md](phases/PHASE-02-ANALYZERS.md) |
| 3 | Controllable multi-model AI agent | Complete | [PHASE-03-AI-AGENT.md](phases/PHASE-03-AI-AGENT.md) |
| 4 | Review-oriented bilingual Web UI | Complete | [PHASE-04-WEB-UI.md](phases/PHASE-04-WEB-UI.md) |
| 5 | Continuous monitoring and CI quality gates | Complete | [PHASE-05-MONITORING.md](phases/PHASE-05-MONITORING.md) |
| 6 | Trust, security and reversible changes | Core implemented | [PHASE-06-TRUST-SECURITY.md](phases/PHASE-06-TRUST-SECURITY.md) |
| 7 | Single-page SEO Lab | Core implemented | [PHASE-07-SEO-LAB.md](phases/PHASE-07-SEO-LAB.md) |
| 8 | Controlled multi-page SEO crawler | Core implemented | [PHASE-08-SEO-CRAWLER.md](phases/PHASE-08-SEO-CRAWLER.md) |
| 9 | Architecture and dependency intelligence | Complete | [PHASE-09-ARCHITECTURE-INTELLIGENCE.md](phases/PHASE-09-ARCHITECTURE-INTELLIGENCE.md) |
| 10 | Test intelligence and visual regression | Core implemented | [PHASE-10-TEST-INTELLIGENCE.md](phases/PHASE-10-TEST-INTELLIGENCE.md) |
| 11 | Specialist AI agents | Core implemented | [PHASE-11-SPECIALIST-AGENTS.md](phases/PHASE-11-SPECIALIST-AGENTS.md) |
| 12 | Performance and bundle lab | Complete | [PHASE-12-PERFORMANCE-LAB.md](phases/PHASE-12-PERFORMANCE-LAB.md) |
| 13 | Multi-project and team dashboard | Core implemented | [PHASE-13-TEAM-DASHBOARD.md](phases/PHASE-13-TEAM-DASHBOARD.md) |

`Core implemented` means the deterministic domain model, analysis engine and tests exist and pass (`npm run build:all && npm test -- --runInBand`). A phase is deliberately not `Complete` while its remaining unchecked acceptance criteria (interactive bilingual UI surfaces, external connectors, Docker/headless packaging, networked role-based access) are product-integration work. Checked criteria are maintained inside each phase file (`docs/phases/PHASE-0X-*.md`).

## Product invariants

- Accept only JavaScript/TypeScript repositories.
- Never write outside the selected repository.
- Never modify secrets, Git internals, lockfiles, dependencies or generated output.
- AI output is untrusted until parsed, path-checked, applied transactionally and verified.
- A failed or regressive fix must leave source files exactly as they were.
- Reports distinguish mechanical fixes, AI patches and advisory recommendations.

## 2026-09-21 implementation audit

- PHASE-09: added duplicated-logic grouping, staged refactoring plans and boundary-violation detection (`src/analyzers/architectureRefactoring.ts`).
- PHASE-10: added visual regression (`src/verify/visualRegression.ts`) and unit-test suggestions + Playwright journeys (`src/verify/testIntelligence.ts`).
- PHASE-11: added specialist issue routing, model arena, input budgets and the specialist planner (`src/core/specialistAgents.ts`, `src/fix/specialistPlanner.ts`); the planner is now wired into the engine fix loop via the `specialistStrategy` config (`--strategy`), injected into the LLM context and counted in the report agent metadata.
- PHASE-12: added unused-asset detection, oversized-image flags, before/after comparison and remediation proposals (`src/analyzers/performanceLab.ts`).
- PHASE-13: added `report.pdf` export (`src/report/pdf.ts`) and GitHub/GitLab annotation output wired into `audit`/`monitor` (`src/report/annotations.ts`, `src/cli/index.ts`).
- All modules above have deterministic tests in `src/tests/finalPhases.test.ts` (34 tests).