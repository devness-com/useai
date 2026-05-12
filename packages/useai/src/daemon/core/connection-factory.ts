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

const PING_INTERVAL_MS = 2 * 60 * 1000;

export async function createMcpConnection(): Promise<WebStandardStreamableHTTPServerTransport> {
  const promptContext = createPromptContext();
  const server = new McpServer({ name: "useai", version: VERSION });

  registerTools(server, promptContext);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
    onsessioninitialized: (connectionId) => {
      promptContext.connectionId = connectionId;
      // Capture the host name as soon as the MCP `initialize` handshake
      // completes. The transport session is created before the handshake,
      // so getClientVersion() is undefined at this exact point — we hook
      // oninitialized instead, which fires after `clientInfo` lands through intialized notification from AI client
      server.server.oninitialized = () => {
        const clientInfo = server.server.getClientVersion();
        if (clientInfo?.name) promptContext.mcpClientName = clientInfo.name;
      };
      const pingInterval = setInterval(() => {
        const conn = connections.get(connectionId);
        if (!conn) return;
        // Skip the probe if a useai tool ran recently — the transport is
        // proven alive by that traffic. Sending a competing `ping` while
        // the agent is actively using the connection has been observed to
        // race and tear down the session, breaking mid-conversation
        // `useai_end` calls with a 404.
        if (Date.now() - conn.lastActivityAt < PING_INTERVAL_MS) return;
        server.server.ping().catch(() => {
          clearInterval(pingInterval);
          connections.delete(promptContext.connectionId!);
          // Drop any in-flight useai sessions tied to this dead transport
          // so /health.active_sessions reflects reality immediately rather
          // than waiting for the active-sessions sweeper.
          unregisterActiveSessionsByConnection(promptContext.connectionId!);
        });
      }, PING_INTERVAL_MS);
      connections.set(connectionId, {
        transport,
        mcpServer: server,
        promptContext,
        pingInterval,
        lastActivityAt: Date.now(),
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
