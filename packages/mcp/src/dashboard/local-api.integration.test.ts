/**
 * Integration tests for dashboard/local-api.ts — HTTP request handlers for the
 * local dashboard API (sessions, stats, milestones, config, delete, auth, etc.).
 *
 * Uses real filesystem for data persistence and mocks only the external API
 * boundary (@useai/shared constants + tools.ts reInjectAllInstructions).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ── vi.hoisted for mock constants ────────────────────────────────────────────

const { tmpDir, sessionsFile, milestonesFile, configFile, sealedDir } = vi.hoisted(() => {
  const base = `/tmp/useai-local-api-test-${process.pid}`;
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
  reInjectAllInstructions: vi.fn(() => ({ updated: [] })),
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
  // For requests with a body, emit data + end immediately
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
    session_id: 'sess-001',
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

describe('handleLocalSessions', () => {
  it('returns empty array when sessions file does not exist', () => {
    const res = createMockResponse();
    handleLocalSessions(createMockRequest(), res);
    expect(res._status).toBe(200);
    expect(parseResponseBody(res)).toEqual([]);
  });

  it('returns deduplicated sessions from sessions file', () => {
    const seal1 = makeSeal({ session_id: 'sess-001', duration_seconds: 100 });
    const seal2 = makeSeal({ session_id: 'sess-001', duration_seconds: 200 });
    const seal3 = makeSeal({ session_id: 'sess-002', duration_seconds: 300 });
    writeJsonFile(sessionsFile, [seal1, seal2, seal3]);

    const res = createMockResponse();
    handleLocalSessions(createMockRequest(), res);

    expect(res._status).toBe(200);
    const sessions = parseResponseBody(res) as Array<{ session_id: string; duration_seconds: number }>;
    expect(sessions).toHaveLength(2);
    // Should keep the longer-duration entry for sess-001
    const s1 = sessions.find(s => s.session_id === 'sess-001');
    expect(s1?.duration_seconds).toBe(200);
  });
});

describe('handleLocalStats', () => {
  it('returns zero stats when sessions file does not exist', () => {
    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    expect(res._status).toBe(200);
    const stats = parseResponseBody(res) as Record<string, unknown>;
    expect(stats.totalHours).toBe(0);
    expect(stats.totalSessions).toBe(0);
    expect(stats.filesTouched).toBe(0);
  });

  it('aggregates stats correctly from sessions', () => {
    const seal1 = makeSeal({
      session_id: 'sess-001',
      duration_seconds: 3600,
      files_touched: 10,
      languages: ['typescript', 'javascript'],
      client: 'claude-code',
      task_type: 'coding',
    });
    const seal2 = makeSeal({
      session_id: 'sess-002',
      duration_seconds: 1800,
      files_touched: 5,
      languages: ['python'],
      client: 'cursor',
      task_type: 'debugging',
      started_at: '2025-06-02T10:00:00.000Z',
    });
    writeJsonFile(sessionsFile, [seal1, seal2]);

    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    expect(res._status).toBe(200);
    const stats = parseResponseBody(res) as {
      totalHours: number;
      totalSessions: number;
      filesTouched: number;
      byClient: Record<string, number>;
      byLanguage: Record<string, number>;
      byTaskType: Record<string, number>;
    };
    expect(stats.totalHours).toBe(5400 / 3600);
    expect(stats.totalSessions).toBe(2);
    expect(stats.filesTouched).toBe(15);
    expect(stats.byClient['claude-code']).toBe(3600);
    expect(stats.byClient['cursor']).toBe(1800);
    expect(stats.byLanguage['typescript']).toBe(3600);
    expect(stats.byLanguage['python']).toBe(1800);
    expect(stats.byTaskType['coding']).toBe(3600);
    expect(stats.byTaskType['debugging']).toBe(1800);
  });

  it('calculates streak correctly for consecutive days', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);

    const sessions = [
      makeSeal({ session_id: 's1', started_at: `${today}T10:00:00.000Z` }),
      makeSeal({ session_id: 's2', started_at: `${yesterday}T10:00:00.000Z` }),
      makeSeal({ session_id: 's3', started_at: `${twoDaysAgo}T10:00:00.000Z` }),
    ];
    writeJsonFile(sessionsFile, sessions);

    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    const stats = parseResponseBody(res) as { currentStreak: number };
    expect(stats.currentStreak).toBe(3);
  });

  it('returns streak of 0 when most recent session is older than yesterday', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10);
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 's1', started_at: `${threeDaysAgo}T10:00:00.000Z` }),
    ]);

    const res = createMockResponse();
    handleLocalStats(createMockRequest(), res);

    const stats = parseResponseBody(res) as { currentStreak: number };
    expect(stats.currentStreak).toBe(0);
  });
});

describe('handleLocalMilestones', () => {
  it('returns empty array when milestones file does not exist', () => {
    const res = createMockResponse();
    handleLocalMilestones(createMockRequest(), res);
    expect(res._status).toBe(200);
    expect(parseResponseBody(res)).toEqual([]);
  });

  it('returns milestones from file', () => {
    const milestones = [
      { id: 'm1', session_id: 'sess-001', title: 'First feature', category: 'feature' },
      { id: 'm2', session_id: 'sess-002', title: 'Bug fix', category: 'bugfix' },
    ];
    writeJsonFile(milestonesFile, milestones);

    const res = createMockResponse();
    handleLocalMilestones(createMockRequest(), res);
    expect(res._status).toBe(200);
    expect(parseResponseBody(res)).toEqual(milestones);
  });
});

describe('handleLocalConfig', () => {
  it('returns config summary with defaults when config file does not exist', () => {
    const res = createMockResponse();
    handleLocalConfig(createMockRequest(), res);

    expect(res._status).toBe(200);
    const config = parseResponseBody(res) as Record<string, unknown>;
    expect(config.authenticated).toBe(false);
    expect(config.email).toBeNull();
    expect(config.username).toBeNull();
    expect(config.auto_sync).toBeDefined();
  });

  it('returns authenticated status when auth token is present', () => {
    writeJsonFile(configFile, {
      auth: {
        token: 'tok_abc123',
        user: { id: 'u1', email: 'test@example.com', username: 'testuser' },
      },
    });

    const res = createMockResponse();
    handleLocalConfig(createMockRequest(), res);

    expect(res._status).toBe(200);
    const config = parseResponseBody(res) as Record<string, unknown>;
    expect(config.authenticated).toBe(true);
    expect(config.email).toBe('test@example.com');
    expect(config.username).toBe('testuser');
  });
});

describe('handleLocalConfigFull', () => {
  it('returns full config with capture, sync, and evaluation_framework', () => {
    writeJsonFile(configFile, {
      evaluation_framework: 'space',
    });

    const res = createMockResponse();
    handleLocalConfigFull(createMockRequest(), res);

    expect(res._status).toBe(200);
    const config = parseResponseBody(res) as Record<string, unknown>;
    expect(config.evaluation_framework).toBe('space');
    expect(config.capture).toBeDefined();
    expect(config.sync).toBeDefined();
    expect(config.authenticated).toBe(false);
  });
});

describe('handleLocalConfigUpdate', () => {
  it('updates evaluation_framework in config', async () => {
    writeJsonFile(configFile, {});
    const req = createMockRequest(JSON.stringify({ evaluation_framework: 'dora' }));
    const res = createMockResponse();

    await handleLocalConfigUpdate(req, res);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as Record<string, unknown>;
    expect(body.evaluation_framework).toBe('dora');
  });

  it('deep-merges capture settings', async () => {
    writeJsonFile(configFile, {});
    const req = createMockRequest(JSON.stringify({ capture: { milestones: false } }));
    const res = createMockResponse();

    await handleLocalConfigUpdate(req, res);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as { capture: { milestones: boolean } };
    expect(body.capture.milestones).toBe(false);
  });

  it('deep-merges sync settings including nested include', async () => {
    writeJsonFile(configFile, {});
    const req = createMockRequest(JSON.stringify({
      sync: { enabled: true, include: { milestones: false } },
    }));
    const res = createMockResponse();

    await handleLocalConfigUpdate(req, res);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as { sync: { enabled: boolean; include: { milestones: boolean } } };
    expect(body.sync.enabled).toBe(true);
    expect(body.sync.include.milestones).toBe(false);
  });

  it('calls onConfigUpdated callback when registered', async () => {
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

describe('handleLocalSaveAuth', () => {
  it('saves auth token and user to config file', async () => {
    writeJsonFile(configFile, {});
    const req = createMockRequest(JSON.stringify({
      token: 'tok_new',
      user: { id: 'u2', email: 'new@example.com', username: 'newuser' },
    }));
    const res = createMockResponse();

    await handleLocalSaveAuth(req, res);

    expect(res._status).toBe(200);
    expect(parseResponseBody(res)).toEqual({ success: true });

    // Verify via handleLocalConfig
    const verifyRes = createMockResponse();
    handleLocalConfig(createMockRequest(), verifyRes);
    const config = parseResponseBody(verifyRes) as Record<string, unknown>;
    expect(config.authenticated).toBe(true);
    expect(config.email).toBe('new@example.com');
  });

  it('returns 400 when token or user is missing', async () => {
    writeJsonFile(configFile, {});
    const req = createMockRequest(JSON.stringify({ token: 'tok_only' }));
    const res = createMockResponse();

    await handleLocalSaveAuth(req, res);

    expect(res._status).toBe(400);
    const body = parseResponseBody(res) as { error: string };
    expect(body.error).toContain('Missing token or user');
  });
});

describe('handleLocalAuthToken', () => {
  it('returns null token when not authenticated', () => {
    writeJsonFile(configFile, {});
    const res = createMockResponse();
    handleLocalAuthToken(createMockRequest(), res);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as { token: string | null };
    expect(body.token).toBeNull();
  });

  it('returns saved token when authenticated', () => {
    writeJsonFile(configFile, { auth: { token: 'tok_saved' } });
    const res = createMockResponse();
    handleLocalAuthToken(createMockRequest(), res);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as { token: string };
    expect(body.token).toBe('tok_saved');
  });
});

describe('handleLocalSyncMark', () => {
  it('updates last_sync_at timestamp in config', async () => {
    writeJsonFile(configFile, {});
    const req = createMockRequest('');
    const res = createMockResponse();

    await handleLocalSyncMark(req, res);

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as { success: boolean; last_sync_at: string };
    expect(body.success).toBe(true);
    expect(body.last_sync_at).toBeDefined();
    // Verify it's a valid ISO date
    expect(new Date(body.last_sync_at).toISOString()).toBe(body.last_sync_at);
  });
});

describe('handleLocalLogout', () => {
  it('removes auth from config', async () => {
    writeJsonFile(configFile, {
      auth: { token: 'tok_existing', user: { id: 'u1', email: 'user@test.com' } },
    });
    const req = createMockRequest('');
    const res = createMockResponse();

    await handleLocalLogout(req, res);

    expect(res._status).toBe(200);
    expect(parseResponseBody(res)).toEqual({ success: true });

    // Verify auth is removed
    const verifyRes = createMockResponse();
    handleLocalConfig(createMockRequest(), verifyRes);
    const config = parseResponseBody(verifyRes) as Record<string, unknown>;
    expect(config.authenticated).toBe(false);
  });
});

describe('handleDeleteSession', () => {
  it('deletes a session and its milestones', () => {
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 'sess-to-delete' }),
      makeSeal({ session_id: 'sess-to-keep' }),
    ]);
    writeJsonFile(milestonesFile, [
      { id: 'm1', session_id: 'sess-to-delete', title: 'A', category: 'feature' },
      { id: 'm2', session_id: 'sess-to-keep', title: 'B', category: 'bugfix' },
    ]);

    const res = createMockResponse();
    handleDeleteSession(createMockRequest() as IncomingMessage, res, 'sess-to-delete');

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as { deleted: boolean; milestones_removed: number };
    expect(body.deleted).toBe(true);
    expect(body.milestones_removed).toBe(1);

    // Verify session is removed
    const sessRes = createMockResponse();
    handleLocalSessions(createMockRequest(), sessRes);
    const sessions = parseResponseBody(sessRes) as Array<{ session_id: string }>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.session_id).toBe('sess-to-keep');
  });

  it('deletes chain file from sealed directory', () => {
    writeJsonFile(sessionsFile, [makeSeal({ session_id: 'sess-chain' })]);
    writeJsonFile(milestonesFile, []);
    const chainPath = join(sealedDir, 'sess-chain.jsonl');
    writeFileSync(chainPath, '{}');

    const res = createMockResponse();
    handleDeleteSession(createMockRequest() as IncomingMessage, res, 'sess-chain');

    expect(res._status).toBe(200);
    expect(existsSync(chainPath)).toBe(false);
  });

  it('returns 404 when session not found', () => {
    writeJsonFile(sessionsFile, []);
    const res = createMockResponse();
    handleDeleteSession(createMockRequest() as IncomingMessage, res, 'nonexistent');

    expect(res._status).toBe(404);
  });
});

describe('handleDeleteConversation', () => {
  it('deletes all sessions in a conversation and their milestones', () => {
    writeJsonFile(sessionsFile, [
      makeSeal({ session_id: 'sess-1', conversation_id: 'conv-target' }),
      makeSeal({ session_id: 'sess-2', conversation_id: 'conv-target' }),
      makeSeal({ session_id: 'sess-3', conversation_id: 'conv-other' }),
    ]);
    writeJsonFile(milestonesFile, [
      { id: 'm1', session_id: 'sess-1', title: 'A', category: 'feature' },
      { id: 'm2', session_id: 'sess-2', title: 'B', category: 'bugfix' },
      { id: 'm3', session_id: 'sess-3', title: 'C', category: 'test' },
    ]);

    const res = createMockResponse();
    handleDeleteConversation(createMockRequest() as IncomingMessage, res, 'conv-target');

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as {
      deleted: boolean;
      sessions_removed: number;
      milestones_removed: number;
    };
    expect(body.deleted).toBe(true);
    expect(body.sessions_removed).toBe(2);
    expect(body.milestones_removed).toBe(2);
  });

  it('returns 404 when conversation not found', () => {
    writeJsonFile(sessionsFile, []);
    const res = createMockResponse();
    handleDeleteConversation(createMockRequest() as IncomingMessage, res, 'nonexistent');
    expect(res._status).toBe(404);
  });
});

describe('handleDeleteMilestone', () => {
  it('deletes a specific milestone by id', () => {
    writeJsonFile(milestonesFile, [
      { id: 'm1', session_id: 'sess-1', title: 'Keep', category: 'feature' },
      { id: 'm2', session_id: 'sess-1', title: 'Delete', category: 'bugfix' },
    ]);

    const res = createMockResponse();
    handleDeleteMilestone(createMockRequest() as IncomingMessage, res, 'm2');

    expect(res._status).toBe(200);
    const body = parseResponseBody(res) as { deleted: boolean; milestone_id: string };
    expect(body.deleted).toBe(true);
    expect(body.milestone_id).toBe('m2');

    // Verify only m1 remains
    const milRes = createMockResponse();
    handleLocalMilestones(createMockRequest(), milRes);
    const milestones = parseResponseBody(milRes) as Array<{ id: string }>;
    expect(milestones).toHaveLength(1);
    expect(milestones[0]!.id).toBe('m1');
  });

  it('returns 404 when milestone not found', () => {
    writeJsonFile(milestonesFile, []);
    const res = createMockResponse();
    handleDeleteMilestone(createMockRequest() as IncomingMessage, res, 'nonexistent');
    expect(res._status).toBe(404);
  });
});

describe('CORS headers', () => {
  it('includes CORS headers in responses', () => {
    const res = createMockResponse();
    handleLocalSessions(createMockRequest(), res);

    expect(res._headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res._headers['Access-Control-Allow-Methods']).toContain('GET');
    expect(res._headers['Content-Type']).toBe('application/json');
  });
});
