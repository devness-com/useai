import { Hono } from "hono";
import { listActiveSessions } from "../core/active-sessions.js";

export const activeSessionsRoutes = new Hono();

/**
 * GET /api/local/active-sessions
 *
 * Returns the in-memory list of in-flight useai sessions — exactly what
 * `/health.active_sessions` counts. Useful for debugging the discrepancy
 * between `active_sessions` and `mcp_connections` (the latter can be larger
 * when MCP transports stay open without an active session, e.g. idle
 * Cursor windows or worktree subagents that exited before useai_start).
 */
activeSessionsRoutes.get("/", (c) => {
  const now = Date.now();
  const sessions = listActiveSessions().map((s) => ({
    promptId: s.promptId,
    connectionId: s.connectionId,
    client: s.client,
    project: s.project,
    title: s.title,
    startedAt: new Date(s.startedAt).toISOString(),
    lastActivityAt: new Date(s.lastActivityAt).toISOString(),
    idleSeconds: Math.round((now - s.lastActivityAt) / 1000),
    parentPromptId: s.parentPromptId,
    sessionDepth: s.sessionDepth,
  }));
  return c.json({ count: sessions.length, sessions });
});
