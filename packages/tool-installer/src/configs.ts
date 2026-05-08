import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync } from "node:fs";
import type { ConfigFormat } from "./formats.js";

export interface ToolConfig {
  id: string;
  name: string;
  configPath: string;
  configFormat: ConfigFormat;
  mcpKey: string;
  /**
   * Which MCP transport to write into the tool's config.
   *
   * - "http": tool's MCP server entry points at the daemon's HTTP endpoint
   *   (`http://127.0.0.1:19200/mcp`). Single shared daemon, lower overhead,
   *   visible in `useai daemon status`. Use for tools that support
   *   Streamable HTTP MCP.
   * - "stdio": tool's MCP server entry spawns `npx ... useai mcp` per session.
   *   Universal compatibility — every MCP client speaks stdio — but the
   *   tool runs its own copy of useai instead of going through the daemon.
   *   Use as the safe default for tools whose HTTP support is uncertain
   *   or known to be missing.
   *
   * When in doubt, prefer "stdio" — it always works.
   */
  transport: "http" | "stdio";
  instructionsPath?: string;
  instructionsMethod?: "append" | "create";
  detect: () => boolean;
}

const HOME = homedir();
const APP_SUPPORT = join(HOME, "Library", "Application Support");

const TOOL_CONFIGS: Record<string, ToolConfig> = {
  "claude-code": {
    id: "claude-code",
    name: "Claude Code",
    //mcp tools are registed in this file
    configPath: join(HOME, ".claude.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    //instruction goes in this file.
    instructionsPath: join(HOME, ".claude", "CLAUDE.md"),
    instructionsMethod: "append",
    detect: () => existsSync(join(HOME, ".claude")),
  },
  "claude-desktop": {
    id: "claude-desktop",
    name: "Claude Desktop",
    configPath: join(APP_SUPPORT, "Claude", "claude_desktop_config.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    detect: () => existsSync(join(APP_SUPPORT, "Claude")),
  },
  cursor: {
    id: "cursor",
    name: "Cursor",
    configPath: join(HOME, ".cursor", "mcp.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    instructionsPath: join(HOME, ".cursor", "rules", "useai.mdc"),
    instructionsMethod: "create",
    detect: () => existsSync(join(HOME, ".cursor")),
  },
  windsurf: {
    id: "windsurf",
    name: "Windsurf",
    configPath: join(HOME, ".codeium", "windsurf", "mcp_config.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    instructionsPath: join(
      HOME,
      ".codeium",
      "windsurf",
      "memories",
      "global_rules.md",
    ),
    instructionsMethod: "append",
    detect: () => existsSync(join(HOME, ".codeium", "windsurf")),
  },
  "vscode-copilot": {
    id: "vscode-copilot",
    name: "VS Code Copilot",
    configPath: join(HOME, ".vscode", "mcp.json"),
    configFormat: "json",
    mcpKey: "servers",
    transport: "http",
    instructionsPath: join(
      APP_SUPPORT,
      "Code",
      "User",
      "prompts",
      "useai.instructions.md",
    ),
    instructionsMethod: "create",
    detect: () => existsSync(join(APP_SUPPORT, "Code")),
  },
  "vscode-insiders": {
    id: "vscode-insiders",
    name: "VS Code Insiders",
    configPath: join(HOME, ".vscode-insiders", "mcp.json"),
    configFormat: "json",
    mcpKey: "servers",
    transport: "http",
    instructionsPath: join(
      APP_SUPPORT,
      "Code - Insiders",
      "User",
      "prompts",
      "useai.instructions.md",
    ),
    instructionsMethod: "create",
    detect: () => existsSync(join(APP_SUPPORT, "Code - Insiders")),
  },
  "gemini-cli": {
    id: "gemini-cli",
    name: "Gemini CLI",
    configPath: join(HOME, ".gemini", "settings.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    instructionsPath: join(HOME, ".gemini", "GEMINI.md"),
    instructionsMethod: "append",
    detect: () => existsSync(join(HOME, ".gemini")),
  },
  "copilot-cli": {
    id: "copilot-cli",
    name: "GitHub Copilot CLI",
    configPath: join(HOME, ".config", "gh-copilot", "mcp.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    detect: () => existsSync(join(HOME, ".config", "gh-copilot")),
  },
  codex: {
    id: "codex",
    name: "OpenAI Codex CLI",
    configPath: join(HOME, ".codex", "config.toml"),
    configFormat: "toml",
    mcpKey: "mcp_servers",
    transport: "http",
    instructionsPath: join(HOME, ".codex", "AGENTS.md"),
    instructionsMethod: "append",
    detect: () => existsSync(join(HOME, ".codex")),
  },
  trae: {
    id: "trae",
    name: "Trae",
    configPath: join(HOME, ".trae", "mcp.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "stdio",
    detect: () => existsSync(join(HOME, ".trae")),
  },
  "kilo-code": {
    id: "kilo-code",
    name: "Kilo Code",
    configPath: join(
      HOME,
      APP_SUPPORT,
      "Code",
      "User",
      "globalStorage",
      "kilocode.kilo-code",
      "settings",
      "mcp_settings.json",
    ),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    detect: () =>
      existsSync(
        join(
          APP_SUPPORT,
          "Code",
          "User",
          "globalStorage",
          "kilocode.kilo-code",
        ),
      ),
  },
  crush: {
    id: "crush",
    name: "Crush",
    configPath: join(HOME, ".config", "crush", "mcp.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    detect: () => existsSync(join(HOME, ".config", "crush")),
  },
  antigravity: {
    id: "antigravity",
    name: "Antigravity",
    configPath: join(HOME, ".config", "antigravity", "config.yaml"),
    configFormat: "yaml",
    mcpKey: "mcpServers",
    transport: "stdio",
    detect: () =>
      existsSync(join(HOME, ".antigravity")) ||
      existsSync(join(HOME, ".config", "Antigravity")) ||
      existsSync(join(HOME, ".config", "antigravity")) ||
      existsSync(join(APP_SUPPORT, "Antigravity")),
  },
  goose: {
    id: "goose",
    name: "Goose",
    configPath: join(HOME, ".config", "goose", "config.yaml"),
    configFormat: "yaml",
    mcpKey: "mcpServers",
    transport: "http",
    detect: () => existsSync(join(HOME, ".config", "goose")),
  },
  cline: {
    id: "cline",
    name: "Cline",
    configPath: join(
      APP_SUPPORT,
      "Code",
      "User",
      "globalStorage",
      "saoudrizwan.claude-dev",
      "settings",
      "cline_mcp_settings.json",
    ),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    instructionsPath: join(HOME, "Documents", "Cline", "Rules", "useai.md"),
    instructionsMethod: "create",
    detect: () =>
      existsSync(
        join(
          APP_SUPPORT,
          "Code",
          "User",
          "globalStorage",
          "saoudrizwan.claude-dev",
        ),
      ),
  },
  "roo-code": {
    id: "roo-code",
    name: "Roo Code",
    configPath: join(
      APP_SUPPORT,
      "Code",
      "User",
      "globalStorage",
      "rooveterinaryinc.roo-cline",
      "settings",
      "cline_mcp_settings.json",
    ),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    instructionsPath: join(HOME, ".roo", "rules", "useai.md"),
    instructionsMethod: "create",
    detect: () =>
      existsSync(
        join(
          APP_SUPPORT,
          "Code",
          "User",
          "globalStorage",
          "rooveterinaryinc.roo-cline",
        ),
      ),
  },
  opencode: {
    id: "opencode",
    name: "OpenCode",
    configPath: join(HOME, ".config", "opencode", "config.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "stdio",
    instructionsPath: join(HOME, ".config", "opencode", "AGENTS.md"),
    instructionsMethod: "append",
    detect: () => existsSync(join(HOME, ".config", "opencode")),
  },
  aider: {
    id: "aider",
    name: "Aider",
    configPath: join(HOME, ".aider.conf.yml"),
    configFormat: "yaml",
    mcpKey: "mcpServers",
    transport: "stdio",
    detect: () => existsSync(join(HOME, ".aider.conf.yml")),
  },
  continue: {
    id: "continue",
    name: "Continue",
    configPath: join(HOME, ".continue", "config.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "stdio",
    detect: () => existsSync(join(HOME, ".continue")),
  },
  zed: {
    id: "zed",
    name: "Zed",
    configPath: join(HOME, ".config", "zed", "mcp.json"),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "http",
    detect: () => existsSync(join(HOME, ".config", "zed")),
  },
  cody: {
    id: "cody",
    name: "Sourcegraph Cody",
    configPath: join(
      APP_SUPPORT,
      "Code",
      "User",
      "globalStorage",
      "sourcegraph.cody-ai",
      "settings",
      "mcp_settings.json",
    ),
    configFormat: "json",
    mcpKey: "mcpServers",
    transport: "stdio",
    detect: () =>
      existsSync(
        join(
          APP_SUPPORT,
          "Code",
          "User",
          "globalStorage",
          "sourcegraph.cody-ai",
        ),
      ),
  },
};

export function getToolConfig(toolId: string): ToolConfig | null {
  return TOOL_CONFIGS[toolId] ?? null;
}

export function getAllToolConfigs(): ToolConfig[] {
  return Object.values(TOOL_CONFIGS);
}
