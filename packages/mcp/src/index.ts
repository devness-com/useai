#!/usr/bin/env node

export {};

const subcommand = process.argv[2];

// CLI mode: handle setup commands before MCP server initialization
if (subcommand === 'mcp' || subcommand?.startsWith('--') || (!subcommand && process.stdin.isTTY)) {
  const args = subcommand === 'mcp' ? process.argv.slice(3) : process.argv.slice(2);
  const { runSetup } = await import('./setup.js');
  await runSetup(args);
  process.exit(0);
}

// Daemon mode: start HTTP server with StreamableHTTP transport
if (subcommand === 'daemon') {
  const { startDaemon } = await import('./daemon.js');
  const portArg = process.argv.indexOf('--port');
  const port = portArg !== -1 ? parseInt(process.argv[portArg + 1]!, 10) : undefined;
  await startDaemon(port);
  // daemon runs until killed — don't fall through
  await new Promise(() => {}); // block forever
}

// ── MCP Server (stdio mode — stdin is piped from an AI tool) ────────────────

const { McpServer } = await import('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
const { VERSION, ensureDir } = await import('@useai/shared');
const { SessionState } = await import('./session-state.js');
const { registerTools } = await import('./register-tools.js');

const session = new SessionState();
const server = new McpServer({
  name: 'UseAI',
  version: VERSION,
});

registerTools(server, session);

async function main() {
  ensureDir();

  try {
    session.initializeKeystore();
  } catch {
    // signingAvailable remains false
  }

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error('useai MCP server failed to start:', error);
  process.exit(1);
});
