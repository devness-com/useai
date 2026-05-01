import {
  accessSync,
  constants as fsConstants,
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { platform } from "node:os";
import {
  UPDATE_STATE_FILE,
  LAST_CRASH_FILE,
  VERSIONS_DIR,
} from "@devness/useai-storage/paths";
import {
  checkForUpdate,
  runUpdate,
  getCurrentVersion,
} from "../../cli/services/update.service.js";
import { isAutostartEnabled } from "./autostart.js";
import { getActiveSessionCount } from "./active-sessions.js";
import { logLine } from "../lib/log.js";

// ---------------------------------------------------------------------------
// Tunables — kept as exported constants so tests can reference the same
// values without hard-coding magic numbers in two places.
// ---------------------------------------------------------------------------

/** Wait this long after daemon startup before the first update check. */
export const FIRST_CHECK_DELAY_MS = 5 * 60 * 1000; // 5 minutes
/** Cadence for subsequent update checks. */
export const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
/** Reschedule delay when an update is available but a session is in flight. */
export const ACTIVE_SESSION_RETRY_MS = 30 * 60 * 1000; // 30 minutes
/** Crash window after an upgrade — crashes inside this window count toward rollback. */
export const PROBATION_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
/** Crash threshold inside the probation window that triggers a rollback. */
export const ROLLBACK_CRASH_THRESHOLD = 3;
/** Time after upgrade after which a clean run is considered a successful release. */
export const PROBATION_SUCCESS_MS = 10 * 60 * 1000; // 10 minutes
/** Number of dist snapshots to keep on disk. */
export const SNAPSHOT_RETENTION = 2;
/** Cap on the number of crash records persisted to disk. */
export const CRASH_LOG_MAX_ENTRIES = 20;

const LOG_SCOPE = "auto-updater";

// ---------------------------------------------------------------------------
// Disk-backed state shapes
// ---------------------------------------------------------------------------

export type ProbationStatus = "pending" | "success" | "rolled-back";

export interface ProbationRecord {
  updatedAt: string;
  fromVersion: string;
  toVersion: string;
  restartsObserved: number;
  status: ProbationStatus;
}

export interface UpdateState {
  /** Probation record for the most recent install attempt. */
  probation?: ProbationRecord;
  /** Set when the global node_modules path is unwritable. Cleared by manual `useai update`. */
  disabled?: boolean;
  /** ISO timestamp of the last successful "no update needed" check. */
  lastCheckAt?: string;
}

export interface CrashRecord {
  timestamp: string;
  message: string;
  stack?: string;
}

// ---------------------------------------------------------------------------
// State I/O — small helpers that swallow read errors and surface write
// errors via the logger. We never want a bad state file to prevent the
// daemon from booting.
// ---------------------------------------------------------------------------

export function readUpdateState(): UpdateState {
  try {
    if (!existsSync(UPDATE_STATE_FILE)) return {};
    const raw = readFileSync(UPDATE_STATE_FILE, "utf-8");
    return JSON.parse(raw) as UpdateState;
  } catch {
    return {};
  }
}

export function writeUpdateState(state: UpdateState): void {
  try {
    mkdirSync(dirname(UPDATE_STATE_FILE), { recursive: true });
    writeFileSync(UPDATE_STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
  } catch (err) {
    logLine(LOG_SCOPE, "warn", `failed to persist update-state.json: ${errMsg(err)}`);
  }
}

export function readCrashLog(): CrashRecord[] {
  try {
    if (!existsSync(LAST_CRASH_FILE)) return [];
    const raw = readFileSync(LAST_CRASH_FILE, "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as CrashRecord[];
  } catch {
    return [];
  }
}

export function writeCrashLog(entries: CrashRecord[]): void {
  try {
    mkdirSync(dirname(LAST_CRASH_FILE), { recursive: true });
    const trimmed = entries.slice(-CRASH_LOG_MAX_ENTRIES);
    writeFileSync(LAST_CRASH_FILE, JSON.stringify(trimmed, null, 2), "utf-8");
  } catch {
    // Crash logging must never crash. Ignore.
  }
}

// ---------------------------------------------------------------------------
// Pure helpers — easy to test
// ---------------------------------------------------------------------------

/**
 * Decide what to do with a probation record given the current crash log and
 * the current time. Pure function — all I/O is left to the caller.
 *
 * - `rollback`: enough crashes within the window to declare the new version
 *   bad. Caller should restore the snapshot and persist `status: rolled-back`.
 * - `success`: probation window is over with zero crashes. Caller should
 *   clear the probation record.
 * - `continue`: still inside the probation window with no crash threshold
 *   tripped. Caller should leave the record untouched.
 */
export function decideRollback(args: {
  probation: ProbationRecord;
  crashes: CrashRecord[];
  now: number;
}): { action: "rollback" | "success" | "continue"; crashCount: number } {
  const updatedAtMs = Date.parse(args.probation.updatedAt);
  if (Number.isNaN(updatedAtMs)) {
    // Corrupt timestamp — treat as continue so we don't accidentally roll
    // back something we can't reason about.
    return { action: "continue", crashCount: 0 };
  }

  const windowEndMs = updatedAtMs + PROBATION_WINDOW_MS;
  const successDeadlineMs = updatedAtMs + PROBATION_SUCCESS_MS;

  const crashCount = args.crashes.reduce((acc, crash) => {
    const t = Date.parse(crash.timestamp);
    if (Number.isNaN(t)) return acc;
    if (t >= updatedAtMs && t <= windowEndMs) return acc + 1;
    return acc;
  }, 0);

  if (crashCount >= ROLLBACK_CRASH_THRESHOLD) {
    return { action: "rollback", crashCount };
  }

  if (args.now >= successDeadlineMs && crashCount === 0) {
    return { action: "success", crashCount };
  }

  return { action: "continue", crashCount };
}

/**
 * Given a versions directory, keep only the `keep` most recent snapshot
 * directories (mtime descending). Returns the list of removed directory
 * names so callers (and tests) can verify.
 */
export function pruneSnapshots(
  versionsDir: string,
  keep: number = SNAPSHOT_RETENTION,
): string[] {
  if (!existsSync(versionsDir)) return [];

  const entries = readdirSync(versionsDir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const full = join(versionsDir, e.name);
      let mtime = 0;
      try {
        mtime = statSync(full).mtimeMs;
      } catch {
        // ignore — entry will sort to the end and likely be pruned
      }
      return { name: e.name, full, mtime };
    });

  if (entries.length <= keep) return [];

  entries.sort((a, b) => b.mtime - a.mtime);
  const toRemove = entries.slice(keep);

  const removed: string[] = [];
  for (const entry of toRemove) {
    try {
      rmSync(entry.full, { recursive: true, force: true });
      removed.push(entry.name);
    } catch {
      // ignore — best effort
    }
  }
  return removed;
}

/**
 * Probe a path with `fs.access(W_OK)`. Returns true when the path exists and
 * is writable by the current user. Any error (missing path, EPERM, EACCES)
 * is treated as "not writable" because that's the only branch the caller
 * cares about.
 */
export function checkWritability(path: string): boolean {
  try {
    accessSync(path, fsConstants.W_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve the platform-appropriate global `node_modules` directory using
 * `npm prefix -g`. Returns null when npm isn't on PATH or fails — callers
 * should treat null the same as "not writable".
 */
export function resolveGlobalNodeModulesPath(): string | null {
  try {
    const prefix = execFileSync("npm", ["prefix", "-g"], {
      encoding: "utf-8",
    }).trim();
    if (!prefix) return null;
    return platform() === "win32"
      ? join(prefix, "node_modules")
      : join(prefix, "lib", "node_modules");
  } catch {
    return null;
  }
}

/**
 * Resolve the running CLI's `dist/` directory by walking up from
 * `process.argv[1]` until a directory called `dist` is found. Returns null
 * when the layout is unrecognised (e.g. running under `tsx` from source).
 */
export function resolveCurrentDistDir(): string | null {
  const entry = process.argv[1];
  if (!entry) return null;
  let dir = resolve(entry);
  // Walk up, looking for a parent named "dist".
  for (let i = 0; i < 6; i++) {
    if (dir.endsWith(`${"/"}dist`) || dir.endsWith(`${"\\"}dist`)) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  // If argv[1] was the bundled cli.js inside dist/, its parent is dist.
  const parent = dirname(resolve(entry));
  if (parent.endsWith(`${"/"}dist`) || parent.endsWith(`${"\\"}dist`)) {
    return parent;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Snapshot + restore (impure — touches the filesystem)
// ---------------------------------------------------------------------------

export interface SnapshotDeps {
  versionsDir?: string;
  distDir?: string | null;
  version?: string;
}

/**
 * Copy the current CLI's `dist/` directory into
 * `~/.useai/versions/<version>/dist`, then prune older snapshots. Returns
 * the snapshot path on success, null if there's nothing to snapshot.
 */
export function snapshotCurrentDist(deps: SnapshotDeps = {}): string | null {
  const versionsDir = deps.versionsDir ?? VERSIONS_DIR;
  const distDir = deps.distDir ?? resolveCurrentDistDir();
  const version = deps.version ?? getCurrentVersion();

  if (!distDir || !existsSync(distDir)) {
    logLine(LOG_SCOPE, "warn", "snapshot skipped: could not resolve current dist dir");
    return null;
  }

  const target = join(versionsDir, version, "dist");
  try {
    mkdirSync(dirname(target), { recursive: true });
    if (existsSync(target)) {
      // Replace any stale snapshot for the same version so we always have
      // a fresh copy of what's running.
      rmSync(target, { recursive: true, force: true });
    }
    cpSync(distDir, target, { recursive: true });
    pruneSnapshots(versionsDir);
    return target;
  } catch (err) {
    logLine(LOG_SCOPE, "warn", `snapshot failed: ${errMsg(err)}`);
    return null;
  }
}

/**
 * Restore a previously-captured snapshot back into the running CLI's `dist/`
 * directory. Returns true on success.
 */
export function restoreSnapshot(args: {
  version: string;
  versionsDir?: string;
  distDir?: string | null;
}): boolean {
  const versionsDir = args.versionsDir ?? VERSIONS_DIR;
  const distDir = args.distDir ?? resolveCurrentDistDir();
  if (!distDir) {
    logLine(LOG_SCOPE, "error", "rollback failed: could not resolve current dist dir");
    return false;
  }
  const source = join(versionsDir, args.version, "dist");
  if (!existsSync(source)) {
    logLine(
      LOG_SCOPE,
      "error",
      `rollback failed: snapshot for ${args.version} not found at ${source}`,
    );
    return false;
  }
  try {
    rmSync(distDir, { recursive: true, force: true });
    cpSync(source, distDir, { recursive: true });
    return true;
  } catch (err) {
    logLine(LOG_SCOPE, "error", `rollback failed: ${errMsg(err)}`);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Boot-time rollback check
// ---------------------------------------------------------------------------

/**
 * Run on every daemon boot, after the PID file is written but before the
 * HTTP server starts listening. Inspects the probation record and decides
 * whether to roll back, clear the record, or leave it alone for the next
 * boot.
 *
 * Wrapped in a top-level try/catch so a corrupt state file or an unexpected
 * filesystem error can never block the daemon from starting — auto-update
 * is opt-in maintenance, not core functionality.
 */
export function runBootRollbackCheck(now: number = Date.now()): void {
  try {
    runBootRollbackCheckInner(now);
  } catch (err) {
    logLine(LOG_SCOPE, "error", `boot rollback check failed: ${errMsg(err)}`);
  }
}

function runBootRollbackCheckInner(now: number): void {
  const state = readUpdateState();
  if (!state.probation || state.probation.status !== "pending") return;

  const probation: ProbationRecord = {
    ...state.probation,
    restartsObserved: state.probation.restartsObserved + 1,
  };

  const crashes = readCrashLog();
  const decision = decideRollback({ probation, crashes, now });

  if (decision.action === "rollback") {
    logLine(
      LOG_SCOPE,
      "error",
      `rolling back ${probation.toVersion} → ${probation.fromVersion} (${decision.crashCount} crashes inside probation window)`,
    );
    const restored = restoreSnapshot({ version: probation.fromVersion });
    writeUpdateState({
      ...state,
      probation: { ...probation, status: "rolled-back" },
      disabled: true,
    });
    logLine(
      LOG_SCOPE,
      restored ? "info" : "error",
      restored
        ? `rollback complete; auto-update disabled until manual \`useai update\``
        : `rollback restore failed; auto-update disabled`,
    );
    return;
  }

  if (decision.action === "success") {
    logLine(
      LOG_SCOPE,
      "info",
      `update to ${probation.toVersion} promoted to stable after probation window`,
    );
    // Probation cleared. Keep disabled/lastCheckAt as-is so we don't lose
    // an admin-configured disable flag.
    const next: UpdateState = { ...state };
    delete next.probation;
    writeUpdateState(next);
    return;
  }

  // Continue: still in probation, just persist the bumped restart counter.
  writeUpdateState({ ...state, probation });
}

// ---------------------------------------------------------------------------
// Crash recording
// ---------------------------------------------------------------------------

/**
 * Append a crash record and re-throw / exit so the supervisor (launchd or
 * systemd) respawns us. The new boot will run `runBootRollbackCheck` and
 * decide whether to roll back.
 */
export function recordCrash(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  const entry: CrashRecord = {
    timestamp: new Date().toISOString(),
    message,
    ...(stack ? { stack } : {}),
  };
  const existing = readCrashLog();
  writeCrashLog([...existing, entry]);
  logLine(LOG_SCOPE, "error", `recorded crash: ${message}`);
}

/**
 * Wire `uncaughtException` and `unhandledRejection` so any fatal goes
 * through the crash recorder. We deliberately exit with code 1 so the
 * supervisor restarts us — the boot-time rollback check needs the new
 * boot to run for it to fire.
 */
export function installCrashHandlers(): void {
  process.on("uncaughtException", (err) => {
    recordCrash(err);
    process.exit(1);
  });
  process.on("unhandledRejection", (reason) => {
    recordCrash(reason);
    process.exit(1);
  });
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/**
 * Kick off the auto-update loop. First check fires after FIRST_CHECK_DELAY_MS
 * (deliberately delayed so we don't disrupt a freshly-started session), then
 * subsequent checks fire on a 24h interval.
 *
 * Fire-and-forget: never blocks daemon startup. Any error inside the loop
 * is caught and logged so a single bad check can't take down the schedule.
 */
export function startAutoUpdater(): void {
  const initial = setTimeout(() => {
    void runUpdateCycleSafe();
    const interval = setInterval(() => {
      void runUpdateCycleSafe();
    }, CHECK_INTERVAL_MS);
    interval.unref();
  }, FIRST_CHECK_DELAY_MS);
  initial.unref();

  logLine(
    LOG_SCOPE,
    "info",
    `scheduled — first check in ${Math.round(FIRST_CHECK_DELAY_MS / 60000)} minutes`,
  );
}

async function runUpdateCycleSafe(): Promise<void> {
  try {
    await runUpdateCycle();
  } catch (err) {
    logLine(LOG_SCOPE, "error", `update cycle failed: ${errMsg(err)}`);
  }
}

/**
 * One pass of the update loop. Executes the full pipeline: idle gate →
 * autostart gate → writability check → snapshot → install → restart.
 * Exits the process on success so the supervisor brings us back on the
 * new binary.
 */
async function runUpdateCycle(): Promise<void> {
  const state = readUpdateState();

  if (state.disabled) {
    logLine(
      LOG_SCOPE,
      "info",
      "auto-update disabled (set by previous failure or rollback); run `useai update` manually to clear",
    );
    return;
  }

  let info: ReturnType<typeof checkForUpdate>;
  try {
    info = checkForUpdate();
  } catch (err) {
    logLine(LOG_SCOPE, "warn", `version check failed: ${errMsg(err)}`);
    return;
  }

  if (!info.hasUpdate) {
    logLine(LOG_SCOPE, "info", `up to date (current=${info.current})`);
    writeUpdateState({ ...state, lastCheckAt: new Date().toISOString() });
    return;
  }

  logLine(
    LOG_SCOPE,
    "info",
    `update available: ${info.current} → ${info.latest}`,
  );

  // Idle gate — don't restart on top of an in-flight session.
  const active = getActiveSessionCount();
  if (active > 0) {
    logLine(
      LOG_SCOPE,
      "info",
      `deferring update — ${active} session${active === 1 ? "" : "s"} active`,
    );
    const retry = setTimeout(() => {
      void runUpdateCycleSafe();
    }, ACTIVE_SESSION_RETRY_MS);
    retry.unref();
    return;
  }

  // Autostart gate — without a supervisor we can't get back up. Manual
  // `useai update` is the documented fallback.
  if (!isAutostartEnabled()) {
    logLine(
      LOG_SCOPE,
      "info",
      "auto-update skipped — autostart not enabled, manual `useai update` is the fallback",
    );
    return;
  }

  // Writability check — if we can't write to the global node_modules path
  // (e.g. system-wide install owned by root) `npm install -g` will fail.
  // Persist `disabled: true` so we don't retry every 24h until the user
  // intervenes.
  const globalModules = resolveGlobalNodeModulesPath();
  if (!globalModules || !checkWritability(globalModules)) {
    logLine(
      LOG_SCOPE,
      "error",
      "auto-update disabled: global node_modules path not writable — reinstall via nvm/fnm to enable auto-update",
    );
    writeUpdateState({ ...state, disabled: true });
    return;
  }

  // Snapshot the running version BEFORE we touch the on-disk binary, so
  // the boot-time rollback check has somewhere to restore from.
  const snapshot = snapshotCurrentDist({ version: info.current });
  if (!snapshot) {
    logLine(
      LOG_SCOPE,
      "warn",
      "skipping update — snapshot failed; cannot install without rollback safety",
    );
    return;
  }
  logLine(LOG_SCOPE, "info", `snapshot saved: ${snapshot}`);

  // Probation record goes in BEFORE the install. The install ends with
  // `process.exit(0)` so we never get a chance to write it afterwards.
  writeUpdateState({
    ...state,
    probation: {
      updatedAt: new Date().toISOString(),
      fromVersion: info.current,
      toVersion: info.latest,
      restartsObserved: 0,
      status: "pending",
    },
  });

  try {
    runUpdate();
  } catch (err) {
    logLine(LOG_SCOPE, "error", `install failed: ${errMsg(err)}`);
    // Install failed before exit; clear the probation record so the next
    // boot doesn't think we just upgraded.
    const next = readUpdateState();
    delete next.probation;
    writeUpdateState(next);
    return;
  }

  logLine(LOG_SCOPE, "info", "update installed, exiting for autostart respawn");
  // The daemon's `process.on("exit", ...)` handler clears the PID file, so
  // we can hand control back to the supervisor with a clean exit.
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Internal utilities
// ---------------------------------------------------------------------------

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
