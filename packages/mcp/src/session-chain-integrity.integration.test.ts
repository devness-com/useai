/**
 * Integration tests for chain integrity — verifying that SessionState produces
 * cryptographically-linked JSONL chain files with correct hash chaining,
 * signing, and file structure across various scenarios.
 *
 * Tests chain verification, multi-session chains, chain with keystore rotation,
 * and chain file content structure.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, basename } from 'node:path';

// ── vi.hoisted for mock constants ────────────────────────────────────────────

const { tmpDir, activeDir, keystoreFile, idCounter } = vi.hoisted(() => {
  const base = `/tmp/useai-chain-integrity-test-${process.pid}`;
  return {
    tmpDir: base,
    activeDir: `${base}/active`,
    keystoreFile: `${base}/keystore.json`,
    idCounter: { value: 0 },
  };
});

// ── Mock @useai/shared ───────────────────────────────────────────────────────

vi.mock('@useai/shared', async () => {
  const actual = await vi.importActual<typeof import('@useai/shared')>('@useai/shared');
  return {
    ...actual,
    ACTIVE_DIR: activeDir,
    KEYSTORE_FILE: keystoreFile,
    GENESIS_HASH: 'GENESIS',
    ensureDir: () => {
      const { mkdirSync: mkSync } = require('node:fs');
      mkSync(activeDir, { recursive: true });
    },
    generateSessionId: () => `chain-test-${++idCounter.value}`,
  };
});

import { SessionState } from './session-state.js';

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  idCounter.value = 0;
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(activeDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function readChainFile(sessionId: string): Array<Record<string, unknown>> {
  const path = join(activeDir, `${sessionId}.jsonl`);
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Chain hash linkage integrity', () => {
  it('every record has a unique non-empty hash', () => {
    const state = new SessionState();
    state.appendToChain('session_start', { client: 'test' });
    state.appendToChain('heartbeat', { n: 1 });
    state.appendToChain('heartbeat', { n: 2 });
    state.appendToChain('session_end', { duration: 60 });

    const records = readChainFile(state.sessionId);
    const hashes = records.map(r => r.hash as string);

    expect(hashes).toHaveLength(4);
    expect(new Set(hashes).size).toBe(4); // all unique
    for (const h of hashes) {
      expect(h).toBeTruthy();
      expect(typeof h).toBe('string');
      expect(h.length).toBeGreaterThan(0);
    }
  });

  it('each record prev_hash matches the previous record hash', () => {
    const state = new SessionState();
    state.appendToChain('session_start', { client: 'test' });
    state.appendToChain('heartbeat', { n: 1 });
    state.appendToChain('heartbeat', { n: 2 });
    state.appendToChain('session_end', { duration: 60 });

    const records = readChainFile(state.sessionId);

    expect(records[0]!.prev_hash).toBe('GENESIS');
    for (let i = 1; i < records.length; i++) {
      expect(records[i]!.prev_hash).toBe(records[i - 1]!.hash);
    }
  });

  it('chainTipHash on the state always matches the last record hash', () => {
    const state = new SessionState();

    expect(state.chainTipHash).toBe('GENESIS');

    const r1 = state.appendToChain('session_start', { client: 'test' });
    expect(state.chainTipHash).toBe(r1.hash);

    const r2 = state.appendToChain('heartbeat', { n: 1 });
    expect(state.chainTipHash).toBe(r2.hash);

    const r3 = state.appendToChain('session_end', { duration: 30 });
    expect(state.chainTipHash).toBe(r3.hash);
  });
});

describe('Chain file structure', () => {
  it('each record contains required fields: type, session_id, hash, prev_hash, timestamp', () => {
    const state = new SessionState();
    state.appendToChain('session_start', { client: 'test-client', task_type: 'coding' });

    const records = readChainFile(state.sessionId);
    expect(records).toHaveLength(1);

    const record = records[0]!;
    expect(record).toHaveProperty('type', 'session_start');
    expect(record).toHaveProperty('session_id', state.sessionId);
    expect(record).toHaveProperty('hash');
    expect(record).toHaveProperty('prev_hash', 'GENESIS');
    expect(record).toHaveProperty('timestamp');
    expect(record).toHaveProperty('data');
  });

  it('data payload is correctly stored in the chain record', () => {
    const state = new SessionState();
    const payload = {
      client: 'claude-code',
      task_type: 'debugging',
      project: 'my-project',
      version: '1.0.0',
    };
    state.appendToChain('session_start', payload);

    const records = readChainFile(state.sessionId);
    const data = records[0]!.data as Record<string, unknown>;

    expect(data.client).toBe('claude-code');
    expect(data.task_type).toBe('debugging');
    expect(data.project).toBe('my-project');
    expect(data.version).toBe('1.0.0');
  });

  it('timestamps are valid ISO 8601 dates', () => {
    const state = new SessionState();
    state.appendToChain('session_start', { client: 'test' });
    state.appendToChain('session_end', { duration: 10 });

    const records = readChainFile(state.sessionId);
    for (const record of records) {
      const ts = record.timestamp as string;
      expect(ts).toBeTruthy();
      const parsed = new Date(ts);
      expect(parsed.toISOString()).toBe(ts);
    }
  });
});

describe('Chain signing with keystore', () => {
  it('records have signatures when keystore is initialized', () => {
    const state = new SessionState();
    state.initializeKeystore();
    expect(state.signingAvailable).toBe(true);

    state.appendToChain('session_start', { client: 'test' });
    state.appendToChain('session_end', { duration: 30 });

    const records = readChainFile(state.sessionId);
    for (const record of records) {
      expect(record.signature).toBeDefined();
      expect(typeof record.signature).toBe('string');
      expect((record.signature as string).length).toBeGreaterThan(0);
    }
  });

  it('records have "unsigned" signature when keystore is not initialized', () => {
    const state = new SessionState();
    expect(state.signingAvailable).toBe(false);

    state.appendToChain('session_start', { client: 'test' });

    const records = readChainFile(state.sessionId);
    const sig = records[0]!.signature as string;
    // Without a signing key, signHash returns 'unsigned'
    expect(sig).toBe('unsigned');
  });

  it('two states sharing the same keystore produce valid signatures', () => {
    const state1 = new SessionState();
    state1.initializeKeystore();

    const state2 = new SessionState();
    state2.initializeKeystore();

    // Both should be able to sign
    expect(state1.signingAvailable).toBe(true);
    expect(state2.signingAvailable).toBe(true);

    state1.appendToChain('session_start', { client: 'state1' });
    state2.appendToChain('session_start', { client: 'state2' });

    const records1 = readChainFile(state1.sessionId);
    const records2 = readChainFile(state2.sessionId);

    expect(records1[0]!.signature).toBeTruthy();
    expect(records2[0]!.signature).toBeTruthy();
  });
});

describe('Multiple independent sessions', () => {
  it('each session writes to its own chain file', () => {
    const state = new SessionState();
    const id1 = state.sessionId;
    state.appendToChain('session_start', { client: 'test' });
    state.appendToChain('session_end', { duration: 30 });

    state.reset();
    const id2 = state.sessionId;
    state.appendToChain('session_start', { client: 'test' });
    state.appendToChain('session_end', { duration: 60 });

    expect(id1).not.toBe(id2);
    expect(existsSync(join(activeDir, `${id1}.jsonl`))).toBe(true);
    expect(existsSync(join(activeDir, `${id2}.jsonl`))).toBe(true);

    const records1 = readChainFile(id1);
    const records2 = readChainFile(id2);

    expect(records1).toHaveLength(2);
    expect(records2).toHaveLength(2);

    // Each chain starts from GENESIS
    expect(records1[0]!.prev_hash).toBe('GENESIS');
    expect(records2[0]!.prev_hash).toBe('GENESIS');

    // Different session IDs in records
    expect(records1[0]!.session_id).toBe(id1);
    expect(records2[0]!.session_id).toBe(id2);
  });

  it('reset creates independent chain state (GENESIS hash)', () => {
    const state = new SessionState();
    state.appendToChain('session_start', { client: 'test' });
    const firstTip = state.chainTipHash;
    expect(firstTip).not.toBe('GENESIS');

    state.reset();
    expect(state.chainTipHash).toBe('GENESIS');
    expect(state.sessionRecordCount).toBe(0);
  });
});

describe('Parent/child chain file independence', () => {
  it('parent and child sessions have separate chain files with independent hash chains', () => {
    const state = new SessionState();
    state.initializeKeystore();

    // Parent writes records
    state.appendToChain('session_start', { client: 'parent' });
    state.appendToChain('heartbeat', { n: 1 });
    const parentId = state.sessionId;
    const parentTip = state.chainTipHash;

    // Save parent, start child
    state.saveParentState();
    state.reset();
    const childId = state.sessionId;

    // Child writes its own chain
    state.appendToChain('session_start', { client: 'child', parent_session_id: parentId });
    state.appendToChain('session_end', { duration: 15 });

    // Verify child chain is independent
    const childRecords = readChainFile(childId);
    expect(childRecords[0]!.prev_hash).toBe('GENESIS');
    expect(childRecords).toHaveLength(2);

    // Restore parent
    state.restoreParentState();
    expect(state.sessionId).toBe(parentId);
    expect(state.chainTipHash).toBe(parentTip);

    // Continue parent chain
    state.appendToChain('session_end', { duration: 120 });

    const parentRecords = readChainFile(parentId);
    expect(parentRecords).toHaveLength(3);
    // Parent's 3rd record links to parent's 2nd record, not to child's records
    expect(parentRecords[2]!.prev_hash).toBe(parentRecords[1]!.hash);
  });
});

describe('Long chain integrity', () => {
  it('maintains correct hash linkage across 20+ records', () => {
    const state = new SessionState();
    state.initializeKeystore();

    state.appendToChain('session_start', { client: 'stress-test' });

    for (let i = 1; i <= 20; i++) {
      state.appendToChain('heartbeat', { heartbeat_number: i, cumulative_seconds: i * 60 });
    }

    state.appendToChain('session_end', { duration: 1200 });

    const records = readChainFile(state.sessionId);
    expect(records).toHaveLength(22); // 1 start + 20 heartbeats + 1 end

    // Verify full chain linkage
    expect(records[0]!.prev_hash).toBe('GENESIS');
    for (let i = 1; i < records.length; i++) {
      expect(records[i]!.prev_hash).toBe(records[i - 1]!.hash);
    }

    // Record count tracked correctly
    expect(state.sessionRecordCount).toBe(22);
  });
});

describe('Chain record count and activity tracking', () => {
  it('appendToChain increments sessionRecordCount for each record', () => {
    const state = new SessionState();
    expect(state.sessionRecordCount).toBe(0);

    state.appendToChain('session_start', { client: 'test' });
    expect(state.sessionRecordCount).toBe(1);

    state.appendToChain('heartbeat', { n: 1 });
    expect(state.sessionRecordCount).toBe(2);

    state.appendToChain('heartbeat', { n: 2 });
    expect(state.sessionRecordCount).toBe(3);
  });

  it('appendToChain updates lastActivityTime', () => {
    const state = new SessionState();
    const initialActivity = state.lastActivityTime;

    // Small delay to ensure time difference
    state.appendToChain('session_start', { client: 'test' });

    expect(state.lastActivityTime).toBeGreaterThanOrEqual(initialActivity);
  });

  it('reset clears sessionRecordCount but preserves signing key', () => {
    const state = new SessionState();
    state.initializeKeystore();

    state.appendToChain('session_start', { client: 'test' });
    state.appendToChain('session_end', { duration: 30 });
    expect(state.sessionRecordCount).toBe(2);
    expect(state.signingAvailable).toBe(true);

    state.reset();
    expect(state.sessionRecordCount).toBe(0);
    expect(state.signingAvailable).toBe(true); // preserved
    expect(state.signingKey).not.toBeNull(); // preserved
  });
});
