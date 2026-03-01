/**
 * Integration tests for mcp-map.ts — MCP session ID ↔ UseAI session ID mapping.
 *
 * Uses real filesystem operations in a temp directory to test the full
 * read → modify → write cycle with actual JSON persistence.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── vi.hoisted for mock constants (avoids TDZ in vi.mock factory) ────────────

const { tmpDir } = vi.hoisted(() => ({
  tmpDir: `/tmp/useai-mcp-map-test-${process.pid}`,
}));

// ── Mock @useai/shared so DATA_DIR points to temp dir ────────────────────────

vi.mock('@useai/shared', async () => {
  const actual = await vi.importActual<typeof import('@useai/shared')>('@useai/shared');
  return {
    ...actual,
    DATA_DIR: tmpDir,
  };
});

import { readMcpMap, writeMcpMapping, removeMcpMapping, removeMcpMappingByUseaiId } from './mcp-map.js';

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('mcp-map integration', () => {
  it('readMcpMap returns empty object when no file exists', () => {
    const map = readMcpMap();
    expect(map).toEqual({});
  });

  it('writeMcpMapping persists a mapping to disk and readMcpMap retrieves it', () => {
    writeMcpMapping('mcp-session-1', 'useai-session-a');
    const map = readMcpMap();
    expect(map['mcp-session-1']).toBe('useai-session-a');
  });

  it('writeMcpMapping accumulates multiple mappings', () => {
    writeMcpMapping('mcp-1', 'useai-a');
    writeMcpMapping('mcp-2', 'useai-b');
    writeMcpMapping('mcp-3', 'useai-c');

    const map = readMcpMap();
    expect(Object.keys(map)).toHaveLength(3);
    expect(map['mcp-1']).toBe('useai-a');
    expect(map['mcp-2']).toBe('useai-b');
    expect(map['mcp-3']).toBe('useai-c');
  });

  it('writeMcpMapping overwrites an existing mapping for the same mcpSessionId', () => {
    writeMcpMapping('mcp-1', 'useai-old');
    writeMcpMapping('mcp-1', 'useai-new');

    const map = readMcpMap();
    expect(map['mcp-1']).toBe('useai-new');
    expect(Object.keys(map)).toHaveLength(1);
  });

  it('writeMcpMapping is a no-op when mcpSessionId is null', () => {
    writeMcpMapping(null, 'useai-session-a');
    const map = readMcpMap();
    expect(map).toEqual({});
  });

  it('removeMcpMapping deletes a specific mapping', () => {
    writeMcpMapping('mcp-1', 'useai-a');
    writeMcpMapping('mcp-2', 'useai-b');

    removeMcpMapping('mcp-1');

    const map = readMcpMap();
    expect(map['mcp-1']).toBeUndefined();
    expect(map['mcp-2']).toBe('useai-b');
  });

  it('removeMcpMapping is a no-op when mcpSessionId is null', () => {
    writeMcpMapping('mcp-1', 'useai-a');
    removeMcpMapping(null);

    const map = readMcpMap();
    expect(map['mcp-1']).toBe('useai-a');
  });

  it('removeMcpMapping is a no-op when mcpSessionId is not in the map', () => {
    writeMcpMapping('mcp-1', 'useai-a');
    removeMcpMapping('mcp-nonexistent');

    const map = readMcpMap();
    expect(map['mcp-1']).toBe('useai-a');
  });

  it('removeMcpMappingByUseaiId removes all entries pointing to a given UseAI session', () => {
    writeMcpMapping('mcp-1', 'useai-target');
    writeMcpMapping('mcp-2', 'useai-target');
    writeMcpMapping('mcp-3', 'useai-other');

    removeMcpMappingByUseaiId('useai-target');

    const map = readMcpMap();
    expect(map['mcp-1']).toBeUndefined();
    expect(map['mcp-2']).toBeUndefined();
    expect(map['mcp-3']).toBe('useai-other');
  });

  it('removeMcpMappingByUseaiId is a no-op when no entries match', () => {
    writeMcpMapping('mcp-1', 'useai-a');
    removeMcpMappingByUseaiId('useai-nonexistent');

    const map = readMcpMap();
    expect(map['mcp-1']).toBe('useai-a');
  });

  it('full lifecycle: write → read → remove → verify empty', () => {
    // Write several
    writeMcpMapping('s1', 'u1');
    writeMcpMapping('s2', 'u2');
    expect(Object.keys(readMcpMap())).toHaveLength(2);

    // Remove one by MCP id
    removeMcpMapping('s1');
    expect(Object.keys(readMcpMap())).toHaveLength(1);

    // Remove by UseAI id
    removeMcpMappingByUseaiId('u2');
    expect(readMcpMap()).toEqual({});
  });

  it('persisted JSON file is valid JSON and contains the correct data', () => {
    writeMcpMapping('mcp-abc', 'useai-xyz');

    const filePath = join(tmpDir, 'mcp-map.json');
    expect(existsSync(filePath)).toBe(true);

    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({ 'mcp-abc': 'useai-xyz' });
  });
});
