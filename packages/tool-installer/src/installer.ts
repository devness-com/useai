import { existsSync } from "node:fs";
import { getDaemonUrl } from "@devness/useai-storage/config";
import { getToolConfig, getAllToolConfigs } from "./configs.js";
import { readConfig, writeConfig } from "./formats.js";
import { injectInstructions, removeInstructions } from "./instructions.js";

export interface ToolInstallResult {
  success: boolean;
  toolId: string;
  message: string;
}

/**
 * Build the HTTP MCP entry for the running daemon. Resolved at install time
 * (not at module load) so tools written into config pick up whatever
 * fallback port the daemon ended up on.
 *
 * Most tools accept `{ type: "http", url }`. Antigravity's schema is strict
 * (`additionalProperties: false`) and uses `serverUrl` for streamable HTTP —
 * any extra key like `type` is rejected and the server fails to register.
 */
async function httpEntry(toolId: string) {
  const daemonUrl = await getDaemonUrl();
  const url = `${daemonUrl}/mcp`;
  if (toolId === "antigravity") {
    return { serverUrl: url };
  }
  return { type: "http", url };
}

/**
 * Build the stdio MCP entry for a given useai version. We pin the version
 * (no `@latest`, no `--prefer-online`) for the same reason the autostart
 * launcher does: a future bad publish on npm cannot break stdio-configured
 * tools that have already been set up. Users move to a new version by
 * running `useai update`, which re-runs setup and rewrites these entries.
 */
function stdioEntry(version: string) {
  return {
    type: "stdio",
    command: "npx",
    args: ["-y", `@devness/useai@${version}`, "mcp"],
  } as const;
}

export async function installTool(
  toolId: string,
  version: string = "latest",
): Promise<ToolInstallResult> {
  const config = getToolConfig(toolId);
  if (!config) {
    return { success: false, toolId, message: `Unknown tool: ${toolId}` };
  }

  try {
    const existing = await readConfig(config.configPath, config.configFormat);
    const servers = (existing[config.mcpKey] as Record<string, unknown>) ?? {};

    servers["useai"] = config.transport === "stdio"
      ? stdioEntry(version)
      : await httpEntry(toolId);
    existing[config.mcpKey] = servers;

    await writeConfig(config.configPath, existing, config.configFormat);

    if (config.instructionsPath && config.instructionsMethod) {
      injectInstructions(config.instructionsPath, config.instructionsMethod);
    }

    return {
      success: true,
      toolId,
      message: `Installed useai MCP server for ${config.name} (${config.transport})`,
    };
  } catch (err) {
    return {
      success: false,
      toolId,
      message: `Failed to install for ${config.name}: ${err}`,
    };
  }
}

export async function removeTool(toolId: string): Promise<ToolInstallResult> {
  const config = getToolConfig(toolId);
  if (!config) {
    return { success: false, toolId, message: `Unknown tool: ${toolId}` };
  }

  if (!existsSync(config.configPath)) {
    return { success: false, toolId, message: `Config not found for ${config.name}` };
  }

  try {
    const existing = await readConfig(config.configPath, config.configFormat);
    const servers = (existing[config.mcpKey] as Record<string, unknown>) ?? {};
    delete servers["useai"];
    existing[config.mcpKey] = servers;

    await writeConfig(config.configPath, existing, config.configFormat);

    if (config.instructionsPath && config.instructionsMethod) {
      removeInstructions(config.instructionsPath, config.instructionsMethod);
    }

    return {
      success: true,
      toolId,
      message: `Removed useai MCP server from ${config.name}`,
    };
  } catch (err) {
    return {
      success: false,
      toolId,
      message: `Failed to remove from ${config.name}: ${err}`,
    };
  }
}

export async function listInstalledTools(): Promise<string[]> {
  const installed: string[] = [];

  for (const config of getAllToolConfigs()) {
    try {
      const existing = await readConfig(config.configPath, config.configFormat);
      const servers = existing[config.mcpKey] as Record<string, unknown> | undefined;
      if (servers?.["useai"]) {
        installed.push(config.id);
      }
    } catch {
      // Not installed
    }
  }

  return installed;
}

export async function isToolConfigured(toolId: string): Promise<boolean> {
  const config = getToolConfig(toolId);
  if (!config || !existsSync(config.configPath)) return false;

  try {
    const existing = await readConfig(config.configPath, config.configFormat);
    const servers = existing[config.mcpKey] as Record<string, unknown> | undefined;
    return !!servers?.["useai"];
  } catch {
    return false;
  }
}

export function detectInstalledTools(): string[] {
  return getAllToolConfigs()
    .filter((c) => c.detect())
    .map((c) => c.id);
}
