import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export type ConfigFormat = 'standard' | 'vscode' | 'zed' | 'toml' | 'yaml' | 'crush';

type InstructionsConfig = { method: 'append' | 'create'; path: string };

export interface AiTool {
  id: string;
  name: string;
  configFormat: ConfigFormat;
  supportsUrl: boolean;
  instructionPlacement?: InstructionsConfig;
  getConfigPath(): string;
  detect(): boolean;
  isConfigured(): boolean;
  install(): void;
  installHttp(): void;
  remove(): void;
  getManualHint(): string | null;
}

export const USEAI_INSTRUCTIONS_TEXT = [
  '## UseAI Session Tracking',
  '- At the START of every response, call `useai_session_start` with the appropriate task_type.',
  '- For LONG sessions (15+ min), call `useai_heartbeat` periodically.',
  '- At the END of every response, call `useai_session_end` with languages used, files_touched_count, and milestones (each with generic `title`, optional detailed `private_title`, and `category`).',
].join('\n');

const MCP_ENTRY = {
  command: 'npx',
  args: ['-y', '@devness/useai@latest'],
};

import { DAEMON_MCP_URL, buildInstructionsText } from '@useai/shared';

export const MCP_HTTP_URL = DAEMON_MCP_URL;

const MCP_HTTP_ENTRY = { type: 'http', url: MCP_HTTP_URL };

const home = homedir();

// --- HTTP install helpers (URL-based config) ---

function installStandardHttp(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = (config['mcpServers'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { ...MCP_HTTP_ENTRY };
  config['mcpServers'] = servers;
  writeJsonFile(configPath, config);
}

function installVscodeHttp(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = (config['servers'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { type: 'http', url: MCP_HTTP_URL };
  config['servers'] = servers;
  writeJsonFile(configPath, config);
}

function hasBinary(name: string): boolean {
  try {
    execSync(`which ${name}`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function readJsonFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeJsonFile(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

// --- JSON standard format (mcpServers key) ---

function isConfiguredStandard(configPath: string): boolean {
  const config = readJsonFile(configPath);
  const servers = config['mcpServers'] as Record<string, unknown> | undefined;
  return !!servers?.['UseAI'] || !!servers?.['useai'];
}

function installStandard(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = (config['mcpServers'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { ...MCP_ENTRY };
  config['mcpServers'] = servers;
  writeJsonFile(configPath, config);
}

function removeStandard(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = config['mcpServers'] as Record<string, unknown> | undefined;
  if (servers) {
    delete servers['UseAI'];
    delete servers['useai'];
    if (Object.keys(servers).length === 0) {
      delete config['mcpServers'];
    }
    writeJsonFile(configPath, config);
  }
}

// --- VS Code format (servers key) ---

function isConfiguredVscode(configPath: string): boolean {
  const config = readJsonFile(configPath);
  const servers = config['servers'] as Record<string, unknown> | undefined;
  return !!servers?.['UseAI'] || !!servers?.['useai'];
}

function installVscode(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = (config['servers'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { command: MCP_ENTRY.command, args: MCP_ENTRY.args };
  config['servers'] = servers;
  writeJsonFile(configPath, config);
}

function removeVscode(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = config['servers'] as Record<string, unknown> | undefined;
  if (servers) {
    delete servers['UseAI'];
    delete servers['useai'];
    if (Object.keys(servers).length === 0) {
      delete config['servers'];
    }
    writeJsonFile(configPath, config);
  }
}

// --- Zed format (context_servers key) ---

function isConfiguredZed(configPath: string): boolean {
  const config = readJsonFile(configPath);
  const servers = config['context_servers'] as Record<string, unknown> | undefined;
  return !!servers?.['UseAI'] || !!servers?.['useai'];
}

function installZed(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = (config['context_servers'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = {
    command: { path: MCP_ENTRY.command, args: MCP_ENTRY.args },
    settings: {},
  };
  config['context_servers'] = servers;
  writeJsonFile(configPath, config);
}

function removeZed(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = config['context_servers'] as Record<string, unknown> | undefined;
  if (servers) {
    delete servers['UseAI'];
    delete servers['useai'];
    if (Object.keys(servers).length === 0) {
      delete config['context_servers'];
    }
    writeJsonFile(configPath, config);
  }
}

// --- TOML format (Codex) ---

function readTomlFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    if (!raw) return {};
    return parseToml(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function writeTomlFile(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyToml(data) + '\n');
}

function isConfiguredToml(configPath: string): boolean {
  const config = readTomlFile(configPath);
  const servers = config['mcp_servers'] as Record<string, unknown> | undefined;
  return !!servers?.['UseAI'] || !!servers?.['useai'];
}

function installToml(configPath: string): void {
  const config = readTomlFile(configPath);
  const servers = (config['mcp_servers'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { command: MCP_ENTRY.command, args: MCP_ENTRY.args };
  config['mcp_servers'] = servers;
  writeTomlFile(configPath, config);
}

function installTomlHttp(configPath: string): void {
  const config = readTomlFile(configPath);
  const servers = (config['mcp_servers'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { url: MCP_HTTP_URL };
  config['mcp_servers'] = servers;
  writeTomlFile(configPath, config);
}

function removeToml(configPath: string): void {
  const config = readTomlFile(configPath);
  const servers = config['mcp_servers'] as Record<string, unknown> | undefined;
  if (servers) {
    delete servers['UseAI'];
    delete servers['useai'];
    if (Object.keys(servers).length === 0) {
      delete config['mcp_servers'];
    }
    writeTomlFile(configPath, config);
  }
}

// --- YAML format (Goose) ---

function readYamlFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    if (!raw) return {};
    return (parseYaml(raw) as Record<string, unknown>) ?? {};
  } catch {
    return {};
  }
}

function writeYamlFile(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyYaml(data));
}

function isConfiguredYaml(configPath: string): boolean {
  const config = readYamlFile(configPath);
  const extensions = config['extensions'] as Record<string, unknown> | undefined;
  return !!extensions?.['UseAI'] || !!extensions?.['useai'];
}

function installYaml(configPath: string): void {
  const config = readYamlFile(configPath);
  const extensions = (config['extensions'] as Record<string, unknown>) ?? {};
  delete extensions['useai'];
  extensions['UseAI'] = {
    name: 'UseAI',
    cmd: MCP_ENTRY.command,
    args: MCP_ENTRY.args,
    enabled: true,
    type: 'stdio',
  };
  config['extensions'] = extensions;
  writeYamlFile(configPath, config);
}

function installYamlHttp(configPath: string): void {
  const config = readYamlFile(configPath);
  const extensions = (config['extensions'] as Record<string, unknown>) ?? {};
  delete extensions['useai'];
  extensions['UseAI'] = {
    name: 'UseAI',
    type: 'http',
    url: MCP_HTTP_URL,
    enabled: true,
  };
  config['extensions'] = extensions;
  writeYamlFile(configPath, config);
}

function removeYaml(configPath: string): void {
  const config = readYamlFile(configPath);
  const extensions = config['extensions'] as Record<string, unknown> | undefined;
  if (extensions) {
    delete extensions['UseAI'];
    delete extensions['useai'];
    if (Object.keys(extensions).length === 0) {
      delete config['extensions'];
    }
    writeYamlFile(configPath, config);
  }
}

// --- Crush format (mcp key) ---

function isConfiguredCrush(configPath: string): boolean {
  const config = readJsonFile(configPath);
  const servers = config['mcp'] as Record<string, unknown> | undefined;
  return !!servers?.['UseAI'] || !!servers?.['useai'];
}

function installCrush(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = (config['mcp'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { type: 'stdio', command: MCP_ENTRY.command, args: MCP_ENTRY.args };
  config['mcp'] = servers;
  writeJsonFile(configPath, config);
}

function removeCrush(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = config['mcp'] as Record<string, unknown> | undefined;
  if (servers) {
    delete servers['UseAI'];
    delete servers['useai'];
    if (Object.keys(servers).length === 0) {
      delete config['mcp'];
    }
    writeJsonFile(configPath, config);
  }
}

function installCrushHttp(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = (config['mcp'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { type: 'http', url: MCP_HTTP_URL };
  config['mcp'] = servers;
  writeJsonFile(configPath, config);
}

// --- Instructions injection ---

const INSTRUCTIONS_START = '<!-- useai:start -->';
const INSTRUCTIONS_END = '<!-- useai:end -->';

function getUseaiInstructions(frameworkId?: string): string {
  return buildInstructionsText(frameworkId);
}

function getUseaiInstructionsBlock(frameworkId?: string): string {
  return `${INSTRUCTIONS_START}\n${getUseaiInstructions(frameworkId)}\n${INSTRUCTIONS_END}`;
}

function hasInstructionsBlock(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    return readFileSync(filePath, 'utf-8').includes(INSTRUCTIONS_START);
  } catch {
    return false;
  }
}

function injectInstructions(config: InstructionsConfig, frameworkId?: string): void {
  mkdirSync(dirname(config.path), { recursive: true });

  const instructions = getUseaiInstructions(frameworkId);
  const block = getUseaiInstructionsBlock(frameworkId);

  if (config.method === 'create') {
    writeFileSync(config.path, instructions + '\n');
    return;
  }

  // Append or replace: update block between markers
  let existing = '';
  if (existsSync(config.path)) {
    existing = readFileSync(config.path, 'utf-8');
  }

  if (hasInstructionsBlock(config.path)) {
    // Replace existing block with updated content
    const pattern = new RegExp(
      `${INSTRUCTIONS_START}[\\s\\S]*?${INSTRUCTIONS_END}`,
    );
    writeFileSync(config.path, existing.replace(pattern, block));
    return;
  }

  const separator = existing && !existing.endsWith('\n') ? '\n\n' : existing ? '\n' : '';
  writeFileSync(config.path, existing + separator + block + '\n');
}

function removeInstructions(config: InstructionsConfig): void {
  if (config.method === 'create') {
    if (existsSync(config.path)) {
      try { unlinkSync(config.path); } catch { /* ignore */ }
    }
    return;
  }

  // Append: remove the block between markers
  if (!existsSync(config.path)) return;
  try {
    const content = readFileSync(config.path, 'utf-8');
    const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `\\n?${escaped(INSTRUCTIONS_START)}[\\s\\S]*?${escaped(INSTRUCTIONS_END)}\\n?`,
    );
    const cleaned = content.replace(regex, '').trim();
    if (cleaned) {
      writeFileSync(config.path, cleaned + '\n');
    } else {
      unlinkSync(config.path);
    }
  } catch { /* ignore */ }
}

// --- Format dispatch ---

const formatHandlers: Record<
  ConfigFormat,
  {
    isConfigured(path: string): boolean;
    install(path: string): void;
    remove(path: string): void;
  }
> = {
  standard: { isConfigured: isConfiguredStandard, install: installStandard, remove: removeStandard },
  vscode: { isConfigured: isConfiguredVscode, install: installVscode, remove: removeVscode },
  zed: { isConfigured: isConfiguredZed, install: installZed, remove: removeZed },
  toml: { isConfigured: isConfiguredToml, install: installToml, remove: removeToml },
  yaml: { isConfigured: isConfiguredYaml, install: installYaml, remove: removeYaml },
  crush: { isConfigured: isConfiguredCrush, install: installCrush, remove: removeCrush },
};

function createTool(def: {
  id: string;
  name: string;
  configFormat: ConfigFormat;
  configPath: string;
  detect(): boolean;
  instructions?: InstructionsConfig;
  manualHint?: string;
  supportsUrl?: boolean;
}): AiTool {
  const handler = formatHandlers[def.configFormat];
  const urlSupported = def.supportsUrl ?? false;
  return {
    id: def.id,
    name: def.name,
    configFormat: def.configFormat,
    supportsUrl: urlSupported,
    instructionPlacement: def.instructions,
    getConfigPath: () => def.configPath,
    detect: def.detect,
    isConfigured: () => handler.isConfigured(def.configPath),
    install: () => {
      handler.install(def.configPath);
      if (def.instructions) injectInstructions(def.instructions);
    },
    installHttp: () => {
      if (def.configFormat === 'vscode') {
        installVscodeHttp(def.configPath);
      } else if (def.configFormat === 'standard') {
        installStandardHttp(def.configPath);
      } else if (def.configFormat === 'toml') {
        installTomlHttp(def.configPath);
      } else if (def.configFormat === 'yaml') {
        installYamlHttp(def.configPath);
      } else if (def.configFormat === 'crush') {
        installCrushHttp(def.configPath);
      } else {
        // Fall back to stdio for unsupported formats
        handler.install(def.configPath);
      }
      if (def.instructions) injectInstructions(def.instructions);
    },
    remove: () => {
      handler.remove(def.configPath);
      if (def.instructions) removeInstructions(def.instructions);
    },
    getManualHint: () => def.instructions ? null : (def.manualHint ?? null),
  };
}

const appSupport = join(home, 'Library', 'Application Support');

/** Match a user-provided name against a tool's id or display name (case-insensitive, partial). */
function matchesTool(tool: AiTool, query: string): boolean {
  const q = query.toLowerCase().replace(/[\s-_]+/g, '');
  const id = tool.id.toLowerCase().replace(/[\s-_]+/g, '');
  const name = tool.name.toLowerCase().replace(/[\s-_]+/g, '');
  return id === q || name === q || id.includes(q) || name.includes(q);
}

/**
 * Resolve user-provided tool names to AiTool objects.
 * Returns `{ matched, unmatched }` so the caller can report unknown names.
 */
export function resolveTools(
  names: string[],
): { matched: AiTool[]; unmatched: string[] } {
  const matched: AiTool[] = [];
  const unmatched: string[] = [];
  for (const name of names) {
    const found = AI_TOOLS.filter((t) => matchesTool(t, name));
    if (found.length > 0) {
      for (const f of found) {
        if (!matched.includes(f)) matched.push(f);
      }
    } else {
      unmatched.push(name);
    }
  }
  return { matched, unmatched };
}

export const AI_TOOLS: AiTool[] = [
  createTool({
    id: 'claude-code',
    name: 'Claude Code',
    configFormat: 'standard',
    configPath: join(home, '.claude.json'),
    detect: () => hasBinary('claude') || existsSync(join(home, '.claude.json')),
    instructions: { method: 'append', path: join(home, '.claude', 'CLAUDE.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'claude-desktop',
    name: 'Claude Desktop',
    configFormat: 'standard',
    configPath: join(appSupport, 'Claude', 'claude_desktop_config.json'),
    detect: () =>
      existsSync(join(appSupport, 'Claude')) ||
      existsSync('/Applications/Claude.app'),
    supportsUrl: true,
  }),
  createTool({
    id: 'cursor',
    name: 'Cursor',
    configFormat: 'standard',
    configPath: join(home, '.cursor', 'mcp.json'),
    detect: () => existsSync(join(home, '.cursor')),
    manualHint: 'Open Cursor Settings → Rules → User Rules and paste the instructions below.',
    supportsUrl: true,
  }),
  createTool({
    id: 'windsurf',
    name: 'Windsurf',
    configFormat: 'standard',
    configPath: join(home, '.codeium', 'windsurf', 'mcp_config.json'),
    detect: () => existsSync(join(home, '.codeium', 'windsurf')),
    instructions: { method: 'append', path: join(home, '.codeium', 'windsurf', 'memories', 'global_rules.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'vscode',
    name: 'VS Code',
    configFormat: 'vscode',
    configPath: join(appSupport, 'Code', 'User', 'mcp.json'),
    detect: () => existsSync(join(appSupport, 'Code')),
    instructions: { method: 'create', path: join(appSupport, 'Code', 'User', 'prompts', 'useai.instructions.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'vscode-insiders',
    name: 'VS Code Insiders',
    configFormat: 'vscode',
    configPath: join(appSupport, 'Code - Insiders', 'User', 'mcp.json'),
    detect: () => existsSync(join(appSupport, 'Code - Insiders')),
    instructions: { method: 'create', path: join(appSupport, 'Code - Insiders', 'User', 'prompts', 'useai.instructions.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'gemini-cli',
    name: 'Gemini CLI',
    configFormat: 'standard',
    configPath: join(home, '.gemini', 'settings.json'),
    detect: () => hasBinary('gemini'),
    instructions: { method: 'append', path: join(home, '.gemini', 'GEMINI.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'antigravity',
    name: 'Antigravity',
    configFormat: 'standard',
    configPath: join(home, '.gemini', 'antigravity', 'mcp_config.json'),
    detect: () => existsSync(join(home, '.gemini', 'antigravity')),
    instructions: { method: 'append', path: join(home, '.gemini', 'GEMINI.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'copilot-cli',
    name: 'Copilot CLI',
    configFormat: 'standard',
    configPath: join(home, '.copilot', 'mcp-config.json'),
    detect: () => hasBinary('copilot') || existsSync(join(home, '.copilot')),
    manualHint: 'No global instructions file — add UseAI instructions to your project-level agent rules.',
    supportsUrl: true,
  }),
  createTool({
    id: 'trae',
    name: 'Trae',
    configFormat: 'standard',
    configPath: join(appSupport, 'Trae', 'User', 'mcp.json'),
    detect: () => existsSync(join(appSupport, 'Trae')),
    manualHint: 'Open Trae Settings → Rules and paste the instructions below.',
    supportsUrl: true,
  }),
  createTool({
    id: 'zed',
    name: 'Zed',
    configFormat: 'zed',
    configPath: join(appSupport, 'Zed', 'settings.json'),
    detect: () => existsSync(join(appSupport, 'Zed')),
    manualHint: 'Open Rules Library (⌘⌥L) → click + → paste the instructions below.',
  }),
  createTool({
    id: 'cline',
    name: 'Cline',
    configFormat: 'standard',
    configPath: join(
      appSupport,
      'Code',
      'User',
      'globalStorage',
      'saoudrizwan.claude-dev',
      'settings',
      'cline_mcp_settings.json',
    ),
    detect: () =>
      existsSync(
        join(appSupport, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev'),
      ),
    instructions: { method: 'create', path: join(home, 'Documents', 'Cline', 'Rules', 'useai.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'roo-code',
    name: 'Roo Code',
    configFormat: 'standard',
    configPath: join(
      appSupport,
      'Code',
      'User',
      'globalStorage',
      'rooveterinaryinc.roo-cline',
      'settings',
      'cline_mcp_settings.json',
    ),
    detect: () =>
      existsSync(
        join(appSupport, 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline'),
      ),
    instructions: { method: 'create', path: join(home, '.roo', 'rules', 'useai.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'kilo-code',
    name: 'Kilo Code',
    configFormat: 'standard',
    configPath: join(
      appSupport,
      'Code',
      'User',
      'globalStorage',
      'kilocode.kilo-code',
      'settings',
      'mcp_settings.json',
    ),
    detect: () =>
      existsSync(
        join(appSupport, 'Code', 'User', 'globalStorage', 'kilocode.kilo-code'),
      ),
    manualHint: 'Add the instructions below to .kilocode/rules/useai.md in your project root.',
    supportsUrl: true,
  }),
  createTool({
    id: 'amazon-q-cli',
    name: 'Amazon Q CLI',
    configFormat: 'standard',
    configPath: join(home, '.aws', 'amazonq', 'mcp.json'),
    detect: () => hasBinary('q') || existsSync(join(home, '.aws', 'amazonq')),
    manualHint: 'Create .amazonq/rules/useai.md in your project root with the instructions below.',
  }),
  createTool({
    id: 'amazon-q-ide',
    name: 'Amazon Q IDE',
    configFormat: 'standard',
    configPath: join(home, '.aws', 'amazonq', 'default.json'),
    detect: () => existsSync(join(home, '.amazonq')) || existsSync(join(home, '.aws', 'amazonq')),
    manualHint: 'Create .amazonq/rules/useai.md in your project root with the instructions below.',
  }),
  createTool({
    id: 'codex',
    name: 'Codex',
    configFormat: 'toml',
    configPath: join(home, '.codex', 'config.toml'),
    detect: () =>
      hasBinary('codex') ||
      existsSync(join(home, '.codex')) ||
      existsSync('/Applications/Codex.app'),
    instructions: { method: 'append', path: join(home, '.codex', 'AGENTS.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'goose',
    name: 'Goose',
    configFormat: 'yaml',
    configPath: join(home, '.config', 'goose', 'config.yaml'),
    detect: () => existsSync(join(home, '.config', 'goose')),
    instructions: { method: 'append', path: join(home, '.config', 'goose', '.goosehints') },
    supportsUrl: true,
  }),
  createTool({
    id: 'opencode',
    name: 'OpenCode',
    configFormat: 'standard',
    configPath: join(home, '.config', 'opencode', 'opencode.json'),
    detect: () => hasBinary('opencode') || existsSync(join(home, '.config', 'opencode')),
    instructions: { method: 'append', path: join(home, '.config', 'opencode', 'AGENTS.md') },
    supportsUrl: true,
  }),
  createTool({
    id: 'crush',
    name: 'Crush',
    configFormat: 'crush',
    configPath: join(home, '.config', 'crush', 'crush.json'),
    detect: () => hasBinary('crush') || existsSync(join(home, '.config', 'crush')),
    manualHint: 'No global instructions file — add UseAI instructions to your project-level .crush.json.',
    supportsUrl: true,
  }),
  createTool({
    id: 'junie',
    name: 'Junie',
    configFormat: 'standard',
    configPath: join(home, '.junie', 'mcp', 'mcp.json'),
    detect: () => existsSync(join(home, '.junie')),
    manualHint: 'Add the instructions below to .junie/guidelines.md in your project root.',
  }),
];

/** Re-inject instructions for all configured tools using the specified framework. */
export function reinjectInstructions(frameworkId: string): { tool: string; ok: boolean }[] {
  const results: { tool: string; ok: boolean }[] = [];
  for (const tool of AI_TOOLS) {
    try {
      if (!tool.isConfigured()) continue;
      if (tool.instructionPlacement) {
        injectInstructions(tool.instructionPlacement, frameworkId);
        results.push({ tool: tool.name, ok: true });
      }
    } catch {
      results.push({ tool: tool.name, ok: false });
    }
  }
  return results;
}
