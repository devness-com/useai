import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  server: {
    port: 5174,
    proxy: {
      // Cloud API proxy (dev only) — auth & sync bypass the daemon
      '/cloud-api': {
        target: 'http://localhost:3010',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cloud-api/, ''),
      },
      // Everything else goes to the production daemon
      '/api': {
        target: 'http://127.0.0.1:19200',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://127.0.0.1:19200',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'es2020',
    minify: 'terser',
  },
});
