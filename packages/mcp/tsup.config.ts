import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  dts: false,
  splitting: false,
  clean: true,
  // Bundle everything EXCEPT @clack/* and @devness/mcp-setup — they're only
  // needed for interactive CLI setup and tool registry (dynamically imported).
  // @devness/mcp-setup internally uses @inquirer/prompts which needs Node 20+.
  noExternal: [/^(?!@clack|@devness\/mcp-setup|@inquirer)/],
  banner: {
    js: `import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);`,
  },
});
