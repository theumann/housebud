import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    coverage: { provider: "v8" },
    setupFiles: ["tests/setup.ts"],
    // The setup pushes the schema for every test file; under parallel workers
    // that can take longer than the default 10s.
    hookTimeout: 60_000,
    reporters: ["verbose"],
    env: {
      NODE_ENV: "test",
    },
  },
});
