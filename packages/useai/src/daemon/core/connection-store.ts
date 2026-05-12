import type { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { PromptContext } from "../../core/prompt-context.js";

export interface Connection {
  transport: WebStandardStreamableHTTPServerTransport;
  mcpServer: McpServer;
  promptContext: PromptContext;
  pingInterval: NodeJS.Timeout;
  /**
   * Monotonic ms timestamp of the last useai tool call on this connection.
   * Used by the keep-alive ping to skip probing when the transport is
   * obviously alive — a recent `useai_start`/`useai_heartbeat`/`useai_end`
   * proves the connection is healthy, and skipping the ping avoids racing
   * with the agent's own request, which has been observed to false-negative
   * the session and tear it down mid-conversation.
   */
  lastActivityAt: number;
}

// Keyed by connectionId (the MCP transport session ID)
export const connections = new Map<string, Connection>();

export function getConnectionCount(): number {
  return connections.size;
}

/** Bump `lastActivityAt` for the connection that owns this useai session. */
export function recordActivity(connectionId: string | undefined): void {
  if (!connectionId) return;
  const conn = connections.get(connectionId);
  if (conn) conn.lastActivityAt = Date.now();
}
