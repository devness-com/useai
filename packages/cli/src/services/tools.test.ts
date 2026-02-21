import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { join } from 'node:path';

// Mock node:child_process
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock node:os
vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/mock-home'),
}));

// Mock smol-toml
vi.mock('smol-toml', () => ({
  parse: vi.fn((raw: string) => JSON.parse(raw)),
  stringify: vi.fn((data: unknown) => JSON.stringify(data, null, 2)),
}));

// Mock yaml
vi.mock('yaml', () => ({
  parse: vi.fn((raw: string) => JSON.parse(raw)),
  stringify: vi.fn((data: unknown) => JSON.stringify(data, null, 2)),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolveTools, AI_TOOLS, type AiTool } from './tools';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockWriteFileSync = vi.mocked(writeFileSync);
const mockMkdirSync = vi.mocked(mkdirSync);
const mockExecSync = vi.mocked(execSync);

beforeEach(() => {
  vi.clearAllMocks();
  mockExistsSync.mockReturnValue(false);
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

  it('each tool has required properties', () => {
    for (const tool of AI_TOOLS) {
      expect(tool.id).toEqual(expect.any(String));
      expect(tool.name).toEqual(expect.any(String));
      expect(tool.configFormat).toEqual(expect.any(String));
      expect(typeof tool.getConfigPath).toBe('function');
      expect(typeof tool.detect).toBe('function');
      expect(typeof tool.isConfigured).toBe('function');
      expect(typeof tool.install).toBe('function');
      expect(typeof tool.remove).toBe('function');
    }
  });

  it('claude-code uses standard config format with correct path', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'claude-code')!;
    expect(tool.configFormat).toBe('standard');
    expect(tool.getConfigPath()).toBe(join('/mock-home', '.claude.json'));
  });

  it('vscode uses vscode config format', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'vscode')!;
    expect(tool.configFormat).toBe('vscode');
  });

  it('zed uses zed config format', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'zed')!;
    expect(tool.configFormat).toBe('zed');
  });

  it('codex uses toml config format', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'codex')!;
    expect(tool.configFormat).toBe('toml');
  });

  it('goose uses yaml config format', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'goose')!;
    expect(tool.configFormat).toBe('yaml');
  });
});

describe('resolveTools', () => {
  it('matches a tool by exact ID', () => {
    const result = resolveTools(['claude-code']);
    expect(result.matched.map((t) => t.id)).toContain('claude-code');
    expect(result.unmatched).toEqual([]);
  });

  it('matches a tool by exact name', () => {
    const result = resolveTools(['Claude Code']);
    expect(result.matched.map((t) => t.id)).toContain('claude-code');
    expect(result.unmatched).toEqual([]);
  });

  it('matches case-insensitively', () => {
    const result = resolveTools(['CLAUDE-CODE']);
    expect(result.matched.map((t) => t.id)).toContain('claude-code');
    expect(result.unmatched).toEqual([]);
  });

  it('matches partial strings', () => {
    const result = resolveTools(['cursor']);
    expect(result.matched.map((t) => t.id)).toContain('cursor');
    expect(result.unmatched).toEqual([]);
  });

  it('matches with partial name substring', () => {
    const result = resolveTools(['gemini']);
    expect(result.matched.map((t) => t.id)).toContain('gemini-cli');
    expect(result.unmatched).toEqual([]);
  });

  it('reports unmatched names', () => {
    const result = resolveTools(['nonexistent-tool']);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual(['nonexistent-tool']);
  });

  it('handles a mix of matched and unmatched names', () => {
    const result = resolveTools(['cursor', 'unknown-editor', 'zed']);
    expect(result.matched.map((t) => t.id)).toContain('cursor');
    expect(result.matched.map((t) => t.id)).toContain('zed');
    expect(result.unmatched).toEqual(['unknown-editor']);
  });

  it('deduplicates matched tools when multiple queries match the same tool', () => {
    const result = resolveTools(['claude-code', 'Claude Code']);
    const claudeCodeMatches = result.matched.filter((t) => t.id === 'claude-code');
    expect(claudeCodeMatches).toHaveLength(1);
  });

  it('returns empty matched and unmatched for empty input', () => {
    const result = resolveTools([]);
    expect(result.matched).toEqual([]);
    expect(result.unmatched).toEqual([]);
  });

  it('can match multiple different tools from a single broad query', () => {
    // "vscode" should match both vscode and vscode-insiders
    const result = resolveTools(['vscode']);
    const ids = result.matched.map((t) => t.id);
    expect(ids).toContain('vscode');
    expect(ids).toContain('vscode-insiders');
    expect(result.unmatched).toEqual([]);
  });

  it('normalizes hyphens, underscores, and spaces in query', () => {
    const result = resolveTools(['claude code']);
    expect(result.matched.map((t) => t.id)).toContain('claude-code');

    const result2 = resolveTools(['claude_code']);
    expect(result2.matched.map((t) => t.id)).toContain('claude-code');
  });

  it('matches amazon q tools with partial queries', () => {
    const result = resolveTools(['amazon']);
    const ids = result.matched.map((t) => t.id);
    expect(ids).toContain('amazon-q-cli');
    expect(ids).toContain('amazon-q-ide');
  });
});

describe('standard config format (mcpServers)', () => {
  let tool: AiTool;

  beforeEach(() => {
    tool = AI_TOOLS.find((t) => t.id === 'claude-code')!;
  });

  describe('isConfigured', () => {
    it('returns false when config file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false when config has no mcpServers key', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ someOtherKey: {} }));
      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false when mcpServers exists but has no useai entry', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ mcpServers: { otherTool: {} } }),
      );
      expect(tool.isConfigured()).toBe(false);
    });

    it('returns true when mcpServers has useai entry', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          mcpServers: { useai: { command: 'npx', args: ['-y', '@devness/useai@latest'] } },
        }),
      );
      expect(tool.isConfigured()).toBe(true);
    });
  });

  describe('install', () => {
    it('creates config with mcpServers.useai when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      tool.install();

      expect(mockMkdirSync).toHaveBeenCalled();
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        tool.getConfigPath(),
        expect.any(String),
      );

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.mcpServers.useai).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });

    it('adds useai to existing mcpServers without removing other entries', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ mcpServers: { otherTool: { command: 'other' } } }),
      );

      tool.install();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.mcpServers.otherTool).toEqual({ command: 'other' });
      expect(written.mcpServers.useai).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });

    it('creates mcpServers key if it does not exist in config', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ existingKey: 'value' }));

      tool.install();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.existingKey).toBe('value');
      expect(written.mcpServers.useai).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });
  });

  describe('remove', () => {
    it('removes useai entry from mcpServers', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          mcpServers: {
            useai: { command: 'npx' },
            otherTool: { command: 'other' },
          },
        }),
      );

      tool.remove();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.mcpServers.useai).toBeUndefined();
      expect(written.mcpServers.otherTool).toEqual({ command: 'other' });
    });

    it('removes mcpServers key entirely when useai was the only entry', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ mcpServers: { useai: { command: 'npx' } } }),
      );

      tool.remove();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.mcpServers).toBeUndefined();
    });

    it('does nothing when config has no mcpServers key', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({ otherKey: 'value' }));

      tool.remove();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it('does nothing when config file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      tool.remove();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });
});

describe('vscode config format (servers)', () => {
  let tool: AiTool;

  beforeEach(() => {
    tool = AI_TOOLS.find((t) => t.id === 'vscode')!;
  });

  describe('isConfigured', () => {
    it('returns false when config file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(tool.isConfigured()).toBe(false);
    });

    it('returns false when servers key exists but no useai', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ servers: { someOther: {} } }),
      );
      expect(tool.isConfigured()).toBe(false);
    });

    it('returns true when servers has useai entry', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ servers: { useai: { command: 'npx' } } }),
      );
      expect(tool.isConfigured()).toBe(true);
    });
  });

  describe('install', () => {
    it('creates config with servers.useai', () => {
      mockExistsSync.mockReturnValue(false);
      tool.install();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.servers.useai).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });

    it('preserves existing server entries', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ servers: { existing: { command: 'node' } } }),
      );

      tool.install();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.servers.existing).toEqual({ command: 'node' });
      expect(written.servers.useai).toEqual({
        command: 'npx',
        args: ['-y', '@devness/useai@latest'],
      });
    });
  });

  describe('remove', () => {
    it('removes useai from servers and keeps other entries', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          servers: { useai: { command: 'npx' }, other: { command: 'node' } },
        }),
      );

      tool.remove();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.servers.useai).toBeUndefined();
      expect(written.servers.other).toEqual({ command: 'node' });
    });

    it('removes servers key entirely when useai was the only entry', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ servers: { useai: { command: 'npx' } } }),
      );

      tool.remove();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.servers).toBeUndefined();
    });

    it('does nothing when no servers key exists', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      tool.remove();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });
});

describe('zed config format (context_servers)', () => {
  let tool: AiTool;

  beforeEach(() => {
    tool = AI_TOOLS.find((t) => t.id === 'zed')!;
  });

  describe('isConfigured', () => {
    it('returns false when config file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(tool.isConfigured()).toBe(false);
    });

    it('returns true when context_servers has useai entry', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ context_servers: { useai: {} } }),
      );
      expect(tool.isConfigured()).toBe(true);
    });

    it('returns false when context_servers has no useai entry', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({ context_servers: { other: {} } }),
      );
      expect(tool.isConfigured()).toBe(false);
    });
  });

  describe('install', () => {
    it('creates config with context_servers.useai in zed format', () => {
      mockExistsSync.mockReturnValue(false);
      tool.install();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.context_servers.useai).toEqual({
        command: { path: 'npx', args: ['-y', '@devness/useai@latest'] },
        settings: {},
      });
    });

    it('preserves existing context_servers entries', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          context_servers: { existing: { command: { path: 'other' } } },
        }),
      );

      tool.install();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.context_servers.existing).toEqual({
        command: { path: 'other' },
      });
      expect(written.context_servers.useai).toEqual({
        command: { path: 'npx', args: ['-y', '@devness/useai@latest'] },
        settings: {},
      });
    });
  });

  describe('remove', () => {
    it('removes useai from context_servers and keeps other entries', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          context_servers: {
            useai: { command: { path: 'npx' } },
            other: { command: { path: 'node' } },
          },
        }),
      );

      tool.remove();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.context_servers.useai).toBeUndefined();
      expect(written.context_servers.other).toEqual({
        command: { path: 'node' },
      });
    });

    it('removes context_servers key entirely when useai was the only entry', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(
        JSON.stringify({
          context_servers: { useai: { command: { path: 'npx' } } },
        }),
      );

      tool.remove();

      const written = JSON.parse(
        mockWriteFileSync.mock.calls[0]![1] as string,
      );
      expect(written.context_servers).toBeUndefined();
    });

    it('does nothing when no context_servers key exists', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(JSON.stringify({}));

      tool.remove();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });
});

describe('readJsonFile edge cases', () => {
  let tool: AiTool;

  beforeEach(() => {
    tool = AI_TOOLS.find((t) => t.id === 'cursor')!; // uses standard format
  });

  it('returns empty config for empty file content', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('');

    // isConfigured uses readJsonFile internally — empty file => no mcpServers => false
    expect(tool.isConfigured()).toBe(false);
  });

  it('returns empty config for whitespace-only file content', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('   \n\t  ');

    expect(tool.isConfigured()).toBe(false);
  });

  it('returns empty config when file contains invalid JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('{ invalid json }');

    expect(tool.isConfigured()).toBe(false);
  });

  it('install creates parent directories recursively', () => {
    mockExistsSync.mockReturnValue(false);
    tool.install();

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true },
    );
  });
});

describe('writeJsonFile behavior', () => {
  let tool: AiTool;

  beforeEach(() => {
    tool = AI_TOOLS.find((t) => t.id === 'cursor')!;
  });

  it('writes JSON with 2-space indentation and trailing newline', () => {
    mockExistsSync.mockReturnValue(false);
    tool.install();

    const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
    expect(writtenContent).toMatch(/^\{[\s\S]*\}\n$/);

    // Verify it is valid JSON
    const parsed = JSON.parse(writtenContent);
    expect(parsed.mcpServers.useai).toBeDefined();

    // Verify 2-space indentation
    expect(writtenContent).toContain('  "mcpServers"');
  });
});

describe('detect behavior', () => {
  it('claude-code detects via which binary', () => {
    mockExecSync.mockReturnValue(Buffer.from('/usr/local/bin/claude'));
    const tool = AI_TOOLS.find((t) => t.id === 'claude-code')!;
    expect(tool.detect()).toBe(true);
  });

  it('claude-code detects via .claude.json existence', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    mockExistsSync.mockImplementation((p) => {
      return String(p) === join('/mock-home', '.claude.json');
    });
    const tool = AI_TOOLS.find((t) => t.id === 'claude-code')!;
    expect(tool.detect()).toBe(true);
  });

  it('claude-code returns false when neither binary nor file exists', () => {
    mockExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    mockExistsSync.mockReturnValue(false);
    const tool = AI_TOOLS.find((t) => t.id === 'claude-code')!;
    expect(tool.detect()).toBe(false);
  });

  it('cursor detects via .cursor directory existence', () => {
    mockExistsSync.mockImplementation((p) => {
      return String(p) === join('/mock-home', '.cursor');
    });
    const tool = AI_TOOLS.find((t) => t.id === 'cursor')!;
    expect(tool.detect()).toBe(true);
  });
});

describe('createTool factory', () => {
  it('produces a tool with all required interface methods', () => {
    const tool = AI_TOOLS[0]!; // claude-code
    expect(typeof tool.id).toBe('string');
    expect(typeof tool.name).toBe('string');
    expect(typeof tool.configFormat).toBe('string');
    expect(typeof tool.getConfigPath()).toBe('string');
    expect(typeof tool.detect).toBe('function');
    expect(typeof tool.isConfigured).toBe('function');
    expect(typeof tool.install).toBe('function');
    expect(typeof tool.remove).toBe('function');
  });

  it('getConfigPath returns the configured path', () => {
    const claudeDesktop = AI_TOOLS.find((t) => t.id === 'claude-desktop')!;
    expect(claudeDesktop.getConfigPath()).toBe(
      join(
        '/mock-home',
        'Library',
        'Application Support',
        'Claude',
        'claude_desktop_config.json',
      ),
    );
  });

  it('install/remove use the correct format handler based on configFormat', () => {
    // Zed tool should write context_servers, not mcpServers or servers
    const zedTool = AI_TOOLS.find((t) => t.id === 'zed')!;
    mockExistsSync.mockReturnValue(false);
    zedTool.install();

    const written = JSON.parse(
      mockWriteFileSync.mock.calls[0]![1] as string,
    );
    expect(written.context_servers).toBeDefined();
    expect(written.mcpServers).toBeUndefined();
    expect(written.servers).toBeUndefined();
  });
});

describe('install then isConfigured round-trip', () => {
  it('standard format: isConfigured returns true after install', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'cursor')!;

    // Initially not configured
    mockExistsSync.mockReturnValue(false);
    expect(tool.isConfigured()).toBe(false);

    // Install
    tool.install();
    const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;

    // Now simulate reading back what was written
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(writtenContent);

    expect(tool.isConfigured()).toBe(true);
  });

  it('vscode format: isConfigured returns true after install', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'vscode')!;

    mockExistsSync.mockReturnValue(false);
    tool.install();
    const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(writtenContent);

    expect(tool.isConfigured()).toBe(true);
  });

  it('zed format: isConfigured returns true after install', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'zed')!;

    mockExistsSync.mockReturnValue(false);
    tool.install();
    const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(writtenContent);

    expect(tool.isConfigured()).toBe(true);
  });
});

describe('install then remove round-trip', () => {
  it('standard format: isConfigured returns false after install then remove', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'cursor')!;

    // Install
    mockExistsSync.mockReturnValue(false);
    tool.install();
    let writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;

    // Remove
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(writtenContent);
    tool.remove();
    writtenContent = mockWriteFileSync.mock.calls[1]![1] as string;

    // Verify not configured
    mockReadFileSync.mockReturnValue(writtenContent);
    expect(tool.isConfigured()).toBe(false);
  });

  it('vscode format: isConfigured returns false after install then remove', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'vscode')!;

    mockExistsSync.mockReturnValue(false);
    tool.install();
    let writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(writtenContent);
    tool.remove();
    writtenContent = mockWriteFileSync.mock.calls[1]![1] as string;

    mockReadFileSync.mockReturnValue(writtenContent);
    expect(tool.isConfigured()).toBe(false);
  });

  it('zed format: isConfigured returns false after install then remove', () => {
    const tool = AI_TOOLS.find((t) => t.id === 'zed')!;

    mockExistsSync.mockReturnValue(false);
    tool.install();
    let writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;

    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(writtenContent);
    tool.remove();
    writtenContent = mockWriteFileSync.mock.calls[1]![1] as string;

    mockReadFileSync.mockReturnValue(writtenContent);
    expect(tool.isConfigured()).toBe(false);
  });
});

describe('matchesTool edge cases via resolveTools', () => {
  it('empty string query matches all tools via includes("")', () => {
    const result = resolveTools(['']);
    // Empty string after normalization is '' which .includes('') returns true
    expect(result.matched.length).toBeGreaterThan(0);
    expect(result.unmatched).toEqual([]);
  });

  it('query with only separators normalizes to empty and matches all', () => {
    const result = resolveTools(['---']);
    expect(result.matched.length).toBeGreaterThan(0);
  });

  it('query that matches multiple tools returns all matches', () => {
    const result = resolveTools(['code']);
    const ids = result.matched.map((t) => t.id);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('roo-code');
    expect(result.matched.length).toBeGreaterThanOrEqual(2);
  });

  it('does not produce duplicate entries even with overlapping queries', () => {
    const result = resolveTools(['cursor', 'Cursor', 'CURSOR']);
    const cursorMatches = result.matched.filter((t) => t.id === 'cursor');
    expect(cursorMatches).toHaveLength(1);
  });
});