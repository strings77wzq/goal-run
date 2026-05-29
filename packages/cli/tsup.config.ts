import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  external: ['fast-glob'],
  noExternal: [/goalrun-/, 'gray-matter'],
  clean: true,
});
