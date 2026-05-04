import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "@strings77wzq/goalrun-core",
    include: ["test/**/*.test.ts"],
  },
});
