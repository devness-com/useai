import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Vite config for true E2E tests.
 * Proxies API calls to the test daemon on port 19201 (not the real daemon on 19200).
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:19201',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:19201',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
  },
});
