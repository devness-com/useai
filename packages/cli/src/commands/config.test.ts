import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/config.service.js', () => ({
  getConfig: vi.fn(),
  updateConfig: vi.fn(),
}));

vi.mock('../utils/display.js', () => ({
  header: vi.fn((text: string) => `[HEADER] ${text}`),
  table: vi.fn((rows: string[][]) => rows.map((r) => r.join(' | ')).join('\n')),
  success: vi.fn((text: string) => `[SUCCESS] ${text}`),
}));

vi.mock('chalk', () => ({
  default: {
    green: (s: string) => `green(${s})`,
    red: (s: string) => `red(${s})`,
    dim: (s: string) => `dim(${s})`,
  },
}));

import { getConfig, updateConfig } from '../services/config.service.js';
import { header, table, success } from '../utils/display.js';

const mockedGetConfig = vi.mocked(getConfig);
const mockedUpdateConfig = vi.mocked(updateConfig);
const mockedHeader = vi.mocked(header);
const mockedTable = vi.mocked(table);

function buildDefaultConfig(overrides: Record<string, unknown> = {}) {
  return {
    milestone_tracking: true,
    auto_sync: true,
    sync_interval_hours: 6,
    last_sync_at: '2026-02-15T10:00:00Z',
    auth: { user: { email: 'user@example.com' } },
    ...overrides,
  };
}

describe('configCommand', () => {
  let originalArgv: string[];
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalArgv = process.argv;
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.clearAllMocks();
    mockedGetConfig.mockReturnValue(buildDefaultConfig() as any);
  });

  afterEach(() => {
    process.argv = originalArgv;
    consoleSpy.mockRestore();
  });

  async function runCommand(args: string[]) {
    const { configCommand } = await import('./config.js');
    process.argv = ['node', 'useai', 'config', ...args];
    await configCommand.parseAsync(process.argv);
  }

  describe('--sync flag', () => {
    it('enables auto-sync when --sync is passed', async () => {
      await runCommand(['--sync']);

      expect(mockedUpdateConfig).toHaveBeenCalledWith({ auto_sync: true });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-sync enabled'),
      );
    });

    it('does not display current settings table when --sync is passed', async () => {
      await runCommand(['--sync']);

      expect(mockedHeader).not.toHaveBeenCalled();
      expect(mockedTable).not.toHaveBeenCalled();
    });
  });

  describe('--no-sync flag', () => {
    it('disables auto-sync when --no-sync is passed', async () => {
      await runCommand(['--no-sync']);

      expect(mockedUpdateConfig).toHaveBeenCalledWith({ auto_sync: false });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-sync disabled'),
      );
    });

    it('does not display current settings table when --no-sync is passed', async () => {
      await runCommand(['--no-sync']);

      expect(mockedHeader).not.toHaveBeenCalled();
      expect(mockedTable).not.toHaveBeenCalled();
    });
  });

  describe('--milestones flag', () => {
    it('enables milestone tracking when --milestones is passed', async () => {
      await runCommand(['--milestones']);

      expect(mockedUpdateConfig).toHaveBeenCalledWith({ milestone_tracking: true });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Milestone tracking enabled'),
      );
    });

    it('does not display current settings table when --milestones is passed', async () => {
      await runCommand(['--milestones']);

      expect(mockedHeader).not.toHaveBeenCalled();
      expect(mockedTable).not.toHaveBeenCalled();
    });
  });

  describe('--no-milestones flag', () => {
    it('disables milestone tracking when --no-milestones is passed', async () => {
      await runCommand(['--no-milestones']);

      expect(mockedUpdateConfig).toHaveBeenCalledWith({ milestone_tracking: false });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Milestone tracking disabled'),
      );
    });

    it('does not display current settings table when --no-milestones is passed', async () => {
      await runCommand(['--no-milestones']);

      expect(mockedHeader).not.toHaveBeenCalled();
      expect(mockedTable).not.toHaveBeenCalled();
    });
  });

  describe('combining flags', () => {
    it('applies both --sync and --milestones together', async () => {
      await runCommand(['--sync', '--milestones']);

      expect(mockedUpdateConfig).toHaveBeenCalledWith({ auto_sync: true });
      expect(mockedUpdateConfig).toHaveBeenCalledWith({ milestone_tracking: true });
      expect(mockedUpdateConfig).toHaveBeenCalledTimes(2);
    });

    it('applies both --no-sync and --no-milestones together', async () => {
      await runCommand(['--no-sync', '--no-milestones']);

      expect(mockedUpdateConfig).toHaveBeenCalledWith({ auto_sync: false });
      expect(mockedUpdateConfig).toHaveBeenCalledWith({ milestone_tracking: false });
      expect(mockedUpdateConfig).toHaveBeenCalledTimes(2);
    });

    it('applies --sync and --no-milestones together', async () => {
      await runCommand(['--sync', '--no-milestones']);

      expect(mockedUpdateConfig).toHaveBeenCalledWith({ auto_sync: true });
      expect(mockedUpdateConfig).toHaveBeenCalledWith({ milestone_tracking: false });
    });

    it('does not display settings table when any flag is passed', async () => {
      await runCommand(['--no-sync', '--milestones']);

      expect(mockedHeader).not.toHaveBeenCalled();
      expect(mockedTable).not.toHaveBeenCalled();
    });
  });

  describe('displaying current settings (no flags)', () => {
    it('displays settings header and table when no flags are provided', async () => {
      await runCommand([]);

      expect(mockedHeader).toHaveBeenCalledWith('Current Settings');
      expect(mockedTable).toHaveBeenCalled();
    });

    it('does not call updateConfig when no flags are provided', async () => {
      await runCommand([]);

      expect(mockedUpdateConfig).not.toHaveBeenCalled();
    });

    it('shows milestone tracking as on when enabled in config', async () => {
      mockedGetConfig.mockReturnValue(buildDefaultConfig({ milestone_tracking: true }) as any);

      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      const milestoneRow = tableCall.find((row) => row[0] === 'Milestone tracking');
      expect(milestoneRow).toBeDefined();
      expect(milestoneRow![1]).toContain('green');
      expect(milestoneRow![1]).toContain('on');
    });

    it('shows milestone tracking as off when disabled in config', async () => {
      mockedGetConfig.mockReturnValue(buildDefaultConfig({ milestone_tracking: false }) as any);

      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      const milestoneRow = tableCall.find((row) => row[0] === 'Milestone tracking');
      expect(milestoneRow).toBeDefined();
      expect(milestoneRow![1]).toContain('red');
      expect(milestoneRow![1]).toContain('off');
    });

    it('shows auto sync as on when enabled in config', async () => {
      mockedGetConfig.mockReturnValue(buildDefaultConfig({ auto_sync: true }) as any);

      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      const syncRow = tableCall.find((row) => row[0] === 'Auto sync');
      expect(syncRow).toBeDefined();
      expect(syncRow![1]).toContain('green');
      expect(syncRow![1]).toContain('on');
    });

    it('shows auto sync as off when disabled in config', async () => {
      mockedGetConfig.mockReturnValue(buildDefaultConfig({ auto_sync: false }) as any);

      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      const syncRow = tableCall.find((row) => row[0] === 'Auto sync');
      expect(syncRow).toBeDefined();
      expect(syncRow![1]).toContain('red');
      expect(syncRow![1]).toContain('off');
    });

    it('shows sync interval from config', async () => {
      mockedGetConfig.mockReturnValue(buildDefaultConfig({ sync_interval_hours: 12 }) as any);

      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      const intervalRow = tableCall.find((row) => row[0] === 'Sync interval');
      expect(intervalRow).toBeDefined();
      expect(intervalRow![1]).toBe('12h');
    });

    it('shows last sync time when available', async () => {
      const lastSync = '2026-02-14T08:30:00Z';
      mockedGetConfig.mockReturnValue(buildDefaultConfig({ last_sync_at: lastSync }) as any);

      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      const lastSyncRow = tableCall.find((row) => row[0] === 'Last sync');
      expect(lastSyncRow).toBeDefined();
      expect(lastSyncRow![1]).toBe(lastSync);
    });

    it('shows "never" dimmed when last_sync_at is null', async () => {
      mockedGetConfig.mockReturnValue(buildDefaultConfig({ last_sync_at: null }) as any);

      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      const lastSyncRow = tableCall.find((row) => row[0] === 'Last sync');
      expect(lastSyncRow).toBeDefined();
      expect(lastSyncRow![1]).toContain('dim');
      expect(lastSyncRow![1]).toContain('never');
    });

    it('shows logged-in user email when authenticated', async () => {
      mockedGetConfig.mockReturnValue(
        buildDefaultConfig({ auth: { user: { email: 'dev@company.com' } } }) as any,
      );

      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      const loggedInRow = tableCall.find((row) => row[0] === 'Logged in');
      expect(loggedInRow).toBeDefined();
      expect(loggedInRow![1]).toContain('green');
      expect(loggedInRow![1]).toContain('dev@company.com');
    });

    it('shows "no" dimmed when not authenticated', async () => {
      mockedGetConfig.mockReturnValue(buildDefaultConfig({ auth: null }) as any);

      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      const loggedInRow = tableCall.find((row) => row[0] === 'Logged in');
      expect(loggedInRow).toBeDefined();
      expect(loggedInRow![1]).toContain('dim');
      expect(loggedInRow![1]).toContain('no');
    });

    it('passes exactly 5 rows to the table display', async () => {
      await runCommand([]);

      const tableCall = mockedTable.mock.calls[0]![0] as string[][];
      expect(tableCall).toHaveLength(5);
    });
  });

  describe('flag priority (negation wins over positive)', () => {
    it('--no-sync takes priority over --sync because it is checked first', async () => {
      await runCommand(['--no-sync', '--sync']);

      expect(mockedUpdateConfig).toHaveBeenCalledWith({ auto_sync: false });
      expect(mockedUpdateConfig).not.toHaveBeenCalledWith({ auto_sync: true });
    });

    it('--no-milestones takes priority over --milestones because it is checked first', async () => {
      await runCommand(['--no-milestones', '--milestones']);

      expect(mockedUpdateConfig).toHaveBeenCalledWith({ milestone_tracking: false });
      expect(mockedUpdateConfig).not.toHaveBeenCalledWith({ milestone_tracking: true });
    });
  });

  describe('getConfig is always called', () => {
    it('calls getConfig even when flags are provided', async () => {
      await runCommand(['--sync']);

      expect(mockedGetConfig).toHaveBeenCalled();
    });

    it('calls getConfig when no flags are provided', async () => {
      await runCommand([]);

      expect(mockedGetConfig).toHaveBeenCalled();
    });
  });
});