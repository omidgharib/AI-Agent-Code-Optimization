# Dependency graph snapshot

Snapshot: 2026-09-03. Static relative imports in `src/`; Node/external imports omitted.

```text
cli -> core
server -> analyzers, core, fix, normalize, seo, verify
core -> analyzers, fix, normalize, prioritize, report, verify
analyzers -> core, report, seo
seo -> analyzers, core
fix -> core, fix
normalize -> core
prioritize -> core
report -> analyzers, core, report
verify -> analyzers, core
tests -> analyzers, core, fix, normalize, prioritize, report, seo, verify
```

Cycles (`core/analyzers`, `core/fix`, `core/report`, `analyzers/report`, `analyzers/seo`) show current directories are not enforceable domains. [Target rules](dependency-rules.md) remove them through contracts/ports. Reproduce: `rg '^import |^export .* from ' src -n`.
