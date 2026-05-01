import type { Command } from "commander";
import { getDaemonStatus, startDaemonProcess } from "../services/daemon.service.js";
import { getDaemonUrl } from "@devness/useai-storage/config";
import { header, success, info, dim } from "../utils/display.js";

export function registerServe(program: Command): void {
  program
    .command("serve")
    .description("Start daemon and open dashboard in browser")
    .action(async () => {
      header("Serve");

      const status = await getDaemonStatus();

      if (!status.running) {
        info("Starting daemon...");
        startDaemonProcess();
        // Brief wait for startup
        await new Promise((r) => setTimeout(r, 1500));
      } else {
        success("Daemon already running.");
      }

      // Read URL after the daemon has had time to start so we pick up any
      // fallback port it had to bind on (it persists the bound port to
      // config before serving traffic).
      const dashboardUrl = await getDaemonUrl();
      info(`Opening dashboard: ${dashboardUrl}`);

      // Open browser (cross-platform)
      const open = process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
          ? "start"
          : "xdg-open";

      const { spawn } = await import("node:child_process");
      spawn(open, [dashboardUrl], { detached: true, stdio: "ignore" }).unref();

      dim("Dashboard is running. Press Ctrl+C to exit.");
      console.log();
    });
}
