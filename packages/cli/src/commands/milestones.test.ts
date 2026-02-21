import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@useai/shared/utils', () => ({
  readJson: vi.fn(),
  formatDuration: vi.fn(),
}));

vi.mock('@useai/shared/constants', () => ({
  MILESTONES_FILE: '/mock/path/milestones.json',
}));

vi.mock('../utils/display.js', () => ({
  header: vi.fn((text: string) => `=== ${text} ===`),
  table: vi.fn((rows: [string, string][]) =>
    rows.map(([k, v]) => `    ${k}: ${v}`).join('\n'),
  ),
  info: vi.fn((text: string) => `ℹ ${text}`),
}));

import { milestonesCommand } from './milestones';
import { readJson, formatDuration } from '@useai/shared/utils';
import { MILESTONES_FILE } from '@useai/shared/constants';
import { header, table, info } from '../utils/display.js';

const mockedReadJson = vi.mocked(readJson);
const mockedFormatDuration = vi.mocked(formatDuration);

function makeMilestone(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ms-abc123',
    title: 'Implemented user authentication',
    category: 'feature',
    complexity: 'medium',
    duration_minutes: 45,
    created_at: '2025-12-15T10:30:00Z',
    published: false,
    published_at: null,
    session_id: 'sess-xyz789',
    client: 'claude-code',
    languages: ['typescript', 'python'],
    chain_hash: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6',
    ...overrides,
  };
}

describe('milestonesCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockedFormatDuration.mockImplementation((secs) => `${secs}s`);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('empty milestones early return', () => {
    it('prints info message and returns when no milestones exist', () => {
      mockedReadJson.mockReturnValue([]);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      expect(readJson).toHaveBeenCalledWith(MILESTONES_FILE, []);
      expect(info).toHaveBeenCalledWith('No milestones recorded yet.');
      expect(consoleSpy).toHaveBeenCalledWith('ℹ No milestones recorded yet.');
      expect(header).not.toHaveBeenCalled();
      expect(table).not.toHaveBeenCalled();
    });

    it('does not render any milestone details when list is empty', () => {
      mockedReadJson.mockReturnValue([]);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n');
      expect(allOutput).not.toContain('Category');
      expect(allOutput).not.toContain('Complexity');
    });
  });

  describe('milestone list rendering', () => {
    it('displays the header with the correct milestone count', () => {
      const milestones = [makeMilestone(), makeMilestone({ id: 'ms-def456', title: 'Fixed race condition in worker' })];
      mockedReadJson.mockReturnValue(milestones);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      expect(header).toHaveBeenCalledWith('Milestones (2)');
    });

    it('renders each milestone title as bold text', () => {
      const milestone = makeMilestone({ title: 'Added caching layer for API responses' });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      const titleCalls = consoleSpy.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('Added caching layer for API responses'),
      );
      expect(titleCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "published" status for published milestones', () => {
      const milestone = makeMilestone({ published: true });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      const titleCalls = consoleSpy.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('published'),
      );
      expect(titleCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('shows "local" status for unpublished milestones', () => {
      const milestone = makeMilestone({ published: false });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      const titleCalls = consoleSpy.mock.calls.filter((c) =>
        typeof c[0] === 'string' && c[0].includes('local'),
      );
      expect(titleCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('renders a table with category, complexity, duration, and date for each milestone', () => {
      const milestone = makeMilestone({
        category: 'bugfix',
        complexity: 'complex',
        duration_minutes: 90,
        created_at: '2025-11-20T08:00:00Z',
      });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      expect(table).toHaveBeenCalledWith([
        ['Category', 'bugfix'],
        ['Complexity', 'complex'],
        ['Duration', expect.any(String)],
        ['Date', '2025-11-20'],
      ]);
    });

    it('passes duration in seconds to formatDuration (minutes * 60)', () => {
      const milestone = makeMilestone({ duration_minutes: 30 });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      expect(formatDuration).toHaveBeenCalledWith(1800);
    });

    it('slices created_at to extract the date portion (YYYY-MM-DD)', () => {
      const milestone = makeMilestone({ created_at: '2025-06-01T14:30:00.000Z' });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      expect(table).toHaveBeenCalledWith(
        expect.arrayContaining([['Date', '2025-06-01']]),
      );
    });

    it('renders multiple milestones in order with mixed published statuses', () => {
      const milestones = [
        makeMilestone({ title: 'First milestone', published: true }),
        makeMilestone({ title: 'Second milestone', published: false }),
        makeMilestone({ title: 'Third milestone', published: true }),
      ];
      mockedReadJson.mockReturnValue(milestones);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      expect(table).toHaveBeenCalledTimes(3);

      const allOutput = consoleSpy.mock.calls.map((c) => String(c[0])).join('\n');
      const firstIdx = allOutput.indexOf('First milestone');
      const secondIdx = allOutput.indexOf('Second milestone');
      const thirdIdx = allOutput.indexOf('Third milestone');
      expect(firstIdx).toBeLessThan(secondIdx);
      expect(secondIdx).toBeLessThan(thirdIdx);
    });

    it('does not render verbose fields when --verbose is not set', () => {
      mockedReadJson.mockReturnValue([makeMilestone()]);

      milestonesCommand.parse(['milestones'], { from: 'user' });

      // table should only be called once (for the basic info block)
      expect(table).toHaveBeenCalledTimes(1);

      const tableArgs = vi.mocked(table).mock.calls[0]![0] as [string, string][];
      const tableKeys = tableArgs.map(([k]) => k);
      expect(tableKeys).not.toContain('ID');
      expect(tableKeys).not.toContain('Session');
      expect(tableKeys).not.toContain('Chain hash');
      expect(tableKeys).not.toContain('Languages');
    });
  });

  describe('verbose mode', () => {
    it('renders an additional detail table with ID, session, client, languages, chain hash, and published_at', () => {
      const milestone = makeMilestone({
        id: 'ms-verbose-001',
        session_id: 'sess-verbose-002',
        client: 'claude-code',
        languages: ['typescript', 'rust'],
        chain_hash: 'abcdef1234567890abcdef1234567890',
        published_at: '2025-12-20T12:00:00Z',
      });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones', '--verbose'], { from: 'user' });

      // In verbose mode, table is called twice per milestone: once for basic, once for details
      expect(table).toHaveBeenCalledTimes(2);

      const verboseCall = vi.mocked(table).mock.calls[1]![0] as [string, string][];
      const verboseKeys = verboseCall.map(([k]) => k);
      expect(verboseKeys).toEqual(['ID', 'Session', 'Client', 'Languages', 'Chain hash', 'Published at']);
    });

    it('displays languages joined with comma separator', () => {
      const milestone = makeMilestone({ languages: ['javascript', 'python', 'go'] });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones', '--verbose'], { from: 'user' });

      const verboseCall = vi.mocked(table).mock.calls[1]![0] as [string, string][];
      const languagesRow = verboseCall.find(([k]) => k === 'Languages');
      expect(languagesRow![1]).toBe('javascript, python, go');
    });

    it('shows "none" when languages array is empty', () => {
      const milestone = makeMilestone({ languages: [] });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones', '--verbose'], { from: 'user' });

      const verboseCall = vi.mocked(table).mock.calls[1]![0] as [string, string][];
      const languagesRow = verboseCall.find(([k]) => k === 'Languages');
      expect(languagesRow![1]).toBe('none');
    });

    it('truncates chain_hash to 16 characters with ellipsis', () => {
      const fullHash = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6';
      const milestone = makeMilestone({ chain_hash: fullHash });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones', '--verbose'], { from: 'user' });

      const verboseCall = vi.mocked(table).mock.calls[1]![0] as [string, string][];
      const hashRow = verboseCall.find(([k]) => k === 'Chain hash');
      // The value will be wrapped in chalk.dim, so check the underlying value passed
      // It should contain the first 16 chars of the hash + '...'
      expect(hashRow![1]).toContain(fullHash.slice(0, 16));
      expect(hashRow![1]).toContain('...');
    });

    it('shows published_at date when present', () => {
      const milestone = makeMilestone({ published_at: '2025-12-25T18:00:00Z' });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones', '--verbose'], { from: 'user' });

      const verboseCall = vi.mocked(table).mock.calls[1]![0] as [string, string][];
      const pubRow = verboseCall.find(([k]) => k === 'Published at');
      expect(pubRow![1]).toBe('2025-12-25T18:00:00Z');
    });

    it('shows "n/a" for published_at when milestone is not published', () => {
      const milestone = makeMilestone({ published_at: null });
      mockedReadJson.mockReturnValue([milestone]);

      milestonesCommand.parse(['milestones', '--verbose'], { from: 'user' });

      const verboseCall = vi.mocked(table).mock.calls[1]![0] as [string, string][];
      const pubRow = verboseCall.find(([k]) => k === 'Published at');
      expect(pubRow![1]).toBe('n/a');
    });

    it('renders verbose details for every milestone when multiple are present', () => {
      const milestones = [
        makeMilestone({ id: 'ms-001', title: 'Auth system' }),
        makeMilestone({ id: 'ms-002', title: 'Data pipeline' }),
      ];
      mockedReadJson.mockReturnValue(milestones);

      milestonesCommand.parse(['milestones', '-v'], { from: 'user' });

      // 2 milestones × 2 table calls each = 4 total
      expect(table).toHaveBeenCalledTimes(4);

      // Verify both verbose tables have the ID field
      const verboseCalls = [
        vi.mocked(table).mock.calls[1]![0] as [string, string][],
        vi.mocked(table).mock.calls[3]![0] as [string, string][],
      ];
      for (const call of verboseCalls) {
        const keys = call.map(([k]) => k);
        expect(keys).toContain('ID');
        expect(keys).toContain('Chain hash');
        expect(keys).toContain('Languages');
      }
    });
  });
});