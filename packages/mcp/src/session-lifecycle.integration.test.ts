/**
 * Integration tests for the session lifecycle — verifying SessionState,
 * parent/child nesting, chain file persistence, and the session.ts wrapper
 * working together with real filesystem operations.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

// ── vi.hoisted for mock constants ────────────────────────────────────────────

const { tmpDir, activeDir, keystoreFile, idCounter } = vi.hoisted(() => {
  const base = `/tmp/useai-session-lifecycle-test-${process.pid}`;
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
    generateSessionId: () => `test-session-${++idCounter.value}`,
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

// ── Tests ────────────────────────────────────────────────────────────────────

describe('SessionState construction and defaults', () => {
  it('initializes with deterministic session and conversation IDs', () => {
    const state = new SessionState();
    expect(state.sessionId).toBe('test-session-1');
    expect(state.conversationId).toBe('test-session-2');
    expect(state.conversationIndex).toBe(0);
    expect(state.clientName).toBe('unknown');
    expect(state.sessionTaskType).toBe('coding');
    expect(state.heartbeatCount).toBe(0);
    expect(state.sessionRecordCount).toBe(0);
    expect(state.chainTipHash).toBe('GENESIS');
    expect(state.signingAvailable).toBe(false);
    expect(state.signingKey).toBeNull();
    expect(state.inProgress).toBe(false);
    expect(state.parentStateStack).toEqual([]);
    expect(state.autoSealedSessionId).toBeNull();
  });

  it('detects project from cwd basename', () => {
    const state = new SessionState();
    state.detectProject();
    const expected = basename(process.cwd());
    expect(state.project).toBe(expected);
  });
});

describe('SessionState setters', () => {
  it('setClient updates clientName', () => {
    const state = new SessionState();
    state.setClient('cursor');
    expect(state.clientName).toBe('cursor');
  });

  it('setTaskType updates sessionTaskType', () => {
    const state = new SessionState();
    state.setTaskType('debugging');
    expect(state.sessionTaskType).toBe('debugging');
  });

  it('setTitle and setPrivateTitle update titles', () => {
    const state = new SessionState();
    state.setTitle('Public Title');
    state.setPrivateTitle('Private: Project X Implementation');
    expect(state.sessionTitle).toBe('Public Title');
    expect(state.sessionPrivateTitle).toBe('Private: Project X Implementation');
  });

  it('setPromptWordCount and setPrompt work correctly', () => {
    const state = new SessionState();
    state.setPrompt('Help me fix this bug');
    state.setPromptWordCount(5);
    expect(state.sessionPrompt).toBe('Help me fix this bug');
    expect(state.sessionPromptWordCount).toBe(5);
  });

  it('setModel updates modelId', () => {
    const state = new SessionState();
    state.setModel('claude-opus-4-6');
    expect(state.modelId).toBe('claude-opus-4-6');
  });

  it('setPromptImageCount and setPromptImages work correctly', () => {
    const state = new SessionState();
    state.setPromptImageCount(2);
    const images = [
      { type: 'image' as const, description: 'screenshot.png' },
      { type: 'image' as const, description: 'diagram.png' },
    ];
    state.setPromptImages(images);
    expect(state.sessionPromptImageCount).toBe(2);
    expect(state.sessionPromptImages).toEqual(images);
  });
});

describe('SessionState reset', () => {
  it('preserves clientName and conversationId across reset', () => {
    const state = new SessionState();
    state.setClient('cursor');
    const convId = state.conversationId;

    state.reset();

    expect(state.clientName).toBe('cursor');
    expect(state.conversationId).toBe(convId);
    expect(state.conversationIndex).toBe(1); // incremented
    expect(state.sessionTaskType).toBe('coding'); // reset to default
    expect(state.heartbeatCount).toBe(0);
    expect(state.sessionRecordCount).toBe(0);
    expect(state.chainTipHash).toBe('GENESIS');
    expect(state.sessionTitle).toBeNull();
    expect(state.sessionPrivateTitle).toBeNull();
    expect(state.modelId).toBeNull();
    expect(state.inProgress).toBe(false);
  });

  it('generates a new sessionId on reset', () => {
    const state = new SessionState();
    const firstId = state.sessionId;

    state.reset();
    expect(state.sessionId).not.toBe(firstId);
  });

  it('increments conversationIndex on each reset', () => {
    const state = new SessionState();
    expect(state.conversationIndex).toBe(0);
    state.reset();
    expect(state.conversationIndex).toBe(1);
    state.reset();
    expect(state.conversationIndex).toBe(2);
  });
});

describe('SessionState heartbeat and timing', () => {
  it('incrementHeartbeat updates count and touchesActivity', () => {
    const state = new SessionState();
    const beforeActivity = state.lastActivityTime;

    state.incrementHeartbeat();

    expect(state.heartbeatCount).toBe(1);
    expect(state.lastActivityTime).toBeGreaterThanOrEqual(beforeActivity);

    state.incrementHeartbeat();
    expect(state.heartbeatCount).toBe(2);
  });

  it('getSessionDuration returns correct duration in seconds', () => {
    const state = new SessionState();
    // Manually set start time to 60s ago
    state.sessionStartTime = Date.now() - 60_000;
    state.childPausedMs = 0;

    const duration = state.getSessionDuration();
    expect(duration).toBeGreaterThanOrEqual(59);
    expect(duration).toBeLessThanOrEqual(61);
  });

  it('getActiveDuration uses lastActivityTime instead of now', () => {
    const state = new SessionState();
    state.sessionStartTime = Date.now() - 120_000;
    // Simulate activity happened 60s after start
    state.lastActivityTime = state.sessionStartTime + 60_000;
    state.childPausedMs = 0;

    const activeDuration = state.getActiveDuration();
    expect(activeDuration).toBe(60);
  });

  it('getSessionDuration excludes childPausedMs', () => {
    const state = new SessionState();
    state.sessionStartTime = Date.now() - 120_000;
    state.childPausedMs = 60_000;

    const duration = state.getSessionDuration();
    expect(duration).toBeGreaterThanOrEqual(59);
    expect(duration).toBeLessThanOrEqual(61);
  });
});

describe('SessionState parent/child nesting', () => {
  it('parentState returns null when no parent is saved', () => {
    const state = new SessionState();
    expect(state.parentState).toBeNull();
    expect(state.getParentSessionIds()).toEqual([]);
  });

  it('saveParentState and restoreParentState work for single level', () => {
    const state = new SessionState();
    state.setClient('claude-code');
    state.setTaskType('coding');
    state.setTitle('Parent Title');
    state.setModel('claude-opus-4-6');
    state.inProgress = true;

    const parentSessionId = state.sessionId;
    const parentConversationId = state.conversationId;

    // Save parent state
    state.saveParentState();

    expect(state.parentState).toBeDefined();
    expect(state.parentState!.sessionId).toBe(parentSessionId);
    expect(state.getParentSessionIds()).toEqual([parentSessionId]);

    // Simulate child session
    state.reset();
    state.setTaskType('debugging');
    state.setTitle('Child Title');

    // Restore parent
    const restored = state.restoreParentState();
    expect(restored).toBe(true);
    expect(state.sessionId).toBe(parentSessionId);
    expect(state.conversationId).toBe(parentConversationId);
    expect(state.sessionTaskType).toBe('coding');
    expect(state.sessionTitle).toBe('Parent Title');
    expect(state.modelId).toBe('claude-opus-4-6');
    expect(state.inProgress).toBe(true);
    expect(state.parentState).toBeNull();
  });

  it('supports multi-level nesting (grandchild sessions)', () => {
    const state = new SessionState();
    const grandparentId = state.sessionId;

    // Save grandparent → start parent
    state.saveParentState();
    state.reset();
    const parentId = state.sessionId;

    // Save parent → start child
    state.saveParentState();
    state.reset();

    expect(state.parentStateStack).toHaveLength(2);
    expect(state.getParentSessionIds()).toEqual([grandparentId, parentId]);
    expect(state.parentState!.sessionId).toBe(parentId);

    // Restore parent
    state.restoreParentState();
    expect(state.sessionId).toBe(parentId);
    expect(state.parentStateStack).toHaveLength(1);

    // Restore grandparent
    state.restoreParentState();
    expect(state.sessionId).toBe(grandparentId);
    expect(state.parentStateStack).toHaveLength(0);
  });

  it('restoreParentState returns false when stack is empty', () => {
    const state = new SessionState();
    expect(state.restoreParentState()).toBe(false);
  });

  it('accumulates childPausedMs when restoring parent', () => {
    const state = new SessionState();
    state.childPausedMs = 0;

    // Save parent state (records pausedAt = now)
    state.saveParentState();

    // The restore will compute: childPausedMs = old + (Date.now() - pausedAt)
    const restored = state.restoreParentState();
    expect(restored).toBe(true);
    // childPausedMs should be >= 0 (time elapsed between save and restore)
    expect(state.childPausedMs).toBeGreaterThanOrEqual(0);
  });
});

describe('SessionState chain file operations', () => {
  it('appendToChain creates a chain file and increments record count', () => {
    const state = new SessionState();

    const record = state.appendToChain('session_start', {
      client: 'test-client',
      task_type: 'coding',
    });

    expect(record).toBeDefined();
    expect(record.hash).toBeDefined();
    expect(typeof record.hash).toBe('string');
    expect(state.sessionRecordCount).toBe(1);
    expect(state.chainTipHash).toBe(record.hash);

    // Verify file was written
    const chainPath = join(activeDir, `${state.sessionId}.jsonl`);
    expect(existsSync(chainPath)).toBe(true);

    const content = readFileSync(chainPath, 'utf-8').trim();
    const parsed = JSON.parse(content);
    expect(parsed.type).toBe('session_start');
    expect(parsed.session_id).toBe(state.sessionId);
  });

  it('appendToChain creates a proper JSONL chain with linked hashes', () => {
    const state = new SessionState();

    const record1 = state.appendToChain('session_start', { client: 'test' });
    const record2 = state.appendToChain('heartbeat', { heartbeat_number: 1 });
    const record3 = state.appendToChain('session_end', { duration_seconds: 60 });

    expect(state.sessionRecordCount).toBe(3);

    // Verify chain linkage
    expect(record1.prev_hash).toBe('GENESIS');
    expect(record2.prev_hash).toBe(record1.hash);
    expect(record3.prev_hash).toBe(record2.hash);

    // Verify file has 3 lines
    const chainPath = join(activeDir, `${state.sessionId}.jsonl`);
    const lines = readFileSync(chainPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(3);

    // Verify each line is valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow();
    }
  });

  it('appendToChain updates lastActivityTime', () => {
    const state = new SessionState();
    const before = state.lastActivityTime;

    state.appendToChain('session_start', { client: 'test' });

    expect(state.lastActivityTime).toBeGreaterThanOrEqual(before);
  });
});

describe('SessionState initializeKeystore', () => {
  it('generates a new keystore when none exists and sets signingAvailable', () => {
    const state = new SessionState();
    expect(state.signingAvailable).toBe(false);
    expect(state.signingKey).toBeNull();

    state.initializeKeystore();

    expect(state.signingAvailable).toBe(true);
    expect(state.signingKey).not.toBeNull();

    // Verify keystore file was written
    expect(existsSync(keystoreFile)).toBe(true);
    const ksContent = readFileSync(keystoreFile, 'utf-8');
    const ks = JSON.parse(ksContent);
    expect(ks).toHaveProperty('encrypted_private_key');
    expect(ks).toHaveProperty('public_key_pem');
  });

  it('reuses existing keystore on subsequent calls', () => {
    const state = new SessionState();
    state.initializeKeystore();

    // Create second state that should reuse the keystore
    const state2 = new SessionState();
    state2.initializeKeystore();

    expect(state2.signingAvailable).toBe(true);
    expect(state2.signingKey).not.toBeNull();
  });
});

describe('Full session lifecycle integration', () => {
  it('start → heartbeat → end chain file is valid and linked', () => {
    const state = new SessionState();
    state.initializeKeystore();
    state.setClient('claude-code');
    state.setTaskType('coding');

    // Start
    const startRecord = state.appendToChain('session_start', {
      client: state.clientName,
      task_type: state.sessionTaskType,
      version: '1.0.0',
    });
    state.inProgress = true;

    // Heartbeat
    state.incrementHeartbeat();
    const heartbeatRecord = state.appendToChain('heartbeat', {
      heartbeat_number: state.heartbeatCount,
      cumulative_seconds: state.getSessionDuration(),
    });

    // End
    const endRecord = state.appendToChain('session_end', {
      duration_seconds: state.getSessionDuration(),
      task_type: state.sessionTaskType,
      languages: ['typescript'],
      files_touched: 3,
      heartbeat_count: state.heartbeatCount,
    });
    state.inProgress = false;

    expect(state.sessionRecordCount).toBe(3);
    expect(state.heartbeatCount).toBe(1);

    // Verify chain file
    const chainPath = join(activeDir, `${state.sessionId}.jsonl`);
    const lines = readFileSync(chainPath, 'utf-8').trim().split('\n');
    expect(lines).toHaveLength(3);

    const records = lines.map(l => JSON.parse(l));
    expect(records[0].type).toBe('session_start');
    expect(records[1].type).toBe('heartbeat');
    expect(records[2].type).toBe('session_end');

    // Verify hash chain
    expect(records[0].prev_hash).toBe('GENESIS');
    expect(records[1].prev_hash).toBe(records[0].hash);
    expect(records[2].prev_hash).toBe(records[1].hash);

    // Since keystore is initialized, records should have signatures
    expect(records[0].signature).toBeDefined();
    expect(records[0].signature).not.toBe('');
  });

  it('parent → child → restore lifecycle preserves chain integrity', () => {
    const state = new SessionState();
    state.setClient('claude-code');

    // Parent starts writing chain
    state.appendToChain('session_start', { client: 'claude-code' });
    const parentId = state.sessionId;
    const parentChainTip = state.chainTipHash;

    // Save parent, start child
    state.saveParentState();
    state.reset(); // Gets new session ID
    const childId = state.sessionId;

    // Child writes its own chain
    state.appendToChain('session_start', { client: 'claude-code', parent_session_id: parentId });
    state.appendToChain('session_end', { duration_seconds: 30 });

    // Restore parent
    state.restoreParentState();
    expect(state.sessionId).toBe(parentId);
    expect(state.chainTipHash).toBe(parentChainTip);

    // Parent continues its chain
    state.appendToChain('session_end', { duration_seconds: 120 });
    expect(state.sessionRecordCount).toBe(2); // start + end for parent

    // Verify both chain files exist
    expect(existsSync(join(activeDir, `${parentId}.jsonl`))).toBe(true);
    expect(existsSync(join(activeDir, `${childId}.jsonl`))).toBe(true);

    // Verify parent chain
    const parentLines = readFileSync(join(activeDir, `${parentId}.jsonl`), 'utf-8').trim().split('\n');
    expect(parentLines).toHaveLength(2);
    const parentRecords = parentLines.map(l => JSON.parse(l));
    expect(parentRecords[1].prev_hash).toBe(parentRecords[0].hash);

    // Verify child chain is independent
    const childLines = readFileSync(join(activeDir, `${childId}.jsonl`), 'utf-8').trim().split('\n');
    expect(childLines).toHaveLength(2);
    const childRecords = childLines.map(l => JSON.parse(l));
    expect(childRecords[0].prev_hash).toBe('GENESIS');
  });
});
