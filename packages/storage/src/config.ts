import type { UseaiConfig } from "@devness/useai-types";
import { UseaiConfigSchema } from "@devness/useai-types/config";
import {
  CONFIG_FILE,
  DAEMON_HOST,
  DAEMON_PORT,
  DAEMON_PROTOCOL,
} from "./paths.js";
import { readJson, writeJson } from "./fs.js";

export async function getConfig(): Promise<UseaiConfig> {
  const raw = await readJson<Record<string, unknown>>(CONFIG_FILE);
  return UseaiConfigSchema.parse(raw ?? {});
}

export async function saveConfig(config: UseaiConfig): Promise<void> {
  await writeJson(CONFIG_FILE, config);
}

/**
 * Best-effort read of the daemon's currently-persisted port. Returns
 * `undefined` when the config file is missing, malformed, or has never
 * recorded a port (first-time install). Callers should fall back to
 * {@link DAEMON_PORT} (19200) when this returns `undefined`.
 */
export async function getDaemonPort(): Promise<number | undefined> {
  try {
    const config = await getConfig();
    return config.daemon.port;
  } catch {
    return undefined;
  }
}

/**
 * Persist the daemon's actual bound port so every other process (CLI,
 * dashboard proxy, tool-installer) can reach the daemon even when it had to
 * fall back off 19200.
 */
export async function setDaemonPort(port: number): Promise<void> {
  await patchConfig({ daemon: { port } });
}

/**
 * Build the daemon's HTTP base URL from the currently-persisted port. Async
 * because every consumer is already inside an async function (fetch call,
 * tool installation step, etc.) and forcing them to read config is the whole
 * point of P2.1 — the static `DAEMON_URL` from `paths.ts` is frozen at module
 * load time and cannot reflect a fallback port chosen later.
 */
export async function getDaemonUrl(): Promise<string> {
  const port = (await getDaemonPort()) ?? DAEMON_PORT;
  return `${DAEMON_PROTOCOL}://${DAEMON_HOST}:${port}`;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    const tv = target[key];
    const sv = source[key];
    if (tv && sv && typeof tv === "object" && typeof sv === "object" && !Array.isArray(tv) && !Array.isArray(sv)) {
      result[key] = deepMerge(tv as Record<string, unknown>, sv as Record<string, unknown>);
    } else {
      result[key] = sv;
    }
  }
  return result;
}

export async function patchConfig(
  patch: Partial<UseaiConfig>,
): Promise<UseaiConfig> {
  const current = await getConfig();
  const merged = deepMerge(current, patch);
  const validated = UseaiConfigSchema.parse(merged);
  await saveConfig(validated);
  return validated;
}
