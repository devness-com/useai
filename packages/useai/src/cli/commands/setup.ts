import type { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  detectInstalledTools,
  isToolConfigured,
  installTool,
  getAllToolConfigs,
} from "@devness/useai-tool-installer";
import { DAEMON_URL } from "@devness/useai-storage/paths";
import {
  getDaemonStatus,
  startDaemonProcess,
  waitForDaemonReady,
} from "../services/daemon.service.js";
import {
  installAutostart,
  getAutostartPlatform,
} from "../../daemon/core/autostart.js";

// Injected by tsup at bundle time from packages/useai/package.json. We pin
// stdio MCP entries to *this* version so a future bad publish on npm cannot
// break tools that were configured during this setup. Same defense as the
// autostart launcher.
declare const __VERSION__: string | undefined;
const VERSION =
  typeof __VERSION__ !== "undefined" ? __VERSION__ : "latest";

export async function runSetup(
  opts: { yes?: boolean; refresh?: boolean } = {},
): Promise<void> {
  console.log();
  p.intro(pc.bold(opts.refresh ? "  useai setup (refresh)" : "  useai setup"));

  const spin = p.spinner();
  spin.start("Scanning for AI tools…");
  const detected     = detectInstalledTools();
  const configured   = detected.filter((id) => isToolConfigured(id));
  const unconfigured = detected.filter((id) => !isToolConfigured(id));
  spin.stop(`Found ${detected.length} tool${detected.length !== 1 ? "s" : ""}`);

  if (detected.length === 0) {
    p.log.warn("No AI tools detected on this machine.");
    p.outro("");
    return;
  }

  for (const id of configured)   p.log.success(`${getAllToolConfigs().find((c) => c.id === id)?.name ?? id}  (already configured)`);
  for (const id of unconfigured) p.log.info(`${getAllToolConfigs().find((c) => c.id === id)?.name ?? id}`);

  // In --refresh mode, re-install both configured AND unconfigured tools so
  // any new instructions text or schema changes from the upgrade land on disk.
  // Otherwise behave as before: prefer to install unconfigured ones, fall
  // back to configured if everything is already set up.
  const toInstall = opts.refresh
    ? detected
    : unconfigured.length > 0 ? unconfigured : configured;

  let selected: string[] = toInstall;
  if (!opts.yes && !opts.refresh && unconfigured.length > 0) {
    const choices = toInstall.map((id) => ({
      value: id,
      label: getAllToolConfigs().find((c) => c.id === id)?.name ?? id,
    }));
    const result = await p.multiselect({
      message: "Select tools to configure",
      options: choices,
      initialValues: toInstall,
    });
    if (p.isCancel(result)) { p.cancel("Cancelled."); return; }
    selected = result as string[];
  }

  let installedCount = 0;
  for (const id of selected) {
    const res = await installTool(id, VERSION);
    if (res.success) {
      p.log.success(res.message);
      installedCount++;
    } else {
      p.log.error(res.message);
    }
  }

  // Auto-start the daemon so the AI tools we just configured can connect immediately.
  // On macOS/Linux we install the autostart service (launchd / systemd --user)
  // — that registers the daemon so it survives reboots AND starts it right now.
  // On unsupported platforms (e.g. Windows for now) we fall back to a detached
  // spawn that lasts only for the current login.
  if (installedCount > 0) {
    const status = await getDaemonStatus();
    if (status.running) {
      p.log.info(`Daemon already running at ${DAEMON_URL}`);
    } else {
      const platform = getAutostartPlatform();
      let startedViaAutostart = false;
      if (platform) {
        try {
          installAutostart();
          startedViaAutostart = true;
          p.log.success(`Autostart enabled — daemon will start at every login.`);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          p.log.warn(`Could not enable autostart: ${msg}. Falling back to a one-shot start.`);
        }
      } else {
        p.log.info(`Autostart is not yet supported on ${process.platform}. Starting a one-shot daemon.`);
      }

      try {
        if (!startedViaAutostart) startDaemonProcess();

        // launchd boots the daemon via `npx`, which can pay a cold-start cost
        // on first run. Most starts answer in under 5 s; if it hasn't come up
        // by 15 s we stop blocking and tell the user to check shortly — the
        // daemon will keep starting in the background either way.
        const waitSpin = p.spinner();
        waitSpin.start("Waiting for daemon to come online…");
        const after = await waitForDaemonReady(startedViaAutostart ? 15_000 : 10_000);
        if (after.running) {
          waitSpin.stop(`Daemon ready at ${DAEMON_URL}`);
        } else {
          waitSpin.stop("Daemon is still starting in the background");
          p.log.info(`Run \`useai daemon status\` in a few seconds to confirm.`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        p.log.error(`Failed to start daemon: ${msg}`);
      }
    }
  }

  p.outro(pc.green("  Done! Restart your AI tool and useai will track every session."));
}

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description("Install useai in your AI tools")
    .option("-y, --yes", "Auto-confirm without prompts")
    .option(
      "--refresh",
      "Re-install MCP configs and instructions in every detected tool (used by `useai update`)",
    )
    .action((opts: { yes?: boolean; refresh?: boolean }) => runSetup(opts));
}
