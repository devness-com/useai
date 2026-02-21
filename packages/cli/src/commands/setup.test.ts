import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted variables for mock factories (available before vi.mock hoisting) ─

const { mockResolveTools, mockAiTools, mockInstructionsText } = vi.hoisted(() => {
  return {
    mockResolveTools: vi.fn(),
    mockAiTools: [] as any[],
    mockInstructionsText: 'Add UseAI MCP to your tool settings.',
  };
});

// ── Mock external dependencies ───────────────────────────────────────────────

vi.mock('chalk', () => {
  const passthrough = (s: string) => s;
  const chalk: any = passthrough;
  chalk.dim = passthrough;
  chalk.bold = passthrough;
  chalk.green = passthrough;
  chalk.yellow = passthrough;
  return { default: chalk };
});

vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn(),
}));

vi.mock('../utils/display.js', () => ({
  header: vi.fn((s: string) => `[HEADER] ${s}`),
  success: vi.fn((s: string) => `[SUCCESS] ${s}`),
  error: vi.fn((s: string) => `[ERROR] ${s}`),
  info: vi.fn((s: string) => `[INFO] ${s}`),
}));

// Build realistic mock AiTool objects
function makeMockTool(overrides: Partial<{
  id: string;
  name: string;
  detected: boolean;
  configured: boolean;
  configPath: string;
  manualHint: string | null;
  installError: Error | null;
  removeError: Error | null;
}> = {}) {
  const defaults = {
    id: 'claude',
    name: 'Claude Code',
    detected: true,
    configured: false,
    configPath: '/Users/testuser/.config/claude/config.json',
    manualHint: null,
    installError: null,
    removeError: null,
  };
  const cfg = { ...defaults, ...overrides };

  return {
    id: cfg.id,
    name: cfg.name,
    detect: vi.fn(() => cfg.detected),
    isConfigured: vi.fn(() => cfg.configured),
    getConfigPath: vi.fn(() => cfg.configPath),
    getManualHint: vi.fn(() => cfg.manualHint),
    install: vi.fn(() => {
      if (cfg.installError) throw cfg.installError;
    }),
    remove: vi.fn(() => {
      if (cfg.removeError) throw cfg.removeError;
    }),
  };
}

vi.mock('../services/tools.js', () => ({
  get AI_TOOLS() { return mockAiTools; },
  USEAI_INSTRUCTIONS_TEXT: mockInstructionsText,
  resolveTools: (...args: any[]) => mockResolveTools(...args),
}));

// ── Import after mocks ───────────────────────────────────────────────────────

import { checkbox } from '@inquirer/prompts';

// ── Helpers ──────────────────────────────────────────────────────────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;
let capturedLines: string[];

function captureConsole() {
  capturedLines = [];
  consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
    capturedLines.push(args.map(String).join(' '));
  });
}

function outputText(): string {
  return capturedLines.join('\n');
}

/**
 * Run the mcp command with the given argv tokens (after "mcp").
 * Dynamically re-imports the module to get a fresh Commander instance each time,
 * avoiding state leakage between tests.
 */
async function runCommand(...argv: string[]): Promise<void> {
  // Re-import the module to get a fresh Command instance each call.
  // Commander stores parsed state on the Command object, so reusing
  // the same instance across tests causes option/argument leakage.
  const mod = await import('./setup.js');
  const cmd = mod.mcpCommand;
  // Prevent Commander from calling process.exit on parse errors
  cmd.exitOverride();
  try {
    await cmd.parseAsync(['node', 'mcp', ...argv]);
  } catch (err: any) {
    // Commander throws on --help, --version, or parse errors when exitOverride is set.
    // Swallow CommanderError with exitCode 0 (help/version), re-throw real errors.
    if (err?.exitCode !== undefined && err.exitCode === 0) return;
    throw err;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('setup.ts', () => {
  const originalHome = process.env['HOME'];

  beforeEach(() => {
    process.env['HOME'] = '/Users/testuser';
    captureConsole();
    mockAiTools.length = 0;
    mockResolveTools.mockReset();
    vi.mocked(checkbox).mockReset();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env['HOME'] = originalHome;
  });

  // ── shortenPath (tested indirectly through showStatus & installFlow output) ──

  describe('shortenPath', () => {
    it('replaces HOME prefix with ~ in tool config paths', async () => {
      const tool = makeMockTool({
        detected: true,
        configured: true,
        configPath: '/Users/testuser/.config/claude/config.json',
      });
      mockAiTools.push(tool);

      await runCommand('--status');

      expect(outputText()).toContain('~/.config/claude/config.json');
      expect(outputText()).not.toContain('/Users/testuser/.config/claude/config.json');
    });

    it('leaves path unchanged when it does not start with HOME', async () => {
      const tool = makeMockTool({
        detected: true,
        configured: true,
        configPath: '/opt/ai-tools/claude/config.json',
      });
      mockAiTools.push(tool);

      await runCommand('--status');

      expect(outputText()).toContain('/opt/ai-tools/claude/config.json');
    });

    it('leaves path unchanged when HOME env var is not set', async () => {
      delete process.env['HOME'];
      const tool = makeMockTool({
        detected: true,
        configured: true,
        configPath: '/Users/testuser/.config/claude/config.json',
      });
      mockAiTools.push(tool);

      await runCommand('--status');

      expect(outputText()).toContain('/Users/testuser/.config/claude/config.json');
    });
  });

  // ── showStatus ──

  describe('showStatus (--status flag)', () => {
    it('displays header and configured tools with checkmark', async () => {
      const tool = makeMockTool({
        name: 'Claude Code',
        detected: true,
        configured: true,
        configPath: '/Users/testuser/.config/claude/mcp.json',
      });
      mockAiTools.push(tool);

      await runCommand('--status');

      expect(outputText()).toContain('[HEADER] AI Tool MCP Status');
      expect(outputText()).toContain('✓ Configured');
      expect(outputText()).toContain('Claude Code');
    });

    it('displays unconfigured but detected tools with warning', async () => {
      const tool = makeMockTool({
        name: 'VS Code',
        detected: true,
        configured: false,
        configPath: '/Users/testuser/.vscode/settings.json',
      });
      mockAiTools.push(tool);

      await runCommand('--status');

      expect(outputText()).toContain('✗ Not set up');
      expect(outputText()).toContain('VS Code');
    });

    it('displays not-found tools as dimmed', async () => {
      const tool = makeMockTool({
        name: 'Cursor',
        detected: false,
      });
      mockAiTools.push(tool);

      await runCommand('--status');

      expect(outputText()).toContain('— Not found');
      expect(outputText()).toContain('Cursor');
    });

    it('shows multiple tools in a single status listing', async () => {
      mockAiTools.push(
        makeMockTool({ name: 'Claude Code', detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' }),
        makeMockTool({ name: 'VS Code', detected: true, configured: false, configPath: '/Users/testuser/.vscode/settings.json' }),
        makeMockTool({ name: 'Windsurf', detected: false }),
      );

      await runCommand('--status');

      const output = outputText();
      expect(output).toContain('Claude Code');
      expect(output).toContain('VS Code');
      expect(output).toContain('Windsurf');
      expect(output).toContain('✓ Configured');
      expect(output).toContain('✗ Not set up');
      expect(output).toContain('— Not found');
    });

    it('filters to specific tools when tool names are provided with --status', async () => {
      const claudeTool = makeMockTool({ id: 'claude', name: 'Claude Code', detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' });
      mockAiTools.push(claudeTool);

      mockResolveTools.mockReturnValue({ matched: [claudeTool], unmatched: [] });

      await runCommand('claude', '--status');

      expect(mockResolveTools).toHaveBeenCalledWith(['claude']);
      expect(outputText()).toContain('Claude Code');
    });
  });

  // ── installFlow ──

  describe('installFlow (default action)', () => {
    describe('with explicit tool names', () => {
      it('installs specified tools directly without scanning', async () => {
        const tool = makeMockTool({
          id: 'claude',
          name: 'Claude Code',
          configured: false,
          configPath: '/Users/testuser/.claude/mcp.json',
        });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('claude');

        expect(tool.install).toHaveBeenCalledOnce();
        expect(outputText()).toContain('[SUCCESS]');
        expect(outputText()).toContain('→');
        expect(outputText()).toContain('~/.claude/mcp.json');
      });

      it('shows (updated) label for already-configured tools', async () => {
        const tool = makeMockTool({
          id: 'vscode',
          name: 'VS Code',
          configured: true,
          configPath: '/Users/testuser/.vscode/settings.json',
        });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('vscode');

        expect(tool.install).toHaveBeenCalledOnce();
        expect(outputText()).toContain('(updated)');
      });

      it('reports errors for tools that fail to install', async () => {
        const tool = makeMockTool({
          id: 'cursor',
          name: 'Cursor',
          configured: false,
          installError: new Error('Permission denied'),
        });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('cursor');

        expect(outputText()).toContain('[ERROR]');
        expect(outputText()).toContain('Permission denied');
      });
    });

    describe('with autoYes (-y flag)', () => {
      it('installs all unconfigured detected tools without prompting', async () => {
        const configured = makeMockTool({ name: 'Claude Code', detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' });
        const unconfigured = makeMockTool({ name: 'VS Code', detected: true, configured: false, configPath: '/Users/testuser/.vscode/settings.json' });
        const notFound = makeMockTool({ name: 'Windsurf', detected: false });
        mockAiTools.push(configured, unconfigured, notFound);

        await runCommand('-y');

        expect(unconfigured.install).toHaveBeenCalledOnce();
        // Already-configured tools get re-installed to update instructions
        expect(configured.install).toHaveBeenCalledOnce();
        expect(notFound.install).not.toHaveBeenCalled();
        expect(outputText()).toContain('Configuring 1 tool');
      });

      it('reports when all detected tools are already configured', async () => {
        const tool = makeMockTool({ detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' });
        mockAiTools.push(tool);

        await runCommand('-y');

        expect(outputText()).toContain('All detected tools are already configured');
        expect(tool.install).not.toHaveBeenCalled();
      });

      it('reports when no AI tools are detected at all', async () => {
        const tool = makeMockTool({ detected: false });
        mockAiTools.push(tool);

        await runCommand('-y');

        expect(outputText()).toContain('No AI tools detected');
      });
    });

    describe('with interactive prompt', () => {
      it('presents checkbox for unconfigured tools and installs selected ones', async () => {
        const tool1 = makeMockTool({ id: 'claude', name: 'Claude Code', detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' });
        const tool2 = makeMockTool({ id: 'vscode', name: 'VS Code', detected: true, configured: false, configPath: '/Users/testuser/.vscode/settings.json' });
        mockAiTools.push(tool1, tool2);

        vi.mocked(checkbox).mockResolvedValue(['claude']);

        await runCommand();

        expect(checkbox).toHaveBeenCalledOnce();
        expect(tool1.install).toHaveBeenCalledOnce();
        expect(tool2.install).not.toHaveBeenCalled();
        expect(outputText()).toContain('Configuring 1 tool');
      });

      it('handles user cancellation (Ctrl+C) gracefully', async () => {
        const tool = makeMockTool({ detected: true, configured: false });
        mockAiTools.push(tool);

        vi.mocked(checkbox).mockRejectedValue(new Error('User cancelled'));

        await runCommand();

        expect(tool.install).not.toHaveBeenCalled();
      });

      it('handles empty selection', async () => {
        const tool = makeMockTool({ detected: true, configured: false });
        mockAiTools.push(tool);

        vi.mocked(checkbox).mockResolvedValue([]);

        await runCommand();

        expect(tool.install).not.toHaveBeenCalled();
        expect(outputText()).toContain('No tools selected');
      });

      it('reports Done with correct count after installation', async () => {
        const tool1 = makeMockTool({ id: 'claude', name: 'Claude Code', detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' });
        const tool2 = makeMockTool({ id: 'vscode', name: 'VS Code', detected: true, configured: false, configPath: '/Users/testuser/.vscode/settings.json' });
        mockAiTools.push(tool1, tool2);

        vi.mocked(checkbox).mockResolvedValue(['claude', 'vscode']);

        await runCommand();

        expect(outputText()).toContain('Done!');
        expect(outputText()).toContain('2 tool');
      });
    });

    describe('install error handling within scan flow', () => {
      it('continues installing remaining tools after one fails', async () => {
        const failing = makeMockTool({ id: 'cursor', name: 'Cursor', detected: true, configured: false, installError: new Error('Disk full') });
        const succeeding = makeMockTool({ id: 'claude', name: 'Claude Code', detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' });
        mockAiTools.push(failing, succeeding);

        vi.mocked(checkbox).mockResolvedValue(['cursor', 'claude']);

        await runCommand();

        expect(failing.install).toHaveBeenCalledOnce();
        expect(succeeding.install).toHaveBeenCalledOnce();
        const output = outputText();
        expect(output).toContain('Disk full');
        expect(output).toContain('[SUCCESS]');
      });
    });
  });

  // ── removeFlow ──

  describe('removeFlow (--remove flag)', () => {
    describe('with explicit tool names', () => {
      it('removes configured tools directly', async () => {
        const tool = makeMockTool({
          id: 'claude',
          name: 'Claude Code',
          configured: true,
        });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('claude', '--remove');

        expect(tool.remove).toHaveBeenCalledOnce();
        expect(outputText()).toContain('Removed from Claude Code');
      });

      it('skips tools that are not configured', async () => {
        const tool = makeMockTool({
          id: 'vscode',
          name: 'VS Code',
          configured: false,
        });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('vscode', '--remove');

        expect(tool.remove).not.toHaveBeenCalled();
        expect(outputText()).toContain('not configured');
        expect(outputText()).toContain('skipping');
      });

      it('handles mix of configured and unconfigured tools', async () => {
        const configured = makeMockTool({ id: 'claude', name: 'Claude Code', configured: true });
        const notConfigured = makeMockTool({ id: 'vscode', name: 'VS Code', configured: false });
        mockResolveTools.mockReturnValue({ matched: [configured, notConfigured], unmatched: [] });

        await runCommand('claude', 'vscode', '--remove');

        expect(configured.remove).toHaveBeenCalledOnce();
        expect(notConfigured.remove).not.toHaveBeenCalled();
        expect(outputText()).toContain('Removed from Claude Code');
        expect(outputText()).toContain('VS Code is not configured');
      });

      it('reports errors during removal', async () => {
        const tool = makeMockTool({
          id: 'cursor',
          name: 'Cursor',
          configured: true,
          removeError: new Error('File locked'),
        });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('cursor', '--remove');

        expect(outputText()).toContain('[ERROR]');
        expect(outputText()).toContain('File locked');
      });

      it('handles isConfigured throwing by treating tool as not-configured', async () => {
        const tool = makeMockTool({ id: 'broken', name: 'Broken Tool' });
        tool.isConfigured.mockImplementation(() => { throw new Error('corrupt config'); });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('broken', '--remove');

        expect(tool.remove).not.toHaveBeenCalled();
        expect(outputText()).toContain('not configured');
      });
    });

    describe('with autoYes (-y flag)', () => {
      it('removes all configured tools without prompting', async () => {
        const tool1 = makeMockTool({ name: 'Claude Code', detected: true, configured: true });
        const tool2 = makeMockTool({ name: 'VS Code', detected: true, configured: true });
        mockAiTools.push(tool1, tool2);

        await runCommand('--remove', '-y');

        expect(tool1.remove).toHaveBeenCalledOnce();
        expect(tool2.remove).toHaveBeenCalledOnce();
        expect(outputText()).toContain('Removing from 2 tool');
      });

      it('reports when no tools are configured', async () => {
        const tool = makeMockTool({ configured: false });
        mockAiTools.push(tool);

        await runCommand('--remove', '-y');

        expect(outputText()).toContain('UseAI is not configured in any AI tools');
      });
    });

    describe('with interactive prompt', () => {
      it('presents checkbox and removes selected tools', async () => {
        const tool1 = makeMockTool({ id: 'claude', name: 'Claude Code', configured: true });
        const tool2 = makeMockTool({ id: 'vscode', name: 'VS Code', configured: true });
        mockAiTools.push(tool1, tool2);

        vi.mocked(checkbox).mockResolvedValue(['claude']);

        await runCommand('--remove');

        expect(checkbox).toHaveBeenCalledOnce();
        expect(tool1.remove).toHaveBeenCalledOnce();
        expect(tool2.remove).not.toHaveBeenCalled();
      });

      it('handles cancellation during removal prompt', async () => {
        const tool = makeMockTool({ configured: true });
        mockAiTools.push(tool);

        vi.mocked(checkbox).mockRejectedValue(new Error('User cancelled'));

        await runCommand('--remove');

        expect(tool.remove).not.toHaveBeenCalled();
      });

      it('shows done message with correct count', async () => {
        const tool1 = makeMockTool({ id: 'claude', name: 'Claude Code', configured: true });
        const tool2 = makeMockTool({ id: 'vscode', name: 'VS Code', configured: true });
        mockAiTools.push(tool1, tool2);

        vi.mocked(checkbox).mockResolvedValue(['claude', 'vscode']);

        await runCommand('--remove');

        expect(outputText()).toContain('Done!');
        expect(outputText()).toContain('2 tool');
      });

      it('handles empty selection on remove', async () => {
        const tool = makeMockTool({ id: 'claude', configured: true });
        mockAiTools.push(tool);

        vi.mocked(checkbox).mockResolvedValue([]);

        await runCommand('--remove');

        expect(tool.remove).not.toHaveBeenCalled();
        expect(outputText()).toContain('No tools selected');
      });
    });
  });

  // ── resolveTools error handling ──

  describe('resolveTools error handling', () => {
    it('prints error and available tool IDs when tool name is unknown', async () => {
      const knownTool = makeMockTool({ id: 'claude', name: 'Claude Code' });
      mockAiTools.push(knownTool);
      mockResolveTools.mockReturnValue({ matched: [], unmatched: ['foobar'] });

      await runCommand('foobar');

      const output = outputText();
      expect(output).toContain('[ERROR]');
      expect(output).toContain('Unknown tool');
      expect(output).toContain('foobar');
      expect(output).toContain('Available');
      expect(output).toContain('claude');
    });

    it('lists multiple unknown tools in the error', async () => {
      mockAiTools.push(makeMockTool({ id: 'claude' }));
      mockResolveTools.mockReturnValue({ matched: [], unmatched: ['foo', 'bar'] });

      await runCommand('foo', 'bar');

      const output = outputText();
      expect(output).toContain('Unknown tool');
      expect(output).toContain('foo');
      expect(output).toContain('bar');
    });

    it('does not call install when tool names are unmatched', async () => {
      const tool = makeMockTool({ id: 'claude' });
      mockAiTools.push(tool);
      mockResolveTools.mockReturnValue({ matched: [], unmatched: ['nope'] });

      await runCommand('nope');

      expect(tool.install).not.toHaveBeenCalled();
    });
  });

  // ── Option flag routing ──

  describe('option flag routing', () => {
    it('routes --status to showStatus', async () => {
      const tool = makeMockTool({ detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' });
      mockAiTools.push(tool);

      await runCommand('--status');

      expect(outputText()).toContain('[HEADER] AI Tool MCP Status');
      expect(tool.install).not.toHaveBeenCalled();
      expect(tool.remove).not.toHaveBeenCalled();
    });

    it('routes --remove to removeFlow', async () => {
      const tool = makeMockTool({ configured: true });
      mockAiTools.push(tool);

      vi.mocked(checkbox).mockResolvedValue([tool.id]);

      await runCommand('--remove');

      expect(tool.remove).toHaveBeenCalled();
      expect(tool.install).not.toHaveBeenCalled();
    });

    it('routes default (no flags) to installFlow', async () => {
      const tool = makeMockTool({ detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' });
      mockAiTools.push(tool);

      vi.mocked(checkbox).mockResolvedValue([tool.id]);

      await runCommand();

      expect(tool.install).toHaveBeenCalled();
      expect(tool.remove).not.toHaveBeenCalled();
      expect(outputText()).toContain('Scanning for AI tools');
    });

    it('--status takes precedence over --remove when both provided', async () => {
      const tool = makeMockTool({ detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' });
      mockAiTools.push(tool);

      await runCommand('--status', '--remove');

      // The code checks opts.status first
      expect(outputText()).toContain('[HEADER] AI Tool MCP Status');
      expect(tool.remove).not.toHaveBeenCalled();
      expect(tool.install).not.toHaveBeenCalled();
    });
  });

  // ── Pluralization in messages ──

  describe('pluralization in messages', () => {
    it('uses singular "tool" for single detected tool in install scan', async () => {
      const tool = makeMockTool({ detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' });
      mockAiTools.push(tool);

      await runCommand('-y');

      expect(outputText()).toContain('1 tool');
      expect(outputText()).not.toContain('1 tools');
    });

    it('uses plural "tools" for multiple detected tools in install scan', async () => {
      mockAiTools.push(
        makeMockTool({ id: 'claude', name: 'Claude Code', detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' }),
        makeMockTool({ id: 'vscode', name: 'VS Code', detected: true, configured: false, configPath: '/Users/testuser/.vscode/settings.json' }),
      );

      await runCommand('-y');

      expect(outputText()).toContain('2 tools');
    });
  });

  // ── Manual hints display ──

  describe('manual hints display', () => {
    it('shows manual hints when tools have them after explicit install', async () => {
      const tool = makeMockTool({
        id: 'codex',
        name: 'OpenAI Codex CLI',
        configured: false,
        manualHint: 'Run codex --configure to complete setup',
        configPath: '/Users/testuser/.codex/config.json',
      });
      mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

      await runCommand('codex');

      const output = outputText();
      expect(output).toContain('Manual setup needed');
      expect(output).toContain('OpenAI Codex CLI');
      expect(output).toContain('Run codex --configure to complete setup');
      expect(output).toContain(mockInstructionsText);
    });

    it('does not show manual hints section when no tools need manual setup', async () => {
      const tool = makeMockTool({
        id: 'claude',
        name: 'Claude Code',
        configured: false,
        manualHint: null,
        configPath: '/Users/testuser/.claude/mcp.json',
      });
      mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

      await runCommand('claude');

      expect(outputText()).not.toContain('Manual setup needed');
    });
  });
});