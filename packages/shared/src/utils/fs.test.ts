import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readJson, writeJson, ensureDir } from './fs.js';
import * as nodeFs from 'node:fs';

// Mock the constants module so we control which directories ensureDir targets
vi.mock('../constants/paths.js', () => ({
  USEAI_DIR: '/tmp/test-useai',
  DATA_DIR: '/tmp/test-useai/data',
  ACTIVE_DIR: '/tmp/test-useai/data/active',
  SEALED_DIR: '/tmp/test-useai/data/sealed',
}));

// Mock node:fs so we never touch real filesystem
vi.mock('node:fs', async () => {
  return {
    existsSync: vi.fn(),
    mkdirSync: vi.fn(),
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    renameSync: vi.fn(),
  };
});

const mockedFs = vi.mocked(nodeFs);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('readJson', () => {
  it('returns the fallback when the file does not exist', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const fallback = { tasks: [], version: 1 };
    const result = readJson('/nonexistent/config.json', fallback);

    expect(result).toEqual(fallback);
    expect(mockedFs.existsSync).toHaveBeenCalledWith('/nonexistent/config.json');
    expect(mockedFs.readFileSync).not.toHaveBeenCalled();
  });

  it('parses and returns valid JSON from an existing file', () => {
    mockedFs.existsSync.mockReturnValue(true);
    const storedData = { tasks: [{ id: 1, title: 'Write tests' }], version: 2 };
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(storedData));

    const fallback = { tasks: [], version: 0 };
    const result = readJson('/data/tasks.json', fallback);

    expect(result).toEqual(storedData);
    expect(mockedFs.readFileSync).toHaveBeenCalledWith('/data/tasks.json', 'utf-8');
  });

  it('returns the fallback when the file contains corrupted JSON', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('{ invalid json content !!!');

    const fallback = { settings: { theme: 'dark' } };
    const result = readJson('/data/settings.json', fallback);

    expect(result).toEqual(fallback);
  });

  it('returns the fallback when readFileSync throws an error', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockImplementation(() => {
      throw new Error('EACCES: permission denied');
    });

    const fallback: string[] = [];
    const result = readJson<string[]>('/restricted/file.json', fallback);

    expect(result).toEqual([]);
  });

  it('returns a primitive fallback for a missing file', () => {
    mockedFs.existsSync.mockReturnValue(false);

    const result = readJson('/missing.json', 42);

    expect(result).toBe(42);
  });

  it('correctly parses a JSON array from file', () => {
    mockedFs.existsSync.mockReturnValue(true);
    const storedArray = ['item-a', 'item-b', 'item-c'];
    mockedFs.readFileSync.mockReturnValue(JSON.stringify(storedArray));

    const result = readJson<string[]>('/data/list.json', []);

    expect(result).toEqual(['item-a', 'item-b', 'item-c']);
  });

  it('returns the fallback when file content is an empty string', () => {
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.readFileSync.mockReturnValue('');

    const fallback = { empty: true };
    const result = readJson('/data/empty.json', fallback);

    expect(result).toEqual(fallback);
  });
});

describe('writeJson', () => {
  it('writes data atomically via a temp file and rename', () => {
    mockedFs.existsSync.mockReturnValue(true);

    const data = { id: 'task-001', title: 'Deploy application', done: false };
    writeJson('/data/tasks.json', data);

    // Verify it wrote to a temp file first (path.pid.tmp pattern)
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
    const writtenPath = mockedFs.writeFileSync.mock.calls[0][0] as string;
    expect(writtenPath).toMatch(/^\/data\/tasks\.json\.\d+\.tmp$/);
    expect(mockedFs.writeFileSync.mock.calls[0][1]).toBe(
      JSON.stringify(data, null, 2)
    );
    expect(mockedFs.writeFileSync.mock.calls[0][2]).toBe('utf-8');

    // Verify the rename from temp to final path
    expect(mockedFs.renameSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.renameSync).toHaveBeenCalledWith(writtenPath, '/data/tasks.json');
  });

  it('calls ensureDir before writing to guarantee directories exist', () => {
    mockedFs.existsSync.mockReturnValue(false);

    writeJson('/data/output.json', { value: 100 });

    // ensureDir should have been called, creating missing directories
    expect(mockedFs.mkdirSync).toHaveBeenCalled();
    // Writing should still happen after directory creation
    expect(mockedFs.writeFileSync).toHaveBeenCalledTimes(1);
    expect(mockedFs.renameSync).toHaveBeenCalledTimes(1);
  });

  it('serializes nested objects with 2-space indentation', () => {
    mockedFs.existsSync.mockReturnValue(true);

    const nested = {
      user: { name: 'Alice', preferences: { notifications: true } },
    };
    writeJson('/data/user.json', nested);

    const writtenContent = mockedFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toBe(JSON.stringify(nested, null, 2));
    // Verify indentation is actually present (not minified)
    expect(writtenContent).toContain('  ');
    expect(writtenContent).toContain('\n');
  });

  it('handles writing an array as top-level data', () => {
    mockedFs.existsSync.mockReturnValue(true);

    const items = [1, 2, 3];
    writeJson('/data/numbers.json', items);

    const writtenContent = mockedFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toBe(JSON.stringify(items, null, 2));
  });

  it('handles writing null data', () => {
    mockedFs.existsSync.mockReturnValue(true);

    writeJson('/data/reset.json', null);

    const writtenContent = mockedFs.writeFileSync.mock.calls[0][1] as string;
    expect(writtenContent).toBe('null');
  });

  it('uses process.pid in the temp file name for uniqueness', () => {
    mockedFs.existsSync.mockReturnValue(true);

    writeJson('/data/file.json', {});

    const writtenPath = mockedFs.writeFileSync.mock.calls[0][0] as string;
    expect(writtenPath).toBe(`/data/file.json.${process.pid}.tmp`);
  });
});

describe('ensureDir', () => {
  it('creates all required directories when none exist', () => {
    mockedFs.existsSync.mockReturnValue(false);

    ensureDir();

    expect(mockedFs.mkdirSync).toHaveBeenCalledTimes(4);
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/test-useai', { recursive: true });
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/test-useai/data', { recursive: true });
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/test-useai/data/active', { recursive: true });
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/test-useai/data/sealed', { recursive: true });
  });

  it('skips directory creation when all directories already exist', () => {
    mockedFs.existsSync.mockReturnValue(true);

    ensureDir();

    expect(mockedFs.existsSync).toHaveBeenCalledTimes(4);
    expect(mockedFs.mkdirSync).not.toHaveBeenCalled();
  });

  it('only creates directories that are missing', () => {
    // First two dirs exist, last two do not
    mockedFs.existsSync
      .mockReturnValueOnce(true)   // USEAI_DIR exists
      .mockReturnValueOnce(true)   // DATA_DIR exists
      .mockReturnValueOnce(false)  // ACTIVE_DIR missing
      .mockReturnValueOnce(false); // SEALED_DIR missing

    ensureDir();

    expect(mockedFs.mkdirSync).toHaveBeenCalledTimes(2);
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/test-useai/data/active', { recursive: true });
    expect(mockedFs.mkdirSync).toHaveBeenCalledWith('/tmp/test-useai/data/sealed', { recursive: true });
  });

  it('checks existence of all four required directories', () => {
    mockedFs.existsSync.mockReturnValue(true);

    ensureDir();

    expect(mockedFs.existsSync).toHaveBeenCalledWith('/tmp/test-useai');
    expect(mockedFs.existsSync).toHaveBeenCalledWith('/tmp/test-useai/data');
    expect(mockedFs.existsSync).toHaveBeenCalledWith('/tmp/test-useai/data/active');
    expect(mockedFs.existsSync).toHaveBeenCalledWith('/tmp/test-useai/data/sealed');
  });

  it('uses recursive option when creating directories', () => {
    mockedFs.existsSync.mockReturnValue(false);

    ensureDir();

    for (const call of mockedFs.mkdirSync.mock.calls) {
      expect(call[1]).toEqual({ recursive: true });
    }
  });
});