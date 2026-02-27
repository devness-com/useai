/**
 * AI Tool Registry — Thin wrapper around @devness/mcp-setup + UseAI HTTP layer.
 */

// Use deep imports to avoid loading @devness/mcp-setup/dist/setup.js which
// depends on @inquirer/prompts (requires Node 20+ styleText API).
import { createToolRegistry } from '@devness/mcp-setup/dist/registry.js';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { hasBinary, readJsonFile, writeJsonFile, injectInstructions, removeInstructions } from '@devness/mcp-setup/dist/formats.js';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { AiTool as BaseAiTool, InstructionsConfig, InstructionPlacement } from '@devness/mcp-setup';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DAEMON_MCP_URL, CONFIG_FILE, readJson, buildInstructionsText, migrateConfig } from '@useai/shared';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AiTool extends BaseAiTool {
  supportsUrl: boolean;
  installHttp(): void;
}

// ── Instructions ─────────────────────────────────────────────────────────────

/** Generate instructions text using the configured evaluation framework. */
export function getInstructionsText(): string {
  const config = migrateConfig(readJson<Record<string, unknown>>(CONFIG_FILE, {}));
  return buildInstructionsText(config.evaluation_framework, {
    evaluationReasons: config.capture.evaluation_reasons,
    capturePrompt: config.capture.prompt,
  });
}

/** Static instructions text for backward compatibility (uses raw default). */
export const USEAI_INSTRUCTIONS_TEXT = [
  '## UseAI Session Tracking',
  '- At the START of every response to a **real user message**, call `useai_start` with the appropriate task_type. Also generate a short session `title` (generic, no project names) and `private_title` (detailed, can include specifics) from the user\'s prompt.',
  '  - **"Real user message"** = the turn contains actual user-authored text (typed or spoken). Do NOT call `useai_start` on turns that only contain system reminders, hook feedback, plan approval clicks, or other automated/system-generated content with no user-authored text.',
  '  - **task_type values**: coding, debugging, testing, planning, reviewing, documenting, learning, deployment, devops, research, migration, design, data, security, configuration, code_review, investigation, infrastructure, analysis, ops, setup, refactoring, other',
  '- To group multiple prompts in the same conversation, pass the `conversation_id` from the previous `useai_start` response. Omit it for the first message or a new conversation.',
  '- For LONG sessions (15+ min), call `useai_heartbeat` periodically.',
  '- At the END of every response where `useai_start` was called, call `useai_end` with languages used, files_touched_count, milestones, and an `evaluation` object honestly assessing: prompt_quality (1-5), context_provided (1-5), task_outcome, iteration_count, independence_level (1-5), scope_quality (1-5), tools_leveraged count. Do NOT call `useai_end` if `useai_start` was not called in this turn.',
  '  - **milestones**: Array of objects, each with required `title` (string, generic — no project/file names), `category` (string), and optional `private_title` (string, detailed — can include project names and specifics). Example: `[{"title": "Implemented auth flow", "private_title": "Added OAuth2 to UserService in acme-api", "category": "feature"}]`',
  '  - **milestone category values**: feature, bugfix, refactor, test, docs, setup, deployment, fix, analysis, research, investigation, performance, cleanup, chore, security, migration, design, devops, config, other',
  '  - **task_type values**: coding, debugging, testing, planning, reviewing, documenting, learning, deployment, devops, research, migration, design, data, security, configuration, code_review, investigation, infrastructure, analysis, ops, setup, refactoring, other',
].join('\n');

export const MCP_HTTP_URL = DAEMON_MCP_URL;

const MCP_HTTP_ENTRY = { type: 'http', url: MCP_HTTP_URL };

const INSTRUCTIONS: InstructionsConfig = {
  text: USEAI_INSTRUCTIONS_TEXT,
  startMarker: '<!-- useai:start -->',
  endMarker: '<!-- useai:end -->',
};

/** Get instructions config with dynamic text from active framework. */
export function getInstructions(): InstructionsConfig {
  return {
    text: getInstructionsText(),
    startMarker: '<!-- useai:start -->',
    endMarker: '<!-- useai:end -->',
  };
}

/** Re-inject instructions into all installed tools' instruction files. */
export function reInjectAllInstructions(): { updated: string[] } {
  const instructions = getInstructions();
  const updated: string[] = [];

  for (const tool of AI_TOOLS) {
    try {
      if (!tool.isConfigured()) continue;
    } catch {
      continue;
    }

    const placement = toolInstructions[tool.id];
    if (placement) {
      try {
        injectInstructions(instructions, placement);
        updated.push(tool.id);
      } catch { /* skip if file doesn't exist */ }
    }
  }

  return { updated };
}

// ── Shared registry ──────────────────────────────────────────────────────────

const registry = createToolRegistry({
  serverName: 'UseAI',
  legacyName: 'useai',
  mcpEntry: { command: 'npx', args: ['-y', '@devness/useai@latest'] },
  instructions: INSTRUCTIONS,
  instructionFileName: 'useai',
});

// ── HTTP install helpers (UseAI-specific — daemon mode) ──────────────────────

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

function readTomlFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    if (!raw) return {};
    return parseToml(raw) as Record<string, unknown>;
  } catch { return {}; }
}

function writeTomlFile(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyToml(data) + '\n');
}

function installTomlHttp(configPath: string): void {
  const config = readTomlFile(configPath);
  const servers = (config['mcp_servers'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { url: MCP_HTTP_URL };
  config['mcp_servers'] = servers;
  writeTomlFile(configPath, config);
}

function readYamlFile(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  try {
    const raw = readFileSync(path, 'utf-8').trim();
    if (!raw) return {};
    return (parseYaml(raw) as Record<string, unknown>) ?? {};
  } catch { return {}; }
}

function writeYamlFile(path: string, data: Record<string, unknown>): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, stringifyYaml(data));
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

// ── Instruction placement lookup (for HTTP install — needs separate injection) ──

const home = homedir();
const appSupport = join(home, 'Library', 'Application Support');

const toolInstructions: Record<string, InstructionPlacement> = {
  'claude-code': { method: 'append', path: join(home, '.claude', 'CLAUDE.md') },
  'windsurf': { method: 'append', path: join(home, '.codeium', 'windsurf', 'memories', 'global_rules.md') },
  'vscode': { method: 'create', path: join(appSupport, 'Code', 'User', 'prompts', 'useai.instructions.md') },
  'vscode-insiders': { method: 'create', path: join(appSupport, 'Code - Insiders', 'User', 'prompts', 'useai.instructions.md') },
  'gemini-cli': { method: 'append', path: join(home, '.gemini', 'GEMINI.md') },
  'antigravity': { method: 'append', path: join(home, '.gemini', 'GEMINI.md') },
  'cline': { method: 'create', path: join(home, 'Documents', 'Cline', 'Rules', 'useai.md') },
  'roo-code': { method: 'create', path: join(home, '.roo', 'rules', 'useai.md') },
  'codex': { method: 'append', path: join(home, '.codex', 'AGENTS.md') },
  'goose': { method: 'append', path: join(home, '.config', 'goose', '.goosehints') },
  'opencode': { method: 'append', path: join(home, '.config', 'opencode', 'AGENTS.md') },
};

// ── Extend base tools with HTTP support ──────────────────────────────────────

const URL_SUPPORTED_TOOLS = new Set([
  'claude-code', 'claude-desktop', 'cursor', 'windsurf', 'vscode', 'vscode-insiders',
  'gemini-cli', 'antigravity', 'copilot-cli', 'trae', 'cline', 'roo-code', 'kilo-code',
  'opencode', 'crush',
]);

const registryTools: AiTool[] = registry.tools.map((baseTool) => {
  const supportsUrl = URL_SUPPORTED_TOOLS.has(baseTool.id);
  return {
    ...baseTool,
    supportsUrl,
    installHttp() {
      // Write HTTP config entry only for URL-supporting formats
      if (baseTool.configFormat === 'vscode' && supportsUrl) {
        installVscodeHttp(baseTool.getConfigPath());
      } else if (baseTool.configFormat === 'standard' && supportsUrl) {
        installStandardHttp(baseTool.getConfigPath());
      } else {
        // Fall back to stdio for unsupported formats (toml, yaml, zed, etc.)
        baseTool.install();
        return;
      }
      // Inject instructions separately (install() bundles config + instructions,
      // but we wrote a different config entry above)
      const placement = toolInstructions[baseTool.id];
      if (placement) {
        injectInstructions(getInstructions(), placement);
      }
    },
  };
});

// ── Extra tools (not yet in @devness/mcp-setup registry) ────────────────────

const MCP_STDIO_ENTRY = { command: 'npx', args: ['-y', '@devness/useai@latest'] };

function installAntigravityHttp(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = (config['mcpServers'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { serverUrl: MCP_HTTP_URL };
  config['mcpServers'] = servers;
  writeJsonFile(configPath, config);
}

function installCrushHttp(configPath: string): void {
  const config = readJsonFile(configPath);
  const servers = (config['mcp'] as Record<string, unknown>) ?? {};
  delete servers['useai'];
  servers['UseAI'] = { type: 'http', url: MCP_HTTP_URL };
  config['mcp'] = servers;
  writeJsonFile(configPath, config);
}

function createExtraTool(def: {
  id: string;
  name: string;
  configFormat: 'standard' | 'crush' | 'antigravity';
  configPath: string;
  detect(): boolean;
  instructions?: InstructionPlacement;
  manualHint?: string;
}): AiTool {
  const supportsUrl = true;
  const jsonKey = def.configFormat === 'crush' ? 'mcp' : 'mcpServers';

  return {
    id: def.id,
    name: def.name,
    configFormat: def.configFormat as string as BaseAiTool['configFormat'],
    supportsUrl,
    getConfigPath: () => def.configPath,
    detect: def.detect,
    isConfigured() {
      if (def.configFormat === 'antigravity') {
        const config = readJsonFile(def.configPath);
        const servers = config['mcpServers'] as Record<string, unknown> | undefined;
        const entry = servers?.['UseAI'] as Record<string, unknown> | undefined;
        return !!entry?.['serverUrl'] || !!servers?.['useai'];
      }
      const config = readJsonFile(def.configPath);
      const servers = config[jsonKey] as Record<string, unknown> | undefined;
      return !!servers?.['UseAI'] || !!servers?.['useai'];
    },
    install() {
      const config = readJsonFile(def.configPath);
      const servers = (config[jsonKey] as Record<string, unknown>) ?? {};
      delete servers['useai'];
      servers['UseAI'] = def.configFormat === 'crush'
        ? { type: 'stdio', ...MCP_STDIO_ENTRY }
        : { ...MCP_STDIO_ENTRY };
      config[jsonKey] = servers;
      writeJsonFile(def.configPath, config);
      if (def.instructions) injectInstructions(getInstructions(), def.instructions);
    },
    installHttp() {
      if (def.configFormat === 'antigravity') {
        installAntigravityHttp(def.configPath);
      } else if (def.configFormat === 'crush') {
        installCrushHttp(def.configPath);
      } else {
        installStandardHttp(def.configPath);
      }
      if (def.instructions) injectInstructions(getInstructions(), def.instructions);
    },
    remove() {
      const config = readJsonFile(def.configPath);
      const servers = config[jsonKey] as Record<string, unknown> | undefined;
      if (servers) {
        delete servers['UseAI'];
        delete servers['useai'];
        if (Object.keys(servers).length === 0) delete config[jsonKey];
        writeJsonFile(def.configPath, config);
      }
      if (def.instructions) removeInstructions(INSTRUCTIONS, def.instructions);
    },
    getManualHint: () => def.instructions ? null : (def.manualHint ?? null),
  };
}

const extraTools: AiTool[] = [
  createExtraTool({
    id: 'antigravity',
    name: 'Antigravity',
    configFormat: 'antigravity',
    configPath: join(home, '.gemini', 'antigravity', 'mcp_config.json'),
    detect: () => existsSync(join(home, '.gemini', 'antigravity')),
    instructions: { method: 'append', path: join(home, '.gemini', 'GEMINI.md') },
  }),
  createExtraTool({
    id: 'copilot-cli',
    name: 'Copilot CLI',
    configFormat: 'standard',
    configPath: join(home, '.copilot', 'mcp-config.json'),
    detect: () => hasBinary('copilot') || existsSync(join(home, '.copilot')),
    manualHint: 'No global instructions file — add UseAI instructions to your project-level agent rules.',
  }),
  createExtraTool({
    id: 'trae',
    name: 'Trae',
    configFormat: 'standard',
    configPath: join(appSupport, 'Trae', 'User', 'mcp.json'),
    detect: () => existsSync(join(appSupport, 'Trae')),
    manualHint: 'Open Trae Settings → Rules and paste the instructions below.',
  }),
  createExtraTool({
    id: 'kilo-code',
    name: 'Kilo Code',
    configFormat: 'standard',
    configPath: join(
      appSupport, 'Code', 'User', 'globalStorage',
      'kilocode.kilo-code', 'settings', 'mcp_settings.json',
    ),
    detect: () => existsSync(
      join(appSupport, 'Code', 'User', 'globalStorage', 'kilocode.kilo-code'),
    ),
    manualHint: 'Add the instructions below to .kilocode/rules/useai.md in your project root.',
  }),
  createExtraTool({
    id: 'crush',
    name: 'Crush',
    configFormat: 'crush',
    configPath: join(home, '.config', 'crush', 'crush.json'),
    detect: () => hasBinary('crush') || existsSync(join(home, '.config', 'crush')),
    manualHint: 'No global instructions file — add UseAI instructions to your project-level .crush.json.',
  }),
];

export const AI_TOOLS: AiTool[] = [...registryTools, ...extraTools];

// ── Tool resolution ──────────────────────────────────────────────────────────

function matchesTool(tool: AiTool, query: string): boolean {
  const q = query.toLowerCase().replace(/[\s-_]+/g, '');
  const id = tool.id.toLowerCase().replace(/[\s-_]+/g, '');
  const name = tool.name.toLowerCase().replace(/[\s-_]+/g, '');
  return id === q || name === q || id.includes(q) || name.includes(q);
}

export function resolveTools(names: string[]): { matched: AiTool[]; unmatched: string[] } {
  // First try registry resolution for known tools
  const { matched: baseMatched, unmatched: registryUnmatched } = registry.resolveTools(names);
  const matched = baseMatched.map((bt) => AI_TOOLS.find((t) => t.id === bt.id)!);

  // Then check extra tools for anything the registry didn't match
  const stillUnmatched: string[] = [];
  for (const name of registryUnmatched) {
    const found = extraTools.filter((t) => matchesTool(t, name));
    if (found.length > 0) {
      for (const f of found) {
        if (!matched.includes(f)) matched.push(f);
      }
    } else {
      stillUnmatched.push(name);
    }
  }
  return { matched, unmatched: stillUnmatched };
}
