import { AI_CLIENT_ENV_VARS } from '../constants/clients.js';

/**
 * Map MCP clientInfo.name values to our canonical names.
 * MCP clients identify themselves during the initialize handshake.
 */
const MCP_CLIENT_NAME_MAP: Record<string, string> = {
  'claude-code': 'claude-code',
  'claude code': 'claude-code',
  'claude-desktop': 'claude-desktop',
  'claude desktop': 'claude-desktop',
  'cursor': 'cursor',
  'windsurf': 'windsurf',
  'codeium': 'windsurf',
  'vscode': 'vscode',
  'visual studio code': 'vscode',
  'vscode-insiders': 'vscode-insiders',
  'codex': 'codex',
  'codex-cli': 'codex',
  'gemini-cli': 'gemini-cli',
  'gemini cli': 'gemini-cli',
  'zed': 'zed',
  'cline': 'cline',
  'roo-code': 'roo-code',
  'roo-cline': 'roo-code',
  'amazon-q': 'amazon-q',
  'opencode': 'opencode',
  'goose': 'goose',
  'junie': 'junie',
};

/**
 * Normalize an MCP clientInfo.name to our canonical client name.
 * Returns the original name (lowercased) if no mapping exists.
 */
export function normalizeMcpClientName(mcpName: string): string {
  const lower = mcpName.toLowerCase().trim();
  return MCP_CLIENT_NAME_MAP[lower] ?? lower;
}

/**
 * Detect the AI client from environment variables (stdio mode).
 * For daemon mode, use normalizeMcpClientName() with the MCP clientInfo instead.
 */
export function detectClient(): string {
  const env = process.env;
  for (const [envVar, clientName] of Object.entries(AI_CLIENT_ENV_VARS)) {
    if (env[envVar]) return clientName;
  }
  if (env.MCP_CLIENT_NAME) return env.MCP_CLIENT_NAME;
  return 'unknown';
}
