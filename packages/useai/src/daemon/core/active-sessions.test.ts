import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  _resetActiveSessionsForTests,
  STALE_TTL_MS,
  SWEEP_INTERVAL_MS,
  getActiveSessionCount,
  listActiveSessions,
  registerActiveSession,
  startActiveSessionsSweeper,
  sweepStaleSessions,
  touchActiveSession,
  unregisterActiveSession,
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

  it("STALE_TTL_MS exceeds the agent's expected heartbeat cadence", () => {
    // CLAUDE.md mandates a heartbeat every 4 minutes (or 10 tool calls).
    // The TTL must give a healthy buffer over that — otherwise live sessions
    // will be wrongly evicted between heartbeats.
    const HEARTBEAT_CADENCE_MS = 4 * 60 * 1000;
    expect(STALE_TTL_MS).toBeGreaterThan(HEARTBEAT_CADENCE_MS);
    // But not so wide that crashed sessions linger for hours.
    expect(STALE_TTL_MS).toBeLessThanOrEqual(15 * 60 * 1000);
    expect(SWEEP_INTERVAL_MS).toBeLessThanOrEqual(STALE_TTL_MS);
  });
});
