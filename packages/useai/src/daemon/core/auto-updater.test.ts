import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  PROBATION_SUCCESS_MS,
  PROBATION_WINDOW_MS,
  ROLLBACK_CRASH_THRESHOLD,
  checkWritability,
  decideRollback,
  pruneSnapshots,
  type CrashRecord,
  type ProbationRecord,
} from "./auto-updater.js";

// ---------------------------------------------------------------------------
// decideRollback — pure function, exercises the three branches.
// ---------------------------------------------------------------------------

describe("decideRollback", () => {
  const updatedAt = new Date("2026-05-01T00:00:00.000Z");
  const updatedAtMs = updatedAt.getTime();

  function makeProbation(): ProbationRecord {
    return {
      updatedAt: updatedAt.toISOString(),
      fromVersion: "1.0.10",
      toVersion: "1.0.11",
      restartsObserved: 1,
      status: "pending",
    };
  }

  function crashAt(offsetMs: number): CrashRecord {
    return {
      timestamp: new Date(updatedAtMs + offsetMs).toISOString(),
      message: "boom",
    };
  }

  it("returns rollback when crash count meets the threshold inside the window", () => {
    const crashes: CrashRecord[] = Array.from(
      { length: ROLLBACK_CRASH_THRESHOLD },
      (_, i) => crashAt((i + 1) * 1000),
    );

    const result = decideRollback({
      probation: makeProbation(),
      crashes,
      now: updatedAtMs + 60_000, // 1 minute after upgrade
    });

    expect(result.action).toBe("rollback");
    expect(result.crashCount).toBe(ROLLBACK_CRASH_THRESHOLD);
  });

  it("ignores crashes that fall outside the probation window", () => {
    const crashes: CrashRecord[] = Array.from(
      { length: ROLLBACK_CRASH_THRESHOLD },
      // All crashes are well after the 5-minute window
      (_, i) => crashAt(PROBATION_WINDOW_MS + (i + 1) * 1000),
    );

    const result = decideRollback({
      probation: makeProbation(),
      crashes,
      // Just past the rollback window but before the success deadline
      now: updatedAtMs + PROBATION_WINDOW_MS + 30_000,
    });

    expect(result.action).toBe("continue");
    expect(result.crashCount).toBe(0);
  });

  it("returns success after the success deadline with zero crashes", () => {
    const result = decideRollback({
      probation: makeProbation(),
      crashes: [],
      now: updatedAtMs + PROBATION_SUCCESS_MS + 1,
    });

    expect(result.action).toBe("success");
    expect(result.crashCount).toBe(0);
  });

  it("returns continue while still inside the window with sub-threshold crashes", () => {
    const crashes = [crashAt(10_000)]; // single crash inside window

    const result = decideRollback({
      probation: makeProbation(),
      crashes,
      now: updatedAtMs + 30_000,
    });

    expect(result.action).toBe("continue");
    expect(result.crashCount).toBe(1);
  });

  it("returns continue when the probation timestamp is corrupt", () => {
    const probation: ProbationRecord = {
      ...makeProbation(),
      updatedAt: "not-a-date",
    };

    const result = decideRollback({
      probation,
      crashes: [],
      now: Date.now(),
    });

    expect(result.action).toBe("continue");
  });

  it("ignores crash records with corrupt timestamps", () => {
    const crashes: CrashRecord[] = [
      { timestamp: "garbage", message: "x" },
      crashAt(5_000),
    ];

    const result = decideRollback({
      probation: makeProbation(),
      crashes,
      now: updatedAtMs + 60_000,
    });

    expect(result.action).toBe("continue");
    expect(result.crashCount).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// pruneSnapshots — filesystem-backed, scoped to a tmp dir.
// ---------------------------------------------------------------------------

describe("pruneSnapshots", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "useai-snapshots-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  function makeVersionDir(name: string, mtimeMs: number): void {
    const full = join(tmp, name);
    mkdirSync(full, { recursive: true });
    writeFileSync(join(full, "marker"), name, "utf-8");
    const seconds = mtimeMs / 1000;
    utimesSync(full, seconds, seconds);
  }

  it("keeps the two most recent snapshots and deletes older ones", () => {
    const base = Date.now();
    makeVersionDir("1.0.8", base - 4 * 86_400_000);
    makeVersionDir("1.0.9", base - 3 * 86_400_000);
    makeVersionDir("1.0.10", base - 2 * 86_400_000);
    makeVersionDir("1.0.11", base - 1 * 86_400_000);

    const removed = pruneSnapshots(tmp, 2);

    expect(removed.sort()).toEqual(["1.0.8", "1.0.9"]);
    const remaining = readdirSync(tmp).sort();
    expect(remaining).toEqual(["1.0.10", "1.0.11"]);
  });

  it("is a no-op when fewer snapshots exist than the retention limit", () => {
    makeVersionDir("1.0.10", Date.now());

    const removed = pruneSnapshots(tmp, 2);

    expect(removed).toEqual([]);
    expect(readdirSync(tmp)).toEqual(["1.0.10"]);
  });

  it("is a no-op when the versions directory does not exist", () => {
    const missing = join(tmp, "does-not-exist");
    const removed = pruneSnapshots(missing, 2);
    expect(removed).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// checkWritability — happy + failure path.
// ---------------------------------------------------------------------------

describe("checkWritability", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "useai-writability-"));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("returns true for a writable directory the current user owns", () => {
    expect(checkWritability(tmp)).toBe(true);
  });

  it("returns false for a path that does not exist", () => {
    expect(checkWritability(join(tmp, "missing"))).toBe(false);
  });
});
