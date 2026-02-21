/**
 * AI Tool Registry — Thin wrapper around @devness/mcp-setup + UseAI HTTP layer.
 */

// Use deep imports to avoid loading @devness/mcp-setup/dist/setup.js which
// depends on @inquirer/prompts (requires Node 20+ styleText API).
import { createToolRegistry } from '@devness/mcp-setup/dist/registry.js';
import { readJsonFile, writeJsonFile, injectInstructions } from '@devness/mcp-setup/dist/formats.js';
import type { AiTool as BaseAiTool, InstructionsConfig } from '@devness/mcp-setup';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { DAEMON_MCP_URL } from '@useai/shared';

// ── Types ────────────────────────────────────────────────────────────────────

export interface AiTool extends BaseAiTool {
  supportsUrl: boolean;
  installHttp(): void;
}

// ── Instructions ─────────────────────────────────────────────────────────────

export const USEAI_INSTRUCTIONS_TEXT = [
  '## UseAI Session Tracking',
  '- At the START of every response, call `useai_start` with the appropriate task_type. Also generate a short session `title` (generic, no project names) and `private_title` (detailed, can include specifics) from the user\'s prompt.',
  '- For LONG sessions (15+ min), call `useai_heartbeat` periodically.',
  '- At the END of every response, call `useai_end` with languages used, files_touched_count, milestones (generic descriptions only \u2014 no project names, file paths, or company names), and an `evaluation` object honestly assessing: prompt_quality (1-5), context_provided (1-5), task_outcome, iteration_count, independence_level (1-5), scope_quality (1-5), tools_leveraged count.',
].join('\n');

export const MCP_HTTP_URL = DAEMON_MCP_URL;

const MCP_HTTP_ENTRY = { type: 'http', url: MCP_HTTP_URL };

const INSTRUCTIONS: InstructionsConfig = {
  text: USEAI_INSTRUCTIONS_TEXT,
  startMarker: '<!-- useai:start -->',
  endMarker: '<!-- useai:end -->',
};

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

// ── Instruction placement lookup (for HTTP install — needs separate injection) ──

const home = homedir();
const appSupport = join(home, 'Library', 'Application Support');

type InstructionPlacement = { method: 'append' | 'create'; path: string };

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

export const AI_TOOLS: AiTool[] = registry.tools.map((baseTool) => {
  const supportsUrl = URL_SUPPORTED_TOOLS.has(baseTool.id);
  return {
    ...baseTool,
    supportsUrl,
    installHttp() {
      // Write HTTP config entry
      if (baseTool.configFormat === 'vscode') {
        installVscodeHttp(baseTool.getConfigPath());
      } else if (baseTool.configFormat === 'standard') {
        installStandardHttp(baseTool.getConfigPath());
      } else {
        // Fall back to stdio for unsupported formats
        baseTool.install();
        return;
      }
      // Inject instructions separately (install() bundles config + instructions,
      // but we wrote a different config entry above)
      const placement = toolInstructions[baseTool.id];
      if (placement) {
        injectInstructions(INSTRUCTIONS, placement);
      }
    },
  };
});

// ── Tool resolution ──────────────────────────────────────────────────────────

export function resolveTools(names: string[]): { matched: AiTool[]; unmatched: string[] } {
  const { matched: baseMatched, unmatched } = registry.resolveTools(names);
  const matched = baseMatched.map((bt) => AI_TOOLS.find((t) => t.id === bt.id)!);
  return { matched, unmatched };
}
