/**
 * Reusable autostart helpers for CLI commands.
 *
 * These thin wrappers delegate to the daemon's autostart core. They exist so
 * `start --boot`, `setup --remove`, and `update` can share a single, consistent
 * way to enable/disable the autostart service without re-inlining the same
 * try/catch + display logic at every call site.
 */
import {
  installAutostart as coreInstallAutostart,
  uninstallAutostart as coreUninstallAutostart,
  isAutostartEnabled,
  getAutostartPlatform,
} from "../../../daemon/core/autostart.js";
import { success, fail, dim } from "../../utils/display.js";

/**
 * Install the autostart service. Reports outcome via display helpers.
 * Returns true if autostart is enabled after the call (already-enabled counts).
 */
export function enableAutostart(): boolean {
  const platform = getAutostartPlatform();
  if (!platform) {
    fail(`Autostart is not supported on ${process.platform}.`);
    return false;
  }
  if (isAutostartEnabled()) {
    dim("Autostart already enabled.");
    return true;
  }
  try {
    coreInstallAutostart();
    success(`Autostart enabled (${platform}). Daemon will start at every login.`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    fail(`Failed to enable autostart: ${msg}`);
    return false;
  }
}

/**
 * Uninstall the autostart service. No-ops cleanly if it was never enabled.
 * Returns true if autostart is disabled after the call.
 */
export function disableAutostart(): boolean {
  if (!isAutostartEnabled()) {
    return true;
  }
  try {
    coreUninstallAutostart();
    success("Autostart disabled.");
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    fail(`Failed to disable autostart: ${msg}`);
    return false;
  }
}
