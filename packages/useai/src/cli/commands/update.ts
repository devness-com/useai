import type { Command } from "commander";
import { checkForUpdate, runUpdate } from "../services/update.service.js";
import {
  getDaemonStatus,
  startDaemonProcess,
  stopDaemonProcess,
  waitForDaemonReady,
} from "../services/daemon.service.js";
import { header, success, info, dim, fail, label, spinner } from "../utils/display.js";
import { createInterface } from "node:readline";
import pc from "picocolors";

export function registerUpdate(program: Command): void {
  program
    .command("update")
    .description("Update useai to the latest version")
    .option("-y, --yes", "Install without confirmation")
    .action(async (opts: { yes?: boolean }) => {
      header("Update");

      const stop = (() => {
        process.stdout.write("  Checking for updates…");
        return () => { process.stdout.write("\r\x1b[K"); };
      })();

      const { current, latest, hasUpdate } = checkForUpdate();
      stop();

      label("Current", current);
      label("Latest",  latest);

      if (!hasUpdate) {
        success("Already up to date.");
        console.log();
        return;
      }

      info(`New version available: ${pc.green(latest)}`);
      console.log();

      if (!opts.yes) {
        const answer = await prompt(`  Install ${latest}? (Y/n) `);
        if (answer.toLowerCase() === "n") {
          dim("Cancelled.");
          console.log();
          return;
        }
        console.log();
      }

      // Capture daemon state BEFORE the install. If the daemon is running, its
      // in-memory code is still the OLD version even after npm overwrites the
      // on-disk binary — without an explicit restart the update silently
      // no-ops until the next reboot.
      const wasDaemonRunning = (await getDaemonStatus()).running;

      info("Running update…");
      runUpdate();

      if (wasDaemonRunning) {
        info("Restarting daemon to load new version…");
        try {
          stopDaemonProcess();
          await new Promise((r) => setTimeout(r, 500));
          startDaemonProcess();
          const stopSpinner = spinner("Waiting for daemon to come online…");
          const after = await waitForDaemonReady(10_000);
          stopSpinner();
          if (after.running) {
            success(`Daemon restarted at ${after.url}`);
          } else {
            fail("Daemon stopped but failed to come back. Run: useai restart");
          }
        } catch (err) {
          fail(`Failed to restart daemon: ${err}. Run: useai restart`);
        }
      }
    });
}

function prompt(q: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(q, (ans) => { rl.close(); resolve(ans.trim()); });
  });
}
