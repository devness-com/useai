import { Hono } from "hono";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { UpdateInfo } from "@devness/useai-types";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const execFileAsync = promisify(execFile);

export const updateRoutes = new Hono();

// Returns the canonical UpdateInfo shape (currentVersion / latestVersion /
// hasUpdate) directly — no { ok, data } envelope. Other "raw" daemon routes
// (e.g. /health, /api/local/config) follow the same convention, and the
// dashboard's fetch helpers do not unwrap envelopes, so historically the
// banner could never render: the response shape here used to disagree with
// the dashboard at three layers (envelope, field names, version field names).
updateRoutes.get("/", async (c) => {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const pkg = require(resolve(__dirname, "../../package.json")) as {
    version: string;
  };
  const currentVersion = pkg.version ?? "0.1.0";

  try {
    const { stdout } = await execFileAsync("npm", [
      "view",
      "@devness/useai",
      "version",
    ]);
    const latestVersion = stdout.trim();
    const hasUpdate = latestVersion !== currentVersion;
    const info: UpdateInfo = { currentVersion, latestVersion, hasUpdate };
    return c.json(info);
  } catch (err) {
    // Surface the real reason (no `npm` on PATH, network down, registry 5xx,
    // etc.) so it shows up in daemon.log instead of being silently swallowed.
    console.warn(
      `[update-check] npm view failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return c.json(
      { error: "Failed to check for updates", currentVersion },
      500,
    );
  }
});
