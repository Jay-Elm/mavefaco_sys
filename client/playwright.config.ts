import { defineConfig } from "@playwright/test";
import { e2eDbUrl } from "./e2e/db";

/**
 * End-to-end tests: a real browser against the production build
 * (`npm run test:e2e` builds first), on its own local database
 * `<DATABASE_URL name>_e2e_test`, seeded fresh for each run (e2e/globalSetup.ts).
 *
 * Uses the Chrome already installed on the machine (channel "chrome"), so
 * no browser download is needed; in CI run `npx playwright install chrome`.
 */
const PORT = 3200;
const db = e2eDbUrl();

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  globalSetup: "./e2e/globalSetup.ts",
  // One shared database, so tests run one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: "chrome",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/favicon.ico`,
    stdout: "pipe",
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: db,
      DIRECT_URL: db,
      // Nothing leaves the machine: no emails, no live-update broadcasts.
      BREVO_API_KEY: "",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      SUPABASE_ANON_KEY: "",
      GEMINI_API_KEY: "",
    },
  },
});
