import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@strings77wzq/goalrun-core": resolve(__dirname, "../core/src/index.ts"),
    },
  },
  test: {
    name: "@strings77wzq/goalrun-security",
    include: ["test/**/*.test.ts"],
  },
});
