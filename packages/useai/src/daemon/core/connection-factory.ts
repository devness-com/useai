import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "../../mcp-tools/mcp-tools.js";
import { createPromptContext } from "../../core/prompt-context.js";
import { connections } from "./connection-store.js";
import { unregisterActiveSessionsByConnection } from "./active-sessions.js";

// Injected by tsup at bundle time from packages/useai/package.json.
declare const __VERSION__: string | undefined;
const VERSION =
  typeof __VERSION__ !== "undefined" ? __VERSION__ : "dev";

export async function createMcpConnection(): Promise<WebStandardStreamableHTTPServerTransport> {
  const promptContext = createPromptContext();
  const server = new McpServer({ name: "useai", version: VERSION });

  registerTools(server, promptContext);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (connectionId) => {
      promptContext.connectionId = connectionId;
      const pingInterval = setInterval(
        () => {
          server.server.ping().catch(() => {
            clearInterval(pingInterval);
            connections.delete(promptContext.connectionId!);
            // Drop any in-flight useai sessions tied to this dead transport
            // so /health.active_sessions reflects reality immediately rather
            // than waiting for the active-sessions sweeper.
            unregisterActiveSessionsByConnection(promptContext.connectionId!);
          });
        },
        2 * 60 * 1000,
      );
      connections.set(connectionId, {
        transport,
        mcpServer: server,
        promptContext,
        pingInterval,
      });
    },
    onsessionclosed: (connectionId) => {
      const conn = connections.get(connectionId);
      if (conn) clearInterval(conn.pingInterval);
      connections.delete(connectionId);
      unregisterActiveSessionsByConnection(connectionId);
    },
  });

  await server.connect(transport);

  return transport;
}
