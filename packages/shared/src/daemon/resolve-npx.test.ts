import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}));

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  homedir: vi.fn(() => '/home/testuser'),
}));

const mockedExecSync = vi.mocked(execSync);
const mockedExistsSync = vi.mocked(existsSync);

// We need to dynamically import to get fresh module state after mocking
async function importModule() {
  // Clear module cache so mocks take effect on re-import
  vi.resetModules();
  return import('./resolve-npx');
}

describe('resolveNpxPath', () => {
  let originalPlatform: PropertyDescriptor | undefined;
  let originalShell: string | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    originalShell = process.env['SHELL'];
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    if (originalShell !== undefined) {
      process.env['SHELL'] = originalShell;
    } else {
      delete process.env['SHELL'];
    }
  });

  it('returns the path from "which npx" when it succeeds', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mockedExecSync.mockReturnValueOnce('/usr/local/bin/npx\n');

    const { resolveNpxPath } = await importModule();
    const result = resolveNpxPath();

    expect(result).toBe('/usr/local/bin/npx');
    expect(mockedExecSync).toHaveBeenCalledWith('which npx', expect.objectContaining({
      encoding: 'utf-8',
    }));
  });

  it('takes the first line when "which npx" returns multiple paths', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    mockedExecSync.mockReturnValueOnce('/opt/homebrew/bin/npx\n/usr/local/bin/npx\n');

    const { resolveNpxPath } = await importModule();
    const result = resolveNpxPath();

    expect(result).toBe('/opt/homebrew/bin/npx');
  });

  it('falls back to login shell resolution when "which npx" fails', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    process.env['SHELL'] = '/bin/zsh';

    // First call: `which npx` fails
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error('not found');
    });
    // Second call: login shell succeeds
    mockedExecSync.mockReturnValueOnce('/home/testuser/.nvm/versions/node/v20.11.0/bin/npx\n');

    const { resolveNpxPath } = await importModule();
    const result = resolveNpxPath();

    expect(result).toBe('/home/testuser/.nvm/versions/node/v20.11.0/bin/npx');
    expect(mockedExecSync).toHaveBeenCalledTimes(2);
    expect(mockedExecSync).toHaveBeenCalledWith(
      '/bin/zsh -lc "which npx"',
      expect.objectContaining({ encoding: 'utf-8' }),
    );
  });

  it('skips the login shell fallback when SHELL env var is not set', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    delete process.env['SHELL'];

    // `which npx` fails
    mockedExecSync.mockImplementationOnce(() => {
      throw new Error('not found');
    });

    // One of the known paths exists
    mockedExistsSync.mockImplementation((p) => p === '/usr/local/bin/npx');

    const { resolveNpxPath } = await importModule();
    const result = resolveNpxPath();

    expect(result).toBe('/usr/local/bin/npx');
    // Only called once for `which npx`, not for login shell
    expect(mockedExecSync).toHaveBeenCalledTimes(1);
  });

  it('falls back to KNOWN_PATHS when both which and login shell fail', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    process.env['SHELL'] = '/bin/bash';

    // Both execSync calls fail
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });

    // The volta path exists
    const voltaNpx = join('/home/testuser', '.volta', 'bin', 'npx');
    mockedExistsSync.mockImplementation((p) => p === voltaNpx);

    const { resolveNpxPath } = await importModule();
    const result = resolveNpxPath();

    expect(result).toBe(voltaNpx);
  });

  it('checks KNOWN_PATHS in order and returns the first existing one', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    process.env['SHELL'] = '/bin/bash';

    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });

    // Both /usr/local/bin/npx and /opt/homebrew/bin/npx exist
    mockedExistsSync.mockImplementation(
      (p) => p === '/usr/local/bin/npx' || p === '/opt/homebrew/bin/npx',
    );

    const { resolveNpxPath } = await importModule();
    const result = resolveNpxPath();

    // Should return the first match in KNOWN_PATHS order
    expect(result).toBe('/usr/local/bin/npx');
  });

  it('throws when npx cannot be found anywhere', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    process.env['SHELL'] = '/bin/bash';

    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    mockedExistsSync.mockReturnValue(false);

    const { resolveNpxPath } = await importModule();

    expect(() => resolveNpxPath()).toThrow(
      'Could not find npx. Ensure Node.js is installed and npx is in your PATH.',
    );
  });

  it('handles "which npx" returning an empty string and falls through', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    process.env['SHELL'] = '/bin/bash';

    // `which npx` returns empty
    mockedExecSync.mockReturnValueOnce('   \n');
    // login shell also returns empty
    mockedExecSync.mockReturnValueOnce('  ');

    mockedExistsSync.mockImplementation((p) => p === '/opt/homebrew/bin/npx');

    const { resolveNpxPath } = await importModule();
    const result = resolveNpxPath();

    expect(result).toBe('/opt/homebrew/bin/npx');
  });

  it('uses "where npx" on Windows', async () => {
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });

    mockedExecSync.mockReturnValueOnce('C:\\Program Files\\nodejs\\npx.cmd\r\n');

    const { resolveNpxPath } = await importModule();
    const result = resolveNpxPath();

    expect(result).toBe('C:\\Program Files\\nodejs\\npx.cmd');
    expect(mockedExecSync).toHaveBeenCalledWith('where npx', expect.any(Object));
  });
});

describe('buildNodePath', () => {
  let originalPlatform: PropertyDescriptor | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
  });

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
  });

  it('includes common Node.js installation directories', async () => {
    // resolveNpxPath will succeed with a known dir
    mockedExecSync.mockReturnValue('/usr/local/bin/npx\n');
    mockedExistsSync.mockReturnValue(true);

    const { buildNodePath } = await importModule();
    const result = buildNodePath();
    const dirs = result.split(':');

    expect(dirs).toContain('/usr/local/bin');
    expect(dirs).toContain('/opt/homebrew/bin');
    expect(dirs).toContain('/usr/bin');
    expect(dirs).toContain('/bin');
  });

  it('includes nvm, volta, and bun directories based on homedir', async () => {
    mockedExecSync.mockReturnValue('/usr/local/bin/npx\n');
    mockedExistsSync.mockReturnValue(true);

    const { buildNodePath } = await importModule();
    const result = buildNodePath();
    const dirs = result.split(':');

    expect(dirs).toContain(join('/home/testuser', '.nvm', 'current', 'bin'));
    expect(dirs).toContain(join('/home/testuser', '.volta', 'bin'));
    expect(dirs).toContain(join('/home/testuser', '.bun', 'bin'));
  });

  it('prepends the resolved npx directory if it is not already in the list', async () => {
    // npx resolved to a custom location not in the default dirs
    mockedExecSync.mockReturnValue('/custom/node/bin/npx\n');
    mockedExistsSync.mockReturnValue(true);

    const { buildNodePath } = await importModule();
    const result = buildNodePath();
    const dirs = result.split(':');

    expect(dirs[0]).toBe('/custom/node/bin');
    // Still contains the standard dirs
    expect(dirs).toContain('/usr/local/bin');
  });

  it('does not duplicate the npx directory if it is already in the default list', async () => {
    mockedExecSync.mockReturnValue('/usr/local/bin/npx\n');
    mockedExistsSync.mockReturnValue(true);

    const { buildNodePath } = await importModule();
    const result = buildNodePath();
    const dirs = result.split(':');

    const usrLocalCount = dirs.filter((d) => d === '/usr/local/bin').length;
    expect(usrLocalCount).toBe(1);
  });

  it('filters out directories that do not exist on disk', async () => {
    mockedExecSync.mockReturnValue('/usr/local/bin/npx\n');

    // Only /usr/local/bin and /usr/bin exist
    mockedExistsSync.mockImplementation(
      (p) => p === '/usr/local/bin' || p === '/usr/bin',
    );

    const { buildNodePath } = await importModule();
    const result = buildNodePath();
    const dirs = result.split(':');

    expect(dirs).toEqual(['/usr/local/bin', '/usr/bin']);
    expect(dirs).not.toContain('/opt/homebrew/bin');
    expect(dirs).not.toContain('/bin');
  });

  it('returns empty string when no directories exist', async () => {
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });
    mockedExistsSync.mockReturnValue(false);

    const { buildNodePath } = await importModule();
    const result = buildNodePath();

    expect(result).toBe('');
  });

  it('gracefully handles resolveNpxPath throwing and still builds path from default dirs', async () => {
    // All execSync calls fail (so resolveNpxPath will throw internally)
    mockedExecSync.mockImplementation(() => {
      throw new Error('not found');
    });

    // Some default dirs exist
    mockedExistsSync.mockImplementation(
      (p) => p === '/usr/local/bin' || p === '/usr/bin' || p === '/bin',
    );

    const { buildNodePath } = await importModule();
    const result = buildNodePath();
    const dirs = result.split(':');

    expect(dirs).toEqual(['/usr/local/bin', '/usr/bin', '/bin']);
  });

  it('joins directories with colon separator', async () => {
    mockedExecSync.mockReturnValue('/usr/local/bin/npx\n');
    mockedExistsSync.mockImplementation(
      (p) => p === '/usr/local/bin' || p === '/opt/homebrew/bin',
    );

    const { buildNodePath } = await importModule();
    const result = buildNodePath();

    expect(result).toBe('/usr/local/bin:/opt/homebrew/bin');
  });
});