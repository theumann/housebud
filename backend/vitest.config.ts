import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.spec.ts"],
    coverage: { provider: "v8" },
    setupFiles: ["tests/setup.ts"],
    reporters: ["verbose"],
    env: {
      NODE_ENV: "test",
    },
  },
});
