import { defineConfig } from "@playwright/test";
import path from "node:path";

const storageStatePath = path.resolve(__dirname, "playwright/.auth/storageState.json");

export default defineConfig({
  globalSetup: "./tests/e2e/global-setup",
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  use: {
    baseURL: "http://localhost:3000",
    storageState: storageStatePath,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev:e2e",
      cwd: "../backend",
      url: "http://localhost:4002/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev",
      cwd: ".",
      url: "http://localhost:3000/login",
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ...process.env,
        NEXT_PUBLIC_API_BASE_URL: "http://localhost:4002",
      },
    },
  ],
});
