import type { Command } from "commander";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerTools } from "../../mcp-tools/mcp-tools.js";
import { createPromptContext } from "../../core/prompt-context.js";

async function runStdioMcpServer(): Promise<void> {
  const promptContext = createPromptContext();
  const server = new McpServer({ name: "useai", version: "1.0.0" });
  registerTools(server, promptContext);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

export function registerMcp(program: Command): void {
  // Hidden: spawned by AI tools over stdio, never typed by humans. Surfacing
  // it in --help would just confuse end users so we keep it out of the menu.
  program
    .command("mcp", { hidden: true })
    .description("(internal) Run useai as an MCP stdio server")
    .action(async () => {
      try {
        await runStdioMcpServer();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        process.stderr.write(`useai mcp: ${msg}\n`);
        process.exit(1);
      }
    });
}
