import type { Command } from "commander";
import { stopDaemonProcess, getDaemonStatus } from "../services/daemon.service.js";
import { success, fail, dim } from "../utils/display.js";

export function registerStop(program: Command): void {
  program
    .command("stop")
    .description("Stop the daemon")
    .action(async () => {
      const status = await getDaemonStatus();
      if (!status.running) {
        dim("Daemon is not running.");
        return;
      }
      const stopped = stopDaemonProcess();
      if (stopped) {
        success("Daemon stopped.");
      } else {
        fail("Could not stop daemon. PID file not found.");
      }
    });
}
