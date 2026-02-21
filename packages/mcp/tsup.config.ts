import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  target: 'node18',
  dts: false,
  splitting: false,
  clean: true,
  // Bundle everything EXCEPT @inquirer/* and @devness/mcp-setup — they use
  // Node 20+ APIs (styleText from "util") that crash on Node 18/19. They're
  // only needed for the interactive CLI setup flow (dynamically imported).
  noExternal: [/^(?!@inquirer|@devness\/mcp-setup)/],
  banner: {
    js: `import { createRequire as __cr } from 'module'; const require = __cr(import.meta.url);`,
  },
});
