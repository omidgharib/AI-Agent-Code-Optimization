import { defineConfig } from "@playwright/test";

const PORT = 4317;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    headless: true,
    channel: "msedge" as const,
    viewport: { width: 1280, height: 900 },
  },
  webServer: {
    command: "npm run web",
    cwd: "..",
    url: `http://127.0.0.1:${PORT}/api/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});