# Optional Chrome MCP testing

AI Auditor does not require MCP at runtime. Playwright and Lighthouse remain the
portable analyzers used by the CLI and Web UI. Chrome MCP is an optional
development controller for interactive UI checks.

## Setup

1. Start AI Auditor with `npm run build:all` and `npm run web`.
2. Open Codex **Settings → Computer use** and connect the Chrome browser extension.
3. Ask Codex to test `http://127.0.0.1:4317` using Chrome MCP.
4. The controller can discover the stable selector contract at
   `GET /api/browser-test-contract`.

## Recommended smoke journey

1. Confirm `/api/health` returns `{ "ok": true }`.
2. Switch Persian/English and verify `html[lang]` and `html[dir]`.
3. Open the folder browser and confirm it is a modal dialog.
4. Enter a JS/TS project path and, for a web project, its running URL.
5. Select provider/model, enable dry-run, and start an audit.
6. Wait for the live status to become completed or failed.
7. Verify live logs contain analyzer output and that the issue list updates.

## Safety boundary

- MCP controls only the local UI; it is not called by the audit engine.
- Source analysis remains local and uses the existing server API.
- API keys are server-side and are never returned by the browser-test contract.
- Write-enabled fixes still pass through path checks, transactions and verification.
