import { defineConfig, devices } from "@playwright/test";

if (process.env.E2E_RUN !== "1" || process.env.E2E_BASE_URL !== "http://127.0.0.1:3199") {
  throw new Error("Use npm run test:e2e to start a fresh isolated database and app.");
}
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 10000 },
  forbidOnly: !!process.env.CI,
  reporter: [["list"], ["html", { open: "never" }]],
  use: { baseURL: process.env.E2E_BASE_URL, actionTimeout: 10000, navigationTimeout: 15000, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "chromium" } },
  ],
});
