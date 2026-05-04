import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@goalrun/core": resolve(__dirname, "../core/src/index.ts"),
    },
  },
  test: {
    name: "@goalrun/reporter",
    include: ["test/**/*.test.ts"],
  },
});
