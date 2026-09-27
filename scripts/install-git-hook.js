const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const gitDir = path.join(root, ".git");
if (!fs.existsSync(gitDir)) throw new Error("Run this command from a Git repository root");
const hook = path.join(gitDir, "hooks", "pre-push");
if (fs.existsSync(hook)) throw new Error("A pre-push hook already exists; refusing to overwrite it");
fs.writeFileSync(hook, "#!/bin/sh\nnpx ai-auditor audit . --changed-only --max-critical 0 --fail-on-new --sarif\n", { mode: 0o755, flag: "wx" });
console.log(`Installed ${hook}`);
