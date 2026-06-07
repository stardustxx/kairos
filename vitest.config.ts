import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["engine/tests/**/*.test.ts", "engine/src/**/*.test.ts"],
    environment: "node",
  },
});
