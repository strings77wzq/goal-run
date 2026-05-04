import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@strings77wzq/goalrun-core": resolve(__dirname, "../core/src/index.ts"),
      "@strings77wzq/goalrun-security": resolve(__dirname, "../security/src/index.ts"),
      "@strings77wzq/goalrun-harness": resolve(__dirname, "../harness/src/index.ts"),
      "@strings77wzq/goalrun-reporter": resolve(__dirname, "../reporter/src/index.ts"),
    },
  },
  test: {
    name: "@strings77wzq/goalrun",
    include: ["test/**/*.test.ts"],
  },
});
