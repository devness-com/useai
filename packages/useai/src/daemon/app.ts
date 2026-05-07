import { serve } from "@hono/node-server";
import type { Hono } from "hono";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { createApp } from "./core/router.js";
import { resolveDaemonPort } from "./core/port-resolver.js";
import { ensureDir, migrateV1IfNeeded } from "@devness/useai-storage";
import { getDaemonPort, setDaemonPort } from "@devness/useai-storage/config";
import {
  DATA_DIR,
  DAEMON_HOST,
  DAEMON_PID_FILE,
} from "@devness/useai-storage/paths";
import {
  installCrashHandlers,
  runBootRollbackCheck,
  startAutoUpdater,
} from "./core/auto-updater.js";
import { startActiveSessionsSweeper } from "./core/active-sessions.js";
import { refreshToolInstructionsIfStale } from "./core/refresh-tool-instructions.js";
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

/**
 * Read the preferred port. Priority:
 *   1. USEAI_PORT env var — explicit override, useful for tests and dev
 *      where you want to pin the daemon to a known port.
 *   2. config.daemon.port — what the resolver chose last time. Sticky so
 *      tools that already wrote the URL into their MCP config keep working.
 *   3. undefined — let the resolver start from the default 19200.
 */
async function readPreferredPort(): Promise<number | undefined> {
  const fromEnv = process.env["USEAI_PORT"];
  if (fromEnv) {
    const parsed = Number(fromEnv);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return getDaemonPort();
}

/**
 * Launch the HTTP server on the given port. The returned promise resolves
 * with the actual bound port (which may differ from the requested one if
 * `serve()` reports a different value), or rejects with the original error
 * — `EADDRINUSE` in particular bubbles up so the caller can re-resolve and
 * retry once (covers the race between port-probe and bind).
 */
function listen(app: Hono, port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const server = serve(
      { fetch: app.fetch, port, hostname: DAEMON_HOST },
      (info) => {
        resolved = true;
        console.log(`useai daemon running at ${info.address}:${info.port}`);
        console.log(`MCP endpoint: ${info.address}:${info.port}/mcp`);
        console.log(`Dashboard API: ${info.address}:${info.port}/api/local/`);
        resolve(info.port);
      },
    );

    server.on("error", (err: NodeJS.ErrnoException) => {
      if (resolved) return; // post-startup errors are not our concern here
      reject(err);
    });
  });
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

  // Catch any fatal so the supervisor can respawn us — and the new boot
  // can decide whether the previous self-update should be rolled back.
  installCrashHandlers();

  // After the PID file is in place but BEFORE the HTTP server starts:
  // inspect any pending probation record and roll back if the previous
  // self-update is showing crash-loop symptoms.
  runBootRollbackCheck();

  // Start background sync scheduler
  // startSyncScheduler();

  const app = createApp();
  const preferred = await readPreferredPort();
  const actualPort = await listenWithRetry(app, preferred);

  // Persist the actual bound port so every other process (CLI, dashboard
  // proxy, tool-installer) can reach the daemon. Best-effort — if the
  // config write fails the daemon still serves; the next start will just
  // re-resolve from scratch.
  try {
    await setDaemonPort(actualPort);
  } catch (err) {
    console.warn(
      `useai daemon: bound on ${actualPort} but failed to persist port to config: ${(err as Error).message}`,
    );
  }

  // Fire-and-forget: schedule the auto-update loop. Never blocks
  // daemon startup. First check fires after a 5-minute warm-up.
  // Placed AFTER listenWithRetry resolves, so the server is already
  // serving by the time the schedule kicks off — equivalent to the
  // serve(...) callback timing.
  startAutoUpdater();

  // Periodic eviction of stale useai sessions (registered via useai_start
  // but never sealed because the client crashed or was killed). Without
  // this, /health.active_sessions would drift upward as orphaned records
  // accumulate.
  startActiveSessionsSweeper();

  // Fire-and-forget: if this daemon is running a newer version than the
  // last time tool instructions were refreshed, re-inject them now. Covers
  // every upgrade path (`npx @latest`, auto-updater rotation, autostart
  // launcher boot) without each one having to remember to call us.
  refreshToolInstructionsIfStale().catch(() => {
    /* already logged inside */
  });
}

/**
 * Resolve a port, bind on it, and on `EADDRINUSE` re-resolve once and retry.
 *
 * The resolver's probe is inherently racy: another process can grab the
 * port between the probe and `serve()`'s real bind. One re-resolve covers
 * the common case (the now-taken port gets skipped on the second pass).
 * Anything else, or a second failure, exits the process with a descriptive
 * message — better than letting the rejection bubble out unhandled and
 * leaving launchd/systemd to retry every 10 seconds forever.
 */
async function listenWithRetry(app: Hono, preferred: number | undefined): Promise<number> {
  const firstPort = await resolveDaemonPort(preferred);
  try {
    return await listen(app, firstPort);
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code !== "EADDRINUSE") {
      console.error(`useai daemon: failed to start: ${(err as Error).message}`);
      process.exit(1);
    }
    console.warn(
      `useai daemon: port ${firstPort} was taken between probe and bind, re-resolving…`,
    );
  }

  const retryPort = await resolveDaemonPort(preferred);
  try {
    return await listen(app, retryPort);
  } catch (retryErr: unknown) {
    console.error(
      `useai daemon: failed to start after retry: ${(retryErr as Error).message}`,
    );
    process.exit(1);
  }
}
