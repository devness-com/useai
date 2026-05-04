import type { IncomingMessage } from "node:http";
import { Hono } from "hono";
import { connections } from "../core/connection-store.js";
import { createMcpConnection } from "../core/connection-factory.js";
import { unregisterActiveSessionsByConnection } from "../core/active-sessions.js";

export { getConnectionCount } from "../core/connection-store.js";

export const mcpRoutes = new Hono();

mcpRoutes.all("/", async (c) => {
  const connectionId = c.req.header("mcp-session-id");

  if (connectionId && connections.has(connectionId)) {
    const conn = connections.get(connectionId)!;

    if (c.req.method === "GET") {
      const incoming = (c.env as { incoming?: IncomingMessage }).incoming;
      incoming?.on("close", () => {
        const c = connections.get(connectionId);
        if (c) clearInterval(c.pingInterval);
        connections.delete(connectionId);
        // Mirror the transport tear-down into the active-sessions store so
        // killing a Claude Code window mid-session drops /health within
        // seconds instead of waiting for the 7-min sweeper.
        unregisterActiveSessionsByConnection(connectionId);
      });
    }

    return conn.transport.handleRequest(c.req.raw);
  }

  if (connectionId && !connections.has(connectionId)) {
    return c.json({ error: "Session not found" }, 404);
  }

  const transport = await createMcpConnection();
  return transport.handleRequest(c.req.raw);
});
