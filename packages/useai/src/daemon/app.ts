import { serve } from "@hono/node-server";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { createApp } from "./core/router.js";
import { ensureDir, migrateV1IfNeeded } from "@devness/useai-storage";
import {
  DATA_DIR,
  DAEMON_PORT,
  DAEMON_HOST,
  DAEMON_PID_FILE,
} from "@devness/useai-storage/paths";
// import { startSyncScheduler } from "./sync-scheduler.js";

function writePidFile(): void {
  try {
    writeFileSync(DAEMON_PID_FILE, String(process.pid), "utf-8");
  } catch {
    // Non-fatal: status display loses the PID row but the daemon still serves.
  }
}

function clearPidFile(): void {
  try {
    if (existsSync(DAEMON_PID_FILE)) unlinkSync(DAEMON_PID_FILE);
  } catch { /* ignore */ }
}

/**
 * Install signal handlers so the daemon shuts down with exit code 0 on
 * SIGTERM/SIGINT/SIGHUP. launchd's `KeepAlive {SuccessfulExit:false}` treats
 * a non-zero exit as a crash and restarts the process — the default signal
 * handler exits with 128+signo, which would loop forever under autostart.
 */
function installSignalHandlers(): void {
  const shutdown = () => {
    clearPidFile();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  process.on("SIGHUP", shutdown);
  process.on("exit", clearPidFile);
}

export async function startDaemon(): Promise<void> {
  await ensureDir(DATA_DIR);

  // One-time migration: convert legacy v1 UUID-named sealed sessions into
  // v3 date-bucketed jsonl files. Idempotent — re-runs are a no-op.
  try {
    const result = await migrateV1IfNeeded();
    if (result.migrated > 0) {
      console.log(
        `migrating ${result.migrated} v1 sessions → date buckets, archiving originals to sealed.v1-archive/`,
      );
    }
    if (result.warnings > 0) {
      console.warn(
        `v1 migration: ${result.warnings} source file(s) could not be parsed, see ~/.useai/data/.migrate-v1-warnings.log`,
      );
    }
  } catch (err) {
    // Migration failure must not block the daemon — the v1 reader still works.
    console.error("v1 migration failed (non-fatal):", err);
  }

  writePidFile();
  installSignalHandlers();

  const app = createApp();

  // Start background sync scheduler
  // startSyncScheduler();

  serve(
    { fetch: app.fetch, port: DAEMON_PORT, hostname: DAEMON_HOST },
    (info) => {
      console.log(`useai daemon running at ${info.address}:${info.port}`);
      console.log(`MCP endpoint: ${info.address}:${info.port}/mcp`);
      console.log(`Dashboard API: ${info.address}:${info.port}/api/local/`);
    },
  );
}
