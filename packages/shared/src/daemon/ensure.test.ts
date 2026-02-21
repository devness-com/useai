import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PidFileData } from './ensure.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// Mock node:child_process
vi.mock('node:child_process', () => ({
  spawn: vi.fn(),
}));

// Mock constants
vi.mock('../constants/paths.js', () => ({
  DAEMON_PID_FILE: '/tmp/test-daemon.pid',
  DAEMON_PORT: 9999,
  DAEMON_HEALTH_URL: 'http://127.0.0.1:9999/health',
}));

// Mock resolve-npx
vi.mock('./resolve-npx.js', () => ({
  resolveNpxPath: vi.fn(),
}));

import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { resolveNpxPath } from './resolve-npx.js';
import {
  readPidFile,
  isProcessRunning,
  checkDaemonHealth,
  fetchDaemonHealth,
  killDaemon,
  ensureDaemon,
} from './ensure.js';

const mockExistsSync = vi.mocked(existsSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockUnlinkSync = vi.mocked(unlinkSync);
const mockSpawn = vi.mocked(spawn);
const mockResolveNpxPath = vi.mocked(resolveNpxPath);

function makePidFileData(overrides?: Partial<PidFileData>): PidFileData {
  return {
    pid: 12345,
    port: 9999,
    started_at: '2026-02-15T10:00:00.000Z',
    ...overrides,
  };
}

describe('readPidFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when the PID file does not exist', () => {
    mockExistsSync.mockReturnValue(false);

    const result = readPidFile();

    expect(result).toBeNull();
    expect(mockExistsSync).toHaveBeenCalledWith('/tmp/test-daemon.pid');
    expect(mockReadFileSync).not.toHaveBeenCalled();
  });

  it('returns parsed PID data for a valid JSON file', () => {
    const pidData = makePidFileData();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(pidData));

    const result = readPidFile();

    expect(result).toEqual(pidData);
    expect(mockReadFileSync).toHaveBeenCalledWith('/tmp/test-daemon.pid', 'utf-8');
  });

  it('trims whitespace from file contents before parsing', () => {
    const pidData = makePidFileData({ pid: 55555 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(`  \n${JSON.stringify(pidData)}\n  `);

    const result = readPidFile();

    expect(result).toEqual(pidData);
  });

  it('returns null when file contains invalid JSON', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('not-valid-json{{{');

    const result = readPidFile();

    expect(result).toBeNull();
  });

  it('returns null when readFileSync throws an error', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const result = readPidFile();

    expect(result).toBeNull();
  });

  it('returns null when file is empty', () => {
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue('   ');

    const result = readPidFile();

    expect(result).toBeNull();
  });
});

describe('isProcessRunning', () => {
  let originalKill: typeof process.kill;

  beforeEach(() => {
    originalKill = process.kill;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.kill = originalKill;
  });

  it('returns true when the process exists (kill signal 0 succeeds)', () => {
    process.kill = vi.fn() as unknown as typeof process.kill;

    const result = isProcessRunning(12345);

    expect(result).toBe(true);
    expect(process.kill).toHaveBeenCalledWith(12345, 0);
  });

  it('returns false when the process does not exist (kill signal 0 throws)', () => {
    process.kill = vi.fn().mockImplementation(() => {
      throw new Error('ESRCH: No such process');
    }) as unknown as typeof process.kill;

    const result = isProcessRunning(12345);

    expect(result).toBe(false);
  });

  it('returns false when permission is denied to signal the process', () => {
    process.kill = vi.fn().mockImplementation(() => {
      throw new Error('EPERM: operation not permitted');
    }) as unknown as typeof process.kill;

    const result = isProcessRunning(99999);

    expect(result).toBe(false);
  });
});

describe('checkDaemonHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns true when daemon responds with 200 OK', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('OK', { status: 200 }));

    const result = await checkDaemonHealth();

    expect(result).toBe(true);
    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:9999/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns false when daemon responds with 500 error', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const result = await checkDaemonHealth();

    expect(result).toBe(false);
  });

  it('returns false when daemon responds with 503 Service Unavailable', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Service Unavailable', { status: 503 }));

    const result = await checkDaemonHealth();

    expect(result).toBe(false);
  });

  it('returns false when fetch throws a network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await checkDaemonHealth();

    expect(result).toBe(false);
  });

  it('returns false when the request times out', async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    const result = await checkDaemonHealth();

    expect(result).toBe(false);
  });
});

describe('fetchDaemonHealth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns JSON body when daemon responds with 200 OK', async () => {
    const healthData = { status: 'ok', uptime: 3600, version: '1.2.0' };
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify(healthData), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const result = await fetchDaemonHealth();

    expect(result).toEqual(healthData);
  });

  it('uses the default DAEMON_HEALTH_URL when no port is provided', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );

    await fetchDaemonHealth();

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:9999/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('uses a custom port URL when port is provided', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ status: 'ok' }), { status: 200 }),
    );

    await fetchDaemonHealth(8080);

    expect(fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8080/health',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('returns null when daemon responds with a non-OK status', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('Not Found', { status: 404 }));

    const result = await fetchDaemonHealth();

    expect(result).toBeNull();
  });

  it('returns null when fetch throws a network error', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await fetchDaemonHealth();

    expect(result).toBeNull();
  });

  it('returns null when the request times out', async () => {
    vi.mocked(fetch).mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    const result = await fetchDaemonHealth();

    expect(result).toBeNull();
  });
});

describe('killDaemon', () => {
  let originalKill: typeof process.kill;

  beforeEach(() => {
    originalKill = process.kill;
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    process.kill = originalKill;
    vi.useRealTimers();
  });

  it('does nothing when there is no PID file', async () => {
    mockExistsSync.mockReturnValue(false);
    process.kill = vi.fn() as unknown as typeof process.kill;

    await killDaemon();

    expect(process.kill).not.toHaveBeenCalled();
  });

  it('removes stale PID file when process is not running', async () => {
    const pidData = makePidFileData();
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(pidData));
    process.kill = vi.fn().mockImplementation(() => {
      throw new Error('ESRCH');
    }) as unknown as typeof process.kill;

    await killDaemon();

    expect(mockUnlinkSync).toHaveBeenCalledWith('/tmp/test-daemon.pid');
  });

  it('sends SIGTERM and returns when process exits gracefully', async () => {
    const pidData = makePidFileData({ pid: 42000 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(pidData));

    let killCallCount = 0;
    process.kill = vi.fn().mockImplementation((_pid: number, signal?: string | number) => {
      if (signal === 0) {
        killCallCount++;
        if (killCallCount >= 3) {
          throw new Error('ESRCH');
        }
        return true;
      }
      if (signal === 'SIGTERM') return true;
      return true;
    }) as unknown as typeof process.kill;

    const promise = killDaemon();
    await vi.advanceTimersByTimeAsync(600);
    await promise;

    expect(process.kill).toHaveBeenCalledWith(42000, 'SIGTERM');
  });

  it('sends SIGKILL after 5 seconds if SIGTERM does not stop the process', async () => {
    const pidData = makePidFileData({ pid: 42000 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(pidData));

    process.kill = vi.fn().mockImplementation((_pid: number, signal?: string | number) => {
      if (signal === 'SIGKILL') return true;
      if (signal === 'SIGTERM') return true;
      return true;
    }) as unknown as typeof process.kill;

    const promise = killDaemon();
    await vi.advanceTimersByTimeAsync(6000);
    await promise;

    expect(process.kill).toHaveBeenCalledWith(42000, 'SIGTERM');
    expect(process.kill).toHaveBeenCalledWith(42000, 'SIGKILL');
  });

  it('returns gracefully if SIGTERM throws (e.g., EPERM)', async () => {
    const pidData = makePidFileData({ pid: 42000 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(pidData));

    process.kill = vi.fn().mockImplementation((_pid: number, signal?: string | number) => {
      if (signal === 0) return true;
      if (signal === 'SIGTERM') throw new Error('EPERM');
      return true;
    }) as unknown as typeof process.kill;

    await killDaemon();
  });

  it('cleans up PID file after SIGKILL', async () => {
    const pidData = makePidFileData({ pid: 42000 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(pidData));

    process.kill = vi.fn().mockImplementation(() => true) as unknown as typeof process.kill;

    const promise = killDaemon();
    await vi.advanceTimersByTimeAsync(6000);
    await promise;

    expect(mockUnlinkSync).toHaveBeenCalled();
  });
});

describe('ensureDaemon', () => {
  let originalKill: typeof process.kill;

  beforeEach(() => {
    originalKill = process.kill;
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    process.kill = originalKill;
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('returns true immediately if health check passes on the first try', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('OK', { status: 200 }));

    const result = await ensureDaemon();

    expect(result).toBe(true);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('spawns a new daemon when no PID file exists and health fails', async () => {
    let healthCallCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      healthCallCount++;
      if (healthCallCount <= 1) {
        throw new Error('ECONNREFUSED');
      }
      return new Response('OK', { status: 200 });
    });
    mockExistsSync.mockReturnValue(false);
    mockResolveNpxPath.mockReturnValue('/usr/local/bin/npx');

    const childMock = { unref: vi.fn() };
    mockSpawn.mockReturnValue(childMock as any);

    const promise = ensureDaemon();
    await vi.advanceTimersByTimeAsync(600);
    const result = await promise;

    expect(result).toBe(true);
    expect(mockSpawn).toHaveBeenCalledWith(
      '/usr/local/bin/npx',
      ['-y', '@devness/useai@latest', 'daemon', '--port', '9999'],
      { detached: true, stdio: 'ignore' },
    );
    expect(childMock.unref).toHaveBeenCalled();
  });

  it('kills unhealthy daemon, spawns a new one, and returns true when health recovers', async () => {
    let healthCallCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      healthCallCount++;
      if (healthCallCount <= 2) {
        throw new Error('ECONNREFUSED');
      }
      return new Response('OK', { status: 200 });
    });

    const pidData = makePidFileData({ pid: 77777 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(pidData));

    let killCallCount = 0;
    process.kill = vi.fn().mockImplementation((_pid: number, signal?: string | number) => {
      if (signal === 0) {
        killCallCount++;
        if (killCallCount >= 3) throw new Error('ESRCH');
        return true;
      }
      if (signal === 'SIGTERM') return true;
      return true;
    }) as unknown as typeof process.kill;

    mockResolveNpxPath.mockReturnValue('/usr/local/bin/npx');
    const childMock = { unref: vi.fn() };
    mockSpawn.mockReturnValue(childMock as any);

    const promise = ensureDaemon();
    await vi.advanceTimersByTimeAsync(9000);
    const result = await promise;

    expect(result).toBe(true);
    expect(process.kill).toHaveBeenCalledWith(77777, 'SIGTERM');
    expect(mockSpawn).toHaveBeenCalled();
  });

  it('removes stale PID file when process is not running, then spawns new daemon', async () => {
    let healthCallCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      healthCallCount++;
      if (healthCallCount <= 1) throw new Error('ECONNREFUSED');
      return new Response('OK', { status: 200 });
    });

    const pidData = makePidFileData({ pid: 88888 });
    mockExistsSync.mockReturnValue(true);
    mockReadFileSync.mockReturnValue(JSON.stringify(pidData));

    process.kill = vi.fn().mockImplementation(() => {
      throw new Error('ESRCH');
    }) as unknown as typeof process.kill;

    mockResolveNpxPath.mockReturnValue('/usr/local/bin/npx');
    const childMock = { unref: vi.fn() };
    mockSpawn.mockReturnValue(childMock as any);

    const promise = ensureDaemon();
    await vi.advanceTimersByTimeAsync(600);
    const result = await promise;

    expect(result).toBe(true);
    expect(mockUnlinkSync).toHaveBeenCalledWith('/tmp/test-daemon.pid');
    expect(mockSpawn).toHaveBeenCalled();
  });

  it('falls back to "npx" when resolveNpxPath throws', async () => {
    let healthCallCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      healthCallCount++;
      if (healthCallCount <= 1) throw new Error('ECONNREFUSED');
      return new Response('OK', { status: 200 });
    });

    mockExistsSync.mockReturnValue(false);
    mockResolveNpxPath.mockImplementation(() => {
      throw new Error('npx not found');
    });

    const childMock = { unref: vi.fn() };
    mockSpawn.mockReturnValue(childMock as any);

    const promise = ensureDaemon();
    await vi.advanceTimersByTimeAsync(600);
    await promise;

    expect(mockSpawn).toHaveBeenCalledWith(
      'npx',
      ['-y', '@devness/useai@latest', 'daemon', '--port', '9999'],
      { detached: true, stdio: 'ignore' },
    );
  });

  it('returns false when the daemon never becomes healthy within 8 seconds', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('ECONNREFUSED'));
    mockExistsSync.mockReturnValue(false);
    mockResolveNpxPath.mockReturnValue('/usr/local/bin/npx');

    const childMock = { unref: vi.fn() };
    mockSpawn.mockReturnValue(childMock as any);

    const promise = ensureDaemon();
    await vi.advanceTimersByTimeAsync(9000);
    const result = await promise;

    expect(result).toBe(false);
    expect(mockSpawn).toHaveBeenCalled();
  });

  it('spawns with the correct port and detached options from constants', async () => {
    let healthCallCount = 0;
    vi.mocked(fetch).mockImplementation(async () => {
      healthCallCount++;
      if (healthCallCount <= 1) throw new Error('ECONNREFUSED');
      return new Response('OK', { status: 200 });
    });

    mockExistsSync.mockReturnValue(false);
    mockResolveNpxPath.mockReturnValue('/usr/local/bin/npx');
    const childMock = { unref: vi.fn() };
    mockSpawn.mockReturnValue(childMock as any);

    const promise = ensureDaemon();
    await vi.advanceTimersByTimeAsync(600);
    await promise;

    const spawnArgs = mockSpawn.mock.calls[0];
    expect(spawnArgs[1]).toContain('--port');
    expect(spawnArgs[1]).toContain('9999');
    expect(spawnArgs[2]).toEqual({ detached: true, stdio: 'ignore' });
  });
});