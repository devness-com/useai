import type { Command } from "commander";
import { getDaemonStatus } from "../services/daemon.service.js";
import { getConfig } from "@devness/useai-storage";
import { CONFIG_FILE } from "@devness/useai-storage/paths";
import {
  isAutostartEnabled,
  getAutostartPlatform,
} from "../../daemon/core/autostart.js";
import { header, label, formatDuration, success, fail } from "../utils/display.js";
import pc from "picocolors";

export function registerStatus(program: Command): void {
  program
    .command("status")
    .description("Show daemon, autostart, auth, sync, and config state")
    .action(async () => {
      header("Status");

      // Run independent reads in parallel — none of them depend on each other.
      const [daemonStatus, config] = await Promise.all([
        getDaemonStatus(),
        getConfig().catch(() => null),
      ]);

      // ---- Daemon ----
      if (daemonStatus.running) {
        success(`Daemon running at ${daemonStatus.url}`);
        if (daemonStatus.pid !== undefined)
          label("  pid",         String(daemonStatus.pid));
        if (daemonStatus.uptimeSeconds !== undefined)
          label("  uptime",      formatDuration(daemonStatus.uptimeSeconds * 1000));
        if (daemonStatus.activeSessions !== undefined)
          label("  connections", String(daemonStatus.activeSessions));
        if (daemonStatus.version)
          label("  version",     daemonStatus.version);
      } else {
        fail(`Daemon not running  (${daemonStatus.url})`);
      }

      // ---- Autostart ----
      const platform = getAutostartPlatform();
      if (platform) {
        label(
          "  autostart",
          isAutostartEnabled() ? `enabled (${platform})` : pc.dim("disabled"),
        );
      } else {
        label("  autostart", pc.dim(`unsupported on ${process.platform}`));
      }

      // ---- Auth + Sync + Config ----
      console.log();
      if (config) {
        const user = config.auth.user;
        if (user) {
          label("auth", pc.green(`${user.username ?? user.email} (${user.id.slice(0, 8)}…)`));
          label("auto-sync", String(config.sync.autoSync));
          if (config.lastSyncAt)
            label("last sync", config.lastSyncAt.slice(0, 19).replace("T", " "));
          else
            label("last sync", pc.dim("never"));
        } else {
          label("auth",      pc.dim("not logged in"));
          label("last sync", pc.dim("—"));
        }

        label("eval framework", config.evaluation.framework);
        label("config",         CONFIG_FILE);
      } else {
        label("config", pc.dim("not found"));
      }

      console.log();
    });
}
