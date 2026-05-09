import { Hono } from "hono";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { UpdateInfo } from "@devness/useai-types";

// Injected by tsup at bundle time from packages/useai/package.json. Matches
// the pattern used in health.ts / autostart.ts / connection-factory.ts so the
// version is read from a literal in the bundle instead of a runtime require
// — the latter previously broke on the npm-installed layout where __dirname
// is dist/ and `../../package.json` resolves to the @devness/ scope dir.
declare const __VERSION__: string | undefined;
const CURRENT_VERSION =
  typeof __VERSION__ !== "undefined" ? __VERSION__ : "0.1.0";

const execFileAsync = promisify(execFile);

export const updateRoutes = new Hono();

// Returns the canonical UpdateInfo shape (currentVersion / latestVersion /
// hasUpdate) directly — no { ok, data } envelope. Other "raw" daemon routes
// (e.g. /health, /api/local/config) follow the same convention, and the
// dashboard's fetch helpers do not unwrap envelopes, so historically the
// banner could never render: the response shape here used to disagree with
// the dashboard at three layers (envelope, field names, version field names).
updateRoutes.get("/", async (c) => {
  try {
    const { stdout } = await execFileAsync("npm", [
      "view",
      "@devness/useai",
      "version",
    ]);
    const latestVersion = stdout.trim();
    const hasUpdate = latestVersion !== CURRENT_VERSION;
    const info: UpdateInfo = {
      currentVersion: CURRENT_VERSION,
      latestVersion,
      hasUpdate,
    };
    return c.json(info);
  } catch (err) {
    // Surface the real reason (no `npm` on PATH, network down, registry 5xx,
    // etc.) so it shows up in daemon.log instead of being silently swallowed.
    console.warn(
      `[update-check] npm view failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return c.json(
      { error: "Failed to check for updates", currentVersion: CURRENT_VERSION },
      500,
    );
  }
});
