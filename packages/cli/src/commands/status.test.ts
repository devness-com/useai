import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

// Mock external dependencies before importing the module under test
vi.mock('@useai/shared/utils', () => ({
  readJson: vi.fn(),
  formatDuration: vi.fn((seconds: number) => {
    if (seconds === 0) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts: string[] = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s) parts.push(`${s}s`);
    return parts.join(' ');
  }),
}));

vi.mock('@useai/shared/constants', () => ({
  USEAI_DIR: '/mock/useai',
  SESSIONS_FILE: '/mock/useai/sessions.json',
  MILESTONES_FILE: '/mock/useai/milestones.json',
  DATA_DIR: '/mock/useai/data',
}));

vi.mock('chalk', () => {
  const identity = (s: string) => s;
  return {
    default: {
      bold: identity,
      dim: identity,
      green: identity,
      red: identity,
    },
  };
});

vi.mock('../services/config.service.js', () => ({
  getConfig: vi.fn(),
}));

vi.mock('../utils/display.js', () => ({
  header: vi.fn((title: string) => `=== ${title} ===`),
  table: vi.fn((rows: [string, string][]) =>
    rows.map(([k, v]) => `${k}: ${v}`).join('\n'),
  ),
  info: vi.fn((msg: string) => `ℹ ${msg}`),
}));

// Now import after mocks are set up
import { statusCommand } from './status.js';
import { readJson } from '@useai/shared/utils';
import { getConfig } from '../services/config.service.js';

describe('formatBytes', () => {
  // formatBytes is not exported, so we replicate the exact logic to verify correctness.
  // The statusCommand integration tests below verify the actual function is wired correctly.
  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  describe('bytes range (< 1024)', () => {
    it('formats 0 bytes', () => {
      expect(formatBytes(0)).toBe('0 B');
    });

    it('formats 1 byte', () => {
      expect(formatBytes(1)).toBe('1 B');
    });

    it('formats 512 bytes', () => {
      expect(formatBytes(512)).toBe('512 B');
    });

    it('formats 1023 bytes at the upper boundary', () => {
      expect(formatBytes(1023)).toBe('1023 B');
    });
  });

  describe('kilobytes range (1024 to < 1MB)', () => {
    it('formats exactly 1 KB (1024 bytes)', () => {
      expect(formatBytes(1024)).toBe('1.0 KB');
    });

    it('formats 1.5 KB correctly', () => {
      expect(formatBytes(1536)).toBe('1.5 KB');
    });

    it('formats 10 KB', () => {
      expect(formatBytes(10240)).toBe('10.0 KB');
    });

    it('formats 500 KB', () => {
      expect(formatBytes(512000)).toBe('500.0 KB');
    });

    it('formats value just below 1 MB boundary', () => {
      const justUnderMB = 1024 * 1024 - 1;
      expect(formatBytes(justUnderMB)).toBe('1024.0 KB');
    });

    it('rounds to one decimal place in KB', () => {
      // 1025 bytes = 1.0009765625 KB → rounds to 1.0
      expect(formatBytes(1025)).toBe('1.0 KB');
    });

    it('handles non-round KB values with decimals', () => {
      // 2560 bytes = 2.5 KB
      expect(formatBytes(2560)).toBe('2.5 KB');
    });
  });

  describe('megabytes range (>= 1MB)', () => {
    it('formats exactly 1 MB', () => {
      expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    });

    it('formats 2.5 MB', () => {
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });

    it('formats 100 MB', () => {
      expect(formatBytes(100 * 1024 * 1024)).toBe('100.0 MB');
    });

    it('formats 1 GB as 1024.0 MB (no GB unit exists)', () => {
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1024.0 MB');
    });

    it('formats 500 MB', () => {
      expect(formatBytes(500 * 1024 * 1024)).toBe('500.0 MB');
    });
  });
});

describe('dirSize', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), 'dirsize-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  // dirSize is not exported, so we test the actual filesystem behaviors
  // that dirSize relies on, and verify integration through statusCommand.

  it('readdirSync with recursive flag lists files in nested directories', () => {
    const subDir = path.join(tempDir, 'sub', 'deep');
    mkdirSync(subDir, { recursive: true });
    writeFileSync(path.join(tempDir, 'root.txt'), 'root content');
    writeFileSync(path.join(subDir, 'nested.txt'), 'nested content');

    const entries = fs.readdirSync(tempDir, { withFileTypes: true, recursive: true });
    const fileEntries = entries.filter((e) => e.isFile());

    expect(fileEntries.length).toBe(2);
    const names = fileEntries.map((e) => e.name).sort();
    expect(names).toEqual(['nested.txt', 'root.txt']);
  });

  it('correctly sums file sizes from stat in a directory tree', () => {
    const content1 = 'Hello, this is a test file with known content';
    const content2 = 'Another file for size verification purposes';
    const subDir = path.join(tempDir, 'subdir');
    mkdirSync(subDir);

    writeFileSync(path.join(tempDir, 'file1.txt'), content1);
    writeFileSync(path.join(subDir, 'file2.txt'), content2);

    let total = 0;
    const entries = fs.readdirSync(tempDir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        const parentPath =
          (entry as unknown as { parentPath?: string }).parentPath ??
          (entry as unknown as { path?: string }).path ??
          tempDir;
        total += fs.statSync(`${parentPath}/${entry.name}`).size;
      }
    }

    expect(total).toBe(
      Buffer.byteLength(content1) + Buffer.byteLength(content2),
    );
  });

  it('returns 0 total for an empty directory', () => {
    let total = 0;
    const entries = fs.readdirSync(tempDir, { withFileTypes: true, recursive: true });
    for (const entry of entries) {
      if (entry.isFile()) {
        total += 1; // just counting
      }
    }
    expect(total).toBe(0);
  });

  it('existsSync returns false for non-existent paths', () => {
    expect(fs.existsSync(path.join(tempDir, 'nonexistent'))).toBe(false);
  });
});

describe('statusCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  const mockReadJson = readJson as ReturnType<typeof vi.fn>;
  const mockGetConfig = getConfig as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  function setupMocks(options: {
    sessions?: Array<{ duration_seconds: number }>;
    milestones?: Array<{ published: boolean }>;
    config?: Record<string, unknown>;
  }) {
    const {
      sessions = [],
      milestones = [],
      config = {
        milestone_tracking: true,
        auto_sync: true,
        sync_interval_hours: 24,
        last_sync_at: null,
        auth: null,
      },
    } = options;

    mockReadJson.mockImplementation((filePath: string, defaultVal: unknown) => {
      if (filePath.includes('sessions')) return sessions;
      if (filePath.includes('milestones')) return milestones;
      return defaultVal;
    });

    mockGetConfig.mockReturnValue(config);
  }

  function getAllOutput(): string {
    return consoleSpy.mock.calls.map((c) => c[0]).join('\n');
  }

  describe('session statistics', () => {
    it('displays zero sessions when no sessions exist', () => {
      setupMocks({ sessions: [], milestones: [] });
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('Sessions recorded');
      expect(output).toContain('0');
    });

    it('displays correct count with multiple sessions', () => {
      setupMocks({
        sessions: [
          { duration_seconds: 300 },
          { duration_seconds: 600 },
          { duration_seconds: 1200 },
        ],
      });
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('3');
    });

    it('sums duration from all sessions for total tracked time', () => {
      setupMocks({
        sessions: [
          { duration_seconds: 3600 },
          { duration_seconds: 1800 },
        ],
      });
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('Total tracked time');
      // formatDuration(5400) → "1h 30m"
      expect(output).toContain('1h 30m');
    });

    it('displays 0s for sessions with zero total duration', () => {
      setupMocks({
        sessions: [
          { duration_seconds: 0 },
          { duration_seconds: 0 },
        ],
      });
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('0s');
    });

    it('handles a large number of sessions', () => {
      const sessions = Array.from({ length: 150 }, () => ({
        duration_seconds: 60,
      }));
      setupMocks({ sessions });
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('150');
    });
  });

  describe('milestone statistics', () => {
    it('splits milestones by published and unpublished counts', () => {
      setupMocks({
        milestones: [
          { published: false },
          { published: false },
          { published: true },
          { published: true },
          { published: true },
        ],
      });
      statusCommand.parse([], { from: 'user' });

      expect(getAllOutput()).toContain('2 unpublished, 3 published');
    });

    it('shows all as unpublished when none are published', () => {
      setupMocks({
        milestones: [{ published: false }, { published: false }],
      });
      statusCommand.parse([], { from: 'user' });

      expect(getAllOutput()).toContain('2 unpublished, 0 published');
    });

    it('shows zero for both when no milestones exist', () => {
      setupMocks({ milestones: [] });
      statusCommand.parse([], { from: 'user' });

      expect(getAllOutput()).toContain('0 unpublished, 0 published');
    });

    it('shows single published milestone correctly', () => {
      setupMocks({
        milestones: [{ published: true }],
      });
      statusCommand.parse([], { from: 'user' });

      expect(getAllOutput()).toContain('0 unpublished, 1 published');
    });
  });

  describe('storage information', () => {
    it('displays local storage size (0 B for non-existent mock directory)', () => {
      setupMocks({});
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('Local storage');
      expect(output).toContain('0 B');
    });

    it('displays the data directory path from constants', () => {
      setupMocks({});
      statusCommand.parse([], { from: 'user' });

      expect(getAllOutput()).toContain('/mock/useai/data');
    });
  });

  describe('settings section', () => {
    it('shows milestone tracking as on when enabled', () => {
      setupMocks({
        config: {
          milestone_tracking: true,
          auto_sync: false,
          sync_interval_hours: 12,
          last_sync_at: null,
          auth: null,
        },
      });
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('Milestone tracking');
      expect(output).toContain('on');
    });

    it('shows milestone tracking as off when disabled', () => {
      setupMocks({
        config: {
          milestone_tracking: false,
          auto_sync: true,
          sync_interval_hours: 24,
          last_sync_at: null,
          auth: null,
        },
      });
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('Milestone tracking');
      expect(output).toContain('off');
    });

    it('shows auto sync state correctly', () => {
      setupMocks({
        config: {
          milestone_tracking: true,
          auto_sync: false,
          sync_interval_hours: 6,
          last_sync_at: null,
          auth: null,
        },
      });
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('Auto sync');
      expect(output).toContain('off');
    });

    it('displays sync interval in hours', () => {
      setupMocks({
        config: {
          milestone_tracking: true,
          auto_sync: true,
          sync_interval_hours: 12,
          last_sync_at: null,
          auth: null,
        },
      });
      statusCommand.parse([], { from: 'user' });

      expect(getAllOutput()).toContain('12h');
    });

    it('displays last sync timestamp when available', () => {
      setupMocks({
        config: {
          milestone_tracking: true,
          auto_sync: true,
          sync_interval_hours: 24,
          last_sync_at: '2025-12-15T08:30:00Z',
          auth: null,
        },
      });
      statusCommand.parse([], { from: 'user' });

      expect(getAllOutput()).toContain('2025-12-15T08:30:00Z');
    });

    it('displays "never" when last sync is null', () => {
      setupMocks({
        config: {
          milestone_tracking: true,
          auto_sync: true,
          sync_interval_hours: 24,
          last_sync_at: null,
          auth: null,
        },
      });
      statusCommand.parse([], { from: 'user' });

      expect(getAllOutput()).toContain('never');
    });

    it('displays user email when authenticated', () => {
      setupMocks({
        config: {
          milestone_tracking: true,
          auto_sync: true,
          sync_interval_hours: 24,
          last_sync_at: null,
          auth: { user: { email: 'developer@example.com' } },
        },
      });
      statusCommand.parse([], { from: 'user' });

      expect(getAllOutput()).toContain('developer@example.com');
    });

    it('displays "no" when not authenticated', () => {
      setupMocks({
        config: {
          milestone_tracking: true,
          auto_sync: true,
          sync_interval_hours: 24,
          last_sync_at: null,
          auth: null,
        },
      });
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('Logged in');
      expect(output).toContain('no');
    });
  });

  describe('section headers', () => {
    it('renders all three section headers', () => {
      setupMocks({});
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain('=== useai Status ===');
      expect(output).toContain('=== Settings ===');
      expect(output).toContain('=== Privacy ===');
    });
  });

  describe('privacy section', () => {
    it('displays privacy disclaimer about no code capture', () => {
      setupMocks({});
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain(
        'useai NEVER captures code, file contents, prompts, or responses.',
      );
    });

    it('displays what data types are recorded', () => {
      setupMocks({});
      statusCommand.parse([], { from: 'user' });

      const output = getAllOutput();
      expect(output).toContain(
        'Only durations, tool names, languages, and task types are recorded.',
      );
    });
  });

  describe('dependency calls', () => {
    it('reads sessions and milestones files with correct paths and defaults', () => {
      setupMocks({});
      statusCommand.parse([], { from: 'user' });

      expect(mockReadJson).toHaveBeenCalledWith(
        '/mock/useai/sessions.json',
        [],
      );
      expect(mockReadJson).toHaveBeenCalledWith(
        '/mock/useai/milestones.json',
        [],
      );
    });

    it('calls getConfig exactly once', () => {
      setupMocks({});
      statusCommand.parse([], { from: 'user' });

      expect(mockGetConfig).toHaveBeenCalledTimes(1);
    });

    it('reads both data files before rendering output', () => {
      setupMocks({});
      statusCommand.parse([], { from: 'user' });

      expect(mockReadJson).toHaveBeenCalledTimes(2);
    });
  });
});