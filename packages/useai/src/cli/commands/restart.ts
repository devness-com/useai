import type { Command } from "commander";
import {
  stopDaemonProcess,
  startDaemonProcess,
  waitForDaemonReady,
} from "../services/daemon.service.js";
import { success, fail, info, spinner } from "../utils/display.js";

export function registerRestart(program: Command): void {
  program
    .command("restart")
    .description("Restart the daemon")
    .action(async () => {
      info("Stopping daemon…");
      stopDaemonProcess();
      await new Promise((r) => setTimeout(r, 500));

      info("Starting daemon…");
      try {
        startDaemonProcess();
        const stop = spinner("Waiting for daemon to come online…");
        const status = await waitForDaemonReady(10_000);
        stop();
        if (status.running) {
          success(`Daemon restarted at ${status.url}`);
        } else {
          fail("Daemon started but health check failed.");
        }
      } catch (err) {
        fail(`Failed to start daemon: ${err}`);
      }
    });
}
