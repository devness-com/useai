import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getStats } from './stats.service';

vi.mock('@useai/shared/utils', () => ({
  readJson: vi.fn(),
}));

vi.mock('@useai/shared/constants', () => ({
  SESSIONS_FILE: '/mock/sessions.json',
}));

import { readJson } from '@useai/shared/utils';

const mockReadJson = vi.mocked(readJson);

function makeSession(overrides: {
  duration_seconds: number;
  client: string;
  languages: string[];
  task_type: string;
  started_at: string;
}) {
  return {
    session_id: `sess-${Math.random().toString(36).slice(2, 8)}`,
    duration_seconds: overrides.duration_seconds,
    client: overrides.client,
    languages: overrides.languages,
    task_type: overrides.task_type,
    started_at: overrides.started_at,
    ended_at: overrides.started_at,
    files_touched_count: 0,
    milestones: [],
  };
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateStr(d) + 'T10:00:00.000Z';
}

describe('getStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('totalHours and totalSessions', () => {
    it('returns zero totals when there are no sessions', () => {
      mockReadJson.mockReturnValue([]);

      const result = getStats();

      expect(result.totalHours).toBe(0);
      expect(result.totalSessions).toBe(0);
      expect(result.byClient).toEqual({});
      expect(result.byLanguage).toEqual({});
      expect(result.byTaskType).toEqual({});
      expect(result.currentStreak).toBe(0);
    });

    it('calculates totalHours by converting seconds to hours', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 1800,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
      ]);

      const result = getStats();

      expect(result.totalHours).toBe(1.5);
      expect(result.totalSessions).toBe(2);
    });

    it('handles fractional hours correctly', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 900,
          client: 'vscode',
          languages: ['python'],
          task_type: 'debugging',
          started_at: daysAgo(0),
        }),
      ]);

      const result = getStats();

      expect(result.totalHours).toBe(0.25);
      expect(result.totalSessions).toBe(1);
    });
  });

  describe('byClient grouping', () => {
    it('groups duration seconds by client name', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 1800,
          client: 'cursor',
          languages: ['javascript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 2400,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'review',
          started_at: daysAgo(0),
        }),
      ]);

      const result = getStats();

      expect(result.byClient).toEqual({
        'claude-code': 6000,
        cursor: 1800,
      });
    });
  });

  describe('byLanguage grouping', () => {
    it('groups duration seconds by each language in the session', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript', 'javascript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 1800,
          client: 'claude-code',
          languages: ['python'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
      ]);

      const result = getStats();

      expect(result.byLanguage).toEqual({
        typescript: 3600,
        javascript: 3600,
        python: 1800,
      });
    });

    it('accumulates time across sessions for the same language', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 1200,
          client: 'cursor',
          languages: ['typescript'],
          task_type: 'debugging',
          started_at: daysAgo(0),
        }),
      ]);

      const result = getStats();

      expect(result.byLanguage).toEqual({
        typescript: 4800,
      });
    });

    it('handles sessions with no languages as empty', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: [],
          task_type: 'planning',
          started_at: daysAgo(0),
        }),
      ]);

      const result = getStats();

      expect(result.byLanguage).toEqual({});
    });
  });

  describe('byTaskType grouping', () => {
    it('groups duration seconds by task type', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 1800,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'debugging',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 900,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
      ]);

      const result = getStats();

      expect(result.byTaskType).toEqual({
        coding: 4500,
        debugging: 1800,
      });
    });
  });

  describe('calculateStreak', () => {
    it('returns streak of 1 when only today has sessions', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
      ]);

      const result = getStats();

      expect(result.currentStreak).toBe(1);
    });

    it('returns streak of 1 when only yesterday has sessions', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(1),
        }),
      ]);

      const result = getStats();

      expect(result.currentStreak).toBe(1);
    });

    it('counts consecutive days correctly for a multi-day streak', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 1800,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(1),
        }),
        makeSession({
          duration_seconds: 2400,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(2),
        }),
      ]);

      const result = getStats();

      expect(result.currentStreak).toBe(3);
    });

    it('breaks the streak when there is a gap in dates', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 1800,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(1),
        }),
        // Gap: day 2 is missing
        makeSession({
          duration_seconds: 2400,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(3),
        }),
      ]);

      const result = getStats();

      expect(result.currentStreak).toBe(2);
    });

    it('returns 0 when the most recent session is older than yesterday', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(5),
        }),
        makeSession({
          duration_seconds: 1800,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: daysAgo(6),
        }),
      ]);

      const result = getStats();

      expect(result.currentStreak).toBe(0);
    });

    it('counts multiple sessions on the same day as one streak day', () => {
      const todayStr = toDateStr(new Date());
      const yesterdayStr = toDateStr(new Date(Date.now() - 86400000));

      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 3600,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'coding',
          started_at: todayStr + 'T09:00:00.000Z',
        }),
        makeSession({
          duration_seconds: 1800,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'review',
          started_at: todayStr + 'T14:00:00.000Z',
        }),
        makeSession({
          duration_seconds: 2400,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'debugging',
          started_at: yesterdayStr + 'T10:00:00.000Z',
        }),
      ]);

      const result = getStats();

      expect(result.currentStreak).toBe(2);
    });

    it('handles a long streak starting from yesterday', () => {
      const sessions = [];
      for (let i = 1; i <= 7; i++) {
        sessions.push(
          makeSession({
            duration_seconds: 3600,
            client: 'claude-code',
            languages: ['typescript'],
            task_type: 'coding',
            started_at: daysAgo(i),
          }),
        );
      }
      mockReadJson.mockReturnValue(sessions);

      const result = getStats();

      expect(result.currentStreak).toBe(7);
    });

    it('returns 0 for empty sessions', () => {
      mockReadJson.mockReturnValue([]);

      const result = getStats();

      expect(result.currentStreak).toBe(0);
    });
  });

  describe('integration of all aggregations', () => {
    it('correctly computes all fields together for a realistic dataset', () => {
      mockReadJson.mockReturnValue([
        makeSession({
          duration_seconds: 7200,
          client: 'claude-code',
          languages: ['typescript', 'sql'],
          task_type: 'feature-development',
          started_at: daysAgo(0),
        }),
        makeSession({
          duration_seconds: 3600,
          client: 'cursor',
          languages: ['python', 'sql'],
          task_type: 'data-analysis',
          started_at: daysAgo(1),
        }),
        makeSession({
          duration_seconds: 1800,
          client: 'claude-code',
          languages: ['typescript'],
          task_type: 'code-review',
          started_at: daysAgo(2),
        }),
      ]);

      const result = getStats();

      expect(result.totalHours).toBe(12600 / 3600);
      expect(result.totalSessions).toBe(3);
      expect(result.byClient).toEqual({
        'claude-code': 9000,
        cursor: 3600,
      });
      expect(result.byLanguage).toEqual({
        typescript: 9000,
        sql: 10800,
        python: 3600,
      });
      expect(result.byTaskType).toEqual({
        'feature-development': 7200,
        'data-analysis': 3600,
        'code-review': 1800,
      });
      expect(result.currentStreak).toBe(3);
    });
  });
});