# Current-to-target module map

Inventory of every current `src/` directory/module group (2026-09-03). Legacy means migration seam/obsolete duplicate.

| Current modules | Target owner | Notes |
| --- | --- | --- |
| `cli/index.ts` | Platform `apps/cli` | Code, SEO, combined composition root. |
| `server/index.ts` | Platform `apps/api` (legacy seam) | Currently imports both domains. |
| `server/crawlWorker.ts` | SEO `workers/crawl-worker` | Contract-consuming composition root. |
| `core/config.ts`, `logger.ts`, `models.ts`, `errorDiagnosis.ts` | Platform | Runtime/AI provider utilities. |
| `core/types.ts`, `schemas.ts` | Contracts | Split domain types; version wire schemas. |
| `core/projectRegistry.ts` | Platform | Move file persistence behind database ports. |
| `core/specialistAgents.ts` | Platform AI orchestration | Domain data via contracts. |
| `core/engine.ts` | Legacy -> Code service + Combined orchestrator | Must not remain shared engine logic. |
| `core/projectDetector.ts`, `projectIgnore.ts` | Code Audit | Repository semantics are Code-only. |
| `core/fixTrace.ts`, `qualityGate.ts`, `trustSecurity.ts` | Legacy split | Platform policy/evidence; Code patch safety; generic Security redaction. |
| `analyzers/eslint.ts`, `tsc.ts`, `tscParse.ts`, `architecture.ts`, `projectHealth.ts`, `playwright.ts` | Code Audit | Static/architecture/test analysis. |
| `analyzers/performanceLab.ts`, `lighthouse.ts`, `seoLab.ts` | SEO Workspace | URL/runtime analysis; no repo prerequisite. |
| `analyzers/seoCrawler.ts` | SEO crawler | Extract via public contracts. |
| `seo/*.ts` | SEO Workspace | Site/environment identity independent of repo. |
| `fix/*.ts` | Code Audit | AI transport may use platform port; patch semantics stay Code. |
| `normalize/normalizer.ts`, `prioritize/prioritize.ts` | Code Audit | Current Issue is not a universal domain contract. |
| `verify/*.ts` | Code Audit | Remove unused `verify.ts` after coverage confirmation. |
| `report/report.ts`, `html.ts`, `markdown.ts`, `sarif.ts`, `summary.ts` | Platform reporting | Consume contracts/artifact port. |
| `report/_report.ts` | Legacy; remove E01 | Stale duplicate. |
| `tests/*.test.ts` | Co-locate by target owner | Boundary integration/contract tests remain. |

## Current boundary findings

- `core/engine.ts` and `server/index.ts` are the principal mixed-domain seams.
- `core/qualityGate.ts` imports a report type; move it to contracts.
- `core/trustSecurity.ts` imports Code diff logic; split generic security from patch enforcement.
- `seo/siteArchitecture.ts` imports a crawler implementation type; move it to a public contract.
- Reporting imports Code/SEO implementation types; replace with report DTO contracts.

See [dependency graph](dependency-graph.md).
