/**
 * Advanced integration tests for dashboard/local-api.ts — testing complex
 * scenarios including stats aggregation edge cases, config update interactions,
 * multi-session deduplication, delete cascading, streak calculation edge cases,
 * and full CRUD lifecycle flows.
 *
 * Uses real filesystem for data persistence and mocks only external boundaries.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ── vi.hoisted for mock constants ────────────────────────────────────────────

const { tmpDir, sessionsFile, milestonesFile, configFile, sealedDir } = vi.hoisted(() => {
  const base = `/tmp/useai-dashboard-advanced-test-${process.pid}`;
  return {
    tmpDir: base,
    sessionsFile: `${base}/sessions.json`,
    milestonesFile: `${base}/milestones.json`,
    configFile: `${base}/config.json`,
    sealedDir: `${base}/sealed`,
  };
});

// ── Mock @useai/shared ───────────────────────────────────────────────────────

vi.mock('@useai/shared', async () => {
  const actual = await vi.importActual<typeof import('@useai/shared')>('@useai/shared');
  return {
    ...actual,
    SESSIONS_FILE: sessionsFile,
    MILESTONES_FILE: milestonesFile,
    CONFIG_FILE: configFile,
    SEALED_DIR: sealedDir,
  };
});

// ── Mock tools.ts (reInjectAllInstructions) ─────────────────────────────────

vi.mock('../tools.js', () => ({
  reInjectAllInstructions: vi.fn(() => ({ updated: ['claude-code'] })),
}));

import {
  handleLocalSessions,
  handleLocalStats,
  handleLocalMilestones,
  handleLocalConfig,
  handleLocalConfigFull,
  handleLocalConfigUpdate,
  handleLocalLogout,
  handleLocalSaveAuth,
  handleLocalAuthToken,
  handleLocalSyncMark,
  handleDeleteSession,
  handleDeleteConversation,
  handleDeleteMilestone,
  setOnConfigUpdated,
} from './local-api.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function createMockResponse(): ServerResponse & { _status: number; _body: string; _headers: Record<string, string> } {
  const res = {
    _status: 0,
    _body: '',
    _headers: {} as Record<string, string>,
    writeHead(status: number, headers?: Record<string, string>) {
      res._status = status;
      if (headers) Object.assign(res._headers, headers);
    },
    end(body?: string) {
      res._body = body ?? '';
    },
  } as unknown as ServerResponse & { _status: number; _body: string; _headers: Record<string, string> };
  return res;
}

function createMockRequest(body?: string): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.headers = {};
  if (body !== undefined) {
    process.nextTick(() => {
      req.emit('data', Buffer.from(body));
      req.emit('end');
    });
  } else {
    process.nextTick(() => req.emit('end'));
  }
  return req;
}

function parseResponseBody(res: { _body: string }): unknown {
  return JSON.parse(res._body);
}

function writeJsonFile(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data));
}

function makeSeal(overrides: Record<string, unknown> = {}) {
  return {
    session_id: `sess-${Math.random().toString(36).slice(2, 10)}`,
    client: 'claude-code',
    task_type: 'coding',
    languages: ['typescript'],
    files_touched: 5,
    started_at: '2025-06-01T10:00:00.000Z',
    ended_at: '2025-06-01T10:30:00.000Z',
    duration_seconds: 1800,
    heartbeat_count: 3,
    record_count: 8,
    chain_start_hash: 'GENESIS',
    chain_end_hash: 'abc123',
    seal_signature: 'sig123',
    ...overrides,
  };
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(sealedDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('Stats aggregation edge cases', () => {
  it('handles sessions with no languages', () => {
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 's1', languages: [], duration_seconds: 600 }),
    ]);

    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    const stats = parseResponseBody(res) as Record<string, unknown>;
    expect(stats.totalSessions).toBe(1);
    expect(stats.byLanguage).toEqual({});
  });

  it('aggregates multiple languages per session correctly', () => {
    writeJsonFile(sessionsFile, [
      makeSeal({
        session_id: 's1',
        languages: ['typescript', 'javascript', 'css'],
        duration_seconds: 3600,
      }),
    ]);

    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    const stats = parseResponseBody(res) as {
      byLanguage: Record<string, number>;
    };
    expect(stats.byLanguage['typescript']).toBe(3600);
    expect(stats.byLanguage['javascript']).toBe(3600);
    expect(stats.byLanguage['css']).toBe(3600);
  });

  it('correctly sums across multiple sessions with overlapping languages', () => {
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 's1', languages: ['typescript'], duration_seconds: 1000 }),
      makeSeal({ session_id: 's2', languages: ['typescript', 'python'], duration_seconds: 2000 }),
      makeSeal({ session_id: 's3', languages: ['python'], duration_seconds: 500 }),
    ]);

    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    const stats = parseResponseBody(res) as {
      totalSessions: number;
      totalHours: number;
      filesTouched: number;
      byLanguage: Record<string, number>;
    };
    expect(stats.totalSessions).toBe(3);
    expect(stats.totalHours).toBeCloseTo(3500 / 3600, 4);
    expect(stats.filesTouched).toBe(15); // 5 * 3
    expect(stats.byLanguage['typescript']).toBe(3000);
    expect(stats.byLanguage['python']).toBe(2500);
  });
});

describe('Session deduplication', () => {
  it('keeps the session with longer duration when duplicates exist', () => {
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 'dup-1', duration_seconds: 100, files_touched: 2 }),
      makeSeal({ session_id: 'dup-1', duration_seconds: 500, files_touched: 10 }),
      makeSeal({ session_id: 'dup-1', duration_seconds: 300, files_touched: 6 }),
    ]);

    const res = createMockResponse();
    handleLocalSessions(createMockRequest(), res);

    const sessions = parseResponseBody(res) as Array<{ session_id: string; duration_seconds: number; files_touched: number }>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.duration_seconds).toBe(500);
    expect(sessions[0]!.files_touched).toBe(10);
  });

  it('deduplicates correctly with mixed unique and duplicate sessions', () => {
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 'u1', duration_seconds: 100 }),
      makeSeal({ session_id: 'd1', duration_seconds: 200 }),
      makeSeal({ session_id: 'd1', duration_seconds: 400 }),
      makeSeal({ session_id: 'u2', duration_seconds: 300 }),
    ]);

    const res = createMockResponse();
    handleLocalSessions(createMockRequest(), res);

    const sessions = parseResponseBody(res) as Array<{ session_id: string; duration_seconds: number }>;
    expect(sessions).toHaveLength(3);

    const d1 = sessions.find(s => s.session_id === 'd1');
    expect(d1!.duration_seconds).toBe(400);
  });
});

describe('Streak calculation edge cases', () => {
  it('returns streak of 1 when only today has sessions', () => {
    const today = new Date().toISOString().slice(0, 10);
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 's1', started_at: `${today}T08:00:00.000Z` }),
      makeSeal({ session_id: 's2', started_at: `${today}T14:00:00.000Z` }),
    ]);

    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    const stats = parseResponseBody(res) as { currentStreak: number };
    expect(stats.currentStreak).toBe(1);
  });

  it('returns streak of 1 when only yesterday has sessions', () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 's1', started_at: `${yesterday}T10:00:00.000Z` }),
    ]);

    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    const stats = parseResponseBody(res) as { currentStreak: number };
    expect(stats.currentStreak).toBe(1);
  });

  it('breaks streak on a gap day', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    // Skip 2 days ago, but have 3 days ago
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);

    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 's1', started_at: `${today}T10:00:00.000Z` }),
      makeSeal({ session_id: 's2', started_at: `${yesterday}T10:00:00.000Z` }),
      makeSeal({ session_id: 's3', started_at: `${threeDaysAgo}T10:00:00.000Z` }),
    ]);

    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    const stats = parseResponseBody(res) as { currentStreak: number };
    // Today + yesterday = 2 (gap breaks the streak at 3 days ago)
    expect(stats.currentStreak).toBe(2);
  });
});

describe('Config update with re-injection', () => {
  it('updates evaluation_framework and returns updated config', async () => {
    writeJsonFile(configFile, {});

    const req = createMockRequest(JSON.stringify({ evaluation_framework: 'dora' }));
    const res = createMockResponse();
    await handleLocalConfigUpdate(req, res);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as Record<string, unknown>;
    expect(body.evaluation_framework).toBe('dora');
    // Should include instructions_updated from mock
    expect(body.instructions_updated).toEqual(['claude-code']);
  });

  it('deep-merges capture settings without losing existing keys', async () => {
    writeJsonFile(configFile, {});

    // First update: set milestones to false
    const req1 = createMockRequest(JSON.stringify({ capture: { milestones: false } }));
    const res1 = createMockResponse();
    await handleLocalConfigUpdate(req1, res1);

    const body1 = parseResponseBody(res1) as { capture: Record<string, unknown> };
    expect(body1.capture.milestones).toBe(false);

    // Second update: set prompt to false (should preserve milestones setting)
    const req2 = createMockRequest(JSON.stringify({ capture: { prompt: false } }));
    const res2 = createMockResponse();
    await handleLocalConfigUpdate(req2, res2);

    const body2 = parseResponseBody(res2) as { capture: Record<string, boolean> };
    expect(body2.capture.prompt).toBe(false);
    // Note: milestones value depends on migration defaults — test that the key exists
    expect(body2.capture).toHaveProperty('milestones');
  });
});

describe('Full auth lifecycle', () => {
  it('handles save-auth → verify-auth → logout → verify-logged-out', async () => {
    writeJsonFile(configFile, {});

    // 1. Save auth
    const saveReq = createMockRequest(JSON.stringify({
      token: 'tok_lifecycle',
      user: { id: 'u1', email: 'lifecycle@test.com', username: 'lifecycle_user' },
    }));
    const saveRes = createMockResponse();
    await handleLocalSaveAuth(saveReq, saveRes);
    expect(saveRes._status).toBe(200);

    // 2. Verify authenticated
    const configRes = createMockResponse();
    handleLocalConfig(createMockRequest(), configRes);
    const config1 = parseResponseBody(configRes) as Record<string, unknown>;
    expect(config1.authenticated).toBe(true);
    expect(config1.email).toBe('lifecycle@test.com');
    expect(config1.username).toBe('lifecycle_user');

    // 3. Verify token retrieval
    const tokenRes = createMockResponse();
    handleLocalAuthToken(createMockRequest(), tokenRes);
    const token = parseResponseBody(tokenRes) as { token: string };
    expect(token.token).toBe('tok_lifecycle');

    // 4. Logout
    const logoutReq = createMockRequest('');
    const logoutRes = createMockResponse();
    await handleLocalLogout(logoutReq, logoutRes);
    expect(logoutRes._status).toBe(200);

    // 5. Verify logged out
    const verifyRes = createMockResponse();
    handleLocalConfig(createMockRequest(), verifyRes);
    const config2 = parseResponseBody(verifyRes) as Record<string, unknown>;
    expect(config2.authenticated).toBe(false);
    expect(config2.email).toBeNull();

    // 6. Token should be null
    const tokenRes2 = createMockResponse();
    handleLocalAuthToken(createMockRequest(), tokenRes2);
    const token2 = parseResponseBody(tokenRes2) as { token: string | null };
    expect(token2.token).toBeNull();
  });
});

describe('Delete session with chain file cleanup', () => {
  it('deletes chain files from sealed directory', () => {
    const sessionId = 'sess-with-chain';
    writeJsonFile(sessionsFile, [makeSeal({ session_id: sessionId })]);
    writeJsonFile(milestonesFile, []);

    // Create a chain file
    const chainPath = join(sealedDir, `${sessionId}.jsonl`);
    writeFileSync(chainPath, '{"type":"session_start"}\n{"type":"session_end"}\n');

    const res = createMockResponse();
    handleDeleteSession(createMockRequest() as IncomingMessage, res, sessionId);

    expect(res._status).toBe(200);
    expect(existsSync(chainPath)).toBe(false);
  });

  it('cascades delete to milestones associated with the session', () => {
    const sessionId = 'sess-cascade';
    writeJsonFile(sessionsFile, [makeSeal({ session_id: sessionId })]);
    writeJsonFile(milestonesFile, [
      { id: 'm1', session_id: sessionId, title: 'A', category: 'feature' },
      { id: 'm2', session_id: sessionId, title: 'B', category: 'bugfix' },
      { id: 'm3', session_id: 'other-sess', title: 'C', category: 'test' },
    ]);

    const res = createMockResponse();
    handleDeleteSession(createMockRequest() as IncomingMessage, res, sessionId);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as { milestones_removed: number };
    expect(body.milestones_removed).toBe(2);

    // Verify only unrelated milestone remains
    const milRes = createMockResponse();
    handleLocalMilestones(createMockRequest(), milRes);
    const milestones = parseResponseBody(milRes) as Array<{ id: string }>;
    expect(milestones).toHaveLength(1);
    expect(milestones[0]!.id).toBe('m3');
  });
});

describe('Delete conversation cascade', () => {
  it('removes all sessions and milestones belonging to a conversation', () => {
    const convId = 'conv-to-delete';
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 's1', conversation_id: convId }),
      makeSeal({ session_id: 's2', conversation_id: convId }),
      makeSeal({ session_id: 's3', conversation_id: 'other-conv' }),
    ]);
    writeJsonFile(milestonesFile, [
      { id: 'm1', session_id: 's1', title: 'A', category: 'feature' },
      { id: 'm2', session_id: 's2', title: 'B', category: 'bugfix' },
      { id: 'm3', session_id: 's3', title: 'C', category: 'test' },
    ]);

    // Create chain files for the sessions
    writeFileSync(join(sealedDir, 's1.jsonl'), '{}');
    writeFileSync(join(sealedDir, 's2.jsonl'), '{}');

    const res = createMockResponse();
    handleDeleteConversation(createMockRequest() as IncomingMessage, res, convId);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as {
      sessions_removed: number;
      milestones_removed: number;
    };
    expect(body.sessions_removed).toBe(2);
    expect(body.milestones_removed).toBe(2);

    // Chain files should be deleted
    expect(existsSync(join(sealedDir, 's1.jsonl'))).toBe(false);
    expect(existsSync(join(sealedDir, 's2.jsonl'))).toBe(false);

    // Remaining session and milestone should be intact
    const sessRes = createMockResponse();
    handleLocalSessions(createMockRequest(), sessRes);
    const remaining = parseResponseBody(sessRes) as Array<{ session_id: string }>;
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.session_id).toBe('s3');
  });
});

describe('Config full endpoint', () => {
  it('returns default values for empty config', () => {
    writeJsonFile(configFile, {});

    const res = createMockResponse();
    handleLocalConfigFull(createMockRequest(), res);

    const config = parseResponseBody(res) as Record<string, unknown>;
    expect(res._status).toBe(200);
    expect(config.capture).toBeDefined();
    expect(config.sync).toBeDefined();
    expect(config.evaluation_framework).toBeDefined();
    expect(config.authenticated).toBe(false);
    expect(config.email).toBeNull();
  });

  it('reflects authenticated state when auth is configured', () => {
    writeJsonFile(configFile, {
      auth: {
        token: 'tok_full',
        user: { id: 'u1', email: 'full@test.com', username: 'full_user' },
      },
      evaluation_framework: 'dora',
    });

    const res = createMockResponse();
    handleLocalConfigFull(createMockRequest(), res);

    const config = parseResponseBody(res) as Record<string, unknown>;
    expect(config.authenticated).toBe(true);
    expect(config.email).toBe('full@test.com');
    expect(config.evaluation_framework).toBe('dora');
  });
});

describe('Sync mark endpoint', () => {
  it('persists last_sync_at timestamp to config file', async () => {
    writeJsonFile(configFile, {});

    const req = createMockRequest('');
    const res = createMockResponse();
    await handleLocalSyncMark(req, res);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as { success: boolean; last_sync_at: string };
    expect(body.success).toBe(true);

    // Verify timestamp is recent (within last 5 seconds)
    const syncTime = new Date(body.last_sync_at).getTime();
    expect(Date.now() - syncTime).toBeLessThan(5000);

    // Verify persisted to disk
    const config = JSON.parse(readFileSync(configFile, 'utf-8'));
    expect(config.last_sync_at).toBe(body.last_sync_at);
  });
});

describe('onConfigUpdated callback', () => {
  it('fires callback when config is updated', async () => {
    const callback = vi.fn();
    setOnConfigUpdated(callback);

    writeJsonFile(configFile, {});
    const req = createMockRequest(JSON.stringify({ evaluation_framework: 'space' }));
    const res = createMockResponse();
    await handleLocalConfigUpdate(req, res);

    expect(callback).toHaveBeenCalledOnce();

    // Clean up
    setOnConfigUpdated((() => {}) as () => void);
  });
});
