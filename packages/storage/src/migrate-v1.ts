import { join } from "node:path";
import { readFile, readdir, rename, writeFile, open, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { DATA_DIR as DEFAULT_DATA_DIR } from "./paths.js";
import { ensureDir } from "./fs.js";
import { parseSealedChain } from "./sessions.js";

export interface MigrateResult {
  migrated: number;
  warnings: number;
  skipped: boolean;
}

interface MigratePaths {
  dataDir: string;
  sealedDir: string;
  archiveDir: string;
  marker: string;
  doneMarker: string;
  warningsLog: string;
}

function buildPaths(dataDir: string): MigratePaths {
  return {
    dataDir,
    sealedDir: join(dataDir, "sealed"),
    archiveDir: join(dataDir, "sealed.v1-archive"),
    marker: join(dataDir, ".migrating"),
    doneMarker: join(dataDir, ".migrated-v1"),
    warningsLog: join(dataDir, ".migrate-v1-warnings.log"),
  };
}

/**
 * Test whether a process is alive.
 *
 * `process.kill(pid, 0)` does no actual signalling — it just checks whether the
 * caller has permission to send a signal to the target. Returns false on ESRCH
 * (no such process) and true otherwise. EPERM means the process exists but is
 * owned by another user — still "alive" for our purposes.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ESRCH") return false;
    return true;
  }
}

interface MigrationLockInfo {
  pid: number;
  startedAt: string;
}

/**
 * Try to acquire the migration lock. Returns true on success, false if another
 * live process is currently migrating. Removes stale locks owned by dead PIDs.
 */
async function acquireMigrationLock(paths: MigratePaths): Promise<boolean> {
  if (existsSync(paths.marker)) {
    try {
      const raw = await readFile(paths.marker, "utf-8");
      const info = JSON.parse(raw) as MigrationLockInfo;
      if (
        typeof info.pid === "number" &&
        info.pid !== process.pid &&
        isProcessAlive(info.pid)
      ) {
        return false;
      }
      // Stale lock — owner is dead (or it's us). Remove and proceed.
      await rm(paths.marker, { force: true });
    } catch {
      // Marker exists but is unreadable/corrupt — treat as stale and remove.
      await rm(paths.marker, { force: true });
    }
  }

  const info: MigrationLockInfo = {
    pid: process.pid,
    startedAt: new Date().toISOString(),
  };
  await writeFile(paths.marker, JSON.stringify(info), "utf-8");
  return true;
}

async function releaseMigrationLock(paths: MigratePaths): Promise<void> {
  await rm(paths.marker, { force: true });
}

/**
 * Atomically replace `target` with `content`. Writes to `${target}.tmp`,
 * fsyncs, then renames over the target. Crash mid-write leaves only the
 * `.tmp` orphan; the target is never partially written.
 */
async function atomicWrite(target: string, content: string): Promise<void> {
  const tmp = `${target}.tmp`;
  const fh = await open(tmp, "w");
  try {
    await fh.writeFile(content, "utf-8");
    await fh.sync();
  } finally {
    await fh.close();
  }
  await rename(tmp, target);
}

interface ParsedSource {
  /** Source filename (UUID.jsonl) within sealedDir. */
  file: string;
  /** Date bucket derived from `endedAt` (YYYY-MM-DD). */
  date: string;
  /** Session JSON line (with milestones embedded). */
  line: string;
}

/**
 * Discover and parse all v1 UUID-named jsonl files in sealedDir.
 * Returns successfully-parsed sources grouped by date, and the list of files
 * that failed to parse (for the warnings log).
 */
async function scanSources(
  paths: MigratePaths,
): Promise<{ byDate: Map<string, ParsedSource[]>; failed: string[] }> {
  const byDate = new Map<string, ParsedSource[]>();
  const failed: string[] = [];

  if (!existsSync(paths.sealedDir)) {
    return { byDate, failed };
  }

  const entries = await readdir(paths.sealedDir);
  // v1 files are UUID-named; date-bucket files are YYYY-MM-DD.jsonl.
  // Skip date buckets, .tmp orphans, and any non-jsonl noise.
  const sources = entries.filter(
    (f) =>
      f.endsWith(".jsonl") &&
      !/^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f) &&
      !f.endsWith(".jsonl.tmp"),
  );

  for (const file of sources) {
    let raw: string;
    try {
      raw = await readFile(join(paths.sealedDir, file), "utf-8");
    } catch {
      failed.push(file);
      continue;
    }

    const parsed = parseSealedChain(file, raw);
    if (!parsed) {
      failed.push(file);
      continue;
    }

    const session = parsed.session;
    session["milestones"] = parsed.milestones;

    const endedAt = (session["endedAt"] as string) ?? "";
    const date = endedAt.slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      failed.push(file);
      continue;
    }

    const line = JSON.stringify(session);
    const bucket = byDate.get(date);
    if (bucket) {
      bucket.push({ file, date, line });
    } else {
      byDate.set(date, [{ file, date, line }]);
    }
  }

  return { byDate, failed };
}

/**
 * Read existing date-bucket file content (if any) so the migration can append
 * without clobbering sessions written by previous v3 runs.
 */
async function readExistingDateBucket(path: string): Promise<string> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return "";
  }
}

async function appendWarnings(
  paths: MigratePaths,
  failed: string[],
): Promise<void> {
  if (failed.length === 0) return;
  const stamp = new Date().toISOString();
  const lines = failed.map((f) => `${stamp}\t${f}`).join("\n") + "\n";
  await writeFile(paths.warningsLog, lines, { flag: "a", encoding: "utf-8" });
}

/**
 * One-time migration of legacy v1 UUID-named sealed sessions into v3
 * date-bucketed jsonl files (`YYYY-MM-DD.jsonl`).
 *
 * Operational guarantees:
 * - Source files are *moved* into `sealed.v1-archive/`, never deleted, so the
 *   original chain records are always recoverable.
 * - Date-bucket writes are atomic per-date (`.tmp` + fsync + rename). A crash
 *   mid-day leaves an orphan `.tmp` and pristine source files; the next run
 *   will re-pick them up.
 * - PID-based lock at `data/.migrating` prevents concurrent runs; stale locks
 *   from dead PIDs are reaped automatically.
 * - Idempotent: once `data/.migrated-v1` exists, returns `{ skipped: true }`.
 * - Malformed source files are left in place and logged to
 *   `data/.migrate-v1-warnings.log` for manual investigation.
 *
 * @param dataDir Optional override for the useai data directory. Defaults to
 *   the real `~/.useai/data`. Tests pass a tmpdir.
 */
export async function migrateV1IfNeeded(
  dataDir: string = DEFAULT_DATA_DIR,
): Promise<MigrateResult> {
  const paths = buildPaths(dataDir);

  // Idempotency gate.
  if (existsSync(paths.doneMarker)) {
    return { migrated: 0, warnings: 0, skipped: true };
  }

  await ensureDir(paths.dataDir);

  const acquired = await acquireMigrationLock(paths);
  if (!acquired) {
    // Another live process is migrating. Bail without doing work; the running
    // daemon will finish and write the done-marker on its own.
    return { migrated: 0, warnings: 0, skipped: true };
  }

  try {
    const { byDate, failed } = await scanSources(paths);

    if (byDate.size === 0 && failed.length === 0) {
      // No v1 files exist. Mark migration as done so we never scan again.
      await writeFile(
        paths.doneMarker,
        JSON.stringify({ count: 0, completedAt: new Date().toISOString() }),
        "utf-8",
      );
      return { migrated: 0, warnings: 0, skipped: false };
    }

    await ensureDir(paths.sealedDir);
    await ensureDir(paths.archiveDir);

    let migrated = 0;

    // Process one date at a time. Each date is committed atomically before its
    // source files are archived, so a crash between dates leaves earlier dates
    // fully migrated and later dates' sources untouched.
    for (const [date, sources] of byDate) {
      const targetPath = join(paths.sealedDir, `${date}.jsonl`);
      const existing = await readExistingDateBucket(targetPath);
      const newLines = sources.map((s) => s.line).join("\n");

      // Normalize: existing content always ends with \n if non-empty;
      // appended content always ends with \n.
      let merged = existing;
      if (merged.length > 0 && !merged.endsWith("\n")) merged += "\n";
      merged += newLines + "\n";

      await atomicWrite(targetPath, merged);

      // Date bucket is durably in place — now archive the source files.
      for (const s of sources) {
        const from = join(paths.sealedDir, s.file);
        const to = join(paths.archiveDir, s.file);
        await rename(from, to);
        migrated += 1;
      }
    }

    await appendWarnings(paths, failed);

    await writeFile(
      paths.doneMarker,
      JSON.stringify({ count: migrated, completedAt: new Date().toISOString() }),
      "utf-8",
    );

    return { migrated, warnings: failed.length, skipped: false };
  } finally {
    await releaseMigrationLock(paths);
  }
}
