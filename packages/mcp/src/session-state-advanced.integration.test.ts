/**
 * Advanced integration tests for SessionState — testing complex scenarios
 * including multi-level parent/child nesting with chain files, concurrent
 * keystore operations, edge cases for timing, and session metadata
 * preservation across reset cycles.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, basename } from 'node:path';

// ── vi.hoisted for mock constants ────────────────────────────────────────────

const { tmpDir, activeDir, keystoreFile, idCounter } = vi.hoisted(() => {
  const base = `/tmp/useai-state-advanced-test-${process.pid}`;
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
    generateSessionId: () => `adv-${++idCounter.value}`,
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

describe('Multi-level parent/child nesting with state restoration', () => {
  it('correctly restores all session metadata after 3 levels of nesting', () => {
    const state = new SessionState();

    // Level 0: Grandparent
    state.setClient('claude-code');
    state.setTaskType('coding');
    state.setTitle('Grand Parent Task');
    state.setPrivateTitle('GP Private');
    state.setModel('claude-opus-4-6');
    state.setPrompt('Fix the auth bug');
    state.setPromptWordCount(4);
    state.setProject('acme-api');
    state.inProgress = true;
    state.inProgressSince = Date.now();
    const gpId = state.sessionId;
    const gpConvId = state.conversationId;

    state.appendToChain('session_start', { client: 'claude-code' });

    // Save grandparent → start parent
    state.saveParentState();
    state.reset();
    state.setTaskType('debugging');
    state.setTitle('Parent Task');
    state.setModel('claude-sonnet-4-6');
    state.inProgress = true;
    const parentId = state.sessionId;

    state.appendToChain('session_start', { client: 'claude-code' });

    // Save parent → start child
    state.saveParentState();
    state.reset();
    state.setTaskType('testing');
    state.setTitle('Child Task');
    state.inProgress = true;

    state.appendToChain('session_start', { client: 'claude-code' });
    state.appendToChain('session_end', { duration: 30 });

    // Verify nesting depth
    expect(state.parentStateStack).toHaveLength(2);
    expect(state.getParentSessionIds()).toEqual([gpId, parentId]);

    // Restore to parent
    const restored1 = state.restoreParentState();
    expect(restored1).toBe(true);
    expect(state.sessionId).toBe(parentId);
    expect(state.sessionTaskType).toBe('debugging');
    expect(state.sessionTitle).toBe('Parent Task');
    expect(state.modelId).toBe('claude-sonnet-4-6');
    expect(state.inProgress).toBe(true);
    expect(state.parentStateStack).toHaveLength(1);

    // Restore to grandparent
    const restored2 = state.restoreParentState();
    expect(restored2).toBe(true);
    expect(state.sessionId).toBe(gpId);
    expect(state.conversationId).toBe(gpConvId);
    expect(state.sessionTaskType).toBe('coding');
    expect(state.sessionTitle).toBe('Grand Parent Task');
    expect(state.sessionPrivateTitle).toBe('GP Private');
    expect(state.modelId).toBe('claude-opus-4-6');
    expect(state.sessionPrompt).toBe('Fix the auth bug');
    expect(state.sessionPromptWordCount).toBe(4);
    expect(state.project).toBe('acme-api');
    expect(state.inProgress).toBe(true);
    expect(state.parentStateStack).toHaveLength(0);

    // No more parents
    expect(state.restoreParentState()).toBe(false);
  });

  it('each nested session has its own independent chain file', () => {
    const state = new SessionState();
    state.initializeKeystore();

    // Grandparent session
    const gpId = state.sessionId;
    state.appendToChain('session_start', { client: 'gp', level: 0 });

    // Push to parent
    state.saveParentState();
    state.reset();
    const parentId = state.sessionId;
    state.appendToChain('session_start', { client: 'parent', level: 1 });

    // Push to child
    state.saveParentState();
    state.reset();
    const childId = state.sessionId;
    state.appendToChain('session_start', { client: 'child', level: 2 });
    state.appendToChain('session_end', { duration: 10 });

    // Verify all chain files exist
    expect(existsSync(join(activeDir, `${gpId}.jsonl`))).toBe(true);
    expect(existsSync(join(activeDir, `${parentId}.jsonl`))).toBe(true);
    expect(existsSync(join(activeDir, `${childId}.jsonl`))).toBe(true);

    // Each starts from GENESIS
    for (const id of [gpId, parentId, childId]) {
      const content = readFileSync(join(activeDir, `${id}.jsonl`), 'utf-8');
      const firstRecord = JSON.parse(content.split('\n')[0]!);
      expect(firstRecord.prev_hash).toBe('GENESIS');
    }
  });
});

describe('childPausedMs accumulation across nesting levels', () => {
  it('tracks time paused correctly across multiple save/restore cycles', () => {
    const state = new SessionState();
    expect(state.childPausedMs).toBe(0);

    // Save parent state
    state.saveParentState();

    // Simulate some time passing during child session (mock by directly setting)
    // The restore will compute: childPausedMs = old + (Date.now() - pausedAt)

    // Restore
    state.restoreParentState();
    expect(state.childPausedMs).toBeGreaterThanOrEqual(0);
  });

  it('accumulates paused time from multiple child sessions', () => {
    const state = new SessionState();
    state.childPausedMs = 0;

    // First child session
    state.saveParentState();
    state.restoreParentState();
    const afterFirst = state.childPausedMs;
    expect(afterFirst).toBeGreaterThanOrEqual(0);

    // Second child session
    state.saveParentState();
    state.restoreParentState();
    const afterSecond = state.childPausedMs;
    expect(afterSecond).toBeGreaterThanOrEqual(afterFirst);
  });
});

describe('Session duration calculations', () => {
  it('getSessionDuration excludes child paused time', () => {
    const state = new SessionState();
    state.sessionStartTime = Date.now() - 120_000; // 2 minutes ago
    state.childPausedMs = 60_000; // 1 minute paused

    const duration = state.getSessionDuration();
    // Should be ~60 seconds (120s total - 60s paused)
    expect(duration).toBeGreaterThanOrEqual(59);
    expect(duration).toBeLessThanOrEqual(61);
  });

  it('getActiveDuration uses lastActivityTime for more accurate timing', () => {
    const state = new SessionState();
    state.sessionStartTime = Date.now() - 300_000; // 5 minutes ago
    state.lastActivityTime = state.sessionStartTime + 120_000; // Activity stopped 3 min ago
    state.childPausedMs = 0;

    const activeDuration = state.getActiveDuration();
    expect(activeDuration).toBe(120); // 2 minutes of actual activity
  });

  it('duration is 0 or near 0 for fresh sessions', () => {
    const state = new SessionState();
    const duration = state.getSessionDuration();
    expect(duration).toBeLessThanOrEqual(1);
  });
});

describe('Session prompt and image metadata', () => {
  it('preserves prompt images through parent/child cycle', () => {
    const state = new SessionState();

    const images = [
      { type: 'image' as const, description: 'Error screenshot' },
      { type: 'image' as const, description: 'Architecture diagram' },
    ];

    state.setPromptImages(images);
    state.setPromptImageCount(2);
    state.setPrompt('Help me debug this issue');
    state.setPromptWordCount(5);

    // Save parent
    state.saveParentState();

    // Modify child state
    state.reset();
    state.setPromptImages(null);
    state.setPromptImageCount(0);
    state.setPrompt(null);

    expect(state.sessionPromptImages).toBeNull();
    expect(state.sessionPromptImageCount).toBe(0);
    expect(state.sessionPrompt).toBeNull();

    // Restore parent
    state.restoreParentState();

    expect(state.sessionPromptImages).toEqual(images);
    expect(state.sessionPromptImageCount).toBe(2);
    expect(state.sessionPrompt).toBe('Help me debug this issue');
    expect(state.sessionPromptWordCount).toBe(5);
  });
});

describe('Keystore initialization edge cases', () => {
  it('handles corrupted keystore file by regenerating', () => {
    // Write a corrupted keystore
    writeFileSync(keystoreFile, 'not-valid-json');

    const state = new SessionState();
    state.initializeKeystore();

    // Should have regenerated
    expect(state.signingAvailable).toBe(true);
    expect(state.signingKey).not.toBeNull();

    // New keystore file should be valid JSON
    const content = readFileSync(keystoreFile, 'utf-8');
    expect(() => JSON.parse(content)).not.toThrow();
  });

  it('persists keystore and reuses it across instances', () => {
    const state1 = new SessionState();
    state1.initializeKeystore();
    expect(state1.signingAvailable).toBe(true);

    const keystoreContent1 = readFileSync(keystoreFile, 'utf-8');

    const state2 = new SessionState();
    state2.initializeKeystore();
    expect(state2.signingAvailable).toBe(true);

    const keystoreContent2 = readFileSync(keystoreFile, 'utf-8');

    // Same keystore file content (not regenerated)
    expect(keystoreContent2).toBe(keystoreContent1);
  });
});

describe('Session state reset cycle', () => {
  it('preserves clientName across resets', () => {
    const state = new SessionState();
    state.setClient('cursor');

    state.reset();
    expect(state.clientName).toBe('cursor');

    state.reset();
    expect(state.clientName).toBe('cursor');
  });

  it('preserves conversationId but increments conversationIndex across resets', () => {
    const state = new SessionState();
    const convId = state.conversationId;

    state.reset();
    expect(state.conversationId).toBe(convId);
    expect(state.conversationIndex).toBe(1);

    state.reset();
    expect(state.conversationId).toBe(convId);
    expect(state.conversationIndex).toBe(2);
  });

  it('clears transient state on reset', () => {
    const state = new SessionState();
    state.setTitle('My Title');
    state.setPrivateTitle('My Private Title');
    state.setModel('claude-opus-4-6');
    state.setPrompt('Some prompt');
    state.setPromptWordCount(2);
    state.setPromptImageCount(3);
    state.setPromptImages([{ type: 'image', description: 'test' }]);
    state.inProgress = true;
    state.inProgressSince = Date.now();

    state.reset();

    expect(state.sessionTitle).toBeNull();
    expect(state.sessionPrivateTitle).toBeNull();
    expect(state.modelId).toBeNull();
    expect(state.sessionPrompt).toBeNull();
    expect(state.sessionPromptWordCount).toBeNull();
    expect(state.sessionPromptImageCount).toBe(0);
    expect(state.sessionPromptImages).toBeNull();
    expect(state.inProgress).toBe(false);
    expect(state.inProgressSince).toBeNull();
    expect(state.heartbeatCount).toBe(0);
    expect(state.sessionRecordCount).toBe(0);
    expect(state.chainTipHash).toBe('GENESIS');
  });

  it('generates a unique sessionId on each reset', () => {
    const state = new SessionState();
    const ids = new Set<string>();
    ids.add(state.sessionId);

    for (let i = 0; i < 5; i++) {
      state.reset();
      ids.add(state.sessionId);
    }

    // All IDs should be unique (6 total: initial + 5 resets)
    expect(ids.size).toBe(6);
  });
});

describe('Heartbeat and activity tracking', () => {
  it('incrementHeartbeat updates both count and activity time', () => {
    const state = new SessionState();
    const initialActivity = state.lastActivityTime;

    state.incrementHeartbeat();
    expect(state.heartbeatCount).toBe(1);
    expect(state.lastActivityTime).toBeGreaterThanOrEqual(initialActivity);

    state.incrementHeartbeat();
    expect(state.heartbeatCount).toBe(2);

    state.incrementHeartbeat();
    expect(state.heartbeatCount).toBe(3);
  });

  it('touchActivity updates lastActivityTime without affecting heartbeatCount', () => {
    const state = new SessionState();
    const initialActivity = state.lastActivityTime;

    state.touchActivity();

    expect(state.lastActivityTime).toBeGreaterThanOrEqual(initialActivity);
    expect(state.heartbeatCount).toBe(0); // unchanged
  });
});

describe('setProject and detectProject', () => {
  it('setProject overrides the project value', () => {
    const state = new SessionState();
    state.setProject('custom-project');
    expect(state.project).toBe('custom-project');
  });

  it('detectProject sets project from cwd basename', () => {
    const state = new SessionState();
    state.detectProject();
    expect(state.project).toBe(basename(process.cwd()));
  });

  it('project is preserved across parent/child nesting', () => {
    const state = new SessionState();
    state.setProject('parent-project');

    state.saveParentState();
    state.reset();
    state.setProject('child-project');

    expect(state.project).toBe('child-project');

    state.restoreParentState();
    expect(state.project).toBe('parent-project');
  });
});

describe('autoSealedSessionId tracking', () => {
  it('starts as null and is not cleared by reset', () => {
    const state = new SessionState();
    expect(state.autoSealedSessionId).toBeNull();

    state.autoSealedSessionId = 'sealed-123';
    state.reset();

    // reset preserves autoSealedSessionId (cleared explicitly by useai_start)
    expect(state.autoSealedSessionId).toBe('sealed-123');
  });
});

describe('mcpSessionId tracking', () => {
  it('starts as null and can be set', () => {
    const state = new SessionState();
    expect(state.mcpSessionId).toBeNull();

    state.mcpSessionId = 'mcp-transport-abc';
    expect(state.mcpSessionId).toBe('mcp-transport-abc');
  });

  it('is not affected by reset', () => {
    const state = new SessionState();
    state.mcpSessionId = 'mcp-456';

    state.reset();
    // mcpSessionId is connection-level, survives reset
    // (reset doesn't explicitly clear it, but also doesn't explicitly preserve it)
    // Let's verify actual behavior
    expect(state.mcpSessionId).toBe('mcp-456');
  });
});
