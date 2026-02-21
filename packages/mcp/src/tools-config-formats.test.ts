import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';

/*
 * The format-handler functions (installStandard, removeStandard, etc.) are
 * module-private and accessed only through AI_TOOLS[*].install/remove/isConfigured.
 *
 * Each AiTool binds a hardcoded configPath (based on homedir), so we cannot
 * call the handlers with arbitrary paths through the public API.
 *
 * Strategy: we mock node:os homedir() to return a temp directory, then
 * import the module under test. This lets us exercise every format handler
 * through the real AI_TOOLS entries while keeping the real filesystem safe.
 */

vi.mock('node:os', async (importOriginal) => {
  const orig = await importOriginal<typeof import('node:os')>();
  const fs = await import('node:fs');
  const path = await import('node:path');
  const tempDir = fs.mkdtempSync(path.join(orig.tmpdir(), 'useai-test-'));
  return {
    ...orig,
    homedir: () => tempDir,
  };
});

vi.mock('node:child_process', () => ({
  execSync: () => {
    throw new Error('not found');
  },
}));

vi.mock('@useai/shared', () => ({
  DAEMON_MCP_URL: 'http://localhost:12425/mcp',
}));

function readJson(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return {};
  return JSON.parse(raw) as Record<string, unknown>;
}

function writeJson(path: string, data: Record<string, unknown>): void {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
}

function readTomlHelper(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return {};
  return parseToml(raw) as Record<string, unknown>;
}

function readYamlHelper(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf-8').trim();
  if (!raw) return {};
  return (parseYaml(raw) as Record<string, unknown>) ?? {};
}

// Clean up temp dir contents between tests to ensure isolation
afterEach(() => {
  const tempHome = homedir();
  try { rmSync(tempHome, { recursive: true, force: true }); } catch { /* ignore */ }
  mkdirSync(tempHome, { recursive: true });
});

import { AI_TOOLS, resolveTools, type AiTool } from './tools';

function findTool(id: string): AiTool {
  const tool = AI_TOOLS.find((t) => t.id === id);
  if (!tool) throw new Error(`Tool not found: ${id}`);
  return tool;
}

// =====================================================================
// Standard JSON format (mcpServers key) — tested via 'claude-code' tool
// =====================================================================
describe('Standard JSON format (mcpServers)', () => {
  let tool: AiTool;
  let configPath: string;

  beforeEach(() => {
    tool = findTool('claude-code');
    configPath = tool.getConfigPath();
  });

  describe('installStandard', () => {
    it('creates config file with UseAI entry under mcpServers when file does not exist', () => {
      tool.install();

      const config = readJson(configPath);
      const servers = config['mcpServers'] as Record<string, unknown>;
      expect(servers).toBeDefined();
      expect(servers['UseAI']).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });

    it('adds UseAI to existing mcpServers without removing other entries', () => {
      writeJson(configPath, {
        mcpServers: {
          'other-tool': { command: 'node', args: ['other.js'] },
        },
      });

      tool.install();

      const config = readJson(configPath);
      const servers = config['mcpServers'] as Record<string, unknown>;
      expect(servers['UseAI']).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
      expect(servers['other-tool']).toEqual({ command: 'node', args: ['other.js'] });
    });

    it('removes legacy "useai" key when installing new "UseAI" key', () => {
      writeJson(configPath, {
        mcpServers: {
          useai: { command: 'old-cmd', args: [] },
        },
      });

      tool.install();

      const config = readJson(configPath);
      const servers = config['mcpServers'] as Record<string, unknown>;
      expect(servers['UseAI']).toBeDefined();
      expect(servers['useai']).toBeUndefined();
    });

    it('preserves existing non-mcpServers config keys', () => {
      writeJson(configPath, {
        theme: 'dark',
        mcpServers: {},
      });

      tool.install();

      const config = readJson(configPath);
      expect(config['theme']).toBe('dark');
    });
  });

  describe('removeStandard', () => {
    it('removes UseAI entry from mcpServers', () => {
      writeJson(configPath, {
        mcpServers: {
          UseAI: { command: 'npx', args: ['-y', '@devness/useai@latest'] },
          'other-tool': { command: 'node', args: [] },
        },
      });

      tool.remove();

      const config = readJson(configPath);
      const servers = config['mcpServers'] as Record<string, unknown>;
      expect(servers['UseAI']).toBeUndefined();
      expect(servers['other-tool']).toEqual({ command: 'node', args: [] });
    });

    it('removes legacy "useai" key as well', () => {
      writeJson(configPath, {
        mcpServers: {
          useai: { command: 'npx', args: [] },
          UseAI: { command: 'npx', args: [] },
        },
      });

      tool.remove();

      const config = readJson(configPath);
      const servers = config['mcpServers'] as Record<string, unknown> | undefined;
      expect(servers?.['UseAI']).toBeUndefined();
      expect(servers?.['useai']).toBeUndefined();
    });

    it('removes the mcpServers key entirely when it becomes empty', () => {
      writeJson(configPath, {
        mcpServers: {
          UseAI: { command: 'npx', args: [] },
        },
        otherKey: 'preserved',
      });

      tool.remove();

      const config = readJson(configPath);
      expect(config['mcpServers']).toBeUndefined();
      expect(config['otherKey']).toBe('preserved');
    });

    it('does nothing when config file does not exist', () => {
      tool.remove();
      expect(existsSync(configPath)).toBe(false);
    });
  });

  describe('isConfiguredStandard', () => {
    it('returns true when UseAI key exists', () => {
      writeJson(configPath, {
        mcpServers: {
          UseAI: { command: 'npx', args: [] },
        },
      });

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns true when legacy useai key exists', () => {
      writeJson(configPath, {
        mcpServers: {
          useai: { command: 'npx', args: [] },
        },
      });

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns false when mcpServers has no UseAI or useai', () => {
      writeJson(configPath, {
        mcpServers: {
          'other-tool': { command: 'node', args: [] },
        },
      });

      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false when config file does not exist', () => {
      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false when config file is empty', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(configPath, '');

      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false when config file contains invalid JSON', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(configPath, '{invalid json content');

      expect(tool.isConfigured()).toBe(false);
    });
  });
});

// =====================================================================
// VS Code format (servers key) — tested via 'vscode' tool
// =====================================================================
describe('VS Code format (servers)', () => {
  let tool: AiTool;
  let configPath: string;

  beforeEach(() => {
    tool = findTool('vscode');
    configPath = tool.getConfigPath();
  });

  describe('installVscode', () => {
    it('creates config with UseAI entry under servers key', () => {
      tool.install();

      const config = readJson(configPath);
      const servers = config['servers'] as Record<string, unknown>;
      expect(servers['UseAI']).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });

    it('preserves other server entries while adding UseAI', () => {
      writeJson(configPath, {
        servers: {
          'my-lsp': { command: 'node', args: ['lsp.js'] },
        },
      });

      tool.install();

      const config = readJson(configPath);
      const servers = config['servers'] as Record<string, unknown>;
      expect(servers['UseAI']).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
      expect(servers['my-lsp']).toEqual({ command: 'node', args: ['lsp.js'] });
    });

    it('removes legacy "useai" key during install', () => {
      writeJson(configPath, {
        servers: {
          useai: { command: 'old', args: [] },
        },
      });

      tool.install();

      const config = readJson(configPath);
      const servers = config['servers'] as Record<string, unknown>;
      expect(servers['useai']).toBeUndefined();
      expect(servers['UseAI']).toBeDefined();
    });
  });

  describe('removeVscode', () => {
    it('removes UseAI from servers key', () => {
      writeJson(configPath, {
        servers: {
          UseAI: { command: 'npx', args: ['-y', '@devness/useai@latest'] },
          'other-server': { command: 'node', args: [] },
        },
      });

      tool.remove();

      const config = readJson(configPath);
      const servers = config['servers'] as Record<string, unknown>;
      expect(servers['UseAI']).toBeUndefined();
      expect(servers['other-server']).toEqual({ command: 'node', args: [] });
    });

    it('removes both UseAI and legacy useai keys', () => {
      writeJson(configPath, {
        servers: {
          UseAI: { command: 'npx', args: [] },
          useai: { command: 'old', args: [] },
        },
      });

      tool.remove();

      const config = readJson(configPath);
      const servers = config['servers'] as Record<string, unknown> | undefined;
      expect(servers?.['UseAI']).toBeUndefined();
      expect(servers?.['useai']).toBeUndefined();
    });

    it('removes servers key entirely when it becomes empty', () => {
      writeJson(configPath, {
        servers: {
          UseAI: { command: 'npx', args: [] },
        },
        settings: { fontSize: 14 },
      });

      tool.remove();

      const config = readJson(configPath);
      expect(config['servers']).toBeUndefined();
      expect(config['settings']).toEqual({ fontSize: 14 });
    });

    it('does nothing when no config file exists', () => {
      tool.remove();
      expect(existsSync(configPath)).toBe(false);
    });
  });

  describe('isConfiguredVscode', () => {
    it('returns true when UseAI is present in servers', () => {
      writeJson(configPath, {
        servers: { UseAI: { command: 'npx', args: [] } },
      });

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns true when legacy useai is present in servers', () => {
      writeJson(configPath, {
        servers: { useai: { command: 'npx', args: [] } },
      });

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns false when servers exists but has no UseAI entry', () => {
      writeJson(configPath, {
        servers: { 'python-lsp': { command: 'pylsp', args: [] } },
      });

      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false for missing file', () => {
      expect(tool.isConfigured()).toBe(false);
    });
  });
});

// =====================================================================
// Zed format (context_servers key) — tested via 'zed' tool
// =====================================================================
describe('Zed format (context_servers)', () => {
  let tool: AiTool;
  let configPath: string;

  beforeEach(() => {
    tool = findTool('zed');
    configPath = tool.getConfigPath();
  });

  describe('installZed', () => {
    it('creates config with UseAI entry in context_servers with correct nested structure', () => {
      tool.install();

      const config = readJson(configPath);
      const servers = config['context_servers'] as Record<string, unknown>;
      expect(servers['UseAI']).toEqual({
        command: { path: 'npx', args: ['-y', '@devness/useai@latest'] },
        settings: {},
      });
    });

    it('preserves existing context_servers entries', () => {
      writeJson(configPath, {
        context_servers: {
          'existing-server': { command: { path: 'node' }, settings: {} },
        },
      });

      tool.install();

      const config = readJson(configPath);
      const servers = config['context_servers'] as Record<string, unknown>;
      expect(servers['UseAI']).toEqual({
        command: { path: 'npx', args: ['-y', '@devness/useai@latest'] },
        settings: {},
      });
      expect(servers['existing-server']).toEqual({
        command: { path: 'node' },
        settings: {},
      });
    });

    it('removes legacy "useai" key on install', () => {
      writeJson(configPath, {
        context_servers: {
          useai: { command: { path: 'old-npx' }, settings: {} },
        },
      });

      tool.install();

      const config = readJson(configPath);
      const servers = config['context_servers'] as Record<string, unknown>;
      expect(servers['useai']).toBeUndefined();
      expect(servers['UseAI']).toBeDefined();
    });
  });

  describe('removeZed', () => {
    it('removes UseAI from context_servers', () => {
      writeJson(configPath, {
        context_servers: {
          UseAI: { command: { path: 'npx' }, settings: {} },
          'my-ext': { command: { path: 'ext' }, settings: {} },
        },
      });

      tool.remove();

      const config = readJson(configPath);
      const servers = config['context_servers'] as Record<string, unknown>;
      expect(servers['UseAI']).toBeUndefined();
      expect(servers['my-ext']).toBeDefined();
    });

    it('removes both UseAI and legacy useai keys', () => {
      writeJson(configPath, {
        context_servers: {
          UseAI: { command: { path: 'npx' }, settings: {} },
          useai: { command: { path: 'old' }, settings: {} },
        },
      });

      tool.remove();

      const config = readJson(configPath);
      expect(config['context_servers']).toBeUndefined();
    });

    it('removes context_servers key when it becomes empty', () => {
      writeJson(configPath, {
        context_servers: {
          UseAI: { command: { path: 'npx' }, settings: {} },
        },
        theme: 'one-dark',
      });

      tool.remove();

      const config = readJson(configPath);
      expect(config['context_servers']).toBeUndefined();
      expect(config['theme']).toBe('one-dark');
    });
  });

  describe('isConfiguredZed', () => {
    it('returns true when UseAI exists in context_servers', () => {
      writeJson(configPath, {
        context_servers: { UseAI: { command: { path: 'npx' }, settings: {} } },
      });

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns true when legacy useai exists in context_servers', () => {
      writeJson(configPath, {
        context_servers: { useai: { command: { path: 'npx' }, settings: {} } },
      });

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns false when context_servers has no UseAI entry', () => {
      writeJson(configPath, {
        context_servers: { 'other-ext': {} },
      });

      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false for non-existent config', () => {
      expect(tool.isConfigured()).toBe(false);
    });
  });
});

// =====================================================================
// TOML format (mcp_servers key) — tested via 'codex' tool
// =====================================================================
describe('TOML format (mcp_servers)', () => {
  let tool: AiTool;
  let configPath: string;

  beforeEach(() => {
    tool = findTool('codex');
    configPath = tool.getConfigPath();
  });

  describe('installToml', () => {
    it('creates a TOML config with UseAI entry under mcp_servers', () => {
      tool.install();

      const config = readTomlHelper(configPath);
      const servers = config['mcp_servers'] as Record<string, unknown>;
      expect(servers['UseAI']).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });

    it('preserves existing TOML entries when adding UseAI', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        '[mcp_servers.existing]\ncommand = "node"\nargs = ["server.js"]\n',
      );

      tool.install();

      const config = readTomlHelper(configPath);
      const servers = config['mcp_servers'] as Record<string, unknown>;
      expect(servers['UseAI']).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
      expect(servers['existing']).toEqual({
        command: 'node',
        args: ['server.js'],
      });
    });

    it('removes legacy "useai" key when installing', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        '[mcp_servers.useai]\ncommand = "old-npx"\nargs = []\n',
      );

      tool.install();

      const config = readTomlHelper(configPath);
      const servers = config['mcp_servers'] as Record<string, unknown>;
      expect(servers['useai']).toBeUndefined();
      expect(servers['UseAI']).toBeDefined();
    });
  });

  describe('removeToml', () => {
    it('removes UseAI from mcp_servers in TOML config', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        [
          '[mcp_servers.UseAI]',
          'command = "npx"',
          'args = ["-y", "@devness/useai@latest"]',
          '',
          '[mcp_servers.other]',
          'command = "node"',
          'args = []',
        ].join('\n') + '\n',
      );

      tool.remove();

      const config = readTomlHelper(configPath);
      const servers = config['mcp_servers'] as Record<string, unknown>;
      expect(servers['UseAI']).toBeUndefined();
      expect(servers['other']).toEqual({ command: 'node', args: [] });
    });

    it('removes mcp_servers key when it becomes empty', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        'title = "my config"\n\n[mcp_servers.UseAI]\ncommand = "npx"\nargs = []\n',
      );

      tool.remove();

      const config = readTomlHelper(configPath);
      expect(config['mcp_servers']).toBeUndefined();
      expect(config['title']).toBe('my config');
    });

    it('does nothing when config file does not exist', () => {
      tool.remove();
      expect(existsSync(configPath)).toBe(false);
    });
  });

  describe('isConfiguredToml', () => {
    it('returns true when UseAI exists in mcp_servers', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        '[mcp_servers.UseAI]\ncommand = "npx"\nargs = ["-y", "@devness/useai@latest"]\n',
      );

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns true when legacy useai exists in mcp_servers', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        '[mcp_servers.useai]\ncommand = "npx"\nargs = []\n',
      );

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns false when mcp_servers has no UseAI entry', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        '[mcp_servers.other]\ncommand = "node"\nargs = []\n',
      );

      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false for missing config file', () => {
      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false for empty TOML file', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(configPath, '');

      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false for corrupt TOML content', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(configPath, '{{invalid toml [[[');

      expect(tool.isConfigured()).toBe(false);
    });
  });
});

// =====================================================================
// YAML format (extensions key) — tested via 'goose' tool
// =====================================================================
describe('YAML format (extensions)', () => {
  let tool: AiTool;
  let configPath: string;

  beforeEach(() => {
    tool = findTool('goose');
    configPath = tool.getConfigPath();
  });

  describe('installYaml', () => {
    it('creates a YAML config with UseAI entry under extensions', () => {
      tool.install();

      const config = readYamlHelper(configPath);
      const extensions = config['extensions'] as Record<string, unknown>;
      expect(extensions['UseAI']).toEqual({
        name: 'UseAI',
        cmd: 'npx',
        args: ['-y', '@devness/useai@latest'],
        enabled: true,
        type: 'stdio',
      });
    });

    it('preserves existing YAML entries when adding UseAI', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        'extensions:\n  existing-ext:\n    name: existing\n    cmd: node\n    enabled: true\n',
      );

      tool.install();

      const config = readYamlHelper(configPath);
      const extensions = config['extensions'] as Record<string, unknown>;
      expect(extensions['UseAI']).toEqual({
        name: 'UseAI',
        cmd: 'npx',
        args: ['-y', '@devness/useai@latest'],
        enabled: true,
        type: 'stdio',
      });
      expect(extensions['existing-ext']).toEqual({
        name: 'existing',
        cmd: 'node',
        enabled: true,
      });
    });

    it('removes legacy "useai" key when installing', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        'extensions:\n  useai:\n    name: useai\n    cmd: old-cmd\n    enabled: true\n',
      );

      tool.install();

      const config = readYamlHelper(configPath);
      const extensions = config['extensions'] as Record<string, unknown>;
      expect(extensions['useai']).toBeUndefined();
      expect(extensions['UseAI']).toBeDefined();
    });
  });

  describe('removeYaml', () => {
    it('removes UseAI from extensions in YAML config', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        [
          'extensions:',
          '  UseAI:',
          '    name: UseAI',
          '    cmd: npx',
          '    enabled: true',
          '  other:',
          '    name: other',
          '    cmd: node',
          '    enabled: true',
        ].join('\n') + '\n',
      );

      tool.remove();

      const config = readYamlHelper(configPath);
      const extensions = config['extensions'] as Record<string, unknown>;
      expect(extensions['UseAI']).toBeUndefined();
      expect(extensions['other']).toEqual({
        name: 'other',
        cmd: 'node',
        enabled: true,
      });
    });

    it('removes both UseAI and legacy useai keys', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        'extensions:\n  UseAI:\n    name: UseAI\n    cmd: npx\n  useai:\n    name: useai\n    cmd: old\n',
      );

      tool.remove();

      const config = readYamlHelper(configPath);
      expect(config['extensions']).toBeUndefined();
    });

    it('removes extensions key when it becomes empty', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        'version: 1\nextensions:\n  UseAI:\n    name: UseAI\n    cmd: npx\n',
      );

      tool.remove();

      const config = readYamlHelper(configPath);
      expect(config['extensions']).toBeUndefined();
      expect(config['version']).toBe(1);
    });

    it('does nothing when config file does not exist', () => {
      tool.remove();
      expect(existsSync(configPath)).toBe(false);
    });
  });

  describe('isConfiguredYaml', () => {
    it('returns true when UseAI exists in extensions', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        'extensions:\n  UseAI:\n    name: UseAI\n    cmd: npx\n',
      );

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns true when legacy useai exists in extensions', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        'extensions:\n  useai:\n    name: useai\n    cmd: npx\n',
      );

      expect(tool.isConfigured()).toBe(true);
    });

    it('returns false when extensions has no UseAI entry', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(
        configPath,
        'extensions:\n  other-ext:\n    name: other\n    cmd: node\n',
      );

      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false for missing config file', () => {
      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false for empty YAML file', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(configPath, '');

      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false for corrupt YAML content', () => {
      mkdirSync(join(configPath, '..'), { recursive: true });
      writeFileSync(configPath, ':\n  :\n    - :\n  {{invalid');

      expect(tool.isConfigured()).toBe(false);
    });
  });
});

// =====================================================================
// readJsonFile edge cases (tested via isConfigured on standard tools)
// =====================================================================
describe('readJsonFile edge cases', () => {
  let tool: AiTool;
  let configPath: string;

  beforeEach(() => {
    tool = findTool('cursor');
    configPath = tool.getConfigPath();
  });

  it('returns empty object equivalent when file does not exist', () => {
    expect(tool.isConfigured()).toBe(false);
  });

  it('handles file with only whitespace', () => {
    mkdirSync(join(configPath, '..'), { recursive: true });
    writeFileSync(configPath, '   \n\t  \n  ');

    expect(tool.isConfigured()).toBe(false);
  });

  it('handles corrupt JSON gracefully', () => {
    mkdirSync(join(configPath, '..'), { recursive: true });
    writeFileSync(configPath, '{"mcpServers": {broken');

    expect(tool.isConfigured()).toBe(false);
  });

  it('handles JSON with null mcpServers value', () => {
    writeJson(configPath, { mcpServers: null as unknown as Record<string, unknown> });

    expect(tool.isConfigured()).toBe(false);
  });
});

// =====================================================================
// readTomlFile edge cases
// =====================================================================
describe('readTomlFile edge cases', () => {
  let tool: AiTool;
  let configPath: string;

  beforeEach(() => {
    tool = findTool('codex');
    configPath = tool.getConfigPath();
  });

  it('returns empty object equivalent when TOML file does not exist', () => {
    expect(tool.isConfigured()).toBe(false);
  });

  it('handles empty TOML file', () => {
    mkdirSync(join(configPath, '..'), { recursive: true });
    writeFileSync(configPath, '');

    expect(tool.isConfigured()).toBe(false);
  });

  it('handles corrupt TOML gracefully', () => {
    mkdirSync(join(configPath, '..'), { recursive: true });
    writeFileSync(configPath, '= = = not valid toml');

    expect(tool.isConfigured()).toBe(false);
  });

  it('handles whitespace-only TOML file', () => {
    mkdirSync(join(configPath, '..'), { recursive: true });
    writeFileSync(configPath, '   \n\n   ');

    expect(tool.isConfigured()).toBe(false);
  });
});

// =====================================================================
// readYamlFile edge cases
// =====================================================================
describe('readYamlFile edge cases', () => {
  let tool: AiTool;
  let configPath: string;

  beforeEach(() => {
    tool = findTool('goose');
    configPath = tool.getConfigPath();
  });

  it('returns empty object equivalent when YAML file does not exist', () => {
    expect(tool.isConfigured()).toBe(false);
  });

  it('handles empty YAML file', () => {
    mkdirSync(join(configPath, '..'), { recursive: true });
    writeFileSync(configPath, '');

    expect(tool.isConfigured()).toBe(false);
  });

  it('handles whitespace-only YAML file', () => {
    mkdirSync(join(configPath, '..'), { recursive: true });
    writeFileSync(configPath, '  \n\n  ');

    expect(tool.isConfigured()).toBe(false);
  });
});

// =====================================================================
// Full install/remove round-trip for all formats
// =====================================================================
describe('full install/remove round-trip', () => {
  const toolIds = ['claude-code', 'vscode', 'zed', 'codex', 'goose'] as const;

  for (const toolId of toolIds) {
    it(`${toolId}: install → isConfigured true → remove → isConfigured false`, () => {
      const tool = findTool(toolId);

      expect(tool.isConfigured()).toBe(false);

      tool.install();
      expect(tool.isConfigured()).toBe(true);

      tool.remove();
      expect(tool.isConfigured()).toBe(false);
    });
  }
});

// =====================================================================
// HTTP install variants for standard and vscode formats
// =====================================================================
describe('HTTP install variants', () => {
  it('installStandardHttp writes URL-based entry under mcpServers', () => {
    const tool = findTool('claude-code');
    const configPath = tool.getConfigPath();

    tool.installHttp();

    const config = readJson(configPath);
    const servers = config['mcpServers'] as Record<string, unknown>;
    expect(servers['UseAI']).toEqual({ type: 'http', url: 'http://localhost:12425/mcp' });
    expect(servers['useai']).toBeUndefined();
  });

  it('installVscodeHttp writes type:http URL entry under servers', () => {
    const tool = findTool('vscode');
    const configPath = tool.getConfigPath();

    tool.installHttp();

    const config = readJson(configPath);
    const servers = config['servers'] as Record<string, unknown>;
    expect(servers['UseAI']).toEqual({
      type: 'http',
      url: 'http://localhost:12425/mcp',
    });
    expect(servers['useai']).toBeUndefined();
  });

  it('installHttp removes legacy useai key for standard format', () => {
    const tool = findTool('claude-code');
    const configPath = tool.getConfigPath();

    writeJson(configPath, {
      mcpServers: {
        useai: { command: 'old', args: [] },
      },
    });

    tool.installHttp();

    const config = readJson(configPath);
    const servers = config['mcpServers'] as Record<string, unknown>;
    expect(servers['useai']).toBeUndefined();
    expect(servers['UseAI']).toEqual({ type: 'http', url: 'http://localhost:12425/mcp' });
  });

  it('installHttp falls back to stdio install for unsupported formats like toml', () => {
    const tool = findTool('codex');
    const configPath = tool.getConfigPath();

    tool.installHttp();

    const config = readTomlHelper(configPath);
    const servers = config['mcp_servers'] as Record<string, unknown>;
    expect(servers['UseAI']).toEqual({
      command: 'npx',
      args: ['-y', '@devness/useai@latest'],
    });
  });
});

// =====================================================================
// resolveTools — the exported function for matching tools by name
// =====================================================================
describe('resolveTools', () => {
  it('resolves tool by exact id', () => {
    const { matched, unmatched } = resolveTools(['claude-code']);
    expect(matched.length).toBe(1);
    expect(matched[0]!.id).toBe('claude-code');
    expect(unmatched).toEqual([]);
  });

  it('resolves tool by display name (case-insensitive)', () => {
    const { matched, unmatched } = resolveTools(['Claude Code']);
    expect(matched.length).toBe(1);
    expect(matched[0]!.id).toBe('claude-code');
    expect(unmatched).toEqual([]);
  });

  it('resolves tool by partial match', () => {
    const { matched, unmatched } = resolveTools(['cursor']);
    expect(matched.length).toBe(1);
    expect(matched[0]!.id).toBe('cursor');
    expect(unmatched).toEqual([]);
  });

  it('returns unmatched names for unknown tools', () => {
    const { matched, unmatched } = resolveTools(['nonexistent-tool']);
    expect(matched).toEqual([]);
    expect(unmatched).toEqual(['nonexistent-tool']);
  });

  it('handles mixed known and unknown tool names', () => {
    const { matched, unmatched } = resolveTools(['cursor', 'unknown-editor', 'zed']);
    expect(matched.length).toBe(2);
    expect(matched.map((t) => t.id)).toContain('cursor');
    expect(matched.map((t) => t.id)).toContain('zed');
    expect(unmatched).toEqual(['unknown-editor']);
  });

  it('does not duplicate matched tools when multiple queries match the same tool', () => {
    const { matched } = resolveTools(['vscode', 'VS Code']);
    const ids = matched.map((t) => t.id);
    const unique = [...new Set(ids)];
    expect(ids.length).toBe(unique.length);
  });
});

// =====================================================================
// Install idempotency: installing twice does not corrupt config
// =====================================================================
describe('install idempotency', () => {
  it('standard format: double install produces single UseAI entry', () => {
    const tool = findTool('claude-code');

    tool.install();
    tool.install();

    const config = readJson(tool.getConfigPath());
    const servers = config['mcpServers'] as Record<string, unknown>;
    const keys = Object.keys(servers).filter((k) => k === 'UseAI');
    expect(keys.length).toBe(1);
  });

  it('vscode format: double install produces single UseAI entry', () => {
    const tool = findTool('vscode');

    tool.install();
    tool.install();

    const config = readJson(tool.getConfigPath());
    const servers = config['servers'] as Record<string, unknown>;
    const keys = Object.keys(servers).filter((k) => k === 'UseAI');
    expect(keys.length).toBe(1);
  });

  it('zed format: double install produces single UseAI entry', () => {
    const tool = findTool('zed');

    tool.install();
    tool.install();

    const config = readJson(tool.getConfigPath());
    const servers = config['context_servers'] as Record<string, unknown>;
    const keys = Object.keys(servers).filter((k) => k === 'UseAI');
    expect(keys.length).toBe(1);
  });

  it('toml format: double install produces single UseAI entry', () => {
    const tool = findTool('codex');

    tool.install();
    tool.install();

    const config = readTomlHelper(tool.getConfigPath());
    const servers = config['mcp_servers'] as Record<string, unknown>;
    const keys = Object.keys(servers).filter((k) => k === 'UseAI');
    expect(keys.length).toBe(1);
  });

  it('yaml format: double install produces single UseAI entry', () => {
    const tool = findTool('goose');

    tool.install();
    tool.install();

    const config = readYamlHelper(tool.getConfigPath());
    const extensions = config['extensions'] as Record<string, unknown>;
    const keys = Object.keys(extensions).filter((k) => k === 'UseAI');
    expect(keys.length).toBe(1);
  });
});

// =====================================================================
// AI_TOOLS metadata correctness
// =====================================================================
describe('AI_TOOLS metadata', () => {
  it('every tool has a non-empty id', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.id.length).toBeGreaterThan(0);
    }
  });

  it('every tool has a non-empty name', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.name.length).toBeGreaterThan(0);
    }
  });

  it('tool ids are unique', () => {
    const ids = AI_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('configFormat is one of the valid formats for every tool', () => {
    const validFormats = ['standard', 'vscode', 'zed', 'toml', 'yaml'];
    for (const tool of AI_TOOLS) {
      expect(validFormats).toContain(tool.configFormat);
    }
  });

  it('getConfigPath returns a non-empty string for every tool', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.getConfigPath().length).toBeGreaterThan(0);
    }
  });
});