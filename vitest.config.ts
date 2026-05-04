import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      'packages/core',
      'packages/security',
      'packages/harness',
      'packages/reporter',
      'packages/cli',
    ],
  },
});
