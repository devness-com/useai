import type { Command } from "commander";
import * as p from "@clack/prompts";
import pc from "picocolors";
import {
  detectInstalledTools,
  isToolConfigured,
  installTool,
  getAllToolConfigs,
  removeTool,
  removeClaudeCodeHooks,
  isClaudeCodeHooksInstalled,
} from "@devness/useai-tool-installer";
import { DAEMON_URL } from "@devness/useai-storage/paths";
import {
  getDaemonStatus,
  startDaemonProcess,
  stopDaemonProcess,
  waitForDaemonReady,
} from "../services/daemon.service.js";
import {
  installAutostart,
  getAutostartPlatform,
  isAutostartEnabled,
} from "../../daemon/core/autostart.js";
import { disableAutostart } from "./lib/autostart.js";

// Injected by tsup at bundle time from packages/useai/package.json. We pin
// stdio MCP entries to *this* version so a future bad publish on npm cannot
// break tools that were configured during this setup. Same defense as the
// autostart launcher.
declare const __VERSION__: string | undefined;
const VERSION =
  typeof __VERSION__ !== "undefined" ? __VERSION__ : "latest";

export interface SetupOptions {
  yes?: boolean;
  refresh?: boolean;
  remove?: boolean;
  keepDaemon?: boolean;
}

export async function runSetup(opts: SetupOptions = {}): Promise<void> {
  if (opts.remove) {
    await runRemove(opts);
    return;
  }

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
          p.log.info(`Run \`useai status\` in a few seconds to confirm.`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        p.log.error(`Failed to start daemon: ${msg}`);
      }
    }
  }

  p.outro(pc.green("  Done! Restart your AI tool and useai will track every session."));
}

/**
 * `useai setup --remove` — undo what `useai setup` did.
 *
 * By default this is the inverse of setup: remove every AI tool integration,
 * remove Claude Code hooks, disable autostart, and stop the running daemon.
 * Pass `--keep-daemon` to skip the daemon teardown when the user wants to
 * keep the local dashboard alive (e.g. for `useai status` or `useai sync`).
 */
async function runRemove(opts: SetupOptions): Promise<void> {
  console.log();
  p.intro(pc.bold("  useai setup --remove"));

  const configured = getAllToolConfigs().filter((c) => isToolConfigured(c.id));
  const hooksInstalled = isClaudeCodeHooksInstalled();
  const autostartActive = isAutostartEnabled();
  const daemonStatus = await getDaemonStatus();

  if (
    configured.length === 0 &&
    !hooksInstalled &&
    !autostartActive &&
    !daemonStatus.running
  ) {
    p.log.info("Nothing to remove — useai is already uninstalled.");
    p.outro("");
    return;
  }

  let toRemove = configured.map((c) => c.id);
  if (!opts.yes && configured.length > 0) {
    const choices = configured.map((c) => ({ value: c.id, label: c.name }));
    const result  = await p.multiselect({
      message: "Select tools to remove from",
      options: choices,
      initialValues: toRemove,
    });
    if (p.isCancel(result)) { p.cancel("Cancelled."); return; }
    toRemove = result as string[];
  }

  for (const id of toRemove) {
    const res = await removeTool(id);
    if (res.success) p.log.success(res.message);
    else             p.log.error(res.message);
  }

  if (hooksInstalled) {
    removeClaudeCodeHooks();
    p.log.success("Claude Code hooks removed");
  }

  if (!opts.keepDaemon) {
    if (autostartActive) {
      // disableAutostart prints its own success/fail line.
      disableAutostart();
    }
    if (daemonStatus.running) {
      const stopped = stopDaemonProcess();
      if (stopped) p.log.success("Daemon stopped");
      else         p.log.warn("Could not stop daemon — no PID file found");
    }
  } else {
    p.log.info("--keep-daemon set: leaving daemon running and autostart untouched.");
  }

  p.outro(pc.green("  Removed."));
}

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description("Configure useai in your AI tools (use --remove to undo)")
    .option("-y, --yes", "Auto-confirm without prompts")
    .option(
      "--refresh",
      "Re-install MCP configs and instructions in every detected tool (used by `useai update`)",
    )
    .option(
      "--remove",
      "Remove useai from your AI tools, stop the daemon, and disable autostart",
    )
    .option(
      "--keep-daemon",
      "With --remove: keep the daemon running and leave autostart in place",
    )
    .action((opts: SetupOptions) => runSetup(opts));
}
