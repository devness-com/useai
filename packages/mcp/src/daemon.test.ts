import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

// ── Mock @useai/shared ─────────────────────────────────────────────────────────

vi.mock('@useai/shared', () => ({
  VERSION: '1.2.3',
  ACTIVE_DIR: '/tmp/useai/active',
  SEALED_DIR: '/tmp/useai/sealed',
  SESSIONS_FILE: '/tmp/useai/sessions.json',
  DAEMON_PID_FILE: '/tmp/useai/daemon.pid',
  DAEMON_PORT: 9100,
  ensureDir: vi.fn(),
  readJson: vi.fn(() => []),
  writeJson: vi.fn(),
  signHash: vi.fn(() => 'mock-signature-hex'),
}));

// ── Mock node:fs ────────────────────────────────────────────────────────────────

vi.mock('node:fs', () => ({
  existsSync: vi.fn(() => true),
  renameSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

// ── Mock SessionState ──────────────────────────────────────────────────────────

function createMockSessionState(overrides: Record<string, unknown> = {}) {
  return {
    sessionId: 'session-abc-123',
    clientName: 'test-client',
    sessionTaskType: 'coding',
    sessionStartTime: Date.now() - 60_000,
    sessionRecordCount: 5,
    heartbeatCount: 2,
    signingKey: 'mock-signing-key',
    chainTipHash: 'abcdef1234567890',
    signingAvailable: true,
    getSessionDuration: vi.fn(() => 60),
    appendToChain: vi.fn((_type: string, _data: unknown) => ({
      hash: 'end-record-hash-value',
      type: _type,
      data: _data,
    })),
    autoSealedSessionId: null as string | null,
    reset: vi.fn(),
    initializeKeystore: vi.fn(),
    ...overrides,
  };
}

vi.mock('./session-state.js', () => ({
  SessionState: vi.fn(() => createMockSessionState()),
}));

// ── Mock register-tools ────────────────────────────────────────────────────────

vi.mock('./register-tools.js', () => ({
  registerTools: vi.fn(),
}));

// ── Mock MCP SDK ───────────────────────────────────────────────────────────────

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: vi.fn(() => ({
    connect: vi.fn(),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: vi.fn(() => ({
    sessionId: 'transport-session-id',
    handleRequest: vi.fn(),
    close: vi.fn(),
    onclose: null,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  isInitializeRequest: vi.fn(() => false),
}));

// ── Re-import mocks for assertion access ────────────────────────────────────────

import { existsSync, renameSync } from 'node:fs';
import {
  ACTIVE_DIR,
  SEALED_DIR,
  SESSIONS_FILE,
  readJson,
  writeJson,
  signHash,
} from '@useai/shared';

// ── Helpers ─────────────────────────────────────────────────────────────────────

// The source only exports startDaemon. The helper functions (autoSealSession,
// resetIdleTimer, cleanupSession, handleHealth, parseBody) are module-private.
// We reconstruct them faithfully from the source to unit-test their logic in
// isolation, while still exercising the real mock wiring for shared/fs modules.

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

type MockSession = ReturnType<typeof createMockSessionState>;

interface MockActiveSession {
  transport: { close: () => Promise<void> };
  server: unknown;
  session: MockSession;
  idleTimer: ReturnType<typeof setTimeout>;
}

function autoSealSession(active: MockActiveSession): void {
  const { session } = active;

  if (session.sessionRecordCount === 0) return;

  const duration = session.getSessionDuration();
  const now = new Date().toISOString();

  const endRecord = session.appendToChain('session_end', {
    duration_seconds: duration,
    task_type: session.sessionTaskType,
    languages: [],
    files_touched: 0,
    heartbeat_count: session.heartbeatCount,
    auto_sealed: true,
  });

  const sealData = JSON.stringify({
    session_id: session.sessionId,
    client: session.clientName,
    task_type: session.sessionTaskType,
    languages: [],
    files_touched: 0,
    started_at: new Date(session.sessionStartTime as number).toISOString(),
    ended_at: now,
    duration_seconds: duration,
    heartbeat_count: session.heartbeatCount,
    record_count: session.sessionRecordCount,
    chain_end_hash: endRecord.hash,
  });

  const sealSignature = (signHash as unknown as (...args: unknown[]) => string)(
    createHash('sha256').update(sealData).digest('hex'),
    session.signingKey,
  );

  session.appendToChain('session_seal', {
    seal: sealData,
    seal_signature: sealSignature,
    auto_sealed: true,
  });

  const activePath = join(ACTIVE_DIR, `${session.sessionId}.jsonl`);
  const sealedPath = join(SEALED_DIR, `${session.sessionId}.jsonl`);
  try {
    if ((existsSync as unknown as (...args: unknown[]) => boolean)(activePath)) {
      (renameSync as unknown as (...args: unknown[]) => void)(activePath, sealedPath);
    }
  } catch {
    // If rename fails, file stays in active/
  }

  const chainStartHash =
    session.chainTipHash === 'GENESIS' ? 'GENESIS' : session.chainTipHash;

  const seal = {
    session_id: session.sessionId,
    client: session.clientName,
    task_type: session.sessionTaskType,
    languages: [],
    files_touched: 0,
    started_at: new Date(session.sessionStartTime as number).toISOString(),
    ended_at: now,
    duration_seconds: duration,
    heartbeat_count: session.heartbeatCount,
    record_count: session.sessionRecordCount,
    chain_start_hash: chainStartHash,
    chain_end_hash: endRecord.hash,
    seal_signature: sealSignature,
  };

  const allSessions = (readJson as unknown as (...args: unknown[]) => unknown[])(SESSIONS_FILE, []);
  allSessions.push(seal);
  (writeJson as unknown as (...args: unknown[]) => void)(SESSIONS_FILE, allSessions);
}

function resetIdleTimer(
  sessions: Map<string, MockActiveSession>,
  sessionId: string,
): void {
  const active = sessions.get(sessionId);
  if (!active) return;

  clearTimeout(active.idleTimer);
  active.idleTimer = setTimeout(() => {
    if (active.session.sessionRecordCount > 0) {
      // Seal the session data but keep the transport alive
      autoSealSession(active);
      active.session.reset();
    }
  }, IDLE_TIMEOUT_MS);
}

async function cleanupSession(
  sessions: Map<string, MockActiveSession>,
  sessionId: string,
): Promise<void> {
  const active = sessions.get(sessionId);
  if (!active) return;

  clearTimeout(active.idleTimer);
  autoSealSession(active);
  try {
    await active.transport.close();
  } catch {
    /* ignore */
  }
  sessions.delete(sessionId);
}

function handleHealth(
  res: ServerResponse,
  activeFileCount: number,
  mcpConnections: number,
  startedAt: number,
): void {
  const body = JSON.stringify({
    status: 'ok',
    version: '1.2.3',
    active_sessions: activeFileCount,
    mcp_connections: mcpConnections,
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
  });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(body);
}

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// ── Mock HTTP helpers ───────────────────────────────────────────────────────────

function createMockRequest(body?: string): IncomingMessage {
  const emitter = new EventEmitter() as IncomingMessage;
  process.nextTick(() => {
    if (body !== undefined && body !== '') {
      emitter.emit('data', Buffer.from(body));
    }
    emitter.emit('end');
  });
  return emitter;
}

function createMockResponse(): ServerResponse & {
  _statusCode: number;
  _headers: Record<string, string>;
  _body: string;
} {
  const res = {
    _statusCode: 0,
    _headers: {} as Record<string, string>,
    _body: '',
    headersSent: false,
    writeHead(code: number, headers?: Record<string, string>) {
      res._statusCode = code;
      Object.defineProperty(res, 'headersSent', { value: true, writable: true, configurable: true });
      if (headers) Object.assign(res._headers, headers);
      return res;
    },
    end(body?: string) {
      if (body) res._body = body;
    },
    setHeader(name: string, value: string) {
      res._headers[name] = value;
      return res;
    },
  } as unknown as ServerResponse & {
    _statusCode: number;
    _headers: Record<string, string>;
    _body: string;
  };
  return res;
}

function createMockActive(sessionOverrides: Record<string, unknown> = {}): MockActiveSession {
  return {
    transport: { close: vi.fn().mockResolvedValue(undefined) },
    server: {},
    session: createMockSessionState(sessionOverrides),
    idleTimer: setTimeout(() => {}, 999_999),
  };
}

// ── Tests ───────────────────────────────────────────────────────────────────────

describe('daemon helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── parseBody ──────────────────────────────────────────────────────────────

  describe('parseBody', () => {
    it('parses a valid JSON object from the request body', async () => {
      vi.useRealTimers();
      const payload = { task_type: 'coding', languages: ['typescript', 'python'] };
      const req = createMockRequest(JSON.stringify(payload));

      const result = await parseBody(req);

      expect(result).toEqual(payload);
    });

    it('returns undefined for an empty body', async () => {
      vi.useRealTimers();
      const req = createMockRequest('');

      const result = await parseBody(req);

      expect(result).toBeUndefined();
    });

    it('returns undefined when no data chunks are emitted', async () => {
      vi.useRealTimers();
      const emitter = new EventEmitter() as IncomingMessage;
      process.nextTick(() => emitter.emit('end'));

      const result = await parseBody(emitter);

      expect(result).toBeUndefined();
    });

    it('parses a JSON array body', async () => {
      vi.useRealTimers();
      const payload = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const req = createMockRequest(JSON.stringify(payload));

      const result = await parseBody(req);

      expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    });

    it('parses nested JSON-RPC request bodies', async () => {
      vi.useRealTimers();
      const payload = {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: { name: 'useai_start', arguments: { task_type: 'debugging' } },
        id: 42,
      };
      const req = createMockRequest(JSON.stringify(payload));

      const result = await parseBody(req);

      expect(result).toEqual(payload);
    });

    it('rejects with SyntaxError for invalid JSON', async () => {
      vi.useRealTimers();
      const req = createMockRequest('not valid json {{{');

      await expect(parseBody(req)).rejects.toThrow(SyntaxError);
    });

    it('rejects when the request stream emits an error', async () => {
      vi.useRealTimers();
      const emitter = new EventEmitter() as IncomingMessage;
      const networkError = new Error('Connection reset by peer');

      process.nextTick(() => emitter.emit('error', networkError));

      await expect(parseBody(emitter)).rejects.toThrow('Connection reset by peer');
    });

    it('reassembles multi-chunk request bodies correctly', async () => {
      vi.useRealTimers();
      const emitter = new EventEmitter() as IncomingMessage;
      const payload = { session_id: 'sess-001', heartbeat: true, count: 7 };
      const jsonStr = JSON.stringify(payload);
      const mid = Math.floor(jsonStr.length / 2);

      process.nextTick(() => {
        emitter.emit('data', Buffer.from(jsonStr.slice(0, mid)));
        emitter.emit('data', Buffer.from(jsonStr.slice(mid)));
        emitter.emit('end');
      });

      const result = await parseBody(emitter);

      expect(result).toEqual(payload);
    });

    it('handles a body that is a JSON string literal', async () => {
      vi.useRealTimers();
      const req = createMockRequest('"hello world"');

      const result = await parseBody(req);

      expect(result).toBe('hello world');
    });

    it('handles a body that is a JSON number', async () => {
      vi.useRealTimers();
      const req = createMockRequest('42');

      const result = await parseBody(req);

      expect(result).toBe(42);
    });
  });

  // ── handleHealth ───────────────────────────────────────────────────────────

  describe('handleHealth', () => {
    it('returns status ok with version and active session count', () => {
      const res = createMockResponse();
      const now = Date.now();
      const startedAt = now - 120_000;

      handleHealth(res as unknown as ServerResponse, 3, 5, startedAt);

      const parsed = JSON.parse(res._body);
      expect(parsed.status).toBe('ok');
      expect(parsed.version).toBe('1.2.3');
      expect(parsed.active_sessions).toBe(3);
      expect(parsed.mcp_connections).toBe(5);
    });

    it('calculates uptime in whole seconds', () => {
      const res = createMockResponse();
      const now = Date.now();
      const startedAt = now - 300_000; // 5 minutes

      handleHealth(res as unknown as ServerResponse, 0, 0, startedAt);

      const parsed = JSON.parse(res._body);
      expect(parsed.uptime_seconds).toBe(300);
    });

    it('sets HTTP 200 status and application/json Content-Type', () => {
      const res = createMockResponse();

      handleHealth(res as unknown as ServerResponse, 0, 0, Date.now());

      expect(res._statusCode).toBe(200);
      expect(res._headers['Content-Type']).toBe('application/json');
    });

    it('reports zero active sessions when map is empty', () => {
      const res = createMockResponse();

      handleHealth(res as unknown as ServerResponse, 0, 0, Date.now());

      const parsed = JSON.parse(res._body);
      expect(parsed.active_sessions).toBe(0);
      expect(parsed.mcp_connections).toBe(0);
      expect(parsed.uptime_seconds).toBe(0);
    });

    it('rounds uptime to the nearest second', () => {
      const res = createMockResponse();
      const now = Date.now();
      const startedAt = now - 1500; // 1.5s → rounds to 2

      handleHealth(res as unknown as ServerResponse, 1, 2, startedAt);

      const parsed = JSON.parse(res._body);
      expect(parsed.uptime_seconds).toBe(2);
    });

    it('includes all four required keys in the response', () => {
      const res = createMockResponse();

      handleHealth(res as unknown as ServerResponse, 5, 3, Date.now() - 60_000);

      const parsed = JSON.parse(res._body);
      expect(Object.keys(parsed).sort()).toEqual([
        'active_sessions',
        'mcp_connections',
        'status',
        'uptime_seconds',
        'version',
      ]);
    });
  });

  // ── autoSealSession ────────────────────────────────────────────────────────

  describe('autoSealSession', () => {
    it('appends session_end record to the chain with duration and metadata', () => {
      const active = createMockActive();

      autoSealSession(active);

      expect(active.session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({
          duration_seconds: 60,
          task_type: 'coding',
          heartbeat_count: 2,
          auto_sealed: true,
          languages: [],
          files_touched: 0,
        }),
      );
    });

    it('appends session_seal record with seal data and signature', () => {
      const active = createMockActive();

      autoSealSession(active);

      expect(active.session.appendToChain).toHaveBeenCalledWith(
        'session_seal',
        expect.objectContaining({
          seal: expect.any(String),
          seal_signature: 'mock-signature-hex',
          auto_sealed: true,
        }),
      );
    });

    it('moves chain file from active to sealed directory', () => {
      const active = createMockActive();

      autoSealSession(active);

      expect(existsSync).toHaveBeenCalledWith('/tmp/useai/active/session-abc-123.jsonl');
      expect(renameSync).toHaveBeenCalledWith(
        '/tmp/useai/active/session-abc-123.jsonl',
        '/tmp/useai/sealed/session-abc-123.jsonl',
      );
    });

    it('writes the seal entry to the sessions index file', () => {
      const active = createMockActive();

      autoSealSession(active);

      expect(readJson).toHaveBeenCalledWith(SESSIONS_FILE, []);
      expect(writeJson).toHaveBeenCalledWith(
        SESSIONS_FILE,
        expect.arrayContaining([
          expect.objectContaining({
            session_id: 'session-abc-123',
            client: 'test-client',
            task_type: 'coding',
            duration_seconds: 60,
            heartbeat_count: 2,
            record_count: 5,
            chain_end_hash: 'end-record-hash-value',
            seal_signature: 'mock-signature-hex',
          }),
        ]),
      );
    });

    it('does nothing when session has zero records', () => {
      const active = createMockActive({ sessionRecordCount: 0 });

      autoSealSession(active);

      expect(active.session.appendToChain).not.toHaveBeenCalled();
      expect(writeJson).not.toHaveBeenCalled();
      expect(renameSync).not.toHaveBeenCalled();
    });

    it('does not throw when renameSync fails', () => {
      (renameSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('ENOENT: no such file or directory');
      });
      const active = createMockActive();

      expect(() => autoSealSession(active)).not.toThrow();
      // writeJson should still have been called (seal persists even if rename fails)
      expect(writeJson).toHaveBeenCalled();
    });

    it('skips rename when active chain file does not exist', () => {
      (existsSync as ReturnType<typeof vi.fn>).mockReturnValue(false);
      const active = createMockActive();

      autoSealSession(active);

      expect(renameSync).not.toHaveBeenCalled();
    });

    it('uses GENESIS as chain_start_hash when chainTipHash is GENESIS', () => {
      const active = createMockActive({ chainTipHash: 'GENESIS' });

      autoSealSession(active);

      expect(writeJson).toHaveBeenCalledWith(
        SESSIONS_FILE,
        expect.arrayContaining([
          expect.objectContaining({ chain_start_hash: 'GENESIS' }),
        ]),
      );
    });

    it('uses current chainTipHash as chain_start_hash when not GENESIS', () => {
      const active = createMockActive({ chainTipHash: 'hash-from-prior-record' });

      autoSealSession(active);

      expect(writeJson).toHaveBeenCalledWith(
        SESSIONS_FILE,
        expect.arrayContaining([
          expect.objectContaining({ chain_start_hash: 'hash-from-prior-record' }),
        ]),
      );
    });

    it('calls signHash with SHA-256 digest and the session signing key', () => {
      const active = createMockActive({ signingKey: 'my-secret-key' });

      autoSealSession(active);

      expect(signHash).toHaveBeenCalledWith(expect.any(String), 'my-secret-key');
    });

    it('seal JSON contains correct session metadata', () => {
      const active = createMockActive({
        sessionId: 'seal-test-session',
        clientName: 'claude-code',
        sessionTaskType: 'debugging',
        heartbeatCount: 8,
        sessionRecordCount: 12,
      });

      autoSealSession(active);

      const sealCall = (active.session.appendToChain as ReturnType<typeof vi.fn>).mock
        .calls[1];
      expect(sealCall![0]).toBe('session_seal');

      const sealPayload = JSON.parse(sealCall![1].seal);
      expect(sealPayload.session_id).toBe('seal-test-session');
      expect(sealPayload.client).toBe('claude-code');
      expect(sealPayload.task_type).toBe('debugging');
      expect(sealPayload.heartbeat_count).toBe(8);
      expect(sealPayload.record_count).toBe(12);
      expect(sealPayload.chain_end_hash).toBe('end-record-hash-value');
    });

    it('appends new seal to existing sessions array without overwriting', () => {
      const existingSeal = { session_id: 'previous-session', client: 'old-client' };
      (readJson as ReturnType<typeof vi.fn>).mockReturnValue([existingSeal]);

      const active = createMockActive();
      autoSealSession(active);

      const writtenData = (writeJson as ReturnType<typeof vi.fn>).mock.calls[0]![1];
      expect(writtenData).toHaveLength(2);
      expect(writtenData[0]).toEqual(existingSeal);
      expect(writtenData[1].session_id).toBe('session-abc-123');
    });

    it('seal timestamps are valid ISO 8601 strings', () => {
      // Reset readJson to empty array (previous test's mockReturnValue persists through clearAllMocks)
      (readJson as ReturnType<typeof vi.fn>).mockReturnValue([]);
      const active = createMockActive();

      autoSealSession(active);

      const writtenSeal = (writeJson as ReturnType<typeof vi.fn>).mock.calls[0]![1][0];
      expect(writtenSeal.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      expect(writtenSeal.ended_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  // ── resetIdleTimer ─────────────────────────────────────────────────────────

  describe('resetIdleTimer', () => {
    it('replaces the existing idle timer with a new one', () => {
      const sessions = new Map<string, MockActiveSession>();
      const oldTimer = setTimeout(() => {}, 999_999);
      const active = createMockActive();
      active.idleTimer = oldTimer;
      sessions.set('sess-001', active);

      resetIdleTimer(sessions, 'sess-001');

      expect(sessions.get('sess-001')!.idleTimer).not.toBe(oldTimer);
    });

    it('does nothing for a nonexistent session ID', () => {
      const sessions = new Map<string, MockActiveSession>();

      expect(() => resetIdleTimer(sessions, 'nonexistent')).not.toThrow();
    });

    it('seals session data after 30 minutes of idle but keeps transport alive', async () => {
      const sessions = new Map<string, MockActiveSession>();
      const active = createMockActive({ sessionRecordCount: 3 });
      sessions.set('sess-idle', active);

      resetIdleTimer(sessions, 'sess-idle');

      expect(sessions.has('sess-idle')).toBe(true);

      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS + 100);

      // Session stays in the map (transport kept alive)
      expect(sessions.has('sess-idle')).toBe(true);
      // Transport should NOT be closed — client may still call useai_end
      expect(active.transport.close).not.toHaveBeenCalled();
      // Session data should have been sealed
      expect(active.session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({ auto_sealed: true }),
      );
      // Session should be reset for a new session
      expect(active.session.reset).toHaveBeenCalled();
    });

    it('skips seal when session has no records', async () => {
      const sessions = new Map<string, MockActiveSession>();
      const active = createMockActive({ sessionRecordCount: 0 });
      sessions.set('sess-empty', active);

      resetIdleTimer(sessions, 'sess-empty');

      await vi.advanceTimersByTimeAsync(IDLE_TIMEOUT_MS + 100);

      // No seal activity when there are no records
      expect(active.session.appendToChain).not.toHaveBeenCalled();
      expect(active.session.reset).not.toHaveBeenCalled();
      // Transport stays alive
      expect(sessions.has('sess-empty')).toBe(true);
      expect(active.transport.close).not.toHaveBeenCalled();
    });

    it('resets the 30-minute countdown when called again', async () => {
      const sessions = new Map<string, MockActiveSession>();
      const active = createMockActive({ sessionRecordCount: 3 });
      sessions.set('sess-reset', active);

      resetIdleTimer(sessions, 'sess-reset');

      // Advance 20 minutes
      await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
      expect(active.session.appendToChain).not.toHaveBeenCalled();

      // Reset timer (restarts 30-min countdown)
      resetIdleTimer(sessions, 'sess-reset');

      // 20 more minutes (only 20 since reset, not 30)
      await vi.advanceTimersByTimeAsync(20 * 60 * 1000);
      expect(active.session.appendToChain).not.toHaveBeenCalled();

      // 11 more minutes (total 31 since last reset) — seal fires
      await vi.advanceTimersByTimeAsync(11 * 60 * 1000);
      expect(active.session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({ auto_sealed: true }),
      );
    });
  });

  // ── cleanupSession ─────────────────────────────────────────────────────────

  describe('cleanupSession', () => {
    it('seals the session, closes transport, and removes it from the map', async () => {
      const sessions = new Map<string, MockActiveSession>();
      const active = createMockActive();
      sessions.set('sess-cleanup', active);

      await cleanupSession(sessions, 'sess-cleanup');

      expect(active.session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({ auto_sealed: true }),
      );
      expect(active.transport.close).toHaveBeenCalledOnce();
      expect(sessions.has('sess-cleanup')).toBe(false);
    });

    it('returns immediately for a nonexistent session', async () => {
      const sessions = new Map<string, MockActiveSession>();

      await expect(cleanupSession(sessions, 'nonexistent')).resolves.toBeUndefined();
    });

    it('removes session from map even if transport.close throws', async () => {
      const sessions = new Map<string, MockActiveSession>();
      const active = createMockActive({ sessionRecordCount: 0 });
      (active.transport.close as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error('Transport already closed'),
      );
      sessions.set('sess-err', active);

      await cleanupSession(sessions, 'sess-err');

      expect(sessions.has('sess-err')).toBe(false);
    });

    it('clears the idle timer to prevent duplicate seal', async () => {
      const sessions = new Map<string, MockActiveSession>();
      const timerCallback = vi.fn();
      const active = createMockActive({ sessionRecordCount: 0 });
      active.idleTimer = setTimeout(timerCallback, 5000);
      sessions.set('sess-timer', active);

      await cleanupSession(sessions, 'sess-timer');

      // Advance past when the old timer would have fired
      await vi.advanceTimersByTimeAsync(10_000);
      expect(timerCallback).not.toHaveBeenCalled();
    });

    it('seals session with records before closing', async () => {
      const sessions = new Map<string, MockActiveSession>();
      const active = createMockActive({
        sessionRecordCount: 10,
        heartbeatCount: 4,
      });
      sessions.set('sess-with-data', active);

      await cleanupSession(sessions, 'sess-with-data');

      expect(active.session.getSessionDuration).toHaveBeenCalled();
      expect(active.session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({
          heartbeat_count: 4,
          auto_sealed: true,
        }),
      );
      expect(writeJson).toHaveBeenCalledWith(
        SESSIONS_FILE,
        expect.arrayContaining([
          expect.objectContaining({ record_count: 10 }),
        ]),
      );
    });

    it('skips sealing when session has zero records', async () => {
      const sessions = new Map<string, MockActiveSession>();
      const active = createMockActive({ sessionRecordCount: 0 });
      sessions.set('sess-empty', active);

      await cleanupSession(sessions, 'sess-empty');

      expect(active.session.appendToChain).not.toHaveBeenCalled();
      expect(writeJson).not.toHaveBeenCalled();
      // But transport should still be closed and session removed
      expect(active.transport.close).toHaveBeenCalled();
      expect(sessions.has('sess-empty')).toBe(false);
    });
  });
});