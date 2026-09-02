// FILE: README.md

# ai-auditor

CLI tool for AI-powered code auditing and auto-fixing.

## Local Web UI

The project includes a bilingual React dashboard for auditing local JavaScript and TypeScript projects. After installing the root and `ui/` dependencies, run:

```bash
npm run build:all
npm run web
```

Open `http://127.0.0.1:4317`. The server binds to loopback, accepts directories with a valid `package.json`, starts the auditor without a command shell, streams progress, and exposes the generated JSON report. See `docs/WEB_UI_ROADMAP.md` for the phased implementation plan.

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

# Auto-fix with a free local model (Ollama, no API key)
ai-auditor audit . --fix --provider ollama

# Auto-fix with a free hosted model (e.g. Groq free tier)
ai-auditor audit . --fix --provider groq --api-key gsk-...

# AIFA (token and end-user ID are supplied by the user)
ai-auditor audit . --fix --provider aifa --api-key <access-token> --aifa-user-id <user-id>

# List all model providers
ai-auditor audit . --list-models

# Filter by severity
ai-auditor audit . --severity high

# Dry run (preview patches only)
ai-auditor audit . --fix --dry-run

# Skip the mechanical ESLint autofix pre-pass
ai-auditor audit . --fix --no-mechanical

# Exclude patterns
ai-auditor audit . --exclude node_modules dist .next

# Verbose output
ai-auditor audit . --verbose

# Include Lighthouse performance/SEO audit for a live URL
ai-auditor audit . --url https://example.com --json --md

# Auto-fix with a free local model (Ollama, no API key)
ai-auditor audit . --fix --provider ollama

# Auto-fix with a free hosted model (e.g. Groq free tier)
ai-auditor audit . --fix --provider groq --api-key gsk-...

# Auto-fix with any OpenAI-compatible model
ai-auditor audit . --fix --model gpt-4o --base-url https://api.openai.com

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--json` | false | Write `ai-auditor-report/report.json` |
| `--md` | false | Write `ai-auditor-report/report.md` |
| `--url <url>` | - | Run Lighthouse (performance/SEO) audit against this URL |
| `--fix` | false | Auto-fix issues via LLM (mechanical ESLint pre-pass runs first) |
| `--no-mechanical` | false | Skip the mechanical ESLint autofix pre-pass (only with `--fix`) |
| `--max-fix-iterations <n>` | 2 | Max fix loop iterations |
| `--include <pattern...>` | - | Glob patterns to include |
| `--exclude <pattern...>` | node_modules,dist,.next,coverage,ai-auditor-report | Patterns to exclude |
| `--severity <level>` | - | Minimum severity: low\|medium\|high\|critical |
| `--model <model>` | llama3.2 | LLM model name |
| `--provider <id>` | auto | Model provider preset (see Models & Providers below) |
| `--base-url <url>` | provider default | OpenAI-compatible base URL |
| `--api-key <key>` | - | API key |
| `--aifa-user-id <id>` | - | Required AIFA end-user ID (`x-user-id`) |
| `--aifa-session-id <id>` | - | Optional AIFA conversation session ID |
| `--list-models` | - | Print available model providers and exit |
| `--dry-run` | false | Preview fixes without writing |
| `--verbose` | false | Verbose logging |

## Models & Providers

You can pass any OpenAI-compatible model with `--model`, `--base-url`, and
`--api-key`, or pick a provider preset with `--provider <id>`. Run
`ai-auditor audit . --list-models` to see all presets.

Built-in presets (with free defaults):

| Provider | Default model | Free | Key required | Key env var |
|----------|---------------|------|--------------|-------------|
| `ollama` | llama3.2 | yes (local) | no | - |
| `openrouter` | openai/gpt-oss-20b:free | yes | yes | `OPENROUTER_API_KEY` |
| `groq` | llama-3.3-70b-versatile | yes | yes | `GROQ_API_KEY` |
| `gemini` | gemini-2.5-flash | yes | yes | `GEMINI_API_KEY` |
| `mistral` | open-mistral-nemo | yes | yes | `MISTRAL_API_KEY` |
| `cerebras` | llama-3.3-70b | yes | yes | `CEREBRAS_API_KEY` |
| `zhipu` | glm-4.7-flash | yes | yes | `ZHIPU_API_KEY` |
| `dashscope` | qwen-flash | yes | yes | `DASHSCOPE_API_KEY` |
| `cloudflare` | @cf/qwen/qwen2.5-coder-32b-instruct | yes | yes | `CF_API_TOKEN` (+ `CF_ACCOUNT_ID`, `CF_GATEWAY_SLUG`) |
| `openai` | gpt-4.1-mini | no | yes | `OPENAI_API_KEY` |
| `aifa` | assistance-model | no | yes | `AIFA_ACCESS_TOKEN` |
| `deepseek` | deepseek-chat | no | yes | `DEEPSEEK_API_KEY` |
| `custom` | gpt-4.1-mini | - | depends | - |

**Default resolution:** if no `--provider`/`--model`/`--base-url` is given, a
set `OPENAI_API_KEY` selects `openai` (gpt-4.1-mini); otherwise the first free
provider whose key env var is set is auto-selected (`DASHSCOPE_API_KEY`,
`ZHIPU_API_KEY`, `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`,
`MISTRAL_API_KEY`, `CEREBRAS_API_KEY`, `CF_API_TOKEN` — in that order). With no
key configured at all, the free local `ollama` provider is used so `--fix`
works out of the box — just make sure Ollama is running (`ollama serve`) and the
model is pulled (`ollama pull llama3.2`). Local endpoints
(`localhost`/`127.0.0.1`) never require an API key.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | API key for OpenAI |
| `AIFA_ACCESS_TOKEN` | User-provided AIFA bearer token |
| `AIFA_USER_ID` | Required AIFA end-user ID (`x-user-id`) |
| `AIFA_SESSION_ID` | Optional AIFA conversation session ID |
| `OPENROUTER_API_KEY` | API key for OpenRouter free models |
| `GROQ_API_KEY` | API key for Groq free tier |
| `GEMINI_API_KEY` | API key for Google AI Studio free tier |
| `MISTRAL_API_KEY` | API key for Mistral free tier |
| `CEREBRAS_API_KEY` | API key for Cerebras free tier |
| `ZHIPU_API_KEY` | API key for Zhipu GLM free flash model |
| `DASHSCOPE_API_KEY` | API key for Alibaba Qwen (qwen-flash, free) |
| `CF_API_TOKEN` | Cloudflare API token (Workers AI) |
| `CF_ACCOUNT_ID` | Cloudflare account id (needed for AI Gateway) |
| `CF_GATEWAY_SLUG` | Cloudflare AI Gateway slug (needed for AI Gateway) |
| `DEEPSEEK_API_KEY` | API key for DeepSeek |
| `AI_AUDITOR_BASE_URL` | Override LLM base URL |
| `AI_AUDITOR_MODEL` | Override LLM model |
| `AI_AUDITOR_PROVIDER` | Override model provider preset |

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
