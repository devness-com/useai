import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: ['./src/vitest-setup.ts'],
    env: {
      // Safety net: redirect all @useai/shared path constants to a temp directory.
      // Even if a test forgets to mock paths, this prevents writes to ~/.useai/.
      USEAI_HOME: '/tmp/useai-test',
    },
    exclude: ['dist/**', 'node_modules/**'],
    server: {
      deps: {
        // Inline @devness/mcp-setup so vi.mock('node:fs'), vi.mock('node:os'), etc.
        // propagate into it (the package lives in node_modules and wouldn't
        // normally pick up the test's module-level mocks).
        inline: [/@devness\/mcp-setup/],
      },
    },
  },
});
