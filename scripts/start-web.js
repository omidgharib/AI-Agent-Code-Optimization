const { spawn } = require("node:child_process");
const path = require("node:path");

const certificate = path.resolve(__dirname, "../config/certs/certum-dv-tls-g2-r39-ca.pem");
const child = spawn(process.execPath, [path.resolve(__dirname, "../dist/server/index.js")], {
  stdio: "inherit",
  windowsHide: true,
  env: { ...process.env, NODE_EXTRA_CA_CERTS: certificate },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.once("error", (error) => { console.error(error); process.exitCode = 2; });
child.once("exit", (code, signal) => { process.exitCode = signal ? 2 : code ?? 2; });
