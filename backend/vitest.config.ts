import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: { provider: "v8" },
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
