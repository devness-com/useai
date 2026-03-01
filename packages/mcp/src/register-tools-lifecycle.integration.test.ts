/**
 * Integration tests for register-tools.ts — testing the full tool handler
 * lifecycle with real SessionState instances and filesystem operations.
 *
 * These tests exercise useai_start → heartbeat → useai_end flows with
 * real chain file persistence, milestones, session seals, and parent/child
 * session nesting through the MCP tool handlers.
 */
import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { mkdirSync, rmSync, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ── vi.hoisted for mock constants ────────────────────────────────────────────

const { tmpDir, activeDir, sealedDir, sessionsFile, milestonesFile, configFile, keystoreFile, idCounter } = vi.hoisted(() => {
  const base = `/tmp/useai-register-tools-lifecycle-test-${process.pid}`;
  return {
    tmpDir: base,
    activeDir: `${base}/active`,
    sealedDir: `${base}/sealed`,
    sessionsFile: `${base}/sessions.json`,
    milestonesFile: `${base}/milestones.json`,
    configFile: `${base}/config.json`,
    keystoreFile: `${base}/keystore.json`,
    idCounter: { value: 0 },
  };
});

// ── Mock @useai/shared ───────────────────────────────────────────────────────

vi.mock('@useai/shared', async () => {
  const actual = await vi.importActual<typeof import('@useai/shared')>('@useai/shared');
  return {
    ...actual,
    VERSION: '1.0.0-test',
    ACTIVE_DIR: activeDir,
    SEALED_DIR: sealedDir,
    CONFIG_FILE: configFile,
    SESSIONS_FILE: sessionsFile,
    MILESTONES_FILE: milestonesFile,
    KEYSTORE_FILE: keystoreFile,
    GENESIS_HASH: 'GENESIS',
    ensureDir: () => {
      const { mkdirSync: mkSync } = require('node:fs');
      mkSync(activeDir, { recursive: true });
      mkSync(sealedDir, { recursive: true });
    },
    generateSessionId: () => `rtl-${++idCounter.value}`,
  };
});

// ── Mock mcp-map.ts ──────────────────────────────────────────────────────────

vi.mock('./mcp-map.js', () => ({
  writeMcpMapping: vi.fn(),
}));

import { SessionState } from './session-state.js';
import { registerTools, installGracefulToolHandler } from './register-tools.js';
import { writeMcpMapping } from './mcp-map.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;

interface RegisteredTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: ToolHandler;
}

function createMockServer(clientVersion?: { name: string; version: string }) {
  const tools: RegisteredTool[] = [];
  return {
    tool: vi.fn(
      (name: string, description: string, schema: Record<string, unknown>, handler: ToolHandler) => {
        tools.push({ name, description, schema, handler });
      },
    ),
    server: {
      getClientVersion: vi.fn(() => clientVersion),
    },
    _tools: tools,
    getToolHandler(name: string): ToolHandler {
      const found = tools.find((t) => t.name === name);
      if (!found) throw new Error(`Tool "${name}" not registered`);
      return found.handler;
    },
  };
}

function readJsonFile(path: string): unknown {
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8'));
}

function writeJsonFile(path: string, data: unknown): void {
  writeFileSync(path, JSON.stringify(data));
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeEach(() => {
  idCounter.value = 0;
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(activeDir, { recursive: true });
  mkdirSync(sealedDir, { recursive: true });
  // Write default config
  writeJsonFile(configFile, {});
  // Write empty sessions & milestones
  writeJsonFile(sessionsFile, []);
  writeJsonFile(milestonesFile, []);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useai_start + useai_end full lifecycle', () => {
  it('produces a chain file with start, end, and seal records', async () => {
    const session = new SessionState();
    const server = createMockServer({ name: 'claude-code', version: '2.0' });
    registerTools(server as never, session as never);

    const startHandler = server.getToolHandler('useai_start');
    const endHandler = server.getToolHandler('useai_end');

    // Start
    const startResult = await startHandler({ task_type: 'coding' });
    expect(startResult.content[0]!.text).toContain('useai session started');
    expect(startResult.content[0]!.text).toContain('coding');

    const sessionId = session.sessionId;

    // End
    const endResult = await endHandler({
      task_type: 'coding',
      languages: ['typescript'],
      files_touched_count: 3,
    });
    expect(endResult.content[0]!.text).toContain('Session ended');

    // Verify chain file was created (in active or sealed)
    const activePath = join(activeDir, `${sessionId}.jsonl`);
    const sealedPath = join(sealedDir, `${sessionId}.jsonl`);
    const chainPath = existsSync(sealedPath) ? sealedPath : activePath;
    expect(existsSync(chainPath)).toBe(true);

    // Parse chain records
    const lines = readFileSync(chainPath, 'utf-8').trim().split('\n');
    expect(lines.length).toBeGreaterThanOrEqual(3); // start + end + seal

    const records = lines.map(l => JSON.parse(l));
    expect(records[0].type).toBe('session_start');
    expect(records[1].type).toBe('session_end');
    expect(records[2].type).toBe('session_seal');

    // Verify hash chain
    expect(records[0].prev_hash).toBe('GENESIS');
    expect(records[1].prev_hash).toBe(records[0].hash);
    expect(records[2].prev_hash).toBe(records[1].hash);
  });

  it('writes session seal to sessions.json', async () => {
    const session = new SessionState();
    const server = createMockServer({ name: 'cursor', version: '1.0' });
    registerTools(server as never, session as never);

    const startHandler = server.getToolHandler('useai_start');
    const endHandler = server.getToolHandler('useai_end');

    await startHandler({ task_type: 'debugging', title: 'Fix auth bug' });
    await endHandler({
      task_type: 'debugging',
      languages: ['python', 'sql'],
      files_touched_count: 7,
    });

    const sessions = readJsonFile(sessionsFile) as Array<Record<string, unknown>>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.task_type).toBe('debugging');
    expect(sessions[0]!.languages).toEqual(['python', 'sql']);
    expect(sessions[0]!.files_touched).toBe(7);
    expect(sessions[0]!.seal_signature).toBeDefined();
  });
});

describe('useai_start → heartbeat → useai_end', () => {
  it('records heartbeats in the chain between start and end', async () => {
    const session = new SessionState();
    const server = createMockServer({ name: 'vscode', version: '1.0' });
    registerTools(server as never, session as never);

    const startHandler = server.getToolHandler('useai_start');
    const heartbeatHandler = server.getToolHandler('useai_heartbeat');
    const endHandler = server.getToolHandler('useai_end');

    await startHandler({ task_type: 'coding' });
    const sessionId = session.sessionId;

    // Multiple heartbeats
    const hb1 = await heartbeatHandler({});
    expect(hb1.content[0]!.text).toContain('Heartbeat recorded');

    const hb2 = await heartbeatHandler({});
    expect(hb2.content[0]!.text).toContain('Heartbeat recorded');

    expect(session.heartbeatCount).toBe(2);

    await endHandler({ task_type: 'coding', languages: ['typescript'] });

    // Check chain file has: start, heartbeat, heartbeat, end, seal
    const chainPath = existsSync(join(sealedDir, `${sessionId}.jsonl`))
      ? join(sealedDir, `${sessionId}.jsonl`)
      : join(activeDir, `${sessionId}.jsonl`);

    const records = readFileSync(chainPath, 'utf-8')
      .trim()
      .split('\n')
      .map(l => JSON.parse(l));

    const types = records.map((r: Record<string, unknown>) => r.type);
    expect(types).toContain('session_start');
    expect(types.filter((t: string) => t === 'heartbeat')).toHaveLength(2);
    expect(types).toContain('session_end');
    expect(types).toContain('session_seal');
  });
});

describe('useai_end with milestones', () => {
  it('writes milestones to milestones.json when tracking is enabled', async () => {
    // Enable milestone tracking via config
    writeJsonFile(configFile, { milestone_tracking: true });

    const session = new SessionState();
    const server = createMockServer({ name: 'claude-code', version: '2.0' });
    registerTools(server as never, session as never);

    const startHandler = server.getToolHandler('useai_start');
    const endHandler = server.getToolHandler('useai_end');

    await startHandler({ task_type: 'coding' });

    const endResult = await endHandler({
      task_type: 'coding',
      languages: ['typescript'],
      files_touched_count: 5,
      milestones: [
        { title: 'Implemented auth flow', category: 'feature', complexity: 'complex' },
        { title: 'Added unit tests', category: 'test' },
      ],
    });

    expect(endResult.content[0]!.text).toContain('2 milestones recorded');

    const milestones = readJsonFile(milestonesFile) as Array<Record<string, unknown>>;
    expect(milestones).toHaveLength(2);
    expect(milestones[0]!.title).toBe('Implemented auth flow');
    expect(milestones[0]!.category).toBe('feature');
    expect(milestones[0]!.complexity).toBe('complex');
    expect(milestones[0]!.session_id).toBe(session.sessionId);
    expect(milestones[1]!.title).toBe('Added unit tests');
    expect(milestones[1]!.category).toBe('test');
    expect(milestones[1]!.complexity).toBe('medium'); // default
  });
});

describe('useai_end with evaluation', () => {
  it('computes session score and includes evaluation in seal', async () => {
    writeJsonFile(configFile, {});

    const session = new SessionState();
    const server = createMockServer({ name: 'claude-code', version: '2.0' });
    registerTools(server as never, session as never);

    const startHandler = server.getToolHandler('useai_start');
    const endHandler = server.getToolHandler('useai_end');

    await startHandler({ task_type: 'coding' });

    const evaluation = {
      prompt_quality: 5,
      context_provided: 4,
      task_outcome: 'completed' as const,
      iteration_count: 2,
      independence_level: 5,
      scope_quality: 4,
      tools_leveraged: 3,
    };

    const endResult = await endHandler({
      task_type: 'coding',
      languages: ['typescript'],
      evaluation,
    });

    expect(endResult.content[0]!.text).toContain('eval: completed');
    expect(endResult.content[0]!.text).toContain('score:');

    const sessions = readJsonFile(sessionsFile) as Array<Record<string, unknown>>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.evaluation).toBeDefined();
    expect(sessions[0]!.session_score).toBeDefined();
    expect(typeof sessions[0]!.session_score).toBe('number');
  });
});

describe('useai_end without useai_start', () => {
  it('returns "no active session" when session was never started', async () => {
    const session = new SessionState();
    // Simulate a clean state with no records
    session.sessionRecordCount = 0 as never;
    const server = createMockServer();
    registerTools(server as never, session as never);

    const endHandler = server.getToolHandler('useai_end');
    const result = await endHandler({ task_type: 'coding' });

    expect(result.content[0]!.text).toContain('No active session to end');
  });
});

describe('useai_start conversation_id handling', () => {
  it('generates new conversation_id when none is provided and not a child session', async () => {
    const session = new SessionState();
    const server = createMockServer({ name: 'claude-code', version: '2.0' });
    registerTools(server as never, session as never);

    const startHandler = server.getToolHandler('useai_start');
    const result = await startHandler({ task_type: 'coding' });

    // Response should contain conversation_id
    expect(result.content[1]!.text).toMatch(/^conversation_id=/);
    const convId = result.content[1]!.text.replace('conversation_id=', '');
    expect(convId.length).toBeGreaterThan(0);
  });

  it('preserves conversation_id when same id is passed on consecutive starts', async () => {
    const session = new SessionState();
    const server = createMockServer({ name: 'claude-code', version: '2.0' });
    registerTools(server as never, session as never);

    const startHandler = server.getToolHandler('useai_start');
    const endHandler = server.getToolHandler('useai_end');

    // First start
    const result1 = await startHandler({ task_type: 'coding' });
    const convId1 = result1.content[1]!.text.replace('conversation_id=', '');

    // End first session
    await endHandler({ task_type: 'coding' });

    // Second start with same conversation_id
    const result2 = await startHandler({ task_type: 'debugging', conversation_id: convId1 });
    const convId2 = result2.content[1]!.text.replace('conversation_id=', '');

    expect(convId2).toBe(convId1);
  });
});

describe('useai_start with title and model', () => {
  it('stores title, private_title, and model in session and chain', async () => {
    const session = new SessionState();
    const server = createMockServer({ name: 'claude-code', version: '2.0' });
    registerTools(server as never, session as never);

    const startHandler = server.getToolHandler('useai_start');

    await startHandler({
      task_type: 'coding',
      title: 'Implement auth',
      private_title: 'Add OAuth2 to UserService in acme-api',
      model: 'claude-opus-4-6',
      project: 'acme-api',
    });

    expect(session.sessionTitle).toBe('Implement auth');
    expect(session.sessionPrivateTitle).toBe('Add OAuth2 to UserService in acme-api');
    expect(session.modelId).toBe('claude-opus-4-6');
    expect(session.project).toBe('acme-api');

    // Verify chain file has the data
    const records = readFileSync(
      join(activeDir, `${session.sessionId}.jsonl`), 'utf-8'
    ).trim().split('\n').map(l => JSON.parse(l));

    const startData = records[0].data;
    expect(startData.title).toBe('Implement auth');
    expect(startData.private_title).toBe('Add OAuth2 to UserService in acme-api');
    expect(startData.model).toBe('claude-opus-4-6');
    expect(startData.project).toBe('acme-api');
  });
});

describe('useai_backup and useai_restore', () => {
  it('backup returns sessions, milestones, and sealed chains', async () => {
    // Setup some data
    writeJsonFile(sessionsFile, [
      { session_id: 'backup-1', client: 'test', task_type: 'coding', duration_seconds: 600 },
    ]);
    writeJsonFile(milestonesFile, [
      { id: 'm1', session_id: 'backup-1', title: 'Feature A', category: 'feature' },
    ]);
    writeFileSync(join(sealedDir, 'backup-1.jsonl'), '{"type":"test"}\n');

    const session = new SessionState();
    const server = createMockServer();
    registerTools(server as never, session as never);

    const backupHandler = server.getToolHandler('useai_backup');
    const result = await backupHandler({});

    const backup = JSON.parse(result.content[0]!.text);
    expect(backup.version).toBe(1);
    expect(backup.sessions).toHaveLength(1);
    expect(backup.milestones).toHaveLength(1);
    expect(backup.sealed_chains).toHaveProperty('backup-1.jsonl');
  });

  it('restore merges new sessions and skips duplicates', async () => {
    // Existing data
    writeJsonFile(sessionsFile, [
      {
        session_id: 'existing-1',
        started_at: '2026-01-01T10:00:00Z',
        ended_at: '2026-01-01T10:10:00Z',
        duration_seconds: 600,
        client: 'test',
        task_type: 'coding',
        languages: ['ts'],
        files_touched: 1,
        heartbeat_count: 0,
        record_count: 2,
        chain_start_hash: 'a',
        chain_end_hash: 'b',
        seal_signature: 's',
      },
    ]);

    const session = new SessionState();
    const server = createMockServer();
    registerTools(server as never, session as never);

    const restoreHandler = server.getToolHandler('useai_restore');

    const backup = JSON.stringify({
      sessions: [
        // Duplicate - should be skipped
        {
          session_id: 'existing-1',
          started_at: '2026-01-01T10:00:00Z',
          ended_at: '2026-01-01T10:10:00Z',
          duration_seconds: 600,
          client: 'test',
          task_type: 'coding',
          languages: ['ts'],
          files_touched: 1,
          heartbeat_count: 0,
          record_count: 2,
          chain_start_hash: 'a',
          chain_end_hash: 'b',
          seal_signature: 's',
        },
        // New - should be added
        {
          session_id: 'new-session-1',
          started_at: '2026-01-02T10:00:00Z',
          ended_at: '2026-01-02T10:20:00Z',
          duration_seconds: 1200,
          client: 'cursor',
          task_type: 'debugging',
          languages: ['python'],
          files_touched: 3,
          heartbeat_count: 1,
          record_count: 4,
          chain_start_hash: 'c',
          chain_end_hash: 'd',
          seal_signature: 't',
        },
      ],
    });

    const result = await restoreHandler({ backup_json: backup });
    const data = JSON.parse(result.content[0]!.text);

    expect(data.success).toBe(true);
    expect(data.restored).toBe(1); // Only the new one

    const sessions = readJsonFile(sessionsFile) as Array<Record<string, unknown>>;
    expect(sessions).toHaveLength(2);
    expect(sessions.map(s => s.session_id)).toContain('existing-1');
    expect(sessions.map(s => s.session_id)).toContain('new-session-1');
  });
});

describe('installGracefulToolHandler with real McpServer', () => {
  it('catches thrown errors and returns them as tool results', async () => {
    const throwingHandler = vi.fn().mockRejectedValue(new Error('Validation failed: invalid task_type'));
    const requestHandlers = new Map<string, Function>();
    requestHandlers.set('tools/call', throwingHandler);

    const fakeMcpServer = {
      server: { _requestHandlers: requestHandlers },
    };

    installGracefulToolHandler(fakeMcpServer as never);
    const wrappedHandler = requestHandlers.get('tools/call')!;

    const result = await wrappedHandler({}, {});
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Validation failed: invalid task_type' }],
      isError: true,
    });
  });
});

describe('MCP mapping persistence', () => {
  it('calls writeMcpMapping during useai_start', async () => {
    const session = new SessionState();
    session.mcpSessionId = 'mcp-transport-123';

    const server = createMockServer({ name: 'claude-code', version: '2.0' });
    registerTools(server as never, session as never);

    const startHandler = server.getToolHandler('useai_start');
    await startHandler({ task_type: 'coding' });

    expect(writeMcpMapping).toHaveBeenCalledWith('mcp-transport-123', session.sessionId);
  });
});
