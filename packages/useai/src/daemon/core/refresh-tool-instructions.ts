import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { INSTRUCTIONS_VERSION_FILE } from "@devness/useai-storage/paths";
import {
  detectInstalledTools,
  installTool,
  isToolConfigured,
} from "@devness/useai-tool-installer";

// Injected by tsup at bundle time from packages/useai/package.json. Falls
// back to "dev" when running through tsc output (e.g. local pnpm dev).
declare const __VERSION__: string | undefined;
const VERSION = typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

export async function refreshToolInstructionsIfStale(): Promise<void> {
  try {
    const seen = existsSync(INSTRUCTIONS_VERSION_FILE)
      ? readFileSync(INSTRUCTIONS_VERSION_FILE, "utf-8").trim()
      : null;
    if (seen === VERSION) return;

    // Only refresh tools the user has already configured. We don't want the
    // daemon silently writing MCP config into tools the user explicitly
    // de-selected during setup.
    const detected = detectInstalledTools();
    const configuredFlags = await Promise.all(
      detected.map((id) => isToolConfigured(id)),
    );
    const installed = detected.filter((_, i) => configuredFlags[i]);

    if (installed.length === 0) {
      // Nothing to refresh, but still mark the version so we don't repeat
      // the work-and-no-op dance on every boot.
      writeFileSync(INSTRUCTIONS_VERSION_FILE, VERSION, "utf-8");
      return;
    }

    const results = await Promise.all(
      installed.map((id) => installTool(id, VERSION)),
    );
    const failed = results.filter((r) => !r.success).map((r) => r.toolId);
    const ok = results.length - failed.length;

    console.log(
      `useai daemon: refreshed instructions for ${ok}/${results.length} tool(s)` +
        (failed.length ? `; failed: ${failed.join(", ")}` : ""),
    );

    // Persist even on partial failure: a failing tool should not cause the
    // refresh to retry on every boot. Next version bump will re-attempt.
    writeFileSync(INSTRUCTIONS_VERSION_FILE, VERSION, "utf-8");
  } catch (err) {
    console.warn(
      `useai daemon: tool instruction refresh failed (non-fatal): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
