import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../services/stats.service.js', () => ({
  getStats: vi.fn(),
}));

vi.mock('../utils/display.js', () => ({
  header: vi.fn((text: string) => `=== ${text} ===`),
  table: vi.fn((rows: string[][]) => rows.map((r) => r.join(' | ')).join('\n')),
  info: vi.fn((text: string) => `ℹ ${text}`),
}));

vi.mock('@useai/shared/utils', () => ({
  formatDuration: vi.fn((seconds: number) => {
    if (seconds === 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.join(' ');
  }),
}));

vi.mock('chalk', () => {
  const bold = (s: string) => s;
  return { default: { bold } };
});

import { getStats } from '../services/stats.service.js';
import { header, table, info } from '../utils/display.js';

const mockedGetStats = vi.mocked(getStats);

function makeStats(overrides: Record<string, unknown> = {}) {
  return {
    totalSessions: 5,
    totalHours: 2.5,
    currentStreak: 3,
    byClient: {} as Record<string, number>,
    byLanguage: {} as Record<string, number>,
    byTaskType: {} as Record<string, number>,
    ...overrides,
  };
}

describe('statsCommand', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function runCommand() {
    const { statsCommand } = await import('./stats.js');
    await statsCommand.parseAsync([], { from: 'user' });
  }

  describe('empty sessions early return', () => {
    it('prints info message and returns when totalSessions is 0', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({ totalSessions: 0 }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(info).toHaveBeenCalledWith('No sessions recorded yet.');
      expect(console.log).toHaveBeenCalledWith('ℹ No sessions recorded yet.');
      expect(header).not.toHaveBeenCalled();
      expect(table).not.toHaveBeenCalled();
    });
  });

  describe('stats table output', () => {
    it('renders the main stats header and summary table', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          totalSessions: 12,
          totalHours: 3.5,
          currentStreak: 7,
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(header).toHaveBeenCalledWith('AI Development Stats');
      const tableCall = vi.mocked(table).mock.calls[0]![0] as string[][];
      expect(tableCall).toHaveLength(3);
      expect(tableCall[0]![0]).toBe('Total time');
      expect(tableCall[1]![0]).toBe('Sessions');
      expect(tableCall[1]![1]).toContain('12');
      expect(tableCall[2]![0]).toBe('Current streak');
      expect(tableCall[2]![1]).toContain('7');
      expect(tableCall[2]![1]).toContain('days');
    });

    it('uses singular "day" when currentStreak is 1', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({ currentStreak: 1 }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      const tableCall = vi.mocked(table).mock.calls[0]![0] as string[][];
      const streakCell = tableCall[2]![1]!;
      expect(streakCell).toContain('1 day');
      expect(streakCell).not.toContain('days');
    });

    it('uses plural "days" when currentStreak is not 1', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({ currentStreak: 0 }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      const tableCall = vi.mocked(table).mock.calls[0]![0] as string[][];
      const streakCell = tableCall[2]![1]!;
      expect(streakCell).toContain('0 days');
    });

    it('rounds totalHours to seconds correctly for formatDuration', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({ totalHours: 1.25 }) as ReturnType<typeof getStats>,
      );

      const { formatDuration } = await import('@useai/shared/utils');

      await runCommand();

      expect(formatDuration).toHaveBeenCalledWith(4500);
    });
  });

  describe('byClient section', () => {
    it('renders "By Client" section when byClient has entries', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          byClient: { 'claude-code': 7200, cursor: 3600 },
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(header).toHaveBeenCalledWith('By Client');
      const tableCalls = vi.mocked(table).mock.calls;
      const clientTable = tableCalls[1]![0] as string[][];
      expect(clientTable).toHaveLength(2);
      expect(clientTable[0]![0]).toBe('claude-code');
      expect(clientTable[1]![0]).toBe('cursor');
    });

    it('does not render "By Client" section when byClient is empty', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({ byClient: {} }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(header).not.toHaveBeenCalledWith('By Client');
    });
  });

  describe('byLanguage section', () => {
    it('renders "By Language" section when byLanguage has entries', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          byLanguage: { typescript: 5400, python: 1800, rust: 900 },
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(header).toHaveBeenCalledWith('By Language');
      const tableCalls = vi.mocked(table).mock.calls;
      const langTableIdx = tableCalls.findIndex((call) => {
        const rows = call[0] as string[][];
        return rows.some((row) => row[0] === 'typescript');
      });
      expect(langTableIdx).toBeGreaterThan(0);
      const langTable = tableCalls[langTableIdx]![0] as string[][];
      expect(langTable[0]![0]).toBe('typescript');
      expect(langTable[1]![0]).toBe('python');
      expect(langTable[2]![0]).toBe('rust');
    });

    it('does not render "By Language" section when byLanguage is empty', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({ byLanguage: {} }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(header).not.toHaveBeenCalledWith('By Language');
    });
  });

  describe('byTaskType section', () => {
    it('renders "By Task Type" section when byTaskType has entries', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          byTaskType: { coding: 4000, debugging: 2000, reviewing: 1000 },
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(header).toHaveBeenCalledWith('By Task Type');
      const tableCalls = vi.mocked(table).mock.calls;
      const taskTableIdx = tableCalls.findIndex((call) => {
        const rows = call[0] as string[][];
        return rows.some((row) => row[0] === 'coding');
      });
      expect(taskTableIdx).toBeGreaterThan(0);
      const taskTable = tableCalls[taskTableIdx]![0] as string[][];
      expect(taskTable[0]![0]).toBe('coding');
      expect(taskTable[1]![0]).toBe('debugging');
      expect(taskTable[2]![0]).toBe('reviewing');
    });

    it('does not render "By Task Type" section when byTaskType is empty', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({ byTaskType: {} }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(header).not.toHaveBeenCalledWith('By Task Type');
    });
  });

  describe('all sections populated together', () => {
    it('renders all optional sections when all have data', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          totalSessions: 20,
          totalHours: 10,
          currentStreak: 5,
          byClient: { 'claude-code': 18000, vscode: 9000 },
          byLanguage: { typescript: 14400, go: 7200 },
          byTaskType: { coding: 10800, testing: 5400 },
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(header).toHaveBeenCalledWith('AI Development Stats');
      expect(header).toHaveBeenCalledWith('By Client');
      expect(header).toHaveBeenCalledWith('By Language');
      expect(header).toHaveBeenCalledWith('By Task Type');
      expect(table).toHaveBeenCalledTimes(4);

      const logCalls = logSpy.mock.calls;
      const lastCallArg = logCalls[logCalls.length - 1]![0];
      expect(lastCallArg).toBe('');
    });

    it('renders only summary when all optional sections are empty', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          totalSessions: 1,
          byClient: {},
          byLanguage: {},
          byTaskType: {},
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      expect(header).toHaveBeenCalledWith('AI Development Stats');
      expect(header).toHaveBeenCalledTimes(1);
      expect(table).toHaveBeenCalledTimes(1);
    });
  });

  describe('sorting behavior', () => {
    it('sorts byClient entries by seconds descending', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          byClient: { smallest: 100, largest: 9999, middle: 5000 },
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      const tableCalls = vi.mocked(table).mock.calls;
      const clientTable = tableCalls[1]![0] as string[][];
      expect(clientTable.map((r) => r[0])).toEqual(['largest', 'middle', 'smallest']);
    });

    it('sorts byLanguage entries by seconds descending', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          byLanguage: { ruby: 100, typescript: 9000, python: 4500 },
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      const tableCalls = vi.mocked(table).mock.calls;
      const langTable = tableCalls[1]![0] as string[][];
      expect(langTable.map((r) => r[0])).toEqual(['typescript', 'python', 'ruby']);
    });

    it('sorts byTaskType entries by seconds descending', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          byTaskType: { reviewing: 500, coding: 8000, debugging: 3000 },
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      const tableCalls = vi.mocked(table).mock.calls;
      const taskTable = tableCalls[1]![0] as string[][];
      expect(taskTable.map((r) => r[0])).toEqual(['coding', 'debugging', 'reviewing']);
    });
  });

  describe('single entry sections', () => {
    it('renders a section with a single entry correctly', async () => {
      mockedGetStats.mockReturnValue(
        makeStats({
          byClient: { 'claude-code': 3600 },
          byLanguage: { typescript: 1800 },
          byTaskType: { coding: 900 },
        }) as ReturnType<typeof getStats>,
      );

      await runCommand();

      const tableCalls = vi.mocked(table).mock.calls;
      expect(tableCalls).toHaveLength(4);

      const clientTable = tableCalls[1]![0] as string[][];
      expect(clientTable).toHaveLength(1);
      expect(clientTable[0]![0]).toBe('claude-code');

      const langTable = tableCalls[2]![0] as string[][];
      expect(langTable).toHaveLength(1);
      expect(langTable[0]![0]).toBe('typescript');

      const taskTable = tableCalls[3]![0] as string[][];
      expect(taskTable).toHaveLength(1);
      expect(taskTable[0]![0]).toBe('coding');
    });
  });
});