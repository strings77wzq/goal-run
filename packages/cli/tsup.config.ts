import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  external: ['fast-glob', 'gray-matter'],
  noExternal: [/goalrun-/],
  clean: true,
});
