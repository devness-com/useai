import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  dts: false,
  splitting: false,
  clean: true,
  noExternal: ['@useai/shared'],
});
