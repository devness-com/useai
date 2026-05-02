import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@devness/useai-types";
import { calculateStreak, calculateStreakDetailed } from "./stats.js";

function mkSession(dateStr: string): Session {
  const start = new Date(`${dateStr}T10:00:00`);
  const end = new Date(`${dateStr}T10:30:00`);
  return {
    promptId: `p-${dateStr}`,
    connectionId: `c-${dateStr}`,
    client: "claude-code",
    taskType: "coding",
    title: "test",
    startedAt: start.toISOString(),
    endedAt: end.toISOString(),
    durationMs: 30 * 60_000,
    milestones: [],
    prevHash: "",
    hash: "",
    signature: "",
  };
}

function dateRange(from: string, to: string): string[] {
  const out: string[] = [];
  const start = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  const cur = new Date(start);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    out.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

describe("calculateStreakDetailed", () => {
  beforeEach(() => {
    // Wednesday, 2025-06-04 — middle of a week so we can construct
    // weekday/weekend cases deterministically.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-04T12:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns zero streak on empty input", () => {
    const r = calculateStreakDetailed([]);
    expect(r.current).toBe(0);
    expect(r.longest).toBe(0);
    expect(r.freezesUsed).toBe(0);
    expect(r.freezesRemaining).toBe(2);
    expect(r.activeDaysInWindow).toBe(0);
  });

  it("returns zero when most recent activity is older than yesterday", () => {
    // Today=Wed Jun 4. Most recent active = Sat May 31 (4 days ago).
    const sessions = [mkSession("2025-05-31")];
    const r = calculateStreakDetailed(sessions);
    expect(r.current).toBe(0);
    expect(r.longest).toBeGreaterThanOrEqual(1);
  });

  it("counts a single active day (today) as a streak of 1", () => {
    const r = calculateStreakDetailed([mkSession("2025-06-04")]);
    expect(r.current).toBe(1);
  });

  it("anchors on yesterday (1-day grace)", () => {
    const r = calculateStreakDetailed([mkSession("2025-06-03")]);
    expect(r.current).toBe(1);
  });

  it("counts consecutive days correctly", () => {
    const sessions = dateRange("2025-05-30", "2025-06-04").map(mkSession);
    const r = calculateStreakDetailed(sessions);
    expect(r.current).toBe(6);
    expect(r.freezesUsed).toBe(0);
  });

  it("treats weekend gaps as free when weekendFreezeFree", () => {
    // Today=Wed. Active on Wed+Tue+Mon, then Fri before (skipping Sat+Sun).
    const sessions = [
      mkSession("2025-06-04"),
      mkSession("2025-06-03"),
      mkSession("2025-06-02"),
      mkSession("2025-05-30"),
    ].concat(); // active Mon-Wed + previous Fri, weekend gap free
    const r = calculateStreakDetailed(sessions);
    // Current run length = 4 active days (Mon, Tue, Wed today, Fri before)
    expect(r.current).toBe(4);
    expect(r.freezesUsed).toBe(0);
  });

  it("consumes a freeze for a single weekday gap", () => {
    // Today=Wed. Active on Wed and Mon (skipping Tue — a weekday gap).
    const sessions = [mkSession("2025-06-04"), mkSession("2025-06-02")];
    const r = calculateStreakDetailed(sessions);
    expect(r.current).toBe(2);
    expect(r.freezesUsed).toBe(1);
    expect(r.freezesRemaining).toBe(1);
  });

  it("consumes both freezes for two weekday gaps", () => {
    // Today=Wed. Active on Wed, Mon, prev Thu (May 29). Skipped Tue and Fri (May 30).
    const sessions = [
      mkSession("2025-06-04"),
      mkSession("2025-06-02"),
      mkSession("2025-05-29"),
    ];
    const r = calculateStreakDetailed(sessions);
    expect(r.current).toBe(3);
    expect(r.freezesUsed).toBe(2);
    expect(r.freezesRemaining).toBe(0);
  });

  it("breaks the streak after a third weekday gap", () => {
    // Active on Wed, Mon (skip Tue), Thu prev week (skip Fri May 30), Tue May 27 (skip Wed May 28).
    // Three weekday gaps — third one breaks.
    const sessions = [
      mkSession("2025-06-04"),
      mkSession("2025-06-02"),
      mkSession("2025-05-29"),
      mkSession("2025-05-27"),
    ];
    const r = calculateStreakDetailed(sessions);
    expect(r.current).toBe(3);
    expect(r.freezesUsed).toBe(2);
  });

  it("counts activeDaysInWindow within the rolling window", () => {
    // 10 active days in the last 30 days.
    const sessions = dateRange("2025-05-26", "2025-06-04").map(mkSession);
    const r = calculateStreakDetailed(sessions);
    expect(r.activeDaysInWindow).toBe(10);
    expect(r.windowDays).toBe(30);
  });

  it("respects custom freezesAllowed=0 (strict mode)", () => {
    const sessions = [mkSession("2025-06-04"), mkSession("2025-06-02")];
    const r = calculateStreakDetailed(sessions, { freezesAllowed: 0 });
    expect(r.current).toBe(1);
    expect(r.freezesUsed).toBe(0);
  });

  it("computes longest >= current", () => {
    const sessions = dateRange("2025-05-01", "2025-06-04").map(mkSession);
    const r = calculateStreakDetailed(sessions);
    expect(r.longest).toBeGreaterThanOrEqual(r.current);
  });
});

describe("calculateStreak (back-compat number return)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-04T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("returns just the current streak number", () => {
    const sessions = dateRange("2025-06-02", "2025-06-04").map(mkSession);
    expect(calculateStreak(sessions)).toBe(3);
  });

  it("survives a single missed weekday with default freezes", () => {
    // Skipped Tue Jun 3 — would have reset to 1 with old code.
    const sessions = [mkSession("2025-06-04"), mkSession("2025-06-02")];
    expect(calculateStreak(sessions)).toBe(2);
  });
});

describe("calculateStreakDetailed — edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-04T12:00:00"));
  });
  afterEach(() => vi.useRealTimers());

  it("ignores sessions with durationMs <= 0", () => {
    const broken = mkSession("2025-06-04");
    broken.durationMs = 0;
    const r = calculateStreakDetailed([broken]);
    expect(r.current).toBe(0);
    expect(r.activeDaysInWindow).toBe(0);
  });

  it("ignores sessions without endedAt", () => {
    const broken = mkSession("2025-06-04");
    (broken as unknown as { endedAt: string | undefined }).endedAt = undefined;
    const r = calculateStreakDetailed([broken]);
    expect(r.current).toBe(0);
  });

  it("multiple sessions on same day count as one active day", () => {
    const sessions = [
      mkSession("2025-06-04"),
      mkSession("2025-06-04"),
      mkSession("2025-06-04"),
    ];
    const r = calculateStreakDetailed(sessions);
    expect(r.current).toBe(1);
    expect(r.activeDaysInWindow).toBe(1);
  });

  it("respects custom windowDays=7", () => {
    const sessions = dateRange("2025-05-25", "2025-06-04").map(mkSession);
    const r = calculateStreakDetailed(sessions, { windowDays: 7 });
    expect(r.windowDays).toBe(7);
    expect(r.activeDaysInWindow).toBe(7); // last 7 days all active
    // current is bounded by walking back at most windowDays days from today
    expect(r.current).toBeLessThanOrEqual(7);
  });

  it("freezesAllowed=99 effectively disables breaks within the window", () => {
    // Active today (Wed Jun 4) and 12 days back (May 23 = Friday).
    // Bridging that requires consuming several freezes for missed weekdays.
    // With freezesAllowed=99 the streak doesn't break.
    const sessions = [mkSession("2025-06-04"), mkSession("2025-05-23")];
    const r = calculateStreakDetailed(sessions, { freezesAllowed: 99 });
    expect(r.current).toBe(2);
    expect(r.freezesUsed).toBeGreaterThan(0);
  });

  it("weekendFreezeFree=false treats weekends like weekdays", () => {
    // Today=Wed, active Mon (Jun 2), prev Fri (May 30). With weekendFreezeFree=false
    // Sat+Sun become weekday gaps and consume freezes.
    const sessions = [
      mkSession("2025-06-04"),
      mkSession("2025-06-03"),
      mkSession("2025-06-02"),
      mkSession("2025-05-30"),
    ];
    const strict = calculateStreakDetailed(sessions, {
      weekendFreezeFree: false,
    });
    // Walk back: Wed=active(1), Tue=active(2), Mon=active(3), Sun=freeze(1),
    // Sat=freeze(2), Fri=active(4 with 2 freezes folded). Then... Thu May 29
    // is a weekday, no freezes left → break.
    expect(strict.current).toBe(4);
    expect(strict.freezesUsed).toBe(2);
  });

  it("longest streak survives a multi-month gap", () => {
    // 10-day run in April, then a 3-month gap, then 5-day run ending today.
    const aprilRun = dateRange("2025-04-01", "2025-04-10");
    const recent = dateRange("2025-05-31", "2025-06-04");
    const sessions = [...aprilRun, ...recent].map(mkSession);
    const r = calculateStreakDetailed(sessions);
    expect(r.longest).toBeGreaterThanOrEqual(10);
    expect(r.current).toBe(5);
  });

  it("freezesRemaining + freezesUsed equals freezesAllowed", () => {
    const sessions = [mkSession("2025-06-04"), mkSession("2025-06-02")];
    const r = calculateStreakDetailed(sessions, { freezesAllowed: 5 });
    expect(r.freezesUsed + r.freezesRemaining).toBe(5);
  });

  it("clamps freezesRemaining to non-negative even on edge inputs", () => {
    const r = calculateStreakDetailed([], { freezesAllowed: 0 });
    expect(r.freezesRemaining).toBe(0);
    expect(r.freezesUsed).toBe(0);
  });

  it("longest is never less than current", () => {
    const sessions = dateRange("2025-05-01", "2025-06-04").map(mkSession);
    const r = calculateStreakDetailed(sessions);
    expect(r.longest).toBeGreaterThanOrEqual(r.current);
  });
});
