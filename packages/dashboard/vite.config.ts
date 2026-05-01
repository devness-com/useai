import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev-mode proxy targets. In production the dashboard is bundled and served
// by the daemon itself, so port collisions are handled there. For `pnpm dev`,
// override this with VITE_DAEMON_PORT if your local daemon had to fall back
// off 19200.
const DEV_DAEMON_PORT = process.env["VITE_DAEMON_PORT"] ?? "19200";
const DEV_DAEMON = `http://127.0.0.1:${DEV_DAEMON_PORT}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": DEV_DAEMON,
      "/health": DEV_DAEMON,
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});
