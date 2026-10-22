import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const storageStatePath = path.resolve(
  __dirname,
  "playwright/.auth/storageState.json",
);

export default defineConfig({
  globalSetup: "./tests/e2e/global-setup",
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  // Specs that change data use fresh users (utils/users.ts), so they can run
  // side by side; the seed users are only read.
  workers: process.env.CI ? "100%" : 4,
  // In CI, one retry records a trace and marks the test "flaky" in the HTML
  // report (uploaded as an artifact) instead of failing the run on a fluke.
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }], ["github"]]
    : "list",
  use: {
    baseURL: "http://localhost:3000",
    storageState: storageStatePath,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Phones are emulated (viewport, touch, user agent) on the desktop engines:
  // Chromium for Android, WebKit for iOS. Tests tagged @desktop or @phone run
  // only on those projects.
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      grepInvert: /@phone/,
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
      grepInvert: /@phone/,
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      grepInvert: /@phone/,
    },
    {
      name: "pixel-7",
      use: { ...devices["Pixel 7"] },
      grepInvert: /@desktop/,
    },
    {
      name: "iphone-14",
      use: { ...devices["iPhone 14"] },
      grepInvert: /@desktop/,
    },
  ],
  webServer: [
    {
      command: "npm run dev:e2e",
      cwd: "../backend",
      url: "http://localhost:4002/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      // A production build: `next dev` compiles each page on its first
      // request, which made parallel workers time out.
      command: "npm run build && npm run start -- -p 3000",
      cwd: ".",
      url: "http://localhost:3000/login",
      reuseExistingServer: false,
      timeout: 240_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:4002",
      },
    },
  ],
});
