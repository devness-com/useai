import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetActiveSessionsForTests,
  STALE_TTL_MS,
  SWEEP_INTERVAL_MS,
  getActiveSessionCount,
  hasActiveSession,
  listActiveSessions,
  registerActiveSession,
  startActiveSessionsSweeper,
  sweepStaleSessions,
  touchActiveSession,
  unregisterActiveSession,
  unregisterActiveSessionsByConnection,
  type ActiveSessionRecord,
} from "./active-sessions.js";

function makeRecord(
  overrides: Partial<Omit<ActiveSessionRecord, "lastActivityAt">> = {},
): Omit<ActiveSessionRecord, "lastActivityAt"> {
  return {
    promptId: overrides.promptId ?? "prompt_1",
    connectionId: overrides.connectionId ?? "conn_1",
    client: overrides.client ?? "claude-code",
    project: overrides.project ?? "useai",
    title: overrides.title ?? "demo",
    startedAt: overrides.startedAt ?? Date.now(),
    parentPromptId: overrides.parentPromptId ?? null,
    sessionDepth: overrides.sessionDepth ?? 0,
  };
}

describe("active-sessions store", () => {
  beforeEach(() => {
    _resetActiveSessionsForTests();
  });

  afterEach(() => {
    _resetActiveSessionsForTests();
  });

  it("registers a session and counts it", () => {
    expect(getActiveSessionCount()).toBe(0);
    registerActiveSession(makeRecord({ promptId: "prompt_a" }));
    expect(getActiveSessionCount()).toBe(1);
    expect(listActiveSessions()).toHaveLength(1);
    expect(listActiveSessions()[0]!.promptId).toBe("prompt_a");
  });

  it("seeds lastActivityAt from startedAt on register", () => {
    const startedAt = 1_000_000;
    registerActiveSession(makeRecord({ promptId: "prompt_a", startedAt }));
    expect(listActiveSessions()[0]!.lastActivityAt).toBe(startedAt);
  });

  it("unregister is a no-op for unknown promptId", () => {
    unregisterActiveSession("does-not-exist");
    expect(getActiveSessionCount()).toBe(0);
  });

  it("unregister removes a registered session", () => {
    registerActiveSession(makeRecord({ promptId: "prompt_a" }));
    registerActiveSession(makeRecord({ promptId: "prompt_b" }));
    unregisterActiveSession("prompt_a");
    expect(getActiveSessionCount()).toBe(1);
    expect(listActiveSessions()[0]!.promptId).toBe("prompt_b");
  });

  it("touch updates lastActivityAt for the matching record only", () => {
    registerActiveSession(
      makeRecord({ promptId: "prompt_a", startedAt: 1_000 }),
    );
    registerActiveSession(
      makeRecord({ promptId: "prompt_b", startedAt: 2_000 }),
    );
    touchActiveSession("prompt_a", 5_000);
    const a = listActiveSessions().find((r) => r.promptId === "prompt_a")!;
    const b = listActiveSessions().find((r) => r.promptId === "prompt_b")!;
    expect(a.lastActivityAt).toBe(5_000);
    expect(b.lastActivityAt).toBe(2_000);
  });

  it("touch is a no-op for unknown promptId", () => {
    expect(() => touchActiveSession("ghost", 9_999)).not.toThrow();
  });

  it("sweepStaleSessions evicts entries older than the threshold", () => {
    const now = 10_000_000;
    registerActiveSession(
      makeRecord({ promptId: "fresh", startedAt: now }),
    );
    registerActiveSession(
      makeRecord({
        promptId: "stale",
        startedAt: now - STALE_TTL_MS - 1_000,
      }),
    );
    const evicted = sweepStaleSessions(STALE_TTL_MS, now);
    expect(evicted).toHaveLength(1);
    expect(evicted[0]!.promptId).toBe("stale");
    expect(getActiveSessionCount()).toBe(1);
    expect(listActiveSessions()[0]!.promptId).toBe("fresh");
  });

  it("sweepStaleSessions respects an explicit threshold", () => {
    const now = 10_000_000;
    registerActiveSession(
      makeRecord({ promptId: "old", startedAt: now - 60_000 }),
    );
    expect(sweepStaleSessions(120_000, now)).toHaveLength(0);
    expect(sweepStaleSessions(30_000, now)).toHaveLength(1);
  });

  it("touch resets the staleness clock", () => {
    const start = 10_000_000;
    registerActiveSession(
      makeRecord({ promptId: "prompt_a", startedAt: start }),
    );
    const checkAt = start + STALE_TTL_MS + 1_000;
    touchActiveSession("prompt_a", checkAt - 1_000);
    expect(sweepStaleSessions(STALE_TTL_MS, checkAt)).toHaveLength(0);
    expect(getActiveSessionCount()).toBe(1);
  });

  it("startActiveSessionsSweeper evicts on tick and reports each eviction", () => {
    vi.useFakeTimers();
    try {
      const evictedCalls: string[] = [];
      const start = Date.now();
      registerActiveSession(
        makeRecord({
          promptId: "stale",
          startedAt: start - STALE_TTL_MS - 1_000,
        }),
      );
      registerActiveSession(
        makeRecord({ promptId: "fresh", startedAt: start }),
      );

      const stop = startActiveSessionsSweeper(STALE_TTL_MS, 1_000, (r) => {
        evictedCalls.push(r.promptId);
      });

      vi.advanceTimersByTime(1_000);

      expect(evictedCalls).toEqual(["stale"]);
      expect(getActiveSessionCount()).toBe(1);

      stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it("unregisterActiveSessionsByConnection drops every session for that connection", () => {
    registerActiveSession(
      makeRecord({ promptId: "p1", connectionId: "conn_a" }),
    );
    registerActiveSession(
      makeRecord({ promptId: "p2", connectionId: "conn_a" }),
    );
    registerActiveSession(
      makeRecord({ promptId: "p3", connectionId: "conn_b" }),
    );

    const evicted = unregisterActiveSessionsByConnection("conn_a");

    expect(evicted.map((r) => r.promptId).sort()).toEqual(["p1", "p2"]);
    expect(getActiveSessionCount()).toBe(1);
    expect(listActiveSessions()[0]!.promptId).toBe("p3");
  });

  it("unregisterActiveSessionsByConnection is a no-op for unknown / empty connectionId", () => {
    registerActiveSession(
      makeRecord({ promptId: "p1", connectionId: "conn_a" }),
    );
    expect(unregisterActiveSessionsByConnection("ghost")).toEqual([]);
    expect(unregisterActiveSessionsByConnection("")).toEqual([]);
    expect(getActiveSessionCount()).toBe(1);
  });

  it("hasActiveSession reflects the store contents", () => {
    expect(hasActiveSession("p1")).toBe(false);
    registerActiveSession(makeRecord({ promptId: "p1" }));
    expect(hasActiveSession("p1")).toBe(true);
    unregisterActiveSession("p1");
    expect(hasActiveSession("p1")).toBe(false);
  });

  it("STALE_TTL_MS tolerates at least two missed heartbeats", () => {
    // CLAUDE.md mandates a heartbeat every 4 minutes (or 10 tool calls).
    // A 7-min TTL only tolerates one missed heartbeat — sessions sometimes
    // go quiet for 5–6 min on a single long tool call, and one missed
    // heartbeat shouldn't false-evict them. Two missed heartbeats = ~8 min,
    // so the TTL must clear that bar.
    const HEARTBEAT_CADENCE_MS = 4 * 60 * 1000;
    expect(STALE_TTL_MS).toBeGreaterThanOrEqual(2 * HEARTBEAT_CADENCE_MS);
    // But not so wide that crashed sessions linger for hours.
    expect(STALE_TTL_MS).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(SWEEP_INTERVAL_MS).toBeLessThanOrEqual(STALE_TTL_MS);
  });
});
