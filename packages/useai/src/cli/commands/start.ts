import type { Command } from "commander";
import {
  getDaemonStatus,
  startDaemonProcess,
  waitForDaemonReady,
} from "../services/daemon.service.js";
import { success, fail, info, spinner } from "../utils/display.js";
import { enableAutostart } from "./lib/autostart.js";

export function registerStart(program: Command): void {
  program
    .command("start")
    .description("Start the daemon")
    .option(
      "--boot",
      "Also install autostart so the daemon survives reboots",
    )
    .action(async (opts: { boot?: boolean }) => {
      // --boot is additive: install autostart first, then make sure the
      // daemon is actually running right now. The two flows compose cleanly
      // because installAutostart() already kicks the service on macOS/Linux.
      if (opts.boot) {
        enableAutostart();
      }

      const status = await getDaemonStatus();
      if (status.running) {
        info(`Daemon already running at ${status.url}`);
        return;
      }
      try {
        startDaemonProcess();
        const stop = spinner("Waiting for daemon to come online…");
        const after = await waitForDaemonReady(10_000);
        stop();
        if (after.running) {
          success(`Daemon started at ${after.url}`);
        } else {
          fail("Daemon started but health check failed. Check logs: useai logs");
        }
      } catch (err) {
        fail(`Failed to start daemon: ${err}`);
      }
    });
}
