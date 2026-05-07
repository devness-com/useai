import { homedir } from "node:os";
import { join } from "node:path";

const HOME = homedir();

export const USEAI_DIR = join(HOME, ".useai");
export const DATA_DIR = join(USEAI_DIR, "data");
export const SEALED_DIR = join(DATA_DIR, "sealed");
export const CONFIG_FILE = join(USEAI_DIR, "config.json");
export const KEYSTORE_FILE = join(USEAI_DIR, "keystore.json");
export const DAEMON_PID_FILE = join(USEAI_DIR, "daemon.pid");
export const DAEMON_LOG_FILE = join(USEAI_DIR, "daemon.log");
export const SYNC_LOG_FILE = join(USEAI_DIR, "sync-log.json");
export const INSTRUCTIONS_VERSION_FILE = join(
  USEAI_DIR,
  ".instructions-version",
);

// Auto-update state and rollback safeguard files. The daemon's auto-updater
// writes the probation record here on every check/install attempt; the boot-
// time rollback path reads it to decide whether the previous install should
// be reverted.
export const UPDATE_STATE_FILE = join(DATA_DIR, "update-state.json");
export const LAST_CRASH_FILE = join(DATA_DIR, "last-crash.json");
// Snapshots of the previously-running CLI's `dist/` are stored here, one
// directory per version, so a botched upgrade can be rolled back on the
// next daemon boot. The auto-updater keeps only the two most recent
// snapshots.
export const VERSIONS_DIR = join(USEAI_DIR, "versions");

export const DAEMON_PORT = Number(process.env["USEAI_PORT"] ?? 19200);
export const DAEMON_HOST = process.env["USEAI_HOST"] ?? "127.0.0.1";
export const DAEMON_PROTOCOL = process.env["USEAI_PROTOCOL"] ?? "http";
export const DAEMON_URL = `${DAEMON_PROTOCOL}://${DAEMON_HOST}:${DAEMON_PORT}`;
