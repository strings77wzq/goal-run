import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "goalrun-core": resolve(__dirname, "../core/src/index.ts"),
      "goalrun-security": resolve(__dirname, "../security/src/index.ts"),
      "goalrun-harness": resolve(__dirname, "../harness/src/index.ts"),
      "goalrun-reporter": resolve(__dirname, "../reporter/src/index.ts"),
    },
  },
  test: {
    name: "goalrun",
    include: ["test/**/*.test.ts"],
  },
});
