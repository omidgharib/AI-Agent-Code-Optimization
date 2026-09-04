# ai-auditor — Architecture

> **Legacy snapshot:** this pre-enterprise document has drifted from implementation. Normative boundaries live in the [Enterprise Roadmap](docs/enterprise/ROADMAP.md), [E00 baseline](docs/enterprise/phases/E00-PRODUCT-BOUNDARIES.md), and [ADR index](docs/adr/README.md).

> A TypeScript CLI that audits source repositories, consolidates findings from multiple analyzers, prioritizes them, optionally applies safe LLM-assisted fixes, and produces JSON/Markdown reports.

---

## 1. Purpose

`ai-auditor` analyzes projects without requiring the audited repository to install external tools such as ESLint.

The CLI is designed to provide:

- Static code analysis using bundled/internal tooling
- TypeScript diagnostics
- Lighthouse performance and SEO auditing
- Future Playwright-based test and browser analysis
- Unified, normalized issue reporting
- Deterministic issue prioritization
- Optional LLM-assisted auto-fixing through validated unified diffs
- Safe diff application restricted to the audited repository
- Machine-readable JSON and human-readable Markdown reports

---

## 2. Architectural Principles

### 2.1 Self-contained analyzers

Analyzers must not require the target repository to install or globally provide tools.

Examples:

- ESLint must be available through `ai-auditor` dependencies.
- The CLI must not execute ESLint using `npx`.
- The CLI must not depend on a globally installed ESLint executable.
- Future analyzers must follow the same principle unless explicitly approved otherwise.

### 2.2 Clear separation of responsibilities

The architecture separates the following concerns:

| Area           | Responsibility                                                     |
| -------------- | ------------------------------------------------------------------ |
| CLI            | Parse arguments and create runtime configuration                   |
| Engine         | Orchestrate audit, fix, verification, and reporting flows          |
| Analyzers      | Collect raw findings from a specific tool or source                |
| Normalization  | Convert findings into one shared issue format and deduplicate them |
| Prioritization | Score and order issues                                             |
| Fix subsystem  | Select issues, build context, request fixes, validate/apply diffs  |
| Reporting      | Generate JSON and Markdown output                                  |
| Logging        | Provide consistent runtime diagnostics                             |

### 2.3 Deterministic output

The same repository state and analyzer output should produce stable issue identities and predictable report structure.

Issue IDs must never depend on:

- random values
- timestamps
- process IDs
- counters
- unstable object ordering

### 2.4 Safety before automation

Auto-fix is optional and security-sensitive.

The system must prefer rejecting an unsafe or ambiguous patch over applying it.

### 2.5 Minimal and focused changes

Architectural changes should preserve existing public contracts unless explicitly approved.

Large refactors require user approval before implementation.

---

## 3. High-Level System Flow

```text
CLI Arguments
│
▼
AuditConfig
│
▼
runAudit(config)
│
├── Run enabled analyzers
│     ├── ESLint
│     ├── TypeScript compiler
│     ├── Lighthouse, only when config.url exists
│     └── Playwright, when implemented/enabled
│
▼
Normalize analyzer results
│
▼
Deduplicate issues
│
▼
Prioritize issues
│
├── Without --fix
│     │
│     ▼
│   Generate reports
│
└── With --fix
│
▼
Select eligible issues for fixing
│
▼
Build source context
│
▼
Request unified diff from LLM
│
▼
Validate diff
│
▼
Apply diff safely
│
▼
Re-analyze without Lighthouse
│
▼
Repeat until complete or maxFixIterations is reached
│
▼
Generate final reports
```

## 4. Project Structure

```text
ai-auditor/
├── src/
│   ├── cli/
│   │   └── index.ts
│   │
│   ├── core/
│   │   ├── engine.ts
│   │   ├── logger.ts
│   │   └── types.ts
│   │
│   ├── analyzers/
│   │   ├── eslint.ts
│   │   ├── tsc.ts
│   │   ├── lighthouse.ts
│   │   └── playwright.ts
│   │
│   ├── normalize/
│   │   └── normalizer.ts
│   │
│   ├── prioritize/
│   │   └── prioritize.ts
│   │
│   ├── fix/
│   │   ├── contextBuilder.ts
│   │   ├── fixPlanner.ts
│   │   ├── llmClient.ts
│   │   └── diffApplier.ts
│   │
│   ├── report/
│   │   └── report.ts
│   │
│   └── tests/
│       └── normalizer.test.ts
│
├── tests/
│   ├── prioritize.test.ts
│   └── diffApplier.test.ts
│
├── dist/
├── ai-auditor-report/
├── package.json
├── tsconfig.json
├── CLAUDE.md
└── ARCHITECTURE.md
```

## 5. Module Responsibilities

### 5.1 CLI

**Location:**

```text
src/cli/index.ts
```

**Responsibilities:**

- Define and parse CLI arguments.
- Convert arguments into AuditConfig.
- Invoke the audit engine.
- Render concise CLI output.
- Set process exit codes where appropriate.

The CLI source file must not include:

```ts
#!/usr/bin/env node
```

The shebang is injected by the build process after TypeScript compilation.

### 5.2 Core Engine

**Location:**

```text
src/core/engine.ts
```

The engine is the main orchestration layer.

**Responsibilities:**

- Execute enabled analyzers.
- Decide whether Lighthouse should run.
- Collect `Issue[]` results.
- Normalize and deduplicate findings.
- Prioritize findings.
- Start and manage the auto-fix loop when enabled.
- Ensure Lighthouse is excluded from re-analysis during fix iterations.
- Generate final reports.

The engine should not contain analyzer-specific parsing logic, report formatting logic, or low-level diff parsing logic.

### 5.3 Logger

**Location:**

```text
src/core/logger.ts
```

**Responsibilities:**

- Provide consistent logging.
- Support verbose output.
- Report warnings without stopping the entire audit where safe.
- Report actionable errors.
- Avoid exposing secrets, API keys, private file contents, or credentials.

Typical logging categories:

```text
debug
info
warn
error
```

### 5.4 Shared Types

**Location:**

```text
src/core/types.ts
```

This file contains shared public data contracts used across the system.

Do not modify public contracts casually. Any intentional contract change requires:

- implementation updates,
- test updates,
- report compatibility review,
- documentation updates.

## 6. Shared Data Contracts

```ts
export type Severity = "low" | "medium" | "high" | "critical";

export type Category =
  | "security"
  | "style"
  | "maintainability"
  | "test"
  | "performance"
  | "seo";

export interface Issue {
  /**
   * Deterministic SHA-256 hash:
   * tool + rule + file + line + message
   */
  id: string;

  /**
   * Example values:
   * eslint, tsc, lighthouse, playwright, custom
   */
  tool: string;

  rule?: string;

  /**
   * Repository-relative file path whenever possible.
   */
  file: string;

  line?: number;
  column?: number;

  message: string;

  severity: Severity;
  category: Category;

  fix?: {
    canAutoFix: boolean;
    suggestion?: string;
  };
}

export interface PrioritizedIssue extends Issue {
  score: number;
}

export interface FixResponse {
  /**
   * Must contain a valid unified diff.
   */
  diff: string;

  explanation?: string;
}

export interface AuditConfig {
  /**
   * Absolute or resolved repository root.
   */
  repoRoot: string;

  /**
   * Enables Lighthouse when present.
   */
  url?: string;

  /**
   * Enables the LLM-assisted fix loop.
   */
  fix: boolean;

  /**
   * Generates and validates proposals without filesystem writes.
   */
  dryRun: boolean;

  /**
   * Maximum number of fix/re-analysis iterations.
   */
  maxFixIterations: number;

  /**
   * Optional minimum severity filter.
   */
  minSeverity?: Severity;

  /**
   * Analyzer paths, globs, or configured exclusions.
   */
  exclude: string[];

  /**
   * Generate JSON report output.
   */
  json: boolean;

  /**
   * Generate Markdown report output.
   */
  md: boolean;

  /**
   * Enable detailed runtime logging.
   */
  verbose: boolean;

  /**
   * Optional LLM API key.
   */
  apiKey?: string;

  /**
   * Configured LLM model name.
   */
  model: string;

  /**
   * Configured LLM API base URL.
   */
  baseUrl: string;
}
```

## 7. Issue Identity

Every issue must use a deterministic SHA-256 identity generated from:

```text
tool + rule + file + line + message
```

Conceptual implementation:

```ts
import { createHash } from "node:crypto";

export function createIssueId(input: {
  tool: string;
  rule?: string;
  file: string;
  line?: number;
  message: string;
}): string {
  const value = [
    input.tool,
    input.rule ?? "",
    input.file,
    input.line ?? "",
    input.message,
  ].join("");

  return createHash("sha256").update(value).digest("hex");
}
```

**Rules:**

- Missing optional fields must be normalized consistently.
- IDs must remain stable between repeated runs against identical findings.
- Analyzer implementations must not generate random IDs.
- Deduplication must use normalized issue identities.

## 8. Analyzer Architecture

Each analyzer is responsible for:

- Running its internal tool or audit process.
- Reading raw results.
- Mapping raw results to the shared `Issue` contract.
- Generating deterministic issue IDs.
- Returning `Promise<Issue[]>`.

All analyzer modules must return:

```ts
Promise<Issue[]>;
```

The engine must receive normalized analyzer output rather than tool-specific data structures.

## 9. ESLint Analyzer

**Location:**

```text
src/analyzers/eslint.ts
```

**Required export:**

```ts
export async function runEslint(cwd: string): Promise<Issue[]>;
```

**Responsibilities:**

- Run bundled ESLint v8 programmatically.
- Analyze supported files in the target repository.
- Respect exclusion configuration where applicable.
- Convert ESLint messages to normalized issues.
- Assign suitable severity and category values.
- Generate deterministic issue IDs.

**Required API style:**

```ts
new ESLint({ ... } as ConstructorParameters<typeof ESLint>[0]);
```

**Forbidden approaches:**

```ts
execa("npx", ["eslint", ...]);
```

```ts
execa("eslint", ["..."]);
```

```ts
spawn("eslint", ["..."]);
```

The audited repository must not need:

- a global ESLint installation,
- `npx eslint`,
- a locally installed ESLint package solely for ai-auditor to work.

## 10. TypeScript Analyzer

**Location:**

```text
src/analyzers/tsc.ts
```

**Required export:**

```ts
export async function runTsc(cwd: string): Promise<Issue[]>;
```

**Responsibilities:**

- Analyze TypeScript diagnostics.
- Map diagnostics to normalized issues.
- Preserve file path, line, and column when available.
- Use TypeScript diagnostic code as the rule identifier when appropriate.
- Categorize findings appropriately, usually as maintainability.
- Generate deterministic issue IDs.

**Expected mapping examples:**

| TypeScript Diagnostic Field  | Issue Field     |
| ---------------------------- | --------------- |
| Diagnostic code              | rule            |
| File name                    | file            |
| Start position               | line and column |
| Flattened diagnostic message | message         |
| Diagnostic category          | severity        |

## 11. Lighthouse Analyzer

**Location:**

```text
src/analyzers/lighthouse.ts
```

**Required export:**

```ts
export async function runLighthouse(url: string): Promise<Issue[]>;
```

**Status:**

Implemented, but may require refinement.

**Responsibilities:**

- Launch or connect to a suitable browser environment.
- Run Lighthouse against the configured URL.
- Convert relevant audit findings to normalized issues.
- Produce performance and SEO-related findings.
- Clean up browser resources even when audit execution fails.

**Possible categories:**

```text
performance
seo
maintainability
```

### Lighthouse Execution Rules

Lighthouse runs only if:

```ts
config.url !== undefined;
```

Lighthouse must run during the initial analysis when a URL exists:

```ts
const issues = await analyze(repoRoot, config.url);
```

Lighthouse must not run during re-analysis in the auto-fix loop:

```ts
const next = await analyze(repoRoot, config.url, false);
```

The re-analysis call must explicitly disable Lighthouse.

**Reason:**

- Lighthouse is expensive.
- Most code fixes do not require repeated browser performance audits.
- Fix-loop verification should focus on source-level and fixable issues.
- Running Lighthouse repeatedly can make the fix process slow and unstable.

## 12. Playwright Analyzer

**Location:**

```text
src/analyzers/playwright.ts
```

**Required export:**

```ts
export async function runPlaywright(cwd: string): Promise<Issue[]>;
```

**Status:**

```text
Roadmap — not yet implemented
```

When implemented, it should:

- Execute browser or test analysis in a controlled environment.
- Convert findings into `Issue[]`.
- Generate deterministic issue IDs.
- Be registered in the core engine.
- Respect exclusions and configuration.
- Avoid imposing global tool requirements on audited repositories.
- Include dedicated tests.

**Possible future use cases:**

- Detecting failing browser tests.
- Detecting accessibility issues.
- Detecting client-side runtime errors.
- Capturing broken flows.
- Checking test coverage or missing critical scenarios.

## 13. Normalization and Deduplication

**Location:**

```text
src/normalize/normalizer.ts
```

**Required export:**

```ts
export function normalize(issues: Issue[]): Issue[];
```

**Responsibilities:**

- Ensure analyzer findings conform to the shared issue shape.
- Normalize inconsistent paths and optional values.
- Deduplicate equivalent issues.
- Preserve meaningful metadata.
- Return stable output.

The normalizer should not:

- invoke analyzers,
- write report files,
- apply fixes,
- request LLM responses.

### Deduplication Strategy

Deduplication is based primarily on `Issue.id`.

```text
Same issue ID => same logical issue
```

If multiple analyzers produce similar-but-not-identical findings, they should remain separate unless an explicit cross-tool deduplication policy is introduced.

## 14. Prioritization

**Location:**

```text
src/prioritize/prioritize.ts
```

**Required export:**

```ts
export function prioritize(issues: Issue[]): PrioritizedIssue[];
```

**Responsibilities:**

- Assign a deterministic numeric score.
- Consider issue severity.
- Consider category impact.
- Sort issues in descending priority.
- Preserve the full original issue data.

**Typical severity ordering:**

```text
critical > high > medium > low
```

**Example category weighting concept:**

| Category        | Typical Priority |
| --------------- | ---------------- |
| security        | Highest          |
| performance     | High             |
| seo             | High             |
| test            | Medium to high   |
| maintainability | Medium           |
| style           | Lower            |

The precise scoring formula may evolve, but must remain deterministic and covered by tests.

## 15. Auto-Fix Subsystem

The auto-fix subsystem is located in:

```text
src/fix/
```

| Module            | Responsibility                                          |
| ----------------- | ------------------------------------------------------- |
| contextBuilder.ts | Build relevant source context for selected issues       |
| fixPlanner.ts     | Select safe, eligible issues for an LLM fix attempt     |
| llmClient.ts      | Request a unified diff from the configured LLM provider |
| diffApplier.ts    | Validate and apply safe repository-local diffs          |

## 16. Context Builder

**Location:**

```text
src/fix/contextBuilder.ts
```

**Required export:**

```ts
export function buildContext(...args: unknown[]): unknown;
```

**Responsibilities:**

- Read only relevant source files.
- Extract context around issue locations.
- Limit context size to avoid excessive LLM payloads.
- Include issue metadata needed to understand the requested fix.
- Avoid reading protected or irrelevant files.

The context should include, where relevant:

- file path,
- line number,
- nearby source lines,
- issue message,
- analyzer/tool name,
- rule identifier,
- suggested remediation.

The context builder must not modify files.

## 17. Fix Planner

**Location:**

```text
src/fix/fixPlanner.ts
```

**Required export:**

```ts
export function selectIssuesForFix(...args: unknown[]): unknown;
```

**Responsibilities:**

- Select issues eligible for automated fixing.
- Exclude issues where `fix.canAutoFix !== true`.
- Respect configured severity filters.
- Respect iteration limits.
- Avoid selecting unsafe or unsupported issue types.
- Prefer high-value, low-risk fixes.

The planner should avoid selecting:

- findings without a meaningful source location,
- issues in protected files,
- issues requiring broad architectural changes,
- ambiguous findings,
- issues where the fix would require secrets or external credentials.

## 18. LLM Client

**Location:**

```text
src/fix/llmClient.ts
```

**Required export:**

```ts
export async function requestFix(...args: unknown[]): Promise<FixResponse>;
```

**Responsibilities:**

- Send selected issue context to the configured LLM provider.
- Request a valid unified diff.
- Include constraints in the prompt:
  - modify only relevant files,
  - do not touch protected files,
  - do not include prose instead of a patch,
  - return a unified diff,
  - preserve existing behavior unless the issue requires otherwise.
- Return `FixResponse`.

The LLM response is untrusted input.

It must always be validated before it is applied.

## 19. Diff Applier

**Location:**

```text
src/fix/diffApplier.ts
```

**Required export:**

```ts
export async function applyDiff(...args: unknown[]): Promise<unknown>;
```

**Responsibilities:**

- Parse a unified diff.
- Validate all target paths.
- Ensure all file operations remain inside `repoRoot`.
- Reject unsafe or malformed patches.
- Apply valid diffs.
- Support dry-run behavior.
- Return enough result information for the engine to determine whether a patch was applied.

## 20. Diff Safety Model

Auto-fixes are security-sensitive.

The system must reject unsafe, malformed, ambiguous, or out-of-scope changes.

### 20.1 Repository Boundary

`applyDiff` must never create, edit, rename, move, or delete files outside:

```text
AuditConfig.repoRoot
```

The repository root should be resolved before path validation.

Every changed path must be resolved and validated against that root.

### 20.2 Forbidden Paths

Reject diffs that target:

```text
../
.git/
absolute paths outside repoRoot
paths that resolve outside repoRoot after normalization
```

### 20.3 Protected Files

The following files must not be changed without explicit user approval:

```text
.env
.env.*
package-lock.json
npm-shrinkwrap.json
yarn.lock
pnpm-lock.yaml
.git/
private keys
certificates
tokens
credentials
secret configuration
deployment secrets
CI secrets
```

Examples of sensitive filename patterns include:

```text
*.pem
*.key
*.p12
*.pfx
id_rsa
credentials.json
secrets.*
```

### 20.4 Unified Diff Requirement

The LLM must provide a valid unified diff.

The system must reject:

- plain source-code responses without a diff,
- malformed patch headers,
- invalid hunks,
- ambiguous paths,
- patches that do not apply cleanly,
- patches targeting protected files,
- patches that escape `repoRoot`.

## 21. Dry-Run Behavior

When:

```ts
config.dryRun === true;
```

the system may:

- analyze the repository,
- select fixable issues,
- build LLM context,
- request a proposed diff,
- validate the proposed diff,
- display or include the proposed diff in output.

The system must not:

- write source files,
- delete source files,
- move files,
- create files,
- claim that a fix was applied,
- report an issue as verified fixed.

Dry-run reports should clearly distinguish:

```text
proposed fixes
```

from:

```text
applied and verified fixes
```

## 22. Fix Loop

The fix loop is enabled only when:

```ts
config.fix === true;
```

**Expected flow:**

```text
Analyze
→ Normalize
→ Prioritize
→ Select fixable issues
→ Build context
→ Request unified diff
→ Validate diff
→ Apply diff
→ Re-analyze without Lighthouse
→ Repeat until complete or maxFixIterations is reached
→ Write reports
```

**Rules:**

- Respect `config.maxFixIterations`.
- Stop when no eligible issues remain.
- Stop when no valid fix can be generated or applied.
- Do not run Lighthouse during re-analysis.
- Do not claim that an issue is fixed until a re-analysis verifies it.
- Keep unresolved and non-fixable issues in final reports.
- Avoid infinite loops by tracking iteration count and lack of progress.

**Conceptual pseudocode:**

```ts
let issues = await analyze(repoRoot, config.url, true);
let prioritized = prioritize(normalize(issues));

for (let iteration = 0; iteration < config.maxFixIterations; iteration += 1) {
  const planned = selectIssuesForFix(prioritized, config);

  if (planned.length === 0) {
    break;
  }

  const context = buildContext(repoRoot, planned);
  const response = await requestFix(context, config);

  const result = await applyDiff(response.diff, {
    repoRoot: config.repoRoot,
    dryRun: config.dryRun,
  });

  if (!result.applied || config.dryRun) {
    break;
  }

  // Lighthouse is intentionally disabled here.
  issues = await analyze(repoRoot, config.url, false);
  prioritized = prioritize(normalize(issues));
}

await writeReport(prioritized, config);
```

## 23. Reports

**Location:**

```text
src/report/report.ts
```

**Required export:**

```ts
export async function writeReport(...args: unknown[]): Promise<void>;
```

Reports are written to:

```text
ai-auditor-report/
```

**Supported outputs:**

```text
ai-auditor-report/report.json
ai-auditor-report/report.md
```

### 23.1 Report Selection

- Generate JSON output when `config.json` is enabled.
- Generate Markdown output when `config.md` is enabled.
- If neither option is selected, generate both report formats.

### 23.2 Overwrite Behavior

Reports must be recreated or overwritten on every audit run.

The output directory must remain predictable:

```text
ai-auditor-report/
```

### 23.3 JSON Report Requirements

JSON output should be:

- machine-readable,
- stable,
- structured,
- suitable for CI integration,
- suitable for future dashboards or automation.

It should include, where applicable:

- audit configuration summary,
- timestamp,
- analyzer summary,
- total issue counts,
- issue severity counts,
- prioritized issue list,
- fix-loop metadata,
- dry-run status,
- applied/proposed patch metadata.

### 23.4 Markdown Report Requirements

Markdown output should be readable by developers and include:

- summary,
- issue counts,
- prioritized findings,
- file and line references,
- severity and category,
- analyzer/rule source,
- fixability information,
- applied/proposed fix status,
- relevant explanation or recommendations.

### 23.5 Schema Stability

Do not rename or remove report fields without explicit approval.

Any report-schema modification requires:

- updated tests,
- updated documentation,
- compatibility consideration for automated consumers.

## 24. CLI Configuration

The CLI converts command-line flags into `AuditConfig`.

Typical configuration concepts include:

```text
repoRoot
url
fix
dryRun
maxFixIterations
minSeverity
exclude
json
md
verbose
apiKey
model
baseUrl
```

The CLI should make safe defaults explicit.

**Expected report behavior:**

| Flag State       | Generated Reports |
| ---------------- | ----------------- |
| --json           | JSON only         |
| --md             | Markdown only     |
| --json --md      | JSON and Markdown |
| Neither provided | JSON and Markdown |

## 25. Runtime and Module Requirements

### 25.1 Node.js Version

The project must follow the Node.js version declared in:

```text
package.json → engines.node
```

The Node.js version is not assumed to be pinned in this document.

Before using a newer Node.js API, confirm compatibility with the declared engine range.

### 25.2 ESM Import Rules

This project uses ESM-compatible TypeScript imports.

TypeScript import specifiers must use `.js` extensions where required by the current module structure.

Example:

```ts
import { normalize } from "../normalize/normalizer.js";
import type { Issue } from "../core/types.js";
```

## 26. Build and Verification Requirements

The project uses the following commands:

```bash
npm run build
```

```bash
npm test
```

**Required verification workflow:**

| Change Type                        | Required Command          |
| ---------------------------------- | ------------------------- |
| TypeScript source changes          | npm run build             |
| Behavior or business-logic changes | npm test                  |
| Issue normalization changes        | npm test                  |
| Priority scoring changes           | npm test                  |
| Report-output changes              | npm test                  |
| Diff application changes           | npm test                  |
| Before completing a coding task    | npm run build && npm test |

If a command fails:

- Investigate the failure.
- Report the failure accurately.
- Do not claim the task is verified successfully.

## 27. Testing Strategy

The project uses Node.js built-in tests.

```bash
npm test
```

Test files should use ESM-compatible `.js` import paths.

Example within `src/tests/`:

```ts
import { normalize } from "../normalize/normalizer.js";
import type { Issue } from "../core/types.js";
```

Example within root `tests/`:

```ts
import { prioritize } from "../src/prioritize/prioritize.js";
import { applyDiff } from "../src/fix/diffApplier.js";
```

### 27.1 Required Test Coverage

Tests must be added or updated when changing:

- issue normalization,
- issue identity generation,
- deduplication behavior,
- issue prioritization,
- analyzer output mapping,
- Lighthouse behavior,
- fix-loop behavior,
- diff validation,
- repository boundary checks,
- protected-file checks,
- dry-run behavior,
- report generation,
- report overwrite behavior,
- report schema.

### 27.2 Critical Safety Tests

The diff applier must have tests proving it rejects:

- `../` path traversal,
- absolute paths outside `repoRoot`,
- `.git/` modifications,
- lockfile modifications without approval,
- `.env` modifications without approval,
- malformed unified diffs,
- invalid hunks.

## 28. Adding a New Analyzer

To add a new analyzer:

1. Create a file under:

   ```text
   src/analyzers/
   ```

2. Use a descriptive filename:

   ```text
   src/analyzers/<analyzer-name>.ts
   ```

3. Export a stable function using the `run<Name>` convention.

4. Return:

   ```ts
   Promise<Issue[]>;
   ```

5. Convert all tool-specific results into the shared `Issue` contract.

6. Generate issue IDs using:

   ```text
   SHA-256(tool + rule + file + line + message)
   ```

7. Assign valid values for:

   ```text
   severity
   category
   ```

8. Register the analyzer in:

   ```text
   src/core/engine.ts
   ```

9. Respect `AuditConfig.exclude` where applicable.

10. Add tests for:
    - valid result mapping,
    - malformed tool output,
    - missing file positions,
    - analyzer failures,
    - deterministic IDs.

Update this document if the analyzer adds a new architectural concern or changes the pipeline.

**Generic signature:**

```ts
export async function runName(cwd: string): Promise<Issue[]>;
```

**Lighthouse exception:**

```ts
export async function runLighthouse(url: string): Promise<Issue[]>;
```

## 29. Current Implementation Status

| Area                          | Status                                     |
| ----------------------------- | ------------------------------------------ |
| Core orchestrator (engine.ts) | Implemented                                |
| Logging                       | Implemented                                |
| ESLint analyzer               | Implemented                                |
| Lighthouse analyzer           | Implemented; refinement may be needed      |
| TypeScript analyzer           | Part of architecture and expected contract |
| Normalization                 | Implemented/required                       |
| Prioritization                | Implemented/required                       |
| LLM fix flow                  | Defined by architecture                    |
| Diff safety restrictions      | Required                                   |
| JSON reporting                | Required                                   |
| Markdown reporting            | Required                                   |
| Playwright analyzer           | Planned / roadmap                          |

## 30. Future Roadmap

Potential future improvements include:

- Completing the Playwright analyzer.
- Improving Lighthouse audit mapping and recommendations.
- Adding more static analyzers.
- Adding accessibility-specific browser audits.
- Adding CI-oriented output modes.
- Adding baseline comparison between audit runs.
- Adding configurable policy rules.
- Adding safer fix confidence scoring.
- Adding selective fix approval workflows.
- Adding incremental analysis for large repositories.

All future features must preserve the core principles:

- deterministic output,
- analyzer isolation,
- repository safety,
- no unnecessary external tool requirements,
- stable public contracts,
- verified fixes rather than assumed fixes.
