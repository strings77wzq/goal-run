import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'goalrun-core',
    include: ['test/**/*.test.ts'],
  },
});
