import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DAEMON_LOG_FILE } from "@devness/useai-storage/paths";

/**
 * Levels accepted by the appender. Kept as a string union so log lines stay
 * grep-friendly without dragging in a logging dependency.
 */
export type LogLevel = "info" | "warn" | "error";

/**
 * Append a single line to `~/.useai/daemon.log` with a stable, grep-friendly
 * format: `[ISO timestamp] [scope] [LEVEL] message`. Failures are swallowed
 * so logging never crashes the daemon — log file unwritable is the user's
 * problem to fix, not ours to abort over.
 */
export function logLine(scope: string, level: LogLevel, message: string): void {
  try {
    mkdirSync(dirname(DAEMON_LOG_FILE), { recursive: true });
    const line = `[${new Date().toISOString()}] [${scope}] [${level.toUpperCase()}] ${message}\n`;
    appendFileSync(DAEMON_LOG_FILE, line, "utf-8");
  } catch {
    // Logging must never crash the daemon. Ignore.
  }
}
