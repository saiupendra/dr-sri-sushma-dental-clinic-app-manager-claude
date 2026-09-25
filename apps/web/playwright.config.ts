import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

const apiDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../api");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "list" : "html",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: "http://localhost:4173",
    trace: "retain-on-failure",
    // In the Claude Code cloud sandbox, browsers are pre-installed at a fixed
    // path rather than the exact revision this Playwright version expects;
    // set CHROMIUM_PATH=/opt/pw-browsers/chromium to use it instead of
    // downloading. CI (with real `playwright install`) leaves this unset.
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  // Tests run against a production build + preview (not `vite dev`), so the
  // service worker behaves the way it will for real users, and against a
  // freshly migrated local D1 so every run starts from the same clean state.
  webServer: [
    {
      command:
        "rm -rf .wrangler/state/v3/d1 && npm run db:migrate:local && npm run dev",
      cwd: apiDir,
      url: "http://localhost:8787/health",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run build -- --mode test && npm run preview",
      url: "http://localhost:4173",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
