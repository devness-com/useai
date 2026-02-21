import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@useai/shared/utils', () => ({
  readJson: vi.fn(),
}));

vi.mock('@useai/shared/constants', () => ({
  SESSIONS_FILE: '/mock/path/sessions.json',
  MILESTONES_FILE: '/mock/path/milestones.json',
}));

vi.mock('../services/config.service.js', () => ({
  getConfig: vi.fn(),
}));

import { exportCommand } from './export';
import { readJson } from '@useai/shared/utils';
import { SESSIONS_FILE, MILESTONES_FILE } from '@useai/shared/constants';
import { getConfig } from '../services/config.service.js';

const mockReadJson = vi.mocked(readJson);
const mockGetConfig = vi.mocked(getConfig);

/**
 * Helper to invoke the Commander action handler.
 * Commander's .action() is a setter, not an invoker.
 * We use parseAsync with exitOverride to safely trigger the handler.
 */
async function runExportAction() {
  exportCommand.exitOverride();
  await exportCommand.parseAsync([], { from: 'user' });
}

describe('exportCommand', () => {
  let stdoutWriteSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    stdoutWriteSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-15T10:30:00.000Z'));
  });

  afterEach(() => {
    stdoutWriteSpy.mockRestore();
    vi.useRealTimers();
  });

  describe('command metadata', () => {
    it('has the name "export"', () => {
      expect(exportCommand.name()).toBe('export');
    });

    it('has a description about exporting data as JSON', () => {
      expect(exportCommand.description()).toBe('Export all local data as JSON to stdout');
    });
  });

  describe('action — JSON structure output', () => {
    it('outputs valid JSON with config, sessions, milestones, and exported_at', async () => {
      const mockConfig = { userId: 'user-123', aiTool: 'claude-code' };
      const mockSessions = [
        {
          id: 'sess-001',
          startedAt: '2026-02-14T09:00:00.000Z',
          endedAt: '2026-02-14T10:00:00.000Z',
          taskType: 'coding',
          languages: ['typescript'],
        },
      ];
      const mockMilestones = [
        {
          id: 'ms-001',
          title: 'Implemented authentication system',
          category: 'feature',
          complexity: 'medium',
          sessionId: 'sess-001',
        },
      ];

      mockGetConfig.mockReturnValue(mockConfig as any);
      mockReadJson.mockImplementation((filePath: string) => {
        if (filePath === SESSIONS_FILE) return mockSessions;
        if (filePath === MILESTONES_FILE) return mockMilestones;
        return [];
      });

      await runExportAction();

      expect(stdoutWriteSpy).toHaveBeenCalledOnce();
      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed).toEqual({
        exported_at: '2026-02-15T10:30:00.000Z',
        config: mockConfig,
        sessions: mockSessions,
        milestones: mockMilestones,
      });
    });

    it('includes exported_at as a valid ISO 8601 timestamp', async () => {
      mockGetConfig.mockReturnValue({} as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);
      const exportedDate = new Date(parsed.exported_at);

      expect(exportedDate.toISOString()).toBe(parsed.exported_at);
      expect(parsed.exported_at).toBe('2026-02-15T10:30:00.000Z');
    });

    it('outputs pretty-printed JSON with 2-space indentation', async () => {
      mockGetConfig.mockReturnValue({ userId: 'user-456' } as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      expect(output).toContain('\n');
      expect(output).toContain('  "exported_at"');
      expect(output).toContain('  "config"');
    });

    it('appends a trailing newline after the JSON output', async () => {
      mockGetConfig.mockReturnValue({} as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      expect(output.endsWith('\n')).toBe(true);
    });

    it('writes output to stdout via process.stdout.write', async () => {
      mockGetConfig.mockReturnValue({} as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      expect(stdoutWriteSpy).toHaveBeenCalledOnce();
      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe('data fetching', () => {
    it('reads sessions from SESSIONS_FILE with empty array default', async () => {
      mockGetConfig.mockReturnValue({} as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      expect(mockReadJson).toHaveBeenCalledWith(SESSIONS_FILE, []);
    });

    it('reads milestones from MILESTONES_FILE with empty array default', async () => {
      mockGetConfig.mockReturnValue({} as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      expect(mockReadJson).toHaveBeenCalledWith(MILESTONES_FILE, []);
    });

    it('calls getConfig to retrieve configuration', async () => {
      mockGetConfig.mockReturnValue({ userId: 'user-789' } as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      expect(mockGetConfig).toHaveBeenCalledOnce();
    });
  });

  describe('edge cases', () => {
    it('handles empty sessions and milestones gracefully', async () => {
      mockGetConfig.mockReturnValue({ userId: 'user-empty' } as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.sessions).toEqual([]);
      expect(parsed.milestones).toEqual([]);
    });

    it('handles large datasets with many sessions and milestones', async () => {
      const manySessions = Array.from({ length: 50 }, (_, i) => ({
        id: `sess-${String(i).padStart(3, '0')}`,
        startedAt: `2026-01-${String((i % 28) + 1).padStart(2, '0')}T09:00:00.000Z`,
        taskType: 'coding',
      }));
      const manyMilestones = Array.from({ length: 30 }, (_, i) => ({
        id: `ms-${String(i).padStart(3, '0')}`,
        title: `Milestone ${i}`,
        category: 'feature',
      }));

      mockGetConfig.mockReturnValue({ userId: 'user-bulk' } as any);
      mockReadJson.mockImplementation((filePath: string) => {
        if (filePath === SESSIONS_FILE) return manySessions;
        if (filePath === MILESTONES_FILE) return manyMilestones;
        return [];
      });

      await runExportAction();

      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.sessions).toHaveLength(50);
      expect(parsed.milestones).toHaveLength(30);
      expect(parsed.sessions[0].id).toBe('sess-000');
      expect(parsed.milestones[29].id).toBe('ms-029');
    });

    it('preserves config shape exactly as returned by getConfig', async () => {
      const complexConfig = {
        userId: 'user-complex',
        aiTool: 'claude-code',
        syncEnabled: true,
        preferences: {
          theme: 'dark',
          notifications: false,
        },
      };
      mockGetConfig.mockReturnValue(complexConfig as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.config).toEqual(complexConfig);
    });

    it('outputs all four top-level keys in the correct order', async () => {
      mockGetConfig.mockReturnValue({} as any);
      mockReadJson.mockReturnValue([]);

      await runExportAction();

      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);
      const keys = Object.keys(parsed);

      expect(keys).toEqual(['exported_at', 'config', 'sessions', 'milestones']);
    });

    it('uses the current time for exported_at, not a cached value', async () => {
      mockGetConfig.mockReturnValue({} as any);
      mockReadJson.mockReturnValue([]);

      vi.setSystemTime(new Date('2026-06-01T00:00:00.000Z'));
      await runExportAction();

      const output = stdoutWriteSpy.mock.calls[0]![0] as string;
      const parsed = JSON.parse(output);

      expect(parsed.exported_at).toBe('2026-06-01T00:00:00.000Z');
    });
  });
});