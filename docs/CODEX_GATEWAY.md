# Codex Local Gateway

Select **Codex Local Gateway** in the AI provider picker. The backend uses the Responses API, health checks and authenticated model discovery. Patch generation, repair and architecture reviews use read-only gateway tasks; AI Auditor validates and applies returned patches itself. No caller-owned functions are enabled.

Enter the token in the password field and click Load models. A successful connection keeps the token only in backend memory until server restart; it is never written to browser storage or disk. Environment configuration is also supported.

Set these variables in the shell that starts AI Auditor:

- LOCAL_CODEX_GATEWAY_TOKEN: the operator-provided gateway bearer token; never enter it in chat or commit it.
- CODEX_GATEWAY_URL: gateway address, default http://127.0.0.1:14317.
- AI_AUDITOR_REQUEST_TIMEOUT_MS: optional request timeout, default 310000 for this provider.

AI Auditor and gateway need separate ports. This installation uses gateway port 14317 and AI Auditor port 4318 (AI_AUDITOR_UI_PORT=4318). Set CODEX_GATEWAY_URL if your gateway address differs. Restart AI Auditor after setting its environment.

CLI: ai-auditor audit . --fix --provider codex-gateway --dry-run

An omitted model uses the gateway's Codex default. The dashboard selects the default model returned by GET /v1/models. Tokens stay in the local backend and are passed only to the audit child process for this provider.

Source contract: https://github.com/omidgharib/codex-local-gateway/blob/main/README.md
