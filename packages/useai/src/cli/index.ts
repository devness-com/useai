import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { Command } from "commander";

import { startDaemon } from "../daemon/app.js";
import { KEYSTORE_FILE } from "@devness/useai-storage/paths";
import { getDaemonUrl } from "@devness/useai-storage/config";
import {
  detectInstalledTools,
  isToolConfigured,
} from "@devness/useai-tool-installer";

// Injected by tsup at bundle time from packages/useai/package.json.
declare const __VERSION__: string;

import { registerSetup, runSetup } from "./commands/setup.js";
import { registerMcp } from "./commands/mcp.js";

import { registerStats } from "./commands/stats.js";
import { registerStatus } from "./commands/status.js";
import { registerExport } from "./commands/export.js";
import { registerConfig } from "./commands/config.js";
import { registerLogin } from "./commands/login.js";
import { registerLogout } from "./commands/logout.js";
import { registerSync } from "./commands/sync.js";
import { registerUpdate } from "./commands/update.js";

import { registerStart } from "./commands/start.js";
import { registerStop } from "./commands/stop.js";
import { registerRestart } from "./commands/restart.js";
import { registerLogs } from "./commands/logs.js";

import {
  getDaemonStatus,
  startDaemonProcess,
  stopDaemonProcess,
  waitForDaemonReady,
} from "./services/daemon.service.js";
import { info, dim } from "./utils/display.js";

const program = new Command();

program
  .name("useai")
  .description("Track and improve your AI coding sessions")
  .version(__VERSION__);

program.action(async () => {
  const hasKeystore = existsSync(KEYSTORE_FILE);
  const anyConfigured = detectInstalledTools().some((id) =>
    isToolConfigured(id),
  );
  const needsSetup = !hasKeystore || !anyConfigured;

  if (needsSetup) {
    await runSetup({});
  }

  await ensureDaemonRunning();
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
async function ensureDaemonRunning(): Promise<void> {
  const status = await getDaemonStatus();

  if (status.running) {
    if (!status.version || status.version === __VERSION__) return;
    info(`Daemon is on ${status.version}; restarting on ${__VERSION__}…`);
    stopDaemonProcess();
    // Give the OS a moment to release the port before we try to bind it.
    await new Promise((r) => setTimeout(r, 500));
  } else {
    info("Starting daemon…");
  }

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
