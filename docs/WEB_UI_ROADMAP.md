# Local Web UI roadmap

The web application is intentionally limited to JavaScript and TypeScript projects. It binds to `127.0.0.1`, requires a valid `package.json`, and never uploads a repository to a hosted service.

## Phase 1 — Local runtime and safety

- [x] Local HTTP API bound to loopback only
- [x] Canonical project-path validation
- [x] JavaScript/TypeScript project gate (`package.json` required)
- [x] Audits launched without a command shell
- [x] In-memory job registry, cancellation, bounded logs, and report endpoint
- [ ] Harden `diffApplier` against traversal, `.git`, secrets, and lockfiles
- [ ] Add Git worktree/snapshot rollback before write-enabled fixes

## Phase 2 — Bilingual React dashboard

- [x] Responsive React/Vite application
- [x] Persian and English copy with RTL/LTR switching
- [x] Project path, severity, AI-fix, and dry-run controls
- [x] Issue summary, severity filtering, live output, and recent jobs
- [x] Language preference persisted locally
- [x] Cross-platform local folder browser with `package.json` validation
- [ ] Dark/light themes and accessibility audit

## Phase 3 — Audit workflow

- [x] Server-sent events for live status and logs
- [x] Cancellation and JSON report loading
- [ ] Persist job history across server restarts
- [ ] Dedicated issue detail view with evidence and source excerpt
- [ ] Before/after metrics and downloadable reports
- [x] Lighthouse target URL control and CLI wiring
- [ ] Lighthouse result visualization

## Phase 4 — Controlled optimization

- [x] Provider/model selector with live OpenAI-compatible model discovery
- [x] ForgetMeAI preset (`http://127.0.0.1:9655`) and live model status
- [ ] Reviewable unified diff per patch
- [ ] Per-patch approve/reject controls
- [ ] Test/build command detection and verification output
- [ ] Rollback failed verification
- [x] Provider/model settings without exposing API keys to the browser
- [ ] End-to-end tests for audit, preview, apply, verify, and rollback
- [x] Optional Chrome MCP test contract with stable selectors (no runtime dependency)

## Local commands

```text
npm install
cd ui && npm install
npm run build:all
npm run web
```

The dashboard is available at `http://127.0.0.1:4317`.

Optional interactive Chrome testing is documented in
[`MCP_CHROME_TESTING.md`](MCP_CHROME_TESTING.md).
