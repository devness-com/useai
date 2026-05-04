/**
 * In-memory store of in-flight useai sessions, keyed by promptId.
 *
 * Source of truth for `/health.active_sessions` and the auto-updater's idle
 * gate. A session is registered on `useai_start` and removed on `useai_end`.
 * Every `useai_*` tool call bumps `lastActivityAt`; the sweeper drops any
 * record whose last activity is older than `STALE_TTL_MS` so a crashed or
 * killed client doesn't leak its session forever.
 *
 * Process-local on purpose — when the daemon restarts, the Map is empty,
 * which is the correct behaviour: any session whose seal didn't reach disk
 * before the restart is gone for that process anyway.
 */

/** Hard cap on how long a registered session may go without activity before
 *  the sweeper evicts it. Must be wider than the agent's heartbeat cadence
 *  (~4 min in CLAUDE.md) plus a buffer for clock skew and slow tool calls. */
export const STALE_TTL_MS = 7 * 60 * 1000;

/** How often the sweeper runs. */
export const SWEEP_INTERVAL_MS = 60 * 1000;

export interface ActiveSessionRecord {
  promptId: string;
  /** MCP transport session id (empty string when registered outside an MCP transport). */
  connectionId: string;
  client: string;
  project: string | null;
  title: string | null;
  /** ms since epoch */
  startedAt: number;
  /** ms since epoch — bumped on every `useai_*` tool call. */
  lastActivityAt: number;
  /** Set when this session is a concurrent child spawned inside another session. */
  parentPromptId: string | null;
  sessionDepth: number;
}

const sessions = new Map<string, ActiveSessionRecord>();

export function registerActiveSession(
  record: Omit<ActiveSessionRecord, "lastActivityAt">,
): void {
  sessions.set(record.promptId, {
    ...record,
    lastActivityAt: record.startedAt,
  });
}

export function unregisterActiveSession(promptId: string): void {
  sessions.delete(promptId);
}

export function touchActiveSession(
  promptId: string,
  now: number = Date.now(),
): void {
  const record = sessions.get(promptId);
  if (record) record.lastActivityAt = now;
}

export function getActiveSessionCount(): number {
  return sessions.size;
}

export function listActiveSessions(): ActiveSessionRecord[] {
  return Array.from(sessions.values());
}

/**
 * Drop sessions whose `lastActivityAt` is older than `thresholdMs`.
 * Returns the evicted records so callers can log them.
 */
export function sweepStaleSessions(
  thresholdMs: number = STALE_TTL_MS,
  now: number = Date.now(),
): ActiveSessionRecord[] {
  const evicted: ActiveSessionRecord[] = [];
  for (const [promptId, record] of sessions.entries()) {
    if (now - record.lastActivityAt > thresholdMs) {
      sessions.delete(promptId);
      evicted.push(record);
    }
  }
  return evicted;
}

/**
 * Start the periodic sweeper. Returns a stop function for tests.
 * The interval is `unref`'d so it never blocks process exit.
 */
export function startActiveSessionsSweeper(
  thresholdMs: number = STALE_TTL_MS,
  intervalMs: number = SWEEP_INTERVAL_MS,
  onEvict: (record: ActiveSessionRecord) => void = (record) => {
    console.warn(
      `useai daemon: evicted stale session ${record.promptId} (project=${record.project ?? "?"}, idle=${Math.round(
        (Date.now() - record.lastActivityAt) / 1000,
      )}s)`,
    );
  },
): () => void {
  const timer = setInterval(() => {
    const evicted = sweepStaleSessions(thresholdMs);
    for (const record of evicted) onEvict(record);
  }, intervalMs);
  if (typeof timer === "object" && "unref" in timer) timer.unref();
  return () => clearInterval(timer);
}

/** Test-only reset hook. Not exposed by the package's public entry. */
export function _resetActiveSessionsForTests(): void {
  sessions.clear();
}
