import { Hono } from "hono";
import { getConnectionCount } from "./mcp.js";
import { getActiveSessionCount } from "../core/active-sessions.js";

// Injected by tsup at bundle time from packages/useai/package.json. Falls back
// to "dev" when running via the un-bundled tsc output so the daemon doesn't
// crash during local development.
declare const __VERSION__: string | undefined;
const VERSION =
  typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

const startTime = Date.now();

export const healthRoutes = new Hono();

healthRoutes.get("/health", (c) => {
  // active_sessions = in-flight useai sessions (registered via useai_start,
  // removed via useai_end or the stale-session sweeper).
  // mcp_connections = open MCP transport sockets — strictly larger or equal
  // (a tool can have an MCP connection open without an active useai session,
  // e.g. an idle Cursor/Windsurf window or a worktree subagent that exited
  // before calling useai_start).
  return c.json({
    status: "ok" as const,
    version: VERSION,
    active_sessions: getActiveSessionCount(),
    mcp_connections: getConnectionCount(),
    uptime_seconds: Math.round((Date.now() - startTime) / 1000),
  });
});
