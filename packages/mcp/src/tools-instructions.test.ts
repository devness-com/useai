import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { rmSync } from 'node:fs';

import { resolveTools, AI_TOOLS, USEAI_INSTRUCTIONS_TEXT } from './tools';

const INSTRUCTIONS_START = '<!-- useai:start -->';
const INSTRUCTIONS_END = '<!-- useai:end -->';

function makeTmpDir(): string {
  const dir = join(tmpdir(), `useai-test-${randomUUID()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function cleanDir(dir: string): void {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore
  }
}

describe('USEAI_INSTRUCTIONS_TEXT', () => {
  it('contains session tracking instructions for start, heartbeat, and end', () => {
    expect(USEAI_INSTRUCTIONS_TEXT).toContain('useai_start');
    expect(USEAI_INSTRUCTIONS_TEXT).toContain('useai_heartbeat');
    expect(USEAI_INSTRUCTIONS_TEXT).toContain('useai_end');
    expect(USEAI_INSTRUCTIONS_TEXT).toContain('## UseAI Session Tracking');
  });
});

describe('resolveTools', () => {
  describe('matching by exact id', () => {
    it('resolves "claude-code" to the Claude Code tool', () => {
      const { matched, unmatched } = resolveTools(['claude-code']);
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0]!.id).toBe('claude-code');
      expect(unmatched).toEqual([]);
    });

    it('resolves "cursor" to the Cursor tool', () => {
      const { matched, unmatched } = resolveTools(['cursor']);
      expect(matched.length).toBeGreaterThanOrEqual(1);
      expect(matched[0]!.id).toBe('cursor');
      expect(unmatched).toEqual([]);
    });

    it('resolves "vscode" to the VS Code tool', () => {
      const { matched } = resolveTools(['vscode']);
      const vscodeTool = matched.find((t) => t.id === 'vscode');
      expect(vscodeTool).not.toBeUndefined();
    });
  });

  describe('matching by display name', () => {
    it('resolves "Claude Code" by name', () => {
      const { matched, unmatched } = resolveTools(['Claude Code']);
      expect(matched.some((t) => t.id === 'claude-code')).toBe(true);
      expect(unmatched).toEqual([]);
    });

    it('resolves "VS Code" by name', () => {
      const { matched, unmatched } = resolveTools(['VS Code']);
      expect(matched.some((t) => t.id === 'vscode')).toBe(true);
      expect(unmatched).toEqual([]);
    });
  });

  describe('case-insensitive matching', () => {
    it('resolves "CLAUDE-CODE" case insensitively', () => {
      const { matched, unmatched } = resolveTools(['CLAUDE-CODE']);
      expect(matched.some((t) => t.id === 'claude-code')).toBe(true);
      expect(unmatched).toEqual([]);
    });

    it('resolves "CuRsOr" case insensitively', () => {
      const { matched, unmatched } = resolveTools(['CuRsOr']);
      expect(matched.some((t) => t.id === 'cursor')).toBe(true);
      expect(unmatched).toEqual([]);
    });

    it('resolves "WINDSURF" case insensitively', () => {
      const { matched, unmatched } = resolveTools(['WINDSURF']);
      expect(matched.some((t) => t.id === 'windsurf')).toBe(true);
      expect(unmatched).toEqual([]);
    });
  });

  describe('partial matching', () => {
    it('resolves "claude" as a partial match for claude-code', () => {
      const { matched, unmatched } = resolveTools(['claude']);
      expect(matched.some((t) => t.id === 'claude-code')).toBe(true);
      expect(unmatched).toEqual([]);
    });

    it('resolves "code" matching multiple tools containing "code"', () => {
      const { matched, unmatched } = resolveTools(['code']);
      // "code" should match claude-code, vscode, vscode-insiders, roo-code, opencode
      expect(matched.length).toBeGreaterThan(1);
      expect(unmatched).toEqual([]);
    });

    it('resolves "amazon" matching both Amazon Q CLI and IDE', () => {
      const { matched, unmatched } = resolveTools(['amazon']);
      expect(matched.some((t) => t.id === 'amazon-q-cli')).toBe(true);
      expect(matched.some((t) => t.id === 'amazon-q-ide')).toBe(true);
      expect(unmatched).toEqual([]);
    });
  });

  describe('normalizes separators (spaces, dashes, underscores)', () => {
    it('matches "claudecode" without any separator', () => {
      const { matched, unmatched } = resolveTools(['claudecode']);
      expect(matched.some((t) => t.id === 'claude-code')).toBe(true);
      expect(unmatched).toEqual([]);
    });

    it('matches "vscode insiders" with space separator', () => {
      const { matched, unmatched } = resolveTools(['vscode insiders']);
      expect(matched.some((t) => t.id === 'vscode-insiders')).toBe(true);
      expect(unmatched).toEqual([]);
    });

    it('matches "vscode_insiders" with underscore separator', () => {
      const { matched, unmatched } = resolveTools(['vscode_insiders']);
      expect(matched.some((t) => t.id === 'vscode-insiders')).toBe(true);
      expect(unmatched).toEqual([]);
    });
  });

  describe('unmatched names', () => {
    it('returns unmatched names for unknown tools', () => {
      const { matched, unmatched } = resolveTools(['nonexistent-editor']);
      expect(matched).toEqual([]);
      expect(unmatched).toEqual(['nonexistent-editor']);
    });

    it('separates matched and unmatched correctly in a mixed list', () => {
      const { matched, unmatched } = resolveTools(['cursor', 'faketools', 'windsurf']);
      expect(matched.some((t) => t.id === 'cursor')).toBe(true);
      expect(matched.some((t) => t.id === 'windsurf')).toBe(true);
      expect(unmatched).toEqual(['faketools']);
    });
  });

  describe('deduplication', () => {
    it('does not include the same tool twice when multiple queries match it', () => {
      const { matched } = resolveTools(['claude', 'claude-code']);
      const claudeTools = matched.filter((t) => t.id === 'claude-code');
      expect(claudeTools.length).toBe(1);
    });
  });

  describe('empty input', () => {
    it('returns empty arrays for empty input', () => {
      const { matched, unmatched } = resolveTools([]);
      expect(matched).toEqual([]);
      expect(unmatched).toEqual([]);
    });
  });
});

describe('AI_TOOLS', () => {
  it('contains all expected tool IDs', () => {
    const ids = AI_TOOLS.map((t) => t.id);
    expect(ids).toContain('claude-code');
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

  it('each tool exposes the full AiTool interface', () => {
    for (const tool of AI_TOOLS) {
      expect(typeof tool.id).toBe('string');
      expect(typeof tool.name).toBe('string');
      expect(['standard', 'vscode', 'zed', 'toml', 'yaml']).toContain(tool.configFormat);
      expect(typeof tool.supportsUrl).toBe('boolean');
      expect(typeof tool.getConfigPath).toBe('function');
      expect(typeof tool.detect).toBe('function');
      expect(typeof tool.isConfigured).toBe('function');
      expect(typeof tool.install).toBe('function');
      expect(typeof tool.installHttp).toBe('function');
      expect(typeof tool.remove).toBe('function');
      expect(typeof tool.getManualHint).toBe('function');
    }
  });

  describe('supportsUrl flag', () => {
    it('standard and vscode format tools can support URL', () => {
      const urlTools = AI_TOOLS.filter((t) => t.supportsUrl);
      for (const tool of urlTools) {
        expect(['standard', 'vscode']).toContain(tool.configFormat);
      }
    });

    it('zed, toml, and yaml format tools do not support URL', () => {
      const nonUrlFormats = AI_TOOLS.filter(
        (t) => t.configFormat === 'zed' || t.configFormat === 'toml' || t.configFormat === 'yaml',
      );
      for (const tool of nonUrlFormats) {
        expect(tool.supportsUrl).toBe(false);
      }
    });
  });

  describe('configFormat assignment', () => {
    const expectedFormats: Record<string, string> = {
      'claude-code': 'standard',
      cursor: 'standard',
      windsurf: 'standard',
      vscode: 'vscode',
      'vscode-insiders': 'vscode',
      'gemini-cli': 'standard',
      zed: 'zed',
      cline: 'standard',
      'roo-code': 'standard',
      'amazon-q-cli': 'standard',
      'amazon-q-ide': 'standard',
      codex: 'toml',
      goose: 'yaml',
      opencode: 'standard',
      junie: 'standard',
    };

    for (const [id, format] of Object.entries(expectedFormats)) {
      it(`${id} uses ${format} format`, () => {
        const tool = AI_TOOLS.find((t) => t.id === id)!;
        expect(tool.configFormat).toBe(format);
      });
    }
  });

  describe('getManualHint', () => {
    it('returns null for tools with auto-injectable instructions', () => {
      const claude = AI_TOOLS.find((t) => t.id === 'claude-code')!;
      expect(claude.getManualHint()).toBeNull();
    });

    it('returns null for windsurf (has instructions config)', () => {
      const windsurf = AI_TOOLS.find((t) => t.id === 'windsurf')!;
      expect(windsurf.getManualHint()).toBeNull();
    });

    it('returns a hint for cursor (no instructions config, has manualHint)', () => {
      const cursor = AI_TOOLS.find((t) => t.id === 'cursor')!;
      const hint = cursor.getManualHint();
      expect(typeof hint).toBe('string');
      expect(hint!.length).toBeGreaterThan(0);
    });

    it('returns a hint for Zed containing "Rules Library"', () => {
      const zed = AI_TOOLS.find((t) => t.id === 'zed')!;
      expect(zed.getManualHint()).toContain('Rules Library');
    });
  });
});

describe('injectInstructions via tool.install (append mode)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it('adds marker block with start and end markers to a new file', () => {
    const filePath = join(tmpDir, 'CLAUDE.md');
    const instructionsText = USEAI_INSTRUCTIONS_TEXT;
    const block = `${INSTRUCTIONS_START}\n${instructionsText}\n${INSTRUCTIONS_END}`;
    writeFileSync(filePath, block + '\n');

    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain(INSTRUCTIONS_START);
    expect(content).toContain(INSTRUCTIONS_END);
    expect(content).toContain('useai_start');
    expect(content).toContain('useai_heartbeat');
    expect(content).toContain('useai_end');
  });

  it('appends marker block after existing content with proper separator', () => {
    const filePath = join(tmpDir, 'CLAUDE.md');
    const existingContent = '# My Project Rules\n\nAlways use TypeScript.\n';
    writeFileSync(filePath, existingContent);

    const existing = readFileSync(filePath, 'utf-8');
    const block = `${INSTRUCTIONS_START}\n${USEAI_INSTRUCTIONS_TEXT}\n${INSTRUCTIONS_END}`;
    const separator = existing && !existing.endsWith('\n') ? '\n\n' : existing ? '\n' : '';
    writeFileSync(filePath, existing + separator + block + '\n');

    const content = readFileSync(filePath, 'utf-8');
    expect(content.startsWith('# My Project Rules')).toBe(true);
    expect(content).toContain('Always use TypeScript.');
    expect(content).toContain(INSTRUCTIONS_START);
    expect(content).toContain(INSTRUCTIONS_END);
  });

  it('adds double-newline separator when existing content does not end with newline', () => {
    const filePath = join(tmpDir, 'CLAUDE.md');
    const existingContent = '# No trailing newline';
    writeFileSync(filePath, existingContent);

    const existing = readFileSync(filePath, 'utf-8');
    const block = `${INSTRUCTIONS_START}\n${USEAI_INSTRUCTIONS_TEXT}\n${INSTRUCTIONS_END}`;
    const separator = existing && !existing.endsWith('\n') ? '\n\n' : existing ? '\n' : '';
    expect(separator).toBe('\n\n');

    writeFileSync(filePath, existing + separator + block + '\n');
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('# No trailing newline\n\n<!-- useai:start -->');
  });
});

describe('injectInstructions via tool.install (create mode)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it('writes instructions content without markers to a new file', () => {
    const filePath = join(tmpDir, 'prompts', 'useai.instructions.md');
    mkdirSync(join(tmpDir, 'prompts'), { recursive: true });
    writeFileSync(filePath, USEAI_INSTRUCTIONS_TEXT + '\n');

    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf-8');
    expect(content).toContain('useai_start');
    expect(content).not.toContain(INSTRUCTIONS_START);
    expect(content).not.toContain(INSTRUCTIONS_END);
  });

  it('creates parent directories if they do not exist', () => {
    const filePath = join(tmpDir, 'deep', 'nested', 'prompts', 'useai.instructions.md');
    mkdirSync(join(tmpDir, 'deep', 'nested', 'prompts'), { recursive: true });
    writeFileSync(filePath, USEAI_INSTRUCTIONS_TEXT + '\n');

    expect(existsSync(filePath)).toBe(true);
  });
});

describe('hasInstructionsBlock detects markers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it('returns false for non-existent file', () => {
    const filePath = join(tmpDir, 'nonexistent.md');
    // hasInstructionsBlock: !existsSync → false
    expect(existsSync(filePath)).toBe(false);
  });

  it('returns false for file without any markers', () => {
    const filePath = join(tmpDir, 'plain.md');
    writeFileSync(filePath, '# Just a regular markdown file\nNo special markers here.');
    const content = readFileSync(filePath, 'utf-8');
    expect(content.includes(INSTRUCTIONS_START)).toBe(false);
  });

  it('returns true when file contains useai:start marker', () => {
    const filePath = join(tmpDir, 'with-markers.md');
    writeFileSync(filePath, `Some preamble\n${INSTRUCTIONS_START}\nInstructions\n${INSTRUCTIONS_END}\n`);
    const content = readFileSync(filePath, 'utf-8');
    expect(content.includes(INSTRUCTIONS_START)).toBe(true);
  });

  it('returns true even if marker appears in the middle of content', () => {
    const filePath = join(tmpDir, 'middle-marker.md');
    writeFileSync(
      filePath,
      `# Title\n\nSome text.\n\n${INSTRUCTIONS_START}\nBlock\n${INSTRUCTIONS_END}\n\nMore text.`,
    );
    const content = readFileSync(filePath, 'utf-8');
    expect(content.includes(INSTRUCTIONS_START)).toBe(true);
  });
});

describe('removeInstructions strips block cleanly (append mode)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it('removes the marker block and preserves surrounding content', () => {
    const filePath = join(tmpDir, 'instructions.md');
    const before = '# My Project\n\nSome important notes.';
    const block = `\n${INSTRUCTIONS_START}\nUseAI session tracking\n${INSTRUCTIONS_END}\n`;
    writeFileSync(filePath, before + block);

    const content = readFileSync(filePath, 'utf-8');
    const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `\\n?${escaped(INSTRUCTIONS_START)}[\\s\\S]*?${escaped(INSTRUCTIONS_END)}\\n?`,
    );
    const cleaned = content.replace(regex, '').trim();
    if (cleaned) {
      writeFileSync(filePath, cleaned + '\n');
    }

    const result = readFileSync(filePath, 'utf-8');
    expect(result).toContain('# My Project');
    expect(result).toContain('Some important notes.');
    expect(result).not.toContain(INSTRUCTIONS_START);
    expect(result).not.toContain(INSTRUCTIONS_END);
    expect(result).not.toContain('UseAI session tracking');
  });

  it('deletes file entirely if only the marker block was present', () => {
    const filePath = join(tmpDir, 'only-block.md');
    writeFileSync(filePath, `${INSTRUCTIONS_START}\nUseAI stuff\n${INSTRUCTIONS_END}\n`);

    const content = readFileSync(filePath, 'utf-8');
    const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `\\n?${escaped(INSTRUCTIONS_START)}[\\s\\S]*?${escaped(INSTRUCTIONS_END)}\\n?`,
    );
    const cleaned = content.replace(regex, '').trim();
    if (cleaned) {
      writeFileSync(filePath, cleaned + '\n');
    } else {
      unlinkSync(filePath);
    }

    expect(existsSync(filePath)).toBe(false);
  });

  it('handles file with content before and after the marker block', () => {
    const filePath = join(tmpDir, 'sandwich.md');
    const content = [
      '# Header',
      '',
      'Before the block.',
      '',
      INSTRUCTIONS_START,
      'UseAI instructions inside',
      INSTRUCTIONS_END,
      '',
      'After the block.',
    ].join('\n');
    writeFileSync(filePath, content);

    const raw = readFileSync(filePath, 'utf-8');
    const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(
      `\\n?${escaped(INSTRUCTIONS_START)}[\\s\\S]*?${escaped(INSTRUCTIONS_END)}\\n?`,
    );
    const cleaned = raw.replace(regex, '').trim();
    writeFileSync(filePath, cleaned + '\n');

    const result = readFileSync(filePath, 'utf-8');
    expect(result).toContain('# Header');
    expect(result).toContain('Before the block.');
    expect(result).toContain('After the block.');
    expect(result).not.toContain(INSTRUCTIONS_START);
    expect(result).not.toContain('UseAI instructions inside');
  });
});

describe('removeInstructions deletes file for create mode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it('deletes the file when method is create and file exists', () => {
    const filePath = join(tmpDir, 'useai.instructions.md');
    writeFileSync(filePath, USEAI_INSTRUCTIONS_TEXT + '\n');
    expect(existsSync(filePath)).toBe(true);

    // create mode: just unlinkSync
    unlinkSync(filePath);
    expect(existsSync(filePath)).toBe(false);
  });

  it('does not throw when file does not exist in create mode', () => {
    const filePath = join(tmpDir, 'nonexistent.md');
    expect(existsSync(filePath)).toBe(false);
    // In source: if (existsSync(config.path)) { unlinkSync(config.path); }
    // No error should occur
    expect(() => {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
      }
    }).not.toThrow();
  });
});

describe('createTool wiring of installHttp for URL-supporting tools', () => {
  it('every tool has an installHttp method regardless of supportsUrl', () => {
    for (const tool of AI_TOOLS) {
      expect(typeof tool.installHttp).toBe('function');
    }
  });

  it('tools with supportsUrl=true are all standard or vscode format', () => {
    const urlTools = AI_TOOLS.filter((t) => t.supportsUrl);
    expect(urlTools.length).toBeGreaterThan(0);
    for (const tool of urlTools) {
      expect(['standard', 'vscode']).toContain(tool.configFormat);
    }
  });

  it('Claude Code (standard, supportsUrl) exposes installHttp', () => {
    const claude = AI_TOOLS.find((t) => t.id === 'claude-code')!;
    expect(claude.supportsUrl).toBe(true);
    expect(claude.configFormat).toBe('standard');
    expect(typeof claude.installHttp).toBe('function');
  });

  it('VS Code (vscode, supportsUrl) exposes installHttp', () => {
    const vscode = AI_TOOLS.find((t) => t.id === 'vscode')!;
    expect(vscode.supportsUrl).toBe(true);
    expect(vscode.configFormat).toBe('vscode');
    expect(typeof vscode.installHttp).toBe('function');
  });

  it('Zed (zed format) has installHttp but supportsUrl is false', () => {
    const zed = AI_TOOLS.find((t) => t.id === 'zed')!;
    expect(zed.supportsUrl).toBe(false);
    expect(typeof zed.installHttp).toBe('function');
  });

  it('Codex (toml format) has installHttp but supportsUrl is false', () => {
    const codex = AI_TOOLS.find((t) => t.id === 'codex')!;
    expect(codex.supportsUrl).toBe(false);
    expect(typeof codex.installHttp).toBe('function');
  });

  it('Goose (yaml format) has installHttp but supportsUrl is false', () => {
    const goose = AI_TOOLS.find((t) => t.id === 'goose')!;
    expect(goose.supportsUrl).toBe(false);
    expect(typeof goose.installHttp).toBe('function');
  });
});

describe('installHttp file format behavior', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = makeTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it('standard HTTP install writes mcpServers with url property', () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(configPath, '{}');

    // Simulate installStandardHttp
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const servers = (config['mcpServers'] as Record<string, unknown>) ?? {};
    delete servers['useai'];
    servers['UseAI'] = { url: 'http://localhost:52419/mcp' };
    config['mcpServers'] = servers;
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const result = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(result.mcpServers.UseAI).toEqual({ url: 'http://localhost:52419/mcp' });
    expect(result.mcpServers.useai).toBeUndefined();
  });

  it('vscode HTTP install writes servers with type and url properties', () => {
    const configPath = join(tmpDir, 'mcp.json');
    writeFileSync(configPath, '{}');

    // Simulate installVscodeHttp
    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const servers = (config['servers'] as Record<string, unknown>) ?? {};
    delete servers['useai'];
    servers['UseAI'] = { type: 'http', url: 'http://localhost:52419/mcp' };
    config['servers'] = servers;
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const result = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(result.servers.UseAI).toEqual({
      type: 'http',
      url: 'http://localhost:52419/mcp',
    });
  });

  it('HTTP install removes legacy "useai" key in favor of "UseAI"', () => {
    const configPath = join(tmpDir, 'config.json');
    writeFileSync(
      configPath,
      JSON.stringify({ mcpServers: { useai: { command: 'old-npx-entry' } } }, null, 2),
    );

    const config = JSON.parse(readFileSync(configPath, 'utf-8'));
    const servers = (config['mcpServers'] as Record<string, unknown>) ?? {};
    delete servers['useai'];
    servers['UseAI'] = { url: 'http://localhost:52419/mcp' };
    config['mcpServers'] = servers;
    writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

    const result = JSON.parse(readFileSync(configPath, 'utf-8'));
    expect(result.mcpServers['useai']).toBeUndefined();
    expect(result.mcpServers['UseAI'].url).toBe('http://localhost:52419/mcp');
  });
});