import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchLatestVersion } from '../src/daemon/check-update';
import { VERSION } from '../src/constants/version';
import { detectPlatform } from '../src/daemon/autostart';

/**
 * Integration: fetchLatestVersion + VERSION constant + detectPlatform.
 * Tests verify the update check module works with mocked fetch and
 * that autostart platform detection returns valid values.
 */

describe('Check update integration', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns latest version string on successful fetch', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: '1.0.0' }),
    }) as any;

    const version = await fetchLatestVersion('@devness/useai');
    expect(version).toBe('1.0.0');
  });

  it('returns null when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any;

    const version = await fetchLatestVersion();
    expect(version).toBeNull();
  });

  it('returns null when response is not ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }) as any;

    const version = await fetchLatestVersion();
    expect(version).toBeNull();
  });

  it('returns null when response has no version field', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as any;

    const version = await fetchLatestVersion();
    expect(version).toBeNull();
  });

  it('VERSION constant can be compared with fetched version', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: VERSION }),
    }) as any;

    const latest = await fetchLatestVersion();
    expect(latest).toBe(VERSION);
  });
});

describe('Autostart platform detection integration', () => {
  it('returns a valid platform string', () => {
    const platform = detectPlatform();
    expect(['macos', 'linux', 'windows', 'unsupported']).toContain(platform);
  });

  it('returns consistent results across calls', () => {
    const p1 = detectPlatform();
    const p2 = detectPlatform();
    expect(p1).toBe(p2);
  });

  it('matches the current process.platform', () => {
    const platform = detectPlatform();
    const expectedMap: Record<string, string> = {
      darwin: 'macos',
      linux: 'linux',
      win32: 'windows',
    };
    const expected = expectedMap[process.platform] ?? 'unsupported';
    expect(platform).toBe(expected);
  });
});
