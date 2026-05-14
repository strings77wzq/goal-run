import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  external: ['fast-glob', 'gray-matter'],
  noExternal: [/goalrun-/],
  clean: true,
});
