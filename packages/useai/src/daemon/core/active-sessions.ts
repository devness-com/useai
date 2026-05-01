/**
 * In-memory active-session counter.
 *
 * Incremented by useai_start (root + child) and decremented by useai_end so
 * the auto-updater can answer one question: "is anything in flight right
 * now?". Process-local on purpose — when the daemon restarts after a self-
 * update the counter resets to zero, which is the correct behaviour: any
 * session that didn't seal pre-restart is gone for that process anyway.
 */

let activeSessions = 0;

export function incrementActiveSessions(): void {
  activeSessions += 1;
}

export function decrementActiveSessions(): void {
  // Floor at zero. A double-decrement (e.g. useai_end called twice for the
  // same session) must not flip the counter negative and lock the gate open.
  if (activeSessions > 0) activeSessions -= 1;
}

export function getActiveSessionCount(): number {
  return activeSessions;
}

/** Test-only reset hook. Not exposed by the package's public entry. */
export function _resetActiveSessionsForTests(): void {
  activeSessions = 0;
}
