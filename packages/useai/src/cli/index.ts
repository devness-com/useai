import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { Command } from "commander";

import { startDaemon } from "../daemon/app.js";
import { KEYSTORE_FILE } from "@devness/useai-storage/paths";
import { getDaemonUrl } from "@devness/useai-storage/config";

// Injected by tsup at bundle time from packages/useai/package.json.
declare const __VERSION__: string;

import { registerSetup, runSetup } from "./commands/setup.js";
import { registerMcp }              from "./commands/mcp.js";

import { registerStats }      from "./commands/stats.js";
import { registerStatus }     from "./commands/status.js";
import { registerExport }     from "./commands/export.js";
import { registerConfig }     from "./commands/config.js";
import { registerLogin }      from "./commands/login.js";
import { registerLogout }     from "./commands/logout.js";
import { registerSync }       from "./commands/sync.js";
import { registerUpdate }     from "./commands/update.js";

import { registerStart }   from "./commands/start.js";
import { registerStop }    from "./commands/stop.js";
import { registerRestart } from "./commands/restart.js";
import { registerLogs }    from "./commands/logs.js";

import {
  getDaemonStatus,
  startDaemonProcess,
  waitForDaemonReady,
} from "./services/daemon.service.js";
import { info, dim } from "./utils/display.js";

const program = new Command();

program
  .name("useai")
  .description("Track and improve your AI coding sessions")
  .version(__VERSION__);

// Bare `useai` is the smart entrypoint:
//   - First run (no keystore yet) → run the setup wizard, then ensure the
//     daemon is running, then open the dashboard in the browser.
//   - Returning user → just make sure the daemon is up and open the dashboard.
//
// We treat the keystore file as the "has the user ever set this up" marker
// because the first MCP/daemon interaction always lazily creates one. There
// is no dedicated `keystoreExists()` helper in @devness/useai-storage today,
// so we fall back to a direct fs.existsSync check on KEYSTORE_FILE.
program.action(async () => {
  const isFirstRun = !existsSync(KEYSTORE_FILE);

  if (isFirstRun) {
    await runSetup({});
  }

  await ensureDaemonRunning();
  // Read the dashboard URL AFTER the daemon has come up. The daemon may have
  // had to fall back from port 19200 onto 19201–19210 if the preferred port
  // was busy, and it persists the actually-bound port to config before it
  // starts serving traffic. Reading from config here guarantees we open the
  // browser at the URL the daemon is really listening on, not the static
  // default.
  const dashboardUrl = await getDaemonUrl();
  openDashboard(dashboardUrl);
});

// Top-level commands (the 13 visible ones).
registerSetup(program);
registerStatus(program);
registerStart(program);
registerStop(program);
registerRestart(program);
registerLogs(program);
registerStats(program);
registerLogin(program);
registerLogout(program);
registerSync(program);
registerConfig(program);
registerUpdate(program);

// Hidden internals — registered for runtime use but not advertised in --help.
registerMcp(program);
registerExport(program);

// Hidden: useai daemon-run starts the HTTP server in-process. Used internally
// by `useai start` to spawn a detached background daemon — not for direct
// user invocation.
program
  .command("daemon-run", { hidden: true })
  .description("(internal) Run the daemon HTTP server in-process")
  .action(async () => {
    await startDaemon();
  });

program.parseAsync().catch((err: unknown) => {
  const msg = err instanceof Error ? err.message : String(err);
  process.stderr.write(`useai: ${msg}\n`);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Helpers for the bare `useai` action.
// ---------------------------------------------------------------------------

/**
 * Ensure the daemon is running before we open the dashboard. If it is already
 * up we just confirm it; if not, we kick a detached process and wait briefly.
 * We deliberately avoid blocking forever — if the daemon takes more than ~10 s
 * to come up, the dashboard will still load and surface the error itself.
 */
async function ensureDaemonRunning(): Promise<void> {
  const status = await getDaemonStatus();
  if (status.running) return;

  info("Starting daemon…");
  startDaemonProcess();
  await waitForDaemonReady(10_000);
}

/**
 * Open the local dashboard URL in the user's default browser. Cross-platform
 * via the `open` (macOS), `start` (Windows), or `xdg-open` (Linux) command.
 */
function openDashboard(url: string): void {
  info(`Opening dashboard: ${url}`);
  const opener =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open";
  spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
  dim("Dashboard is running. Press Ctrl+C to exit.");
  console.log();
}
