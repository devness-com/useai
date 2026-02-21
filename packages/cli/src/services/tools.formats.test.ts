import { describe, test, expect, beforeEach, vi } from 'vitest';
import { parse as parseToml } from 'smol-toml';
import { parse as parseYaml } from 'yaml';

// Mock node:fs so we can control file existence and content without touching disk
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

// Mock node:child_process to prevent real binary detection
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => {
    throw new Error('not found');
  }),
}));

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { AI_TOOLS, type AiTool } from './tools';

const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;
const mockReadFileSync = readFileSync as unknown as ReturnType<typeof vi.fn>;
const mockWriteFileSync = writeFileSync as unknown as ReturnType<typeof vi.fn>;
const mockMkdirSync = mkdirSync as unknown as ReturnType<typeof vi.fn>;

function findTool(id: string): AiTool {
  const tool = AI_TOOLS.find((t) => t.id === id);
  if (!tool) throw new Error(`Tool "${id}" not found in AI_TOOLS`);
  return tool;
}

describe('TOML format handlers (Codex)', () => {
  let codex: AiTool;

  beforeEach(() => {
    vi.clearAllMocks();
    codex = findTool('codex');
    // Default: file does not exist
    mockExistsSync.mockReturnValue(false);
  });

  test('configFormat is toml', () => {
    expect(codex.configFormat).toBe('toml');
  });

  test('config path points to ~/.codex/config.toml', () => {
    const configPath = codex.getConfigPath();
    expect(configPath).toMatch(/\.codex[/\\]config\.toml$/);
  });

  describe('isConfigured (isConfiguredToml)', () => {
    test('returns false when config file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(codex.isConfigured()).toBe(false);
    });

    test('returns false when config file is empty', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('');
      expect(codex.isConfigured()).toBe(false);
    });

    test('returns false when config has no mcp_servers section', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('[general]\neditor = "vim"\n');
      expect(codex.isConfigured()).toBe(false);
    });

    test('returns false when mcp_servers exists but useai is not present', () => {
      const toml = `[mcp_servers.other-tool]\ncommand = "node"\nargs = ["server.js"]\n`;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(toml);
      expect(codex.isConfigured()).toBe(false);
    });

    test('returns true when mcp_servers.useai is present', () => {
      const toml = `[mcp_servers.useai]\ncommand = "npx"\nargs = ["-y", "@devness/useai@latest"]\n`;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(toml);
      expect(codex.isConfigured()).toBe(true);
    });

    test('returns true when useai coexists with other servers', () => {
      const toml = [
        '[mcp_servers.other]',
        'command = "node"',
        'args = ["other.js"]',
        '',
        '[mcp_servers.useai]',
        'command = "npx"',
        'args = ["-y", "@devness/useai@latest"]',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(toml);
      expect(codex.isConfigured()).toBe(true);
    });

    test('returns false when file contains invalid TOML', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('this is not valid toml [[[');
      expect(codex.isConfigured()).toBe(false);
    });
  });

  describe('install (installToml)', () => {
    test('creates config with mcp_servers.useai when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      codex.install();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('.codex'),
        { recursive: true },
      );
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseToml(writtenContent);
      const servers = parsed['mcp_servers'] as Record<string, unknown>;
      expect(servers).toBeDefined();
      const useai = servers['useai'] as Record<string, unknown>;
      expect(useai['command']).toBe('npx');
      expect(useai['args']).toEqual(['-y', '@devness/useai@latest']);
    });

    test('preserves existing config entries when installing', () => {
      const existingToml = `[general]\neditor = "vim"\n\n[mcp_servers.existing]\ncommand = "node"\nargs = ["existing.js"]\n`;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingToml);

      codex.install();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseToml(writtenContent);
      expect((parsed['general'] as Record<string, unknown>)['editor']).toBe('vim');
      const servers = parsed['mcp_servers'] as Record<string, unknown>;
      expect(servers['existing']).toBeDefined();
      expect(servers['useai']).toBeDefined();
    });

    test('overwrites existing useai entry when reinstalling', () => {
      const existingToml = `[mcp_servers.useai]\ncommand = "old-command"\nargs = ["old"]\n`;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingToml);

      codex.install();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseToml(writtenContent);
      const servers = parsed['mcp_servers'] as Record<string, unknown>;
      const useai = servers['useai'] as Record<string, unknown>;
      expect(useai['command']).toBe('npx');
      expect(useai['args']).toEqual(['-y', '@devness/useai@latest']);
    });

    test('creates mcp_servers section when config has no servers', () => {
      const existingToml = `[general]\neditor = "vim"\n`;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingToml);

      codex.install();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseToml(writtenContent);
      const servers = parsed['mcp_servers'] as Record<string, unknown>;
      expect(servers['useai']).toBeDefined();
    });

    test('written file ends with a newline', () => {
      mockExistsSync.mockReturnValue(false);

      codex.install();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      expect(writtenContent.endsWith('\n')).toBe(true);
    });
  });

  describe('remove (removeToml)', () => {
    test('does nothing when config file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      codex.remove();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    test('does nothing when config has no mcp_servers section', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(`[general]\neditor = "vim"\n`);

      codex.remove();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    test('removes useai and keeps other servers', () => {
      const toml = [
        '[mcp_servers.other]',
        'command = "node"',
        'args = ["other.js"]',
        '',
        '[mcp_servers.useai]',
        'command = "npx"',
        'args = ["-y", "@devness/useai@latest"]',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(toml);

      codex.remove();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseToml(writtenContent);
      const servers = parsed['mcp_servers'] as Record<string, unknown>;
      expect(servers['useai']).toBeUndefined();
      expect(servers['other']).toBeDefined();
    });

    test('removes entire mcp_servers section when useai is the only server', () => {
      const toml = `[mcp_servers.useai]\ncommand = "npx"\nargs = ["-y", "@devness/useai@latest"]\n`;
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(toml);

      codex.remove();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseToml(writtenContent);
      expect(parsed['mcp_servers']).toBeUndefined();
    });

    test('preserves non-server config sections after removal', () => {
      const toml = [
        '[general]',
        'editor = "vim"',
        '',
        '[mcp_servers.useai]',
        'command = "npx"',
        'args = ["-y", "@devness/useai@latest"]',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(toml);

      codex.remove();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseToml(writtenContent);
      expect((parsed['general'] as Record<string, unknown>)['editor']).toBe('vim');
    });
  });
});

describe('YAML format handlers (Goose)', () => {
  let goose: AiTool;

  beforeEach(() => {
    vi.clearAllMocks();
    goose = findTool('goose');
    mockExistsSync.mockReturnValue(false);
  });

  test('configFormat is yaml', () => {
    expect(goose.configFormat).toBe('yaml');
  });

  test('config path points to ~/.config/goose/config.yaml', () => {
    const configPath = goose.getConfigPath();
    expect(configPath).toMatch(/\.config[/\\]goose[/\\]config\.yaml$/);
  });

  describe('isConfigured (isConfiguredYaml)', () => {
    test('returns false when config file does not exist', () => {
      mockExistsSync.mockReturnValue(false);
      expect(goose.isConfigured()).toBe(false);
    });

    test('returns false when config file is empty', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('');
      expect(goose.isConfigured()).toBe(false);
    });

    test('returns false when config has no extensions section', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('provider: openai\nmodel: gpt-4\n');
      expect(goose.isConfigured()).toBe(false);
    });

    test('returns false when extensions exists but useai is not present', () => {
      const yaml = [
        'extensions:',
        '  other-tool:',
        '    name: other-tool',
        '    cmd: node',
        '    enabled: true',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(yaml);
      expect(goose.isConfigured()).toBe(false);
    });

    test('returns true when extensions.useai is present', () => {
      const yaml = [
        'extensions:',
        '  useai:',
        '    name: useai',
        '    cmd: npx',
        '    args:',
        '      - "-y"',
        '      - "@devness/useai@latest"',
        '    enabled: true',
        '    type: stdio',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(yaml);
      expect(goose.isConfigured()).toBe(true);
    });

    test('returns true when useai coexists with other extensions', () => {
      const yaml = [
        'extensions:',
        '  other:',
        '    name: other',
        '    cmd: node',
        '  useai:',
        '    name: useai',
        '    cmd: npx',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(yaml);
      expect(goose.isConfigured()).toBe(true);
    });

    test('returns false when file contains invalid YAML', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(':\n  :\n    - [invalid');
      // The readYamlFile catch block returns {} for parse errors
      expect(goose.isConfigured()).toBe(false);
    });
  });

  describe('install (installYaml)', () => {
    test('creates config with extensions.useai when file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      goose.install();

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('goose'),
        { recursive: true },
      );
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseYaml(writtenContent) as Record<string, unknown>;
      const extensions = parsed['extensions'] as Record<string, Record<string, unknown>>;
      expect(extensions).toBeDefined();
      expect(extensions['useai']!['name']).toBe('useai');
      expect(extensions['useai']!['cmd']).toBe('npx');
      expect(extensions['useai']!['args']).toEqual(['-y', '@devness/useai@latest']);
      expect(extensions['useai']!['enabled']).toBe(true);
      expect(extensions['useai']!['type']).toBe('stdio');
    });

    test('preserves existing config entries when installing', () => {
      const existingYaml = [
        'provider: openai',
        'model: gpt-4',
        'extensions:',
        '  existing-ext:',
        '    name: existing-ext',
        '    cmd: node',
        '    enabled: true',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingYaml);

      goose.install();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseYaml(writtenContent) as Record<string, unknown>;
      expect(parsed['provider']).toBe('openai');
      expect(parsed['model']).toBe('gpt-4');
      const extensions = parsed['extensions'] as Record<string, Record<string, unknown>>;
      expect(extensions['existing-ext']).toBeDefined();
      expect(extensions['useai']).toBeDefined();
    });

    test('overwrites existing useai entry when reinstalling', () => {
      const existingYaml = [
        'extensions:',
        '  useai:',
        '    name: old-useai',
        '    cmd: old-command',
        '    enabled: false',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingYaml);

      goose.install();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseYaml(writtenContent) as Record<string, unknown>;
      const extensions = parsed['extensions'] as Record<string, Record<string, unknown>>;
      expect(extensions['useai']!['name']).toBe('useai');
      expect(extensions['useai']!['cmd']).toBe('npx');
      expect(extensions['useai']!['enabled']).toBe(true);
    });

    test('creates extensions section when config has none', () => {
      const existingYaml = 'provider: openai\nmodel: gpt-4\n';
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(existingYaml);

      goose.install();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseYaml(writtenContent) as Record<string, unknown>;
      const extensions = parsed['extensions'] as Record<string, Record<string, unknown>>;
      expect(extensions['useai']).toBeDefined();
    });

    test('useai entry has all required Goose extension fields', () => {
      mockExistsSync.mockReturnValue(false);

      goose.install();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseYaml(writtenContent) as Record<string, unknown>;
      const useai = (parsed['extensions'] as Record<string, Record<string, unknown>>)['useai'];
      expect(Object.keys(useai!).sort()).toEqual(['args', 'cmd', 'enabled', 'name', 'type']);
    });
  });

  describe('remove (removeYaml)', () => {
    test('does nothing when config file does not exist', () => {
      mockExistsSync.mockReturnValue(false);

      goose.remove();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    test('does nothing when config has no extensions section', () => {
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue('provider: openai\nmodel: gpt-4\n');

      goose.remove();

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    test('removes useai and keeps other extensions', () => {
      const yaml = [
        'extensions:',
        '  other-ext:',
        '    name: other-ext',
        '    cmd: node',
        '    enabled: true',
        '  useai:',
        '    name: useai',
        '    cmd: npx',
        '    args:',
        '      - "-y"',
        '      - "@devness/useai@latest"',
        '    enabled: true',
        '    type: stdio',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(yaml);

      goose.remove();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseYaml(writtenContent) as Record<string, unknown>;
      const extensions = parsed['extensions'] as Record<string, Record<string, unknown>>;
      expect(extensions['useai']).toBeUndefined();
      expect(extensions['other-ext']).toBeDefined();
    });

    test('removes entire extensions section when useai is the only extension', () => {
      const yaml = [
        'provider: openai',
        'extensions:',
        '  useai:',
        '    name: useai',
        '    cmd: npx',
        '    enabled: true',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(yaml);

      goose.remove();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseYaml(writtenContent) as Record<string, unknown>;
      expect(parsed['extensions']).toBeUndefined();
    });

    test('preserves non-extension config sections after removal', () => {
      const yaml = [
        'provider: openai',
        'model: gpt-4',
        'extensions:',
        '  useai:',
        '    name: useai',
        '    cmd: npx',
      ].join('\n');
      mockExistsSync.mockReturnValue(true);
      mockReadFileSync.mockReturnValue(yaml);

      goose.remove();

      const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
      const parsed = parseYaml(writtenContent) as Record<string, unknown>;
      expect(parsed['provider']).toBe('openai');
      expect(parsed['model']).toBe('gpt-4');
    });
  });
});

describe('readTomlFile edge cases', () => {
  let codex: AiTool;

  beforeEach(() => {
    vi.clearAllMocks();
    codex = findTool('codex');
  });

  test('handles whitespace-only file as empty config', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('   \n  \t  \n  ');
    // An empty trimmed string returns {}, so isConfigured returns false
    expect(codex.isConfigured()).toBe(false);
  });

  test('handles file read exceptions gracefully', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });
    // readTomlFile catches and returns {}, so isConfigured returns false
    expect(codex.isConfigured()).toBe(false);
  });
});

describe('readYamlFile edge cases', () => {
  let goose: AiTool;

  beforeEach(() => {
    vi.clearAllMocks();
    goose = findTool('goose');
  });

  test('handles whitespace-only file as empty config', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('   \n  \t  \n  ');
    expect(goose.isConfigured()).toBe(false);
  });

  test('handles file read exceptions gracefully', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });
    expect(goose.isConfigured()).toBe(false);
  });

  test('handles YAML that parses to null', () => {
    mockExistsSync.mockReturnValue(true);
    // YAML spec: a document containing only "~" or "null" parses to null
    mockReadFileSync.mockReturnValue('~');
    // readYamlFile has a ?? {} fallback for null parse results
    expect(goose.isConfigured()).toBe(false);
  });
});

describe('writeTomlFile behavior', () => {
  let codex: AiTool;

  beforeEach(() => {
    vi.clearAllMocks();
    codex = findTool('codex');
    mockExistsSync.mockReturnValue(false);
  });

  test('creates parent directories recursively', () => {
    codex.install();

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true },
    );
  });

  test('writes valid TOML that can be round-tripped', () => {
    codex.install();

    const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
    // Should not throw when re-parsed
    const parsed = parseToml(writtenContent);
    expect(parsed['mcp_servers']).toBeDefined();
  });
});

describe('writeYamlFile behavior', () => {
  let goose: AiTool;

  beforeEach(() => {
    vi.clearAllMocks();
    goose = findTool('goose');
    mockExistsSync.mockReturnValue(false);
  });

  test('creates parent directories recursively', () => {
    goose.install();

    expect(mockMkdirSync).toHaveBeenCalledWith(
      expect.any(String),
      { recursive: true },
    );
  });

  test('writes valid YAML that can be round-tripped', () => {
    goose.install();

    const writtenContent = mockWriteFileSync.mock.calls[0]![1] as string;
    const parsed = parseYaml(writtenContent) as Record<string, unknown>;
    expect(parsed['extensions']).toBeDefined();
  });
});

describe('install then remove round-trip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('TOML: install then remove leaves no mcp_servers', () => {
    const codex = findTool('codex');

    // Step 1: Install into empty file
    mockExistsSync.mockReturnValue(false);
    codex.install();
    const afterInstall = mockWriteFileSync.mock.calls[0]![1] as string;

    // Step 2: Remove from installed state
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(afterInstall);
    codex.remove();

    const afterRemove = mockWriteFileSync.mock.calls[0]![1] as string;
    const parsed = parseToml(afterRemove);
    expect(parsed['mcp_servers']).toBeUndefined();
  });

  test('YAML: install then remove leaves no extensions', () => {
    const goose = findTool('goose');

    // Step 1: Install into empty file
    mockExistsSync.mockReturnValue(false);
    goose.install();
    const afterInstall = mockWriteFileSync.mock.calls[0]![1] as string;

    // Step 2: Remove from installed state
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(afterInstall);
    goose.remove();

    const afterRemove = mockWriteFileSync.mock.calls[0]![1] as string;
    const parsed = parseYaml(afterRemove) as Record<string, unknown>;
    expect(parsed['extensions']).toBeUndefined();
  });

  test('TOML: install is idempotent — installing twice produces same result', () => {
    const codex = findTool('codex');

    // First install
    mockExistsSync.mockReturnValue(false);
    codex.install();
    const firstInstall = mockWriteFileSync.mock.calls[0]![1] as string;

    // Second install on top of first
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(firstInstall);
    codex.install();
    const secondInstall = mockWriteFileSync.mock.calls[0]![1] as string;

    const first = parseToml(firstInstall);
    const second = parseToml(secondInstall);
    expect(second).toEqual(first);
  });

  test('YAML: install is idempotent — installing twice produces same result', () => {
    const goose = findTool('goose');

    // First install
    mockExistsSync.mockReturnValue(false);
    goose.install();
    const firstInstall = mockWriteFileSync.mock.calls[0]![1] as string;

    // Second install on top of first
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(firstInstall);
    goose.install();
    const secondInstall = mockWriteFileSync.mock.calls[0]![1] as string;

    const first = parseYaml(firstInstall) as Record<string, unknown>;
    const second = parseYaml(secondInstall) as Record<string, unknown>;
    expect(second).toEqual(first);
  });
});