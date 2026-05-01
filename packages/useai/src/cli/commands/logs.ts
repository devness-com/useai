import type { Command } from "commander";
import { readFileSync, existsSync } from "node:fs";
import { getDaemonLogPath } from "../services/daemon.service.js";
import { fail, dim } from "../utils/display.js";

export function registerLogs(program: Command): void {
  program
    .command("logs")
    .description("Show daemon log output")
    .option("-n, --lines <n>", "Number of lines to show", "50")
    .option("-f, --follow", "Follow log output (tail -f)")
    .action(async (opts: { lines: string; follow?: boolean }) => {
      const logPath = getDaemonLogPath();
      const lines   = parseInt(opts.lines, 10) || 50;

      if (!existsSync(logPath)) {
        dim("No log file found. Start the daemon first.");
        return;
      }

      if (opts.follow) {
        const { spawn } = await import("node:child_process");
        spawn("tail", ["-f", logPath], { stdio: "inherit" });
        return;
      }

      try {
        const raw  = readFileSync(logPath, "utf-8");
        const tail = raw.trim().split("\n").slice(-lines).join("\n");
        console.log(tail);
      } catch (err) {
        fail(`Could not read log: ${err}`);
      }
    });
}
