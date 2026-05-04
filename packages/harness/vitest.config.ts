import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@goalrun/core": resolve(__dirname, "../core/src/index.ts"),
      "@goalrun/security": resolve(__dirname, "../security/src/index.ts"),
    },
  },
  test: {
    name: "@goalrun/harness",
    include: ["test/**/*.test.ts"],
  },
});
