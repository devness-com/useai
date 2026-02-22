import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ── Mock external dependencies ────────────────────────────────────────────────

vi.mock('@inquirer/prompts', () => ({
  checkbox: vi.fn(),
}));

vi.mock('chalk', () => {
  const passthrough = (s: string) => s;
  const chainable: any = new Proxy(passthrough, {
    get: () => chainable,
    apply: (_target: any, _thisArg: any, args: any[]) => args[0],
  });
  return { default: chainable };
});

vi.mock('@useai/shared', () => ({
  DAEMON_PORT: 9999,
  ensureDaemon: vi.fn(),
  killDaemon: vi.fn(),
  installAutostart: vi.fn(),
  removeAutostart: vi.fn(),
  isAutostartInstalled: vi.fn(),
  detectPlatform: vi.fn(),
  installClaudeCodeHooks: vi.fn(),
  removeClaudeCodeHooks: vi.fn(),
  DAEMON_MCP_URL: 'http://localhost:9999/mcp',
  CONFIG_FILE: '/tmp/useai-test-config.json',
  readJson: () => ({ milestone_tracking: true, auto_sync: true, evaluation_framework: 'raw' }),
  buildInstructionsText: () => '## UseAI Session Tracking\n- test instructions',
}));

const { mockToolA, mockToolB, allMockTools } = vi.hoisted(() => {
  const _vi = { fn: () => Object.assign((() => {}) as any, { mockReturnValue: (v: any) => Object.assign((() => v) as any, { mockReturnValue: (v2: any) => (() => v2) }) }) };
  return {
    mockToolA: {
      id: 'claude',
      name: 'Claude Code',
      supportsUrl: true,
      detect: vi.fn(),
      isConfigured: vi.fn(),
      getConfigPath: vi.fn().mockReturnValue('/home/user/.config/claude/config.json'),
      getManualHint: vi.fn().mockReturnValue(null),
      install: vi.fn(),
      installHttp: vi.fn(),
      remove: vi.fn(),
    },
    mockToolB: {
      id: 'cursor',
      name: 'Cursor',
      supportsUrl: false,
      detect: vi.fn(),
      isConfigured: vi.fn(),
      getConfigPath: vi.fn().mockReturnValue('/home/user/.config/cursor/config.json'),
      getManualHint: vi.fn().mockReturnValue(null),
      install: vi.fn(),
      installHttp: vi.fn(),
      remove: vi.fn(),
    },
    allMockTools: [] as any[],
  };
});
allMockTools.push(mockToolA, mockToolB);

vi.mock('./tools.js', () => ({
  AI_TOOLS: allMockTools,
  MCP_HTTP_URL: 'http://localhost:9999/mcp',
  USEAI_INSTRUCTIONS_TEXT: 'Add UseAI instructions to your AI tool.',
  resolveTools: vi.fn(),
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { runSetup } from './setup.js';
import { resolveTools } from './tools.js';
import {
  ensureDaemon,
  killDaemon,
  installAutostart,
  removeAutostart,
  isAutostartInstalled,
  detectPlatform,
} from '@useai/shared';

// ── Helpers ───────────────────────────────────────────────────────────────────

let consoleSpy: Mock;

function capturedOutput(): string {
  return (consoleSpy as Mock).mock.calls.map((c: any[]) => c.join(' ')).join('\n');
}

beforeEach(() => {
  vi.clearAllMocks();
  consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) as unknown as Mock;

  // Sensible defaults — individual tests override as needed
  mockToolA.detect.mockReturnValue(true);
  mockToolA.isConfigured.mockReturnValue(false);
  mockToolB.detect.mockReturnValue(true);
  mockToolB.isConfigured.mockReturnValue(false);

  (ensureDaemon as Mock).mockResolvedValue(true);
  (killDaemon as Mock).mockResolvedValue(undefined);
  (detectPlatform as Mock).mockReturnValue('launchd');
  (isAutostartInstalled as Mock).mockReturnValue(false);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('runSetup', () => {
  // ── --help flag ───────────────────────────────────────────────────────────

  describe('--help flag', () => {
    it('shows usage text and returns without performing any install when --help is passed', async () => {
      await runSetup(['--help']);

      const output = capturedOutput();
      expect(output).toContain('Usage:');
      expect(output).toContain('--stdio');
      expect(output).toContain('--remove');
      expect(output).toContain('--status');
      expect(output).toContain('--help');
      // Should NOT have triggered any install flow
      expect(ensureDaemon).not.toHaveBeenCalled();
      expect(mockToolA.install).not.toHaveBeenCalled();
    });

    it('shows help text when -h short flag is passed', async () => {
      await runSetup(['-h']);

      const output = capturedOutput();
      expect(output).toContain('Usage:');
      expect(ensureDaemon).not.toHaveBeenCalled();
    });

    it('shows help even when combined with other flags like --remove and --stdio', async () => {
      await runSetup(['--help', '--remove', '--stdio']);

      const output = capturedOutput();
      expect(output).toContain('Usage:');
      expect(ensureDaemon).not.toHaveBeenCalled();
      expect(killDaemon).not.toHaveBeenCalled();
    });
  });

  // ── --status flag ─────────────────────────────────────────────────────────

  describe('--status flag', () => {
    it('prints configured status for detected and configured tools', async () => {
      mockToolA.detect.mockReturnValue(true);
      mockToolA.isConfigured.mockReturnValue(true);
      mockToolB.detect.mockReturnValue(false);

      await runSetup(['--status']);

      const output = capturedOutput();
      expect(output).toContain('AI Tool MCP Status');
      expect(output).toContain('Claude Code');
      expect(output).toContain('Configured');
      expect(output).toContain('Cursor');
      expect(output).toContain('Not found');
      // Should NOT have triggered any install flow
      expect(ensureDaemon).not.toHaveBeenCalled();
      expect(mockToolA.install).not.toHaveBeenCalled();
    });

    it('shows "Not set up" for detected but unconfigured tools', async () => {
      mockToolA.detect.mockReturnValue(true);
      mockToolA.isConfigured.mockReturnValue(false);

      await runSetup(['--status']);

      const output = capturedOutput();
      expect(output).toContain('Not set up');
    });
  });

  // ── --remove flag ─────────────────────────────────────────────────────────

  describe('--remove flag', () => {
    it('kills daemon and removes autostart when autostart is installed', async () => {
      mockToolA.isConfigured.mockReturnValue(false);
      mockToolB.isConfigured.mockReturnValue(false);
      (isAutostartInstalled as Mock).mockReturnValue(true);

      await runSetup(['--remove', '-y']);

      expect(killDaemon).toHaveBeenCalled();
      expect(removeAutostart).toHaveBeenCalled();
    });

    it('removes all configured tools and stops daemon with -y auto-confirm', async () => {
      // First call (filter configured tools) returns true; second call (anyRemaining check) returns false
      mockToolA.isConfigured.mockReturnValueOnce(true).mockReturnValue(false);
      mockToolB.isConfigured.mockReturnValueOnce(true).mockReturnValue(false);
      (isAutostartInstalled as Mock).mockReturnValue(false);

      await runSetup(['--remove', '-y']);

      expect(mockToolA.remove).toHaveBeenCalled();
      expect(mockToolB.remove).toHaveBeenCalled();
      expect(killDaemon).toHaveBeenCalled();
      const output = capturedOutput();
      expect(output).toContain('Removed from Claude Code');
      expect(output).toContain('Removed from Cursor');
    });

    it('skips tools that are not configured during removal', async () => {
      mockToolA.isConfigured.mockReturnValue(false);
      mockToolB.isConfigured.mockReturnValue(true);

      await runSetup(['--remove', '-y']);

      expect(mockToolA.remove).not.toHaveBeenCalled();
      expect(mockToolB.remove).toHaveBeenCalled();
    });

    it('prints message when no tools are configured for removal', async () => {
      mockToolA.isConfigured.mockReturnValue(false);
      mockToolB.isConfigured.mockReturnValue(false);

      await runSetup(['--remove', '-y']);

      const output = capturedOutput();
      expect(output).toContain('not configured');
    });

    it('does not call removeAutostart when autostart is not installed', async () => {
      (isAutostartInstalled as Mock).mockReturnValue(false);

      await runSetup(['--remove', '-y']);

      expect(removeAutostart).not.toHaveBeenCalled();
    });
  });

  // ── --stdio flag ──────────────────────────────────────────────────────────

  describe('--stdio flag', () => {
    it('installs detected unconfigured tools via stdio with -y auto-confirm', async () => {
      mockToolA.detect.mockReturnValue(true);
      mockToolA.isConfigured.mockReturnValue(false);
      mockToolB.detect.mockReturnValue(true);
      mockToolB.isConfigured.mockReturnValue(true);

      await runSetup(['--stdio', '-y']);

      // Unconfigured tool A installed
      expect(mockToolA.install).toHaveBeenCalled();
      // Already-configured tool B re-installed for instruction injection
      expect(mockToolB.install).toHaveBeenCalled();
      // Daemon should NOT be started in stdio mode
      expect(ensureDaemon).not.toHaveBeenCalled();
    });

    it('reports when all detected tools are already configured', async () => {
      mockToolA.detect.mockReturnValue(true);
      mockToolA.isConfigured.mockReturnValue(true);
      mockToolB.detect.mockReturnValue(true);
      mockToolB.isConfigured.mockReturnValue(true);

      await runSetup(['--stdio', '-y']);

      const output = capturedOutput();
      expect(output).toContain('already configured');
    });

    it('reports when no AI tools are detected on the machine', async () => {
      mockToolA.detect.mockReturnValue(false);
      mockToolB.detect.mockReturnValue(false);

      await runSetup(['--stdio', '-y']);

      const output = capturedOutput();
      expect(output).toContain('No AI tools detected');
    });
  });

  // ── Default (daemon install flow) — no flags ─────────────────────────────

  describe('default daemon install flow (no flags)', () => {
    it('starts daemon and configures URL-capable tools via HTTP', async () => {
      (ensureDaemon as Mock).mockResolvedValue(true);
      mockToolA.detect.mockReturnValue(true);
      mockToolB.detect.mockReturnValue(true);

      await runSetup(['-y']);

      expect(ensureDaemon).toHaveBeenCalled();
      // Tool A supports URL → installHttp
      expect(mockToolA.installHttp).toHaveBeenCalled();
      expect(mockToolA.install).not.toHaveBeenCalled();
      // Tool B does NOT support URL → stdio fallback
      expect(mockToolB.install).toHaveBeenCalled();
      expect(mockToolB.installHttp).not.toHaveBeenCalled();
    });

    it('falls back to stdio for all tools when daemon fails to start', async () => {
      (ensureDaemon as Mock).mockResolvedValue(false);

      await runSetup(['-y']);

      expect(mockToolA.install).toHaveBeenCalled();
      expect(mockToolA.installHttp).not.toHaveBeenCalled();
      expect(mockToolB.install).toHaveBeenCalled();
      const output = capturedOutput();
      expect(output).toContain('Could not start daemon');
      expect(output).toContain('stdio');
    });

    it('installs autostart service when daemon succeeds and platform is supported', async () => {
      (ensureDaemon as Mock).mockResolvedValue(true);
      (detectPlatform as Mock).mockReturnValue('launchd');

      await runSetup(['-y']);

      expect(installAutostart).toHaveBeenCalled();
      const output = capturedOutput();
      expect(output).toContain('Auto-start service installed');
    });

    it('skips autostart installation on unsupported platform', async () => {
      (ensureDaemon as Mock).mockResolvedValue(true);
      (detectPlatform as Mock).mockReturnValue('unsupported');

      await runSetup(['-y']);

      expect(installAutostart).not.toHaveBeenCalled();
    });

    it('does not crash when installAutostart throws and shows warning', async () => {
      (ensureDaemon as Mock).mockResolvedValue(true);
      (detectPlatform as Mock).mockReturnValue('launchd');
      (installAutostart as Mock).mockImplementation(() => {
        throw new Error('permission denied');
      });

      await runSetup(['-y']);

      const output = capturedOutput();
      expect(output).toContain('Could not install auto-start');
    });

    it('only configures detected tools when no explicit tool names given', async () => {
      mockToolA.detect.mockReturnValue(true);
      mockToolB.detect.mockReturnValue(false);

      await runSetup(['-y']);

      expect(mockToolA.installHttp).toHaveBeenCalled();
      expect(mockToolB.install).not.toHaveBeenCalled();
      expect(mockToolB.installHttp).not.toHaveBeenCalled();
    });

    it('reports error when no tools are detected on the machine', async () => {
      mockToolA.detect.mockReturnValue(false);
      mockToolB.detect.mockReturnValue(false);

      await runSetup(['-y']);

      const output = capturedOutput();
      expect(output).toContain('No AI tools detected');
    });

    it('handles individual tool install failure gracefully and continues', async () => {
      mockToolA.detect.mockReturnValue(true);
      mockToolA.installHttp.mockImplementation(() => {
        throw new Error('write permission denied');
      });

      await runSetup(['-y']);

      const output = capturedOutput();
      expect(output).toContain('write permission denied');
      // Should still configure remaining tools
      expect(mockToolB.install).toHaveBeenCalled();
    });

    it('prints done summary with configured count and daemon mode', async () => {
      mockToolA.detect.mockReturnValue(true);
      mockToolB.detect.mockReturnValue(true);
      (ensureDaemon as Mock).mockResolvedValue(true);

      await runSetup(['-y']);

      const output = capturedOutput();
      expect(output).toContain('Done!');
      expect(output).toContain('daemon mode');
    });

    it('prints done summary with stdio mode when daemon fails', async () => {
      (ensureDaemon as Mock).mockResolvedValue(false);

      await runSetup(['-y']);

      const output = capturedOutput();
      expect(output).toContain('Done!');
      expect(output).toContain('stdio mode');
    });
  });

  // ── Explicit tool names via resolveTools ──────────────────────────────────

  describe('explicit tool names resolved via resolveTools', () => {
    it('calls resolveTools with provided tool names and configures matched tools', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });

      await runSetup(['claude']);

      expect(resolveTools).toHaveBeenCalledWith(['claude']);
      expect(mockToolA.installHttp).toHaveBeenCalled();
      // mockToolB was not in matched list
      expect(mockToolB.install).not.toHaveBeenCalled();
      expect(mockToolB.installHttp).not.toHaveBeenCalled();
    });

    it('resolves multiple tool names and configures all matched tools', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA, mockToolB],
        unmatched: [],
      });

      await runSetup(['claude', 'cursor']);

      expect(resolveTools).toHaveBeenCalledWith(['claude', 'cursor']);
      expect(mockToolA.installHttp).toHaveBeenCalled();
      expect(mockToolB.install).toHaveBeenCalled();
    });

    it('uses resolved tools for --status display', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });
      mockToolA.detect.mockReturnValue(true);
      mockToolA.isConfigured.mockReturnValue(true);

      await runSetup(['claude', '--status']);

      const output = capturedOutput();
      expect(output).toContain('Claude Code');
      expect(output).toContain('Configured');
      // Should not show unresolved mockToolB
      expect(output).not.toContain('Cursor');
    });

    it('uses resolved tools for --remove flow', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });
      mockToolA.isConfigured.mockReturnValue(true);

      await runSetup(['claude', '--remove']);

      expect(mockToolA.remove).toHaveBeenCalled();
      expect(mockToolB.remove).not.toHaveBeenCalled();
    });

    it('uses resolved tools for --stdio explicit install', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });
      mockToolA.isConfigured.mockReturnValue(false);

      await runSetup(['claude', '--stdio']);

      // Explicit + stdio flow calls install directly without scanning
      expect(mockToolA.install).toHaveBeenCalled();
      expect(ensureDaemon).not.toHaveBeenCalled();
    });

    it('bypasses detect() filter for explicit tools in daemon flow', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });
      mockToolA.detect.mockReturnValue(false);

      await runSetup(['claude']);

      // With explicit=true, detect() filter is skipped in daemonInstallFlow
      expect(mockToolA.installHttp).toHaveBeenCalled();
    });
  });

  // ── Unknown tool names produce error ──────────────────────────────────────

  describe('unknown tool names produce error', () => {
    it('prints error for a single unknown tool and returns early without installing', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [],
        unmatched: ['nonexistent'],
      });

      await runSetup(['nonexistent']);

      const output = capturedOutput();
      expect(output).toContain('Unknown tool');
      expect(output).toContain('nonexistent');
      expect(output).toContain('Available:');
      // Should not proceed to any install flow
      expect(ensureDaemon).not.toHaveBeenCalled();
      expect(mockToolA.install).not.toHaveBeenCalled();
    });

    it('prints error listing all unmatched tool names', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: ['bogus', 'fake'],
      });

      await runSetup(['claude', 'bogus', 'fake']);

      const output = capturedOutput();
      expect(output).toContain('Unknown tools');
      expect(output).toContain('bogus');
      expect(output).toContain('fake');
      // Should return early — no install attempted
      expect(ensureDaemon).not.toHaveBeenCalled();
      expect(mockToolA.install).not.toHaveBeenCalled();
    });

    it('uses singular "tool" for one unknown and plural "tools" for multiple unknown', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [],
        unmatched: ['xyz'],
      });

      await runSetup(['xyz']);

      const singleOutput = capturedOutput();
      expect(singleOutput).toContain('Unknown tool:');
      expect(singleOutput).not.toContain('Unknown tools:');

      vi.clearAllMocks();
      consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {}) as unknown as Mock;

      (resolveTools as Mock).mockReturnValue({
        matched: [],
        unmatched: ['abc', 'def'],
      });

      await runSetup(['abc', 'def']);

      const pluralOutput = capturedOutput();
      expect(pluralOutput).toContain('Unknown tools:');
    });

    it('shows available tool IDs when an unknown tool is given', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [],
        unmatched: ['unknown-tool'],
      });

      await runSetup(['unknown-tool']);

      const output = capturedOutput();
      expect(output).toContain('Available:');
      expect(output).toContain('claude');
      expect(output).toContain('cursor');
    });
  });

  // ── Flag parsing edge cases ───────────────────────────────────────────────

  describe('flag parsing edge cases', () => {
    it('separates flags from tool names correctly (flags start with -, tools do not)', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });

      await runSetup(['claude', '--status']);

      // 'claude' is a tool name, '--status' is a flag
      expect(resolveTools).toHaveBeenCalledWith(['claude']);
    });

    it('recognizes -y short flag as auto-yes', async () => {
      mockToolA.detect.mockReturnValue(true);
      mockToolA.isConfigured.mockReturnValue(false);
      mockToolB.detect.mockReturnValue(false);

      await runSetup(['--stdio', '-y']);

      expect(mockToolA.install).toHaveBeenCalled();
    });

    it('recognizes --yes long flag as auto-yes', async () => {
      mockToolA.detect.mockReturnValue(true);
      mockToolA.isConfigured.mockReturnValue(false);
      mockToolB.detect.mockReturnValue(false);

      await runSetup(['--stdio', '--yes']);

      expect(mockToolA.install).toHaveBeenCalled();
    });

    it('treats empty args array as default daemon flow', async () => {
      await runSetup(['-y']);

      expect(ensureDaemon).toHaveBeenCalled();
    });

    it('does not call resolveTools when no tool names are provided', async () => {
      await runSetup(['--status']);

      expect(resolveTools).not.toHaveBeenCalled();
    });
  });

  // ── Remove flow with explicit tool names ──────────────────────────────────

  describe('--remove with explicit tool names', () => {
    it('removes the specified configured tool and prints confirmation', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });
      mockToolA.isConfigured.mockReturnValue(true);

      await runSetup(['claude', '--remove']);

      expect(mockToolA.remove).toHaveBeenCalled();
      const output = capturedOutput();
      expect(output).toContain('Removed from Claude Code');
    });

    it('skips explicit tool that is not configured and prints skip message', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });
      mockToolA.isConfigured.mockReturnValue(false);

      await runSetup(['claude', '--remove']);

      expect(mockToolA.remove).not.toHaveBeenCalled();
      const output = capturedOutput();
      expect(output).toContain('not configured');
      expect(output).toContain('skipping');
    });

    it('handles remove error for a specific tool gracefully', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });
      mockToolA.isConfigured.mockReturnValue(true);
      mockToolA.remove.mockImplementation(() => {
        throw new Error('cannot delete config');
      });

      await runSetup(['claude', '--remove']);

      const output = capturedOutput();
      expect(output).toContain('cannot delete config');
    });
  });

  // ── Stdio explicit install shows update status ────────────────────────────

  describe('--stdio with explicit tool names', () => {
    it('shows "(updated)" for tools that were already configured', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });
      mockToolA.isConfigured.mockReturnValue(true);

      await runSetup(['claude', '--stdio']);

      expect(mockToolA.install).toHaveBeenCalled();
      const output = capturedOutput();
      expect(output).toContain('updated');
    });

    it('shows config path for newly configured tools', async () => {
      (resolveTools as Mock).mockReturnValue({
        matched: [mockToolA],
        unmatched: [],
      });
      mockToolA.isConfigured.mockReturnValue(false);

      await runSetup(['claude', '--stdio']);

      expect(mockToolA.install).toHaveBeenCalled();
      const output = capturedOutput();
      expect(output).toContain('Claude Code');
    });
  });
});