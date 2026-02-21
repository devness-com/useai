import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
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
