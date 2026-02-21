import { describe, it, expect, vi, beforeEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { stringify as stringifyToml, parse as parseToml } from 'smol-toml';
import { stringify as stringifyYaml, parse as parseYaml } from 'yaml';

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ''),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => {
    throw new Error('not found');
  }),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock-home'),
}));

import { AI_TOOLS, resolveTools } from './tools';
import type { AiTool } from './tools';

const mockedExistsSync = vi.mocked(existsSync);
const mockedReadFileSync = vi.mocked(readFileSync);
const mockedWriteFileSync = vi.mocked(writeFileSync);
const mockedMkdirSync = vi.mocked(mkdirSync);

function findTool(id: string): AiTool {
  const tool = AI_TOOLS.find((t) => t.id === id);
  if (!tool) throw new Error(`Tool ${id} not found in AI_TOOLS`);
  return tool;
}

function mockFileContent(content: string) {
  mockedExistsSync.mockReturnValue(true);
  mockedReadFileSync.mockReturnValue(content);
}

function mockTomlContent(data: Record<string, unknown>) {
  mockedExistsSync.mockReturnValue(true);
  mockedReadFileSync.mockReturnValue(stringifyToml(data));
}

function mockYamlContent(data: Record<string, unknown>) {
  mockedExistsSync.mockReturnValue(true);
  mockedReadFileSync.mockReturnValue(stringifyYaml(data));
}

function getWrittenContent(): Record<string, unknown> {
  const call = mockedWriteFileSync.mock.calls[0];
  if (!call) throw new Error('writeFileSync was not called');
  return JSON.parse(call[1] as string);
}

function getWrittenTomlContent(): Record<string, unknown> {
  const call = mockedWriteFileSync.mock.calls[0];
  if (!call) throw new Error('writeFileSync was not called');
  return parseToml(call[1] as string) as Record<string, unknown>;
}

function getWrittenYamlContent(): Record<string, unknown> {
  const call = mockedWriteFileSync.mock.calls[0];
  if (!call) throw new Error('writeFileSync was not called');
  return parseYaml(call[1] as string) as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedExistsSync.mockReturnValue(false);
  mockedReadFileSync.mockReturnValue('');
});

describe('AI_TOOLS registry', () => {
  it('contains all expected tool IDs', () => {
    const ids = AI_TOOLS.map((t) => t.id);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('claude-desktop');
    expect(ids).toContain('cursor');
    expect(ids).toContain('windsurf');
    expect(ids).toContain('vscode');
    expect(ids).toContain('vscode-insiders');
    expect(ids).toContain('gemini-cli');
    expect(ids).toContain('zed');
    expect(ids).toContain('cline');
    expect(ids).toContain('roo-code');
    expect(ids).toContain('amazon-q-cli');
    expect(ids).toContain('amazon-q-ide');
    expect(ids).toContain('codex');
    expect(ids).toContain('goose');
    expect(ids).toContain('opencode');
    expect(ids).toContain('junie');
  });

  it('each tool has required properties and valid config format', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.id).toEqual(expect.any(String));
      expect(tool.name).toEqual(expect.any(String));
      expect(['standard', 'vscode', 'zed', 'toml', 'yaml']).toContain(tool.configFormat);
      expect(typeof tool.getConfigPath).toBe('function');
      expect(typeof tool.detect).toBe('function');
      expect(typeof tool.isConfigured).toBe('function');
      expect(typeof tool.install).toBe('function');
      expect(typeof tool.remove).toBe('function');
    }
  });

  it('each tool config path is under the mocked home directory', () => {
    for (const tool of AI_TOOLS) {
      const configPath = tool.getConfigPath();
      expect(configPath.startsWith('/mock-home')).toBe(true);
    }
  });

  it('assigns correct config formats to tools', () => {
    expect(findTool('claude-code').configFormat).toBe('standard');
    expect(findTool('vscode').configFormat).toBe('vscode');
    expect(findTool('vscode-insiders').configFormat).toBe('vscode');
    expect(findTool('zed').configFormat).toBe('zed');
    expect(findTool('codex').configFormat).toBe('toml');
    expect(findTool('goose').configFormat).toBe('yaml');
  });
});

describe('Standard config format (mcpServers)', () => {
  const tool = () => findTool('claude-code');

  describe('isConfigured', () => {
    it('returns false when config file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(tool().isConfigured()).toBe(false);
    });

    it('returns false when config file is empty', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('');
      expect(tool().isConfigured()).toBe(false);
    });

    it('returns false when mcpServers key does not exist', () => {
      mockFileContent(JSON.stringify({ otherKey: 'value' }));
      expect(tool().isConfigured()).toBe(false);
    });

    it('returns true when UseAI key exists in mcpServers', () => {
      mockFileContent(JSON.stringify({
        mcpServers: { UseAI: { command: 'npx', args: ['-y', '@devness/useai@latest'] } },
      }));
      expect(tool().isConfigured()).toBe(true);
    });

    it('returns true when legacy useai key exists in mcpServers', () => {
      mockFileContent(JSON.stringify({
        mcpServers: { useai: { command: 'npx' } },
      }));
      expect(tool().isConfigured()).toBe(true);
    });

    it('returns false when mcpServers exists but UseAI is not present', () => {
      mockFileContent(JSON.stringify({
        mcpServers: { SomeOtherServer: { command: 'node' } },
      }));
      expect(tool().isConfigured()).toBe(false);
    });
  });

  describe('install', () => {
    it('creates config with mcpServers.UseAI when file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      tool().install();
      const written = getWrittenContent();
      expect(written).toEqual({
        mcpServers: {
          UseAI: { command: 'npx', args: ['-y', '@devness/useai@latest'] },
        },
      });
    });

    it('adds UseAI to existing mcpServers without overwriting others', () => {
      mockFileContent(JSON.stringify({
        mcpServers: { OtherServer: { command: 'node' } },
      }));
      tool().install();
      const written = getWrittenContent();
      expect(written.mcpServers).toEqual({
        OtherServer: { command: 'node' },
        UseAI: { command: 'npx', args: ['-y', '@devness/useai@latest'] },
      });
    });

    it('removes legacy useai key and adds UseAI', () => {
      mockFileContent(JSON.stringify({
        mcpServers: { useai: { command: 'old' } },
      }));
      tool().install();
      const written = getWrittenContent();
      expect(written.mcpServers).toEqual({
        UseAI: { command: 'npx', args: ['-y', '@devness/useai@latest'] },
      });
      expect((written.mcpServers as Record<string, unknown>)['useai']).toBeUndefined();
    });

    it('preserves other config keys in the file', () => {
      mockFileContent(JSON.stringify({
        someExistingConfig: true,
        mcpServers: {},
      }));
      tool().install();
      const written = getWrittenContent();
      expect(written.someExistingConfig).toBe(true);
    });

    it('creates parent directories recursively', () => {
      mockedExistsSync.mockReturnValue(false);
      tool().install();
      expect(mockedMkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true },
      );
    });
  });

  describe('remove', () => {
    it('does nothing when config file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      tool().remove();
      expect(mockedWriteFileSync).not.toHaveBeenCalled();
    });

    it('removes UseAI from mcpServers', () => {
      mockFileContent(JSON.stringify({
        mcpServers: {
          UseAI: { command: 'npx' },
          OtherServer: { command: 'node' },
        },
      }));
      tool().remove();
      const written = getWrittenContent();
      expect((written.mcpServers as Record<string, unknown>)['UseAI']).toBeUndefined();
      expect((written.mcpServers as Record<string, unknown>)['OtherServer']).toEqual({ command: 'node' });
    });

    it('removes legacy useai key too', () => {
      mockFileContent(JSON.stringify({
        mcpServers: {
          useai: { command: 'npx' },
          OtherServer: { command: 'node' },
        },
      }));
      tool().remove();
      const written = getWrittenContent();
      expect((written.mcpServers as Record<string, unknown>)['useai']).toBeUndefined();
    });

    it('removes mcpServers key entirely when it becomes empty', () => {
      mockFileContent(JSON.stringify({
        otherConfig: 'keep',
        mcpServers: { UseAI: { command: 'npx' } },
      }));
      tool().remove();
      const written = getWrittenContent();
      expect(written.mcpServers).toBeUndefined();
      expect(written.otherConfig).toBe('keep');
    });

    it('does not rewrite config when mcpServers key does not exist', () => {
      mockFileContent(JSON.stringify({ otherKey: 'value' }));
      tool().remove();
      const configWrites = mockedWriteFileSync.mock.calls.filter(
        (call) => String(call[0]) === tool().getConfigPath(),
      );
      expect(configWrites).toHaveLength(0);
    });
  });
});

describe('VS Code config format (servers)', () => {
  const tool = () => findTool('vscode');

  describe('isConfigured', () => {
    it('returns false when config file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(tool().isConfigured()).toBe(false);
    });

    it('returns true when UseAI exists in servers', () => {
      mockFileContent(JSON.stringify({
        servers: { UseAI: { command: 'npx', args: ['-y', '@devness/useai@latest'] } },
      }));
      expect(tool().isConfigured()).toBe(true);
    });

    it('returns true when legacy useai exists in servers', () => {
      mockFileContent(JSON.stringify({
        servers: { useai: { command: 'npx' } },
      }));
      expect(tool().isConfigured()).toBe(true);
    });

    it('returns false when servers key exists but without UseAI', () => {
      mockFileContent(JSON.stringify({
        servers: { AnotherServer: {} },
      }));
      expect(tool().isConfigured()).toBe(false);
    });
  });

  describe('install', () => {
    it('creates config with servers.UseAI when file does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      tool().install();
      const written = getWrittenContent();
      expect(written).toEqual({
        servers: {
          UseAI: { command: 'npx', args: ['-y', '@devness/useai@latest'] },
        },
      });
    });

    it('removes legacy useai key and adds UseAI alongside existing servers', () => {
      mockFileContent(JSON.stringify({
        servers: { useai: { command: 'old' }, Other: { command: 'node' } },
      }));
      tool().install();
      const written = getWrittenContent();
      expect((written.servers as Record<string, unknown>)['useai']).toBeUndefined();
      expect((written.servers as Record<string, unknown>)['UseAI']).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
      expect((written.servers as Record<string, unknown>)['Other']).toEqual({ command: 'node' });
    });
  });

  describe('remove', () => {
    it('removes UseAI from servers while keeping other entries', () => {
      mockFileContent(JSON.stringify({
        servers: { UseAI: { command: 'npx' }, Keep: {} },
      }));
      tool().remove();
      const written = getWrittenContent();
      expect((written.servers as Record<string, unknown>)['UseAI']).toBeUndefined();
      expect((written.servers as Record<string, unknown>)['Keep']).toEqual({});
    });

    it('removes servers key when empty after removal', () => {
      mockFileContent(JSON.stringify({
        servers: { UseAI: { command: 'npx' } },
      }));
      tool().remove();
      const written = getWrittenContent();
      expect(written.servers).toBeUndefined();
    });
  });
});

describe('Zed config format (context_servers)', () => {
  const tool = () => findTool('zed');

  describe('isConfigured', () => {
    it('returns false when config does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(tool().isConfigured()).toBe(false);
    });

    it('returns true when UseAI exists in context_servers', () => {
      mockFileContent(JSON.stringify({
        context_servers: {
          UseAI: {
            command: { path: 'npx', args: ['-y', '@devness/useai@latest'] },
            settings: {},
          },
        },
      }));
      expect(tool().isConfigured()).toBe(true);
    });

    it('returns true when legacy useai exists in context_servers', () => {
      mockFileContent(JSON.stringify({
        context_servers: { useai: {} },
      }));
      expect(tool().isConfigured()).toBe(true);
    });
  });

  describe('install', () => {
    it('installs with Zed-specific format (command.path + settings)', () => {
      mockedExistsSync.mockReturnValue(false);
      tool().install();
      const written = getWrittenContent();
      expect(written).toEqual({
        context_servers: {
          UseAI: {
            command: { path: 'npx', args: ['-y', '@devness/useai@latest'] },
            settings: {},
          },
        },
      });
    });

    it('removes legacy useai key during install', () => {
      mockFileContent(JSON.stringify({
        context_servers: { useai: { old: true } },
      }));
      tool().install();
      const written = getWrittenContent();
      expect((written.context_servers as Record<string, unknown>)['useai']).toBeUndefined();
      expect((written.context_servers as Record<string, unknown>)['UseAI']).toEqual({
        command: { path: 'npx', args: ['-y', '@devness/useai@latest'] },
        settings: {},
      });
    });
  });

  describe('remove', () => {
    it('removes UseAI from context_servers while keeping others', () => {
      mockFileContent(JSON.stringify({
        context_servers: { UseAI: { command: {} }, Other: {} },
      }));
      tool().remove();
      const written = getWrittenContent();
      expect((written.context_servers as Record<string, unknown>)['UseAI']).toBeUndefined();
      expect((written.context_servers as Record<string, unknown>)['Other']).toEqual({});
    });

    it('removes context_servers key when empty', () => {
      mockFileContent(JSON.stringify({
        context_servers: { UseAI: {} },
      }));
      tool().remove();
      const written = getWrittenContent();
      expect(written.context_servers).toBeUndefined();
    });
  });
});

describe('TOML config format (mcp_servers) — Codex', () => {
  const tool = () => findTool('codex');

  describe('isConfigured', () => {
    it('returns false when config does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(tool().isConfigured()).toBe(false);
    });

    it('returns true when UseAI exists in mcp_servers', () => {
      mockTomlContent({
        mcp_servers: { UseAI: { command: 'npx' } },
      });
      expect(tool().isConfigured()).toBe(true);
    });

    it('returns true when legacy useai exists in mcp_servers', () => {
      mockTomlContent({
        mcp_servers: { useai: { command: 'npx' } },
      });
      expect(tool().isConfigured()).toBe(true);
    });

    it('returns false when mcp_servers exists without UseAI', () => {
      mockTomlContent({
        mcp_servers: { OtherTool: { command: 'node' } },
      });
      expect(tool().isConfigured()).toBe(false);
    });
  });

  describe('install', () => {
    it('creates config with mcp_servers.UseAI', () => {
      mockedExistsSync.mockReturnValue(false);
      tool().install();
      const written = getWrittenTomlContent();
      expect((written.mcp_servers as Record<string, unknown>)['UseAI']).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });

    it('removes legacy useai key when installing', () => {
      mockTomlContent({
        mcp_servers: { useai: { command: 'old' } },
      });
      tool().install();
      const written = getWrittenTomlContent();
      expect((written.mcp_servers as Record<string, unknown>)['useai']).toBeUndefined();
      expect((written.mcp_servers as Record<string, unknown>)['UseAI']).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });
  });

  describe('remove', () => {
    it('removes UseAI from mcp_servers while keeping others', () => {
      mockTomlContent({
        mcp_servers: { UseAI: { command: 'npx' }, OtherTool: { command: 'node' } },
      });
      tool().remove();
      const written = getWrittenTomlContent();
      expect((written.mcp_servers as Record<string, unknown>)['UseAI']).toBeUndefined();
      expect((written.mcp_servers as Record<string, unknown>)['OtherTool']).toEqual({ command: 'node' });
    });

    it('removes mcp_servers key when empty', () => {
      mockTomlContent({
        mcp_servers: { UseAI: { command: 'npx' } },
      });
      tool().remove();
      const written = getWrittenTomlContent();
      expect(written.mcp_servers).toBeUndefined();
    });

    it('does not rewrite config when mcp_servers does not exist', () => {
      mockTomlContent({ other: 'value' });
      tool().remove();
      const configWrites = mockedWriteFileSync.mock.calls.filter(
        (call) => String(call[0]) === tool().getConfigPath(),
      );
      expect(configWrites).toHaveLength(0);
    });
  });
});

describe('YAML config format (extensions) — Goose', () => {
  const tool = () => findTool('goose');

  describe('isConfigured', () => {
    it('returns false when config does not exist', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(tool().isConfigured()).toBe(false);
    });

    it('returns true when UseAI exists in extensions', () => {
      mockYamlContent({
        extensions: { UseAI: { name: 'UseAI', cmd: 'npx' } },
      });
      expect(tool().isConfigured()).toBe(true);
    });

    it('returns true when legacy useai exists in extensions', () => {
      mockYamlContent({
        extensions: { useai: {} },
      });
      expect(tool().isConfigured()).toBe(true);
    });

    it('returns false when extensions key is absent', () => {
      mockYamlContent({ other: 'value' });
      expect(tool().isConfigured()).toBe(false);
    });
  });

  describe('install', () => {
    it('creates config with Goose-specific extension format', () => {
      mockedExistsSync.mockReturnValue(false);
      tool().install();
      const written = getWrittenYamlContent();
      expect(written).toEqual({
        extensions: {
          UseAI: {
            name: 'UseAI',
            cmd: 'npx',
            args: ['-y', '@devness/useai@latest'],
            enabled: true,
            type: 'stdio',
          },
        },
      });
    });

    it('removes legacy useai key when installing', () => {
      mockYamlContent({
        extensions: { useai: { name: 'old' } },
      });
      tool().install();
      const written = getWrittenYamlContent();
      expect((written.extensions as Record<string, unknown>)['useai']).toBeUndefined();
      expect((written.extensions as Record<string, unknown>)['UseAI']).toEqual({
        name: 'UseAI',
        cmd: 'npx',
        args: ['-y', '@devness/useai@latest'],
        enabled: true,
        type: 'stdio',
      });
    });
  });

  describe('remove', () => {
    it('removes UseAI from extensions while keeping others', () => {
      mockYamlContent({
        extensions: { UseAI: { name: 'UseAI' }, OtherExt: { name: 'other' } },
      });
      tool().remove();
      const written = getWrittenYamlContent();
      expect((written.extensions as Record<string, unknown>)['UseAI']).toBeUndefined();
      expect((written.extensions as Record<string, unknown>)['OtherExt']).toEqual({ name: 'other' });
    });

    it('removes extensions key when empty', () => {
      mockYamlContent({
        extensions: { UseAI: { name: 'UseAI' } },
      });
      tool().remove();
      const written = getWrittenYamlContent();
      expect(written.extensions).toBeUndefined();
    });

    it('does not rewrite config when extensions does not exist', () => {
      mockYamlContent({ other: 'value' });
      tool().remove();
      const configWrites = mockedWriteFileSync.mock.calls.filter(
        (call) => String(call[0]) === tool().getConfigPath(),
      );
      expect(configWrites).toHaveLength(0);
    });
  });
});

describe('File I/O helpers (via install/remove/isConfigured)', () => {
  describe('readJsonFile behavior', () => {
    it('returns empty object for non-existent files', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(findTool('cursor').isConfigured()).toBe(false);
    });

    it('returns empty object for empty file content', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('   ');
      expect(findTool('cursor').isConfigured()).toBe(false);
    });

    it('returns empty object for invalid JSON', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('not valid json {{{');
      expect(findTool('cursor').isConfigured()).toBe(false);
    });
  });

  describe('writeJsonFile behavior', () => {
    it('creates parent directories before writing', () => {
      mockedExistsSync.mockReturnValue(false);
      findTool('cursor').install();
      expect(mockedMkdirSync).toHaveBeenCalledWith(
        expect.any(String),
        { recursive: true },
      );
    });

    it('writes formatted JSON with trailing newline', () => {
      mockedExistsSync.mockReturnValue(false);
      findTool('cursor').install();
      const rawContent = mockedWriteFileSync.mock.calls[0]![1] as string;
      expect(rawContent.endsWith('\n')).toBe(true);
      expect(rawContent).toContain('  ');
    });
  });

  describe('readTomlFile behavior (via codex)', () => {
    it('returns empty object for non-existent TOML files', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(findTool('codex').isConfigured()).toBe(false);
    });

    it('returns empty object for empty TOML content', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('   ');
      expect(findTool('codex').isConfigured()).toBe(false);
    });
  });

  describe('readYamlFile behavior (via goose)', () => {
    it('returns empty object for non-existent YAML files', () => {
      mockedExistsSync.mockReturnValue(false);
      expect(findTool('goose').isConfigured()).toBe(false);
    });

    it('returns empty object for empty YAML content', () => {
      mockedExistsSync.mockReturnValue(true);
      mockedReadFileSync.mockReturnValue('  ');
      expect(findTool('goose').isConfigured()).toBe(false);
    });
  });
});

describe('matchesTool (via resolveTools)', () => {
  it('matches by exact tool id', () => {
    const { matched } = resolveTools(['claude-code']);
    expect(matched.map((t) => t.id)).toContain('claude-code');
  });

  it('matches by exact tool name', () => {
    const { matched } = resolveTools(['Claude Code']);
    expect(matched.map((t) => t.id)).toContain('claude-code');
  });

  it('matches case-insensitively', () => {
    const { matched } = resolveTools(['CURSOR']);
    expect(matched.map((t) => t.id)).toContain('cursor');
  });

  it('matches partial id substring', () => {
    const { matched } = resolveTools(['claude']);
    const ids = matched.map((t) => t.id);
    expect(ids).toContain('claude-code');
  });

  it('matches partial name substring', () => {
    const { matched } = resolveTools(['VS Code']);
    const ids = matched.map((t) => t.id);
    expect(ids).toContain('vscode');
    expect(ids).toContain('vscode-insiders');
  });

  it('normalizes hyphens, underscores, and spaces for matching', () => {
    const { matched } = resolveTools(['claude_code']);
    expect(matched.map((t) => t.id)).toContain('claude-code');
  });

  it('normalizes spaces in query to match hyphenated ids', () => {
    const { matched } = resolveTools(['roo code']);
    expect(matched.map((t) => t.id)).toContain('roo-code');
  });

  it('reports unmatched names when no tool matches', () => {
    const { matched, unmatched } = resolveTools(['nonexistent-tool']);
    expect(matched).toHaveLength(0);
    expect(unmatched).toEqual(['nonexistent-tool']);
  });

  it('matches amazon tools by partial name', () => {
    const { matched } = resolveTools(['amazon']);
    const ids = matched.map((t) => t.id);
    expect(ids).toContain('amazon-q-cli');
    expect(ids).toContain('amazon-q-ide');
  });
});

describe('resolveTools', () => {
  it('returns matched and unmatched arrays', () => {
    const result = resolveTools(['cursor', 'nonexistent']);
    expect(result.matched.map((t) => t.id)).toContain('cursor');
    expect(result.unmatched).toEqual(['nonexistent']);
  });

  it('deduplicates when multiple names resolve to the same tool', () => {
    const { matched } = resolveTools(['cursor', 'Cursor']);
    const cursorTools = matched.filter((t) => t.id === 'cursor');
    expect(cursorTools).toHaveLength(1);
  });

  it('deduplicates when a broad query overlaps with a specific query', () => {
    const { matched } = resolveTools(['claude', 'claude-code']);
    const claudeCodeTools = matched.filter((t) => t.id === 'claude-code');
    expect(claudeCodeTools).toHaveLength(1);
  });

  it('handles empty input array', () => {
    const result = resolveTools([]);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toHaveLength(0);
  });

  it('handles all unmatched names', () => {
    const result = resolveTools(['alpha', 'beta', 'gamma']);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatched).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('handles all matched names', () => {
    const result = resolveTools(['cursor', 'zed', 'goose']);
    expect(result.matched).toHaveLength(3);
    expect(result.unmatched).toHaveLength(0);
  });

  it('preserves order of first appearance in matched results', () => {
    const { matched } = resolveTools(['goose', 'cursor', 'zed']);
    const ids = matched.map((t) => t.id);
    expect(ids.indexOf('goose')).toBeLessThan(ids.indexOf('cursor'));
    expect(ids.indexOf('cursor')).toBeLessThan(ids.indexOf('zed'));
  });
});

describe('createTool (via AiTool objects)', () => {
  it('getConfigPath returns the expected path for cursor', () => {
    const tool = findTool('cursor');
    expect(tool.getConfigPath()).toBe(join('/mock-home', '.cursor', 'mcp.json'));
  });

  it('binds install to the correct config file path', () => {
    mockedExistsSync.mockReturnValue(false);
    const tool = findTool('cursor');
    tool.install();
    const writtenPath = mockedWriteFileSync.mock.calls[0]![0] as string;
    expect(writtenPath).toBe(tool.getConfigPath());
  });
});

describe('Install/remove round-trip for each format', () => {
  it('standard format: install → configured → remove → not configured', () => {
    const tool = findTool('windsurf');

    mockedExistsSync.mockReturnValue(false);
    expect(tool.isConfigured()).toBe(false);

    tool.install();
    const installedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    expect(tool.isConfigured()).toBe(true);

    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    tool.remove();
    const removedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedReadFileSync.mockReturnValue(removedContent);
    expect(tool.isConfigured()).toBe(false);
  });

  it('vscode format: install → configured → remove → not configured', () => {
    const tool = findTool('vscode');

    mockedExistsSync.mockReturnValue(false);
    expect(tool.isConfigured()).toBe(false);

    tool.install();
    const installedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    expect(tool.isConfigured()).toBe(true);

    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    tool.remove();
    const removedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedReadFileSync.mockReturnValue(removedContent);
    expect(tool.isConfigured()).toBe(false);
  });

  it('zed format: install → configured → remove → not configured', () => {
    const tool = findTool('zed');

    mockedExistsSync.mockReturnValue(false);
    expect(tool.isConfigured()).toBe(false);

    tool.install();
    const installedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    expect(tool.isConfigured()).toBe(true);

    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    tool.remove();
    const removedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedReadFileSync.mockReturnValue(removedContent);
    expect(tool.isConfigured()).toBe(false);
  });

  it('toml format: install → configured → remove → not configured', () => {
    const tool = findTool('codex');

    mockedExistsSync.mockReturnValue(false);
    expect(tool.isConfigured()).toBe(false);

    tool.install();
    const installedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    expect(tool.isConfigured()).toBe(true);

    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    tool.remove();
    const removedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedReadFileSync.mockReturnValue(removedContent);
    expect(tool.isConfigured()).toBe(false);
  });

  it('yaml format: install → configured → remove → not configured', () => {
    const tool = findTool('goose');

    mockedExistsSync.mockReturnValue(false);
    expect(tool.isConfigured()).toBe(false);

    tool.install();
    const installedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    expect(tool.isConfigured()).toBe(true);

    vi.clearAllMocks();
    mockedExistsSync.mockReturnValue(true);
    mockedReadFileSync.mockReturnValue(installedContent);
    tool.remove();
    const removedContent = mockedWriteFileSync.mock.calls[0]![1] as string;

    mockedReadFileSync.mockReturnValue(removedContent);
    expect(tool.isConfigured()).toBe(false);
  });
});