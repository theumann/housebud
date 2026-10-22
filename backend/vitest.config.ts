import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      // The app's code; server.ts only starts it, and the seed scripts
      // aren't part of what's served.
      include: ["src/**/*.ts"],
      exclude: ["src/server.ts", "src/types/**"],
      reporter: ["text-summary", "html", "json-summary"],
      // A few points under the coverage when they were set (2026-10-22:
      // statements 89.5, branches 81.9, functions 96.6, lines 90.7), so
      // untested new code fails the run but small changes don't.
      thresholds: { statements: 87, branches: 79, functions: 94, lines: 88 },
    },
    reporters: ["verbose"],
    env: {
      NODE_ENV: "test",
    },
    projects: [
      {
        // Pure functions (dates, splits, balances): no database, no setup.
        extends: true,
        test: {
          name: "unit",
          include: ["tests/unit/**/*.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "api",
          include: ["tests/api/**/*.test.ts", "tests/scripts/**/*.test.ts"],
          setupFiles: ["tests/setup.ts"],
          // The setup pushes the schema for every test file; under parallel
          // workers that can take longer than the default 10s.
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
