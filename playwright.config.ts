import { defineConfig, devices } from "@playwright/test";

/**
 * Sevent end-to-end tests.
 *
 * Assumes:
 *   - Local Supabase stack is running (pnpm db:start), seeded (pnpm seed),
 *     and the dev server is up on http://localhost:3000.
 *   - The env vars NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
 *     are exported in the shell that launches Playwright (the helpers in
 *     e2e/helpers/db.ts read them to bypass RLS for fast-forward and
 *     fixture setup).
 *
 * Tests are NOT run against production (seventsa.com). They're scoped to
 * local-dev where SQL fast-forwards are safe.
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // serial — tests share fixture state via DB
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 20_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
