import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Hoisted variables for mock factories (available before vi.mock hoisting) ─

const { mockResolveTools, mockAiTools, mockInstructionsText } = vi.hoisted(() => {
  return {
    mockResolveTools: vi.fn(),
    mockAiTools: [] as any[],
    mockInstructionsText: 'Add UseAI MCP to your tool settings.',
  };
});

const mockClack = vi.hoisted(() => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  spinner: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() })),
  note: vi.fn(),
  confirm: vi.fn(),
  multiselect: vi.fn(),
  isCancel: vi.fn(() => false),
  log: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const mockShared = vi.hoisted(() => ({
  ensureDaemon: vi.fn(() => Promise.resolve(true)),
  killDaemon: vi.fn(() => Promise.resolve()),
  installAutostart: vi.fn(),
  removeAutostart: vi.fn(),
  isAutostartInstalled: vi.fn(() => false),
  detectPlatform: vi.fn(() => 'launchd' as const),
  installClaudeCodeHooks: vi.fn(() => true),
  removeClaudeCodeHooks: vi.fn(),
  DAEMON_PORT: 19200,
  DAEMON_MCP_URL: 'http://127.0.0.1:19200/mcp',
  buildInstructionsText: vi.fn(() => 'mock instructions'),
}));

// ── Mock external dependencies ───────────────────────────────────────────────

vi.mock('picocolors', () => {
  const passthrough = (s: string) => s;
  return {
    default: {
      dim: passthrough,
      bold: passthrough,
      green: passthrough,
      yellow: passthrough,
      cyan: passthrough,
      red: passthrough,
      bgCyan: passthrough,
      black: passthrough,
    },
  };
});

vi.mock('@clack/prompts', () => mockClack);

vi.mock('@useai/shared', () => mockShared);

vi.mock('../utils/display.js', () => ({
  header: vi.fn((s: string) => `[HEADER] ${s}`),
  success: vi.fn((s: string) => `[SUCCESS] ${s}`),
  error: vi.fn((s: string) => `[ERROR] ${s}`),
  info: vi.fn((s: string) => `[INFO] ${s}`),
  shortenPath: vi.fn((p: string) => {
    const home = process.env['HOME'];
    return home && p.startsWith(home) ? '~' + p.slice(home.length) : p;
  }),
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
  supportsUrl: boolean;
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
    supportsUrl: true,
  };
  const cfg = { ...defaults, ...overrides };

  return {
    id: cfg.id,
    name: cfg.name,
    configFormat: 'standard',
    supportsUrl: cfg.supportsUrl,
    detect: vi.fn(() => cfg.detected),
    isConfigured: vi.fn(() => cfg.configured),
    getConfigPath: vi.fn(() => cfg.configPath),
    getManualHint: vi.fn(() => cfg.manualHint),
    install: vi.fn(() => {
      if (cfg.installError) throw cfg.installError;
    }),
    installHttp: vi.fn(() => {
      if (cfg.installError) throw cfg.installError;
    }),
    remove: vi.fn(() => {
      if (cfg.removeError) throw cfg.removeError;
    }),
  };
}

vi.mock('../services/tools.js', () => ({
  get AI_TOOLS() { return mockAiTools; },
  get MCP_HTTP_URL() { return 'http://127.0.0.1:19200/mcp'; },
  USEAI_INSTRUCTIONS_TEXT: mockInstructionsText,
  resolveTools: (...args: any[]) => mockResolveTools(...args),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

let consoleSpy: ReturnType<typeof vi.spyOn>;
let capturedLines: string[];

function captureConsole() {
  capturedLines = [];
  consoleSpy = vi.spyOn(console, 'log').mockImplementation((...args: any[]) => {
    capturedLines.push(args.map(String).join(' '));
  });
}

function clackOutput(): string {
  // Collect all clack log outputs + p.note + p.intro + p.outro
  const lines: string[] = [];
  for (const call of mockClack.log.success.mock.calls) lines.push(`[SUCCESS] ${call[0]}`);
  for (const call of mockClack.log.error.mock.calls) lines.push(`[ERROR] ${call[0]}`);
  for (const call of mockClack.log.info.mock.calls) lines.push(`[INFO] ${call[0]}`);
  for (const call of mockClack.log.warn.mock.calls) lines.push(`[WARN] ${call[0]}`);
  for (const call of mockClack.note.mock.calls) lines.push(`[NOTE:${call[1] ?? ''}] ${call[0]}`);
  for (const call of mockClack.outro.mock.calls) lines.push(`[OUTRO] ${call[0]}`);
  for (const call of mockClack.cancel.mock.calls) lines.push(`[CANCEL] ${call[0]}`);
  return lines.join('\n');
}

/**
 * Run the mcp command with the given argv tokens (after "mcp").
 * Dynamically re-imports the module to get a fresh Commander instance each time.
 */
async function runCommand(...argv: string[]): Promise<void> {
  vi.resetModules();
  const mod = await import('./setup.js');
  const cmd = mod.mcpCommand;
  cmd.exitOverride();
  try {
    await cmd.parseAsync(['node', 'mcp', ...argv]);
  } catch (err: any) {
    if (err?.exitCode !== undefined && err.exitCode === 0) return;
    throw err;
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('setup.ts', () => {
  const originalHome = process.env['HOME'];

  beforeEach(() => {
    vi.clearAllMocks();
    process.env['HOME'] = '/Users/testuser';
    captureConsole();
    mockAiTools.length = 0;
    mockResolveTools.mockReset();

    // Re-configure clack mocks after clearAllMocks
    mockClack.spinner.mockReturnValue({ start: vi.fn(), stop: vi.fn() });
    mockClack.isCancel.mockReturnValue(false);

    // Re-configure shared mocks after clearAllMocks
    mockShared.ensureDaemon.mockResolvedValue(true);
    mockShared.killDaemon.mockResolvedValue(undefined as any);
    mockShared.isAutostartInstalled.mockReturnValue(false);
    mockShared.detectPlatform.mockReturnValue('launchd' as any);
    mockShared.installClaudeCodeHooks.mockReturnValue(true);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    process.env['HOME'] = originalHome;
  });

  // ── showStatus ──

  describe('showStatus (--status flag)', () => {
    it('displays configured tools', async () => {
      const tool = makeMockTool({
        name: 'Claude Code',
        detected: true,
        configured: true,
        configPath: '/Users/testuser/.config/claude/mcp.json',
      });
      mockAiTools.push(tool);

      await runCommand('--status');

      const output = clackOutput();
      expect(output).toContain('AI Tool MCP Status');
      expect(output).toContain('Configured');
      expect(output).toContain('Claude Code');
    });

    it('displays unconfigured but detected tools', async () => {
      const tool = makeMockTool({
        name: 'VS Code',
        detected: true,
        configured: false,
        configPath: '/Users/testuser/.vscode/settings.json',
      });
      mockAiTools.push(tool);

      await runCommand('--status');

      const output = clackOutput();
      expect(output).toContain('Not set up');
      expect(output).toContain('VS Code');
    });

    it('shows warning when no tools detected', async () => {
      const tool = makeMockTool({
        name: 'Cursor',
        detected: false,
      });
      mockAiTools.push(tool);

      await runCommand('--status');

      expect(mockClack.log.warn).toHaveBeenCalledWith(
        expect.stringContaining('No supported AI tools detected'),
      );
    });

    it('shows multiple tools in a single status listing', async () => {
      mockAiTools.push(
        makeMockTool({ name: 'Claude Code', detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' }),
        makeMockTool({ name: 'VS Code', detected: true, configured: false, configPath: '/Users/testuser/.vscode/settings.json' }),
      );

      await runCommand('--status');

      const output = clackOutput();
      expect(output).toContain('Claude Code');
      expect(output).toContain('VS Code');
      expect(output).toContain('Configured');
      expect(output).toContain('Not set up');
    });

    it('filters to specific tools when tool names are provided with --status', async () => {
      const claudeTool = makeMockTool({ id: 'claude', name: 'Claude Code', detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' });
      mockAiTools.push(claudeTool);

      mockResolveTools.mockReturnValue({ matched: [claudeTool], unmatched: [] });

      await runCommand('claude', '--status');

      expect(mockResolveTools).toHaveBeenCalledWith(['claude']);
    });
  });

  // ── daemonInstallFlow (default action) ──

  describe('daemonInstallFlow (default action)', () => {
    it('ensures daemon is running and configures detected tools via installHttp', async () => {
      const tool = makeMockTool({
        id: 'claude',
        name: 'Claude Code',
        detected: true,
        configured: false,
        configPath: '/Users/testuser/.claude/mcp.json',
        supportsUrl: true,
      });
      mockAiTools.push(tool);

      await runCommand();

      expect(mockShared.ensureDaemon).toHaveBeenCalled();
      expect(tool.installHttp).toHaveBeenCalledOnce();
    });

    it('reports no AI tools detected when none found', async () => {
      const tool = makeMockTool({ detected: false });
      mockAiTools.push(tool);

      await runCommand();

      expect(mockClack.log.error).toHaveBeenCalledWith(
        expect.stringContaining('No AI tools detected'),
      );
    });

    it('falls back to stdio when daemon fails to start', async () => {
      mockShared.ensureDaemon.mockResolvedValue(false);
      const tool = makeMockTool({
        id: 'claude',
        name: 'Claude Code',
        detected: true,
        configured: false,
        supportsUrl: true,
      });
      mockAiTools.push(tool);

      await runCommand();

      // Falls back to stdio, calls install() not installHttp()
      expect(tool.install).toHaveBeenCalledOnce();
      expect(tool.installHttp).not.toHaveBeenCalled();
    });

    it('installs autostart service when daemon is working', async () => {
      const tool = makeMockTool({ detected: true });
      mockAiTools.push(tool);

      await runCommand();

      expect(mockShared.installAutostart).toHaveBeenCalled();
    });

    it('installs Claude Code hooks', async () => {
      const tool = makeMockTool({ detected: true });
      mockAiTools.push(tool);

      await runCommand();

      expect(mockShared.installClaudeCodeHooks).toHaveBeenCalled();
    });
  });

  // ── stdioInstallFlow (--stdio flag) ──

  describe('stdioInstallFlow (--stdio flag)', () => {
    describe('with explicit tool names', () => {
      it('installs specified tools directly', async () => {
        const tool = makeMockTool({
          id: 'claude',
          name: 'Claude Code',
          configured: false,
          configPath: '/Users/testuser/.claude/mcp.json',
        });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('claude', '--stdio');

        expect(tool.install).toHaveBeenCalledOnce();
      });

      it('reports errors for tools that fail to install', async () => {
        const tool = makeMockTool({
          id: 'cursor',
          name: 'Cursor',
          configured: false,
          installError: new Error('Permission denied'),
        });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('cursor', '--stdio');

        expect(mockClack.log.error).toHaveBeenCalledWith(
          expect.stringContaining('Permission denied'),
        );
      });
    });

    describe('with autoYes (-y flag)', () => {
      it('installs all unconfigured detected tools without prompting', async () => {
        const configured = makeMockTool({ name: 'Claude Code', detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' });
        const unconfigured = makeMockTool({ name: 'VS Code', detected: true, configured: false, configPath: '/Users/testuser/.vscode/settings.json' });
        const notFound = makeMockTool({ name: 'Windsurf', detected: false });
        mockAiTools.push(configured, unconfigured, notFound);

        // Even with -y, stdioInstallFlow asks for p.confirm after showing summary
        mockClack.confirm.mockResolvedValue(true);

        await runCommand('--stdio', '-y');

        expect(unconfigured.install).toHaveBeenCalledOnce();
        // Already-configured tools get re-installed to update instructions
        expect(configured.install).toHaveBeenCalledOnce();
        expect(notFound.install).not.toHaveBeenCalled();
      });

      it('reports when all detected tools are already configured', async () => {
        const tool = makeMockTool({ detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' });
        mockAiTools.push(tool);

        await runCommand('--stdio', '-y');

        expect(mockClack.log.success).toHaveBeenCalledWith(
          expect.stringContaining('All detected tools are already configured'),
        );
      });

      it('reports when no AI tools are detected at all', async () => {
        const tool = makeMockTool({ detected: false });
        mockAiTools.push(tool);

        await runCommand('--stdio', '-y');

        expect(mockClack.log.error).toHaveBeenCalledWith(
          expect.stringContaining('No AI tools detected'),
        );
      });
    });

    describe('with interactive prompt', () => {
      it('presents multiselect for unconfigured tools and installs selected ones', async () => {
        const tool1 = makeMockTool({ id: 'claude', name: 'Claude Code', detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' });
        const tool2 = makeMockTool({ id: 'vscode', name: 'VS Code', detected: true, configured: false, configPath: '/Users/testuser/.vscode/settings.json' });
        mockAiTools.push(tool1, tool2);

        mockClack.multiselect.mockResolvedValue(['claude']);
        mockClack.confirm.mockResolvedValue(true);

        await runCommand('--stdio');

        expect(mockClack.multiselect).toHaveBeenCalledOnce();
        expect(tool1.install).toHaveBeenCalledOnce();
        expect(tool2.install).not.toHaveBeenCalled();
      });

      it('handles user cancellation gracefully', async () => {
        const tool = makeMockTool({ detected: true, configured: false });
        mockAiTools.push(tool);

        mockClack.multiselect.mockResolvedValue(Symbol.for('cancel'));
        mockClack.isCancel.mockReturnValue(true);

        await runCommand('--stdio');

        expect(tool.install).not.toHaveBeenCalled();
        expect(mockClack.cancel).toHaveBeenCalledWith(
          expect.stringContaining('cancelled'),
        );
      });

      it('handles empty selection after confirm rejection', async () => {
        const tool = makeMockTool({ id: 'claude', detected: true, configured: false });
        mockAiTools.push(tool);

        mockClack.multiselect.mockResolvedValue(['claude']);
        // User says no at confirm
        mockClack.confirm.mockResolvedValue(Symbol.for('cancel'));
        mockClack.isCancel.mockImplementation((val: unknown) => typeof val === 'symbol');

        await runCommand('--stdio');

        expect(tool.install).not.toHaveBeenCalled();
      });
    });

    describe('install error handling within scan flow', () => {
      it('continues installing remaining tools after one fails', async () => {
        const failing = makeMockTool({ id: 'cursor', name: 'Cursor', detected: true, configured: false, installError: new Error('Disk full') });
        const succeeding = makeMockTool({ id: 'claude', name: 'Claude Code', detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' });
        mockAiTools.push(failing, succeeding);

        mockClack.multiselect.mockResolvedValue(['cursor', 'claude']);
        mockClack.confirm.mockResolvedValue(true);

        await runCommand('--stdio');

        expect(failing.install).toHaveBeenCalledOnce();
        expect(succeeding.install).toHaveBeenCalledOnce();
        const output = clackOutput();
        expect(output).toContain('Disk full');
      });
    });
  });

  // ── fullRemoveFlow ──

  describe('fullRemoveFlow (--remove flag)', () => {
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
        expect(mockClack.log.success).toHaveBeenCalledWith(
          expect.stringContaining('Removed from Claude Code'),
        );
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
        expect(mockClack.log.info).toHaveBeenCalledWith(
          expect.stringContaining('not configured'),
        );
      });

      it('handles mix of configured and unconfigured tools', async () => {
        const configured = makeMockTool({ id: 'claude', name: 'Claude Code', configured: true });
        const notConfigured = makeMockTool({ id: 'vscode', name: 'VS Code', configured: false });
        mockResolveTools.mockReturnValue({ matched: [configured, notConfigured], unmatched: [] });

        await runCommand('claude', 'vscode', '--remove');

        expect(configured.remove).toHaveBeenCalledOnce();
        expect(notConfigured.remove).not.toHaveBeenCalled();
        const output = clackOutput();
        expect(output).toContain('Removed from Claude Code');
        expect(output).toContain('VS Code is not configured');
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

        expect(mockClack.log.error).toHaveBeenCalledWith(
          expect.stringContaining('File locked'),
        );
      });

      it('handles isConfigured throwing by treating tool as not-configured', async () => {
        const tool = makeMockTool({ id: 'broken', name: 'Broken Tool' });
        tool.isConfigured.mockImplementation(() => { throw new Error('corrupt config'); });
        mockResolveTools.mockReturnValue({ matched: [tool], unmatched: [] });

        await runCommand('broken', '--remove');

        expect(tool.remove).not.toHaveBeenCalled();
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
      });

      it('reports when no tools are configured', async () => {
        const tool = makeMockTool({ configured: false });
        mockAiTools.push(tool);

        await runCommand('--remove', '-y');

        expect(mockClack.log.info).toHaveBeenCalledWith(
          expect.stringContaining('not configured in any AI tools'),
        );
      });
    });

    describe('with interactive prompt', () => {
      it('presents multiselect and removes selected tools', async () => {
        const tool1 = makeMockTool({ id: 'claude', name: 'Claude Code', configured: true });
        const tool2 = makeMockTool({ id: 'vscode', name: 'VS Code', configured: true });
        mockAiTools.push(tool1, tool2);

        mockClack.multiselect.mockResolvedValue(['claude']);

        await runCommand('--remove');

        expect(mockClack.multiselect).toHaveBeenCalledOnce();
        expect(tool1.remove).toHaveBeenCalledOnce();
        expect(tool2.remove).not.toHaveBeenCalled();
      });

      it('handles cancellation during removal prompt', async () => {
        const tool = makeMockTool({ configured: true });
        mockAiTools.push(tool);

        mockClack.multiselect.mockResolvedValue(Symbol.for('cancel'));
        mockClack.isCancel.mockReturnValue(true);

        await runCommand('--remove');

        expect(tool.remove).not.toHaveBeenCalled();
      });

      it('handles empty selection on remove', async () => {
        const tool = makeMockTool({ id: 'claude', configured: true });
        mockAiTools.push(tool);

        mockClack.multiselect.mockResolvedValue([]);

        await runCommand('--remove');

        expect(tool.remove).not.toHaveBeenCalled();
        expect(mockClack.log.info).toHaveBeenCalledWith(
          expect.stringContaining('No tools selected'),
        );
      });
    });
  });

  // ── resolveTools error handling ──

  describe('resolveTools error handling', () => {
    it('prints error when tool name is unknown', async () => {
      const knownTool = makeMockTool({ id: 'claude', name: 'Claude Code' });
      mockAiTools.push(knownTool);
      mockResolveTools.mockReturnValue({ matched: [], unmatched: ['foobar'] });

      await runCommand('foobar');

      expect(mockClack.log.error).toHaveBeenCalledWith(
        expect.stringContaining('Unknown tool'),
      );
      expect(mockClack.log.info).toHaveBeenCalledWith(
        expect.stringContaining('Available'),
      );
    });

    it('lists multiple unknown tools in the error', async () => {
      mockAiTools.push(makeMockTool({ id: 'claude' }));
      mockResolveTools.mockReturnValue({ matched: [], unmatched: ['foo', 'bar'] });

      await runCommand('foo', 'bar');

      expect(mockClack.log.error).toHaveBeenCalledWith(
        expect.stringContaining('foo'),
      );
    });

    it('does not call install when tool names are unmatched', async () => {
      const tool = makeMockTool({ id: 'claude' });
      mockAiTools.push(tool);
      mockResolveTools.mockReturnValue({ matched: [], unmatched: ['nope'] });

      await runCommand('nope');

      expect(tool.install).not.toHaveBeenCalled();
      expect(tool.installHttp).not.toHaveBeenCalled();
    });
  });

  // ── Option flag routing ──

  describe('option flag routing', () => {
    it('routes --status to showStatus', async () => {
      const tool = makeMockTool({ detected: true, configured: true, configPath: '/Users/testuser/.claude/mcp.json' });
      mockAiTools.push(tool);

      await runCommand('--status');

      expect(mockClack.note).toHaveBeenCalledWith(
        expect.stringContaining('Configured'),
        'AI Tool MCP Status',
      );
      expect(tool.install).not.toHaveBeenCalled();
      expect(tool.installHttp).not.toHaveBeenCalled();
      expect(tool.remove).not.toHaveBeenCalled();
    });

    it('routes --remove to fullRemoveFlow', async () => {
      const tool = makeMockTool({ configured: true });
      mockAiTools.push(tool);

      mockClack.multiselect.mockResolvedValue([tool.id]);

      await runCommand('--remove');

      expect(tool.remove).toHaveBeenCalled();
      expect(tool.install).not.toHaveBeenCalled();
    });

    it('routes default (no flags) to daemonInstallFlow', async () => {
      const tool = makeMockTool({ detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' });
      mockAiTools.push(tool);

      await runCommand();

      expect(mockShared.ensureDaemon).toHaveBeenCalled();
      expect(tool.installHttp).toHaveBeenCalled();
    });

    it('routes --stdio to stdioInstallFlow', async () => {
      const tool = makeMockTool({ detected: true, configured: false, configPath: '/Users/testuser/.claude/mcp.json' });
      mockAiTools.push(tool);

      mockClack.multiselect.mockResolvedValue([tool.id]);
      mockClack.confirm.mockResolvedValue(true);

      await runCommand('--stdio');

      expect(mockShared.ensureDaemon).not.toHaveBeenCalled();
      expect(tool.install).toHaveBeenCalled();
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

      await runCommand('codex', '--stdio');

      const output = clackOutput();
      expect(output).toContain('Manual setup needed');
      expect(output).toContain('OpenAI Codex CLI');
      expect(output).toContain('Run codex --configure to complete setup');
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

      await runCommand('claude', '--stdio');

      const noteArgs = mockClack.note.mock.calls.map((c: any[]) => c[1]).filter(Boolean);
      const hasManualHint = noteArgs.some((title: string) => title.includes('Manual setup'));
      expect(hasManualHint).toBe(false);
    });
  });
});
