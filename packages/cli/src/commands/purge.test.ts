import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';

// Mock node:fs before importing the module under test
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  rmSync: vi.fn(),
}));

// Mock node:readline before importing
vi.mock('node:readline', () => ({
  createInterface: vi.fn(),
}));

// Mock @useai/shared/constants
vi.mock('@useai/shared/constants', () => ({
  USEAI_DIR: '/home/testuser/.useai',
}));

// Mock the display utilities
vi.mock('../utils/display.js', () => ({
  error: vi.fn((msg: string) => `[ERROR] ${msg}`),
  success: vi.fn((msg: string) => `[SUCCESS] ${msg}`),
  info: vi.fn((msg: string) => `[INFO] ${msg}`),
}));

import { existsSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Command } from 'commander';

const mockExistsSync = vi.mocked(existsSync);
const mockRmSync = vi.mocked(rmSync);
const mockCreateInterface = vi.mocked(createInterface);

function createMockReadline(userInput: string) {
  const rl = new EventEmitter() as EventEmitter & {
    question: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
  };
  rl.question = vi.fn((_prompt: string, cb: (answer: string) => void) => {
    cb(userInput);
  });
  rl.close = vi.fn();
  return rl;
}

/**
 * Import a fresh purgeCommand for each test to avoid Commander singleton state leaking
 * between tests (e.g., --yes flag persisting across parseAsync calls).
 */
async function getFreshPurgeCommand(): Promise<Command> {
  // Reset the module cache so we get a fresh Command instance
  vi.resetModules();
  // Re-apply mocks after reset
  vi.doMock('node:fs', () => ({
    existsSync: mockExistsSync,
    rmSync: mockRmSync,
  }));
  vi.doMock('node:readline', () => ({
    createInterface: mockCreateInterface,
  }));
  vi.doMock('@useai/shared/constants', () => ({
    USEAI_DIR: '/home/testuser/.useai',
  }));
  vi.doMock('../utils/display.js', () => ({
    error: vi.fn((msg: string) => `[ERROR] ${msg}`),
    success: vi.fn((msg: string) => `[SUCCESS] ${msg}`),
    info: vi.fn((msg: string) => `[INFO] ${msg}`),
  }));
  const mod = await import('./purge');
  return mod.purgeCommand;
}

async function runPurgeCommand(args: string[] = []) {
  const cmd = await getFreshPurgeCommand();
  return cmd.parseAsync(['node', 'purge', ...args]);
}

describe('purgeCommand', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('when no data directory exists', () => {
    it('exits early with informational message', async () => {
      mockExistsSync.mockReturnValue(false);

      await runPurgeCommand();

      expect(mockExistsSync).toHaveBeenCalledWith('/home/testuser/.useai');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('No useai data directory found')
      );
      expect(mockRmSync).not.toHaveBeenCalled();
    });

    it('does not prompt the user for confirmation', async () => {
      mockExistsSync.mockReturnValue(false);

      await runPurgeCommand();

      expect(mockCreateInterface).not.toHaveBeenCalled();
    });
  });

  describe('with --yes flag', () => {
    it('skips confirmation and deletes the data directory', async () => {
      mockExistsSync.mockReturnValue(true);

      await runPurgeCommand(['--yes']);

      expect(mockCreateInterface).not.toHaveBeenCalled();
      expect(mockRmSync).toHaveBeenCalledWith('/home/testuser/.useai', {
        recursive: true,
        force: true,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('All local useai data has been deleted')
      );
    });

    it('accepts the -y short flag', async () => {
      mockExistsSync.mockReturnValue(true);

      await runPurgeCommand(['-y']);

      expect(mockCreateInterface).not.toHaveBeenCalled();
      expect(mockRmSync).toHaveBeenCalledWith('/home/testuser/.useai', {
        recursive: true,
        force: true,
      });
    });
  });

  describe('interactive confirmation prompt', () => {
    it('deletes the data directory when user types "yes"', async () => {
      mockExistsSync.mockReturnValue(true);
      const mockRl = createMockReadline('yes');
      mockCreateInterface.mockReturnValue(mockRl as any);

      await runPurgeCommand();

      expect(mockCreateInterface).toHaveBeenCalledWith(
        expect.objectContaining({
          input: process.stdin,
          output: process.stderr,
        })
      );
      expect(mockRl.question).toHaveBeenCalledWith(
        '  Type "yes" to confirm: ',
        expect.any(Function)
      );
      expect(mockRl.close).toHaveBeenCalled();
      expect(mockRmSync).toHaveBeenCalledWith('/home/testuser/.useai', {
        recursive: true,
        force: true,
      });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('All local useai data has been deleted')
      );
    });

    it('accepts "YES" (case-insensitive)', async () => {
      mockExistsSync.mockReturnValue(true);
      const mockRl = createMockReadline('YES');
      mockCreateInterface.mockReturnValue(mockRl as any);

      await runPurgeCommand();

      expect(mockRmSync).toHaveBeenCalledWith('/home/testuser/.useai', {
        recursive: true,
        force: true,
      });
    });

    it('accepts " yes " (with whitespace)', async () => {
      mockExistsSync.mockReturnValue(true);
      const mockRl = createMockReadline('  yes  ');
      mockCreateInterface.mockReturnValue(mockRl as any);

      await runPurgeCommand();

      expect(mockRmSync).toHaveBeenCalledWith('/home/testuser/.useai', {
        recursive: true,
        force: true,
      });
    });

    it('cancels purge when user types "no"', async () => {
      mockExistsSync.mockReturnValue(true);
      const mockRl = createMockReadline('no');
      mockCreateInterface.mockReturnValue(mockRl as any);

      await runPurgeCommand();

      expect(mockRl.close).toHaveBeenCalled();
      expect(mockRmSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Purge cancelled')
      );
    });

    it('cancels purge when user types anything other than "yes"', async () => {
      mockExistsSync.mockReturnValue(true);
      const mockRl = createMockReadline('maybe');
      mockCreateInterface.mockReturnValue(mockRl as any);

      await runPurgeCommand();

      expect(mockRmSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Purge cancelled')
      );
    });

    it('cancels purge when user presses enter with empty input', async () => {
      mockExistsSync.mockReturnValue(true);
      const mockRl = createMockReadline('');
      mockCreateInterface.mockReturnValue(mockRl as any);

      await runPurgeCommand();

      expect(mockRmSync).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Purge cancelled')
      );
    });

    it('displays a warning message before prompting', async () => {
      mockExistsSync.mockReturnValue(true);
      const mockRl = createMockReadline('no');
      mockCreateInterface.mockReturnValue(mockRl as any);

      await runPurgeCommand();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'This will permanently delete all data in /home/testuser/.useai'
        )
      );
    });
  });

  describe('rmSync call correctness', () => {
    it('passes the exact USEAI_DIR path to rmSync', async () => {
      mockExistsSync.mockReturnValue(true);

      await runPurgeCommand(['--yes']);

      const [path] = mockRmSync.mock.calls[0]!;
      expect(path).toBe('/home/testuser/.useai');
    });

    it('uses recursive and force options for complete removal', async () => {
      mockExistsSync.mockReturnValue(true);

      await runPurgeCommand(['--yes']);

      const [, options] = mockRmSync.mock.calls[0]!;
      expect(options).toEqual({ recursive: true, force: true });
    });
  });
});