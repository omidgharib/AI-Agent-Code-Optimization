// FILE: README.md

# ai-auditor

CLI tool for AI-powered code auditing and auto-fixing.

## Requirements

- Node.js >= 20
- `tsconfig.json` present (for TypeScript analysis)

> **Note:** ESLint is bundled with `ai-auditor` — you do **not** need ESLint installed in your target project. If the project has its own ESLint config, it will be used automatically; otherwise `eslint:recommended` is applied as a fallback.

## Installation

```bash
npm install
npm run build
npm link   # makes `ai-auditor` available globally

## Usage

bash
# Basic audit
ai-auditor audit [path]

# With reports
ai-auditor audit . --json --md

# Auto-fix with LLM
ai-auditor audit . --fix --api-key sk-... --model gpt-4.1-mini

# Filter by severity
ai-auditor audit . --severity high

# Dry run (preview patches only)
ai-auditor audit . --fix --dry-run

# Exclude patterns
ai-auditor audit . --exclude node_modules dist .next

# Verbose output
ai-auditor audit . --verbose

# Include Lighthouse performance/SEO audit for a live URL
ai-auditor audit . --url https://example.com --json --md

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--json` | false | Write `ai-auditor-report/report.json` |
| `--md` | false | Write `ai-auditor-report/report.md` |
| `--url <url>` | - | Run Lighthouse (performance/SEO) audit against this URL |
| `--fix` | false | Auto-fix issues via LLM |
| `--max-fix-iterations <n>` | 2 | Max fix loop iterations |
| `--include <pattern...>` | - | Glob patterns to include |
| `--exclude <pattern...>` | node_modules,dist,.next,coverage,ai-auditor-report | Patterns to exclude |
| `--severity <level>` | - | Minimum severity: low\|medium\|high\|critical |
| `--model <model>` | gpt-4.1-mini | LLM model name |
| `--base-url <url>` | https://api.openai.com | OpenAI-compatible base URL |
| `--api-key <key>` | - | API key |
| `--dry-run` | false | Preview fixes without writing |
| `--verbose` | false | Verbose logging |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | API key for LLM |
| `AI_AUDITOR_BASE_URL` | Override LLM base URL |
| `AI_AUDITOR_MODEL` | Override LLM model |

## Analyzers

| Analyzer | Requires external install | Notes |
|----------|---------------------------|-------|
| ESLint | No (bundled) | Uses project config if present, else `eslint:recommended` |
| TypeScript (tsc) | No (bundled) | Requires `tsconfig.json` in target project |
| Playwright | No (bundled) | Analyzes test files if present |
| Lighthouse | No (bundled) | Runs only when `--url` is provided; checks performance & SEO |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | No issues found |
| 1 | Issues found |
| 2 | Internal error |

## Build & Test

bash
npm run build   # compiles TypeScript to dist/
npm test        # runs Jest test suite
```
