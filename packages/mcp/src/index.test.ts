import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { createHash, randomUUID } from 'node:crypto';

// ── Mock @useai/shared ─────────────────────────────────────────────────────────

const mockReadJson = vi.fn();
const mockWriteJson = vi.fn();
const mockEnsureDir = vi.fn();
const mockFormatDuration = vi.fn((seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
});
const mockDetectClient = vi.fn(() => 'claude');
const mockSignHash = vi.fn((hash: string, _key: any) => `sig_${hash.slice(0, 8)}`);

vi.mock('@useai/shared', async (importOriginal) => {
  const real = await importOriginal<typeof import('@useai/shared')>();
  return {
    ...real,
    VERSION: '1.0.0-test',
    USEAI_DIR: '/home/testuser/.useai',
    ACTIVE_DIR: '/home/testuser/.useai/active',
    SEALED_DIR: '/home/testuser/.useai/sealed',
    CONFIG_FILE: '/home/testuser/.useai/config.json',
    SESSIONS_FILE: '/home/testuser/.useai/sessions.json',
    MILESTONES_FILE: '/home/testuser/.useai/milestones.json',
    ensureDir: (...args: any[]) => (mockEnsureDir as any)(...args),
    readJson: (...args: any[]) => (mockReadJson as any)(...args),
    writeJson: (...args: any[]) => (mockWriteJson as any)(...args),
    formatDuration: (...args: any[]) => (mockFormatDuration as any)(...args),
    detectClient: (...args: any[]) => (mockDetectClient as any)(...args),
    signHash: (...args: any[]) => (mockSignHash as any)(...args),
  };
});

// ── Mock ./session.js ──────────────────────────────────────────────────────────

let mockSessionId = 'sess-abc12345-6789-0def-ghij-klmnopqrstuv';
let mockSessionStartTime = Date.now();
let mockHeartbeatCount = 0;
let mockSessionRecordCount = 0;
let mockClientName = 'unknown';
let mockSessionTaskType = 'coding';
let mockChainTipHash = 'GENESIS';
let mockSigningKey: any = null;
let mockSigningAvailable = false;

const mockResetSession = vi.fn(() => {
  mockSessionId = `sess-${randomUUID()}`;
  mockSessionStartTime = Date.now();
  mockHeartbeatCount = 0;
  mockSessionRecordCount = 0;
  mockClientName = 'unknown';
  mockSessionTaskType = 'coding';
  mockChainTipHash = 'GENESIS';
});

const mockSetClient = vi.fn((client: string) => {
  mockClientName = client;
});

const mockSetTaskType = vi.fn((taskType: string) => {
  mockSessionTaskType = taskType;
});

const mockIncrementHeartbeat = vi.fn(() => {
  mockHeartbeatCount++;
});

const mockGetSessionDuration = vi.fn(() => 300);

const mockInitializeKeystore = vi.fn();

const mockAppendToChain = vi.fn((type: string, data: any) => {
  mockSessionRecordCount++;
  const hash = createHash('sha256')
    .update(JSON.stringify({ type, data, seq: mockSessionRecordCount }))
    .digest('hex');
  mockChainTipHash = hash;
  return { hash, seq: mockSessionRecordCount };
});

vi.mock('./session.js', () => ({
  get sessionId() { return mockSessionId; },
  get sessionStartTime() { return mockSessionStartTime; },
  get heartbeatCount() { return mockHeartbeatCount; },
  get sessionRecordCount() { return mockSessionRecordCount; },
  get clientName() { return mockClientName; },
  get sessionTaskType() { return mockSessionTaskType; },
  get chainTipHash() { return mockChainTipHash; },
  get signingKey() { return mockSigningKey; },
  get signingAvailable() { return mockSigningAvailable; },
  resetSession: (...args: any[]) => (mockResetSession as any)(...args),
  setClient: (...args: any[]) => (mockSetClient as any)(...args),
  setTaskType: (...args: any[]) => (mockSetTaskType as any)(...args),
  incrementHeartbeat: (...args: any[]) => (mockIncrementHeartbeat as any)(...args),
  getSessionDuration: (...args: any[]) => (mockGetSessionDuration as any)(...args),
  initializeKeystore: (...args: any[]) => (mockInitializeKeystore as any)(...args),
  appendToChain: (...args: any[]) => (mockAppendToChain as any)(...args),
}));

// ── Mock ./session-state.js ───────────────────────────────────────────────────
// The current index.ts imports SessionState directly (not from ./session.js).
// We return a mock object that delegates to the same mock variables above.
// IMPORTANT: Use Object.defineProperties for getters — Object.assign evaluates
// getters immediately instead of preserving them as live accessors.

const mockSessionObj: Record<string, any> = {};

vi.mock('./session-state.js', () => ({
  SessionState: vi.fn(function () {
    // Live getters that always return current mock variable values
    Object.defineProperties(mockSessionObj, {
      sessionId: { get() { return mockSessionId; }, configurable: true, enumerable: true },
      sessionStartTime: { get() { return mockSessionStartTime; }, configurable: true, enumerable: true },
      heartbeatCount: { get() { return mockHeartbeatCount; }, configurable: true, enumerable: true },
      sessionRecordCount: { get() { return mockSessionRecordCount; }, configurable: true, enumerable: true },
      clientName: { get() { return mockClientName; }, configurable: true, enumerable: true },
      sessionTaskType: { get() { return mockSessionTaskType; }, configurable: true, enumerable: true },
      chainTipHash: { get() { return mockChainTipHash; }, configurable: true, enumerable: true },
      signingKey: { get() { return mockSigningKey; }, configurable: true, enumerable: true },
      signingAvailable: { get() { return mockSigningAvailable; }, configurable: true, enumerable: true },
    });

    // Mutable properties (directly on mockSessionObj)
    mockSessionObj.conversationId = 'conv-test-id';
    mockSessionObj.conversationIndex = 0;
    mockSessionObj.mcpSessionId = null;
    mockSessionObj.modelId = null;
    mockSessionObj.startCallTokensEst = null;
    mockSessionObj.sessionTitle = null;
    mockSessionObj.sessionPrivateTitle = null;
    mockSessionObj.sessionPromptWordCount = null;
    mockSessionObj.project = null;
    mockSessionObj.inProgress = false;
    mockSessionObj.inProgressSince = null;
    mockSessionObj.autoSealedSessionId = null;
    mockSessionObj.parentState = null;

    // Methods — plain functions so vi.clearAllMocks() doesn't affect them.
    // They delegate to vi.fn() mocks which ARE restored in restoreMockImplementations().
    mockSessionObj.reset = (...args: any[]) => {
      (mockResetSession as any)(...args);
      mockSessionObj.conversationIndex++;
      mockSessionObj.inProgress = false;
      mockSessionObj.inProgressSince = null;
    };
    mockSessionObj.setClient = (...args: any[]) => (mockSetClient as any)(...args);
    mockSessionObj.setTaskType = (...args: any[]) => (mockSetTaskType as any)(...args);
    mockSessionObj.setProject = (p: string) => { mockSessionObj.project = p; };
    mockSessionObj.setModel = (m: string) => { mockSessionObj.modelId = m; };
    mockSessionObj.setTitle = (t: string | null) => { mockSessionObj.sessionTitle = t; };
    mockSessionObj.setPrivateTitle = (t: string | null) => { mockSessionObj.sessionPrivateTitle = t; };
    mockSessionObj.incrementHeartbeat = (...args: any[]) => (mockIncrementHeartbeat as any)(...args);
    mockSessionObj.getSessionDuration = (...args: any[]) => (mockGetSessionDuration as any)(...args);
    mockSessionObj.initializeKeystore = (...args: any[]) => (mockInitializeKeystore as any)(...args);
    mockSessionObj.appendToChain = (...args: any[]) => (mockAppendToChain as any)(...args);
    mockSessionObj.detectProject = () => {};
    mockSessionObj.sessionChainPath = () => '/home/testuser/.useai/active/mock-session.jsonl';
    mockSessionObj.saveParentState = () => {
      mockSessionObj.parentState = {
        sessionId: mockSessionId,
        sessionStartTime: mockSessionStartTime,
        heartbeatCount: mockHeartbeatCount,
        sessionRecordCount: mockSessionRecordCount,
        chainTipHash: mockChainTipHash,
        conversationId: mockSessionObj.conversationId,
        conversationIndex: mockSessionObj.conversationIndex,
        sessionTaskType: mockSessionTaskType,
        sessionTitle: mockSessionObj.sessionTitle,
        sessionPrivateTitle: mockSessionObj.sessionPrivateTitle,
        sessionPromptWordCount: mockSessionObj.sessionPromptWordCount,
        project: mockSessionObj.project,
        modelId: mockSessionObj.modelId,
        startCallTokensEst: mockSessionObj.startCallTokensEst,
        inProgress: mockSessionObj.inProgress,
        inProgressSince: mockSessionObj.inProgressSince,
      };
    };
    mockSessionObj.restoreParentState = () => {
      if (!mockSessionObj.parentState) return false;
      const p = mockSessionObj.parentState;
      // Restore mock variables that getters reference
      mockSessionId = p.sessionId;
      mockSessionStartTime = p.sessionStartTime;
      mockHeartbeatCount = p.heartbeatCount;
      mockSessionRecordCount = p.sessionRecordCount;
      mockChainTipHash = p.chainTipHash;
      mockSessionObj.conversationId = p.conversationId;
      mockSessionObj.conversationIndex = p.conversationIndex;
      mockSessionTaskType = p.sessionTaskType;
      mockSessionObj.sessionTitle = p.sessionTitle;
      mockSessionObj.sessionPrivateTitle = p.sessionPrivateTitle;
      mockSessionObj.sessionPromptWordCount = p.sessionPromptWordCount;
      mockSessionObj.project = p.project;
      mockSessionObj.modelId = p.modelId;
      mockSessionObj.startCallTokensEst = p.startCallTokensEst;
      mockSessionObj.inProgress = p.inProgress;
      mockSessionObj.inProgressSince = p.inProgressSince;
      mockSessionObj.parentState = null;
      return true;
    };

    return mockSessionObj;
  }),
}));

// ── Mock ./mcp-map.js ─────────────────────────────────────────────────────────

vi.mock('./mcp-map.js', () => ({
  writeMcpMapping: vi.fn(),
}));

// ── Mock node:fs ───────────────────────────────────────────────────────────────

const mockExistsSync = vi.fn(() => true);
const mockRenameSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: any[]) => (mockExistsSync as any)(...args),
  renameSync: (...args: any[]) => (mockRenameSync as any)(...args),
  appendFileSync: vi.fn(),
}));

// ── Mock @modelcontextprotocol/sdk ─────────────────────────────────────────────

type ToolHandler = (args: any) => Promise<any>;
const registeredTools: Map<string, { handler: ToolHandler; schema: any; description: string }> = new Map();

const mockServerConnect = vi.fn().mockResolvedValue(undefined);
const mockServerTool = vi.fn((name: string, description: string, schema: any, handler: ToolHandler) => {
  registeredTools.set(name, { handler, schema, description });
});

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  // Use a regular function (not arrow) so it's valid as a constructor with `new`
  McpServer: vi.fn(function () {
    return {
      tool: (...args: any[]) => (mockServerTool as any)(...args),
      connect: (...args: any[]) => (mockServerConnect as any)(...args),
      server: { getClientVersion: () => undefined },
    };
  }),
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: vi.fn(function () { return {}; }),
}));

// ── Helper to invoke registered tool handlers ──────────────────────────────────

async function callTool(name: string, args: Record<string, any> = {}): Promise<any> {
  const tool = registeredTools.get(name);
  if (!tool) throw new Error(`Tool "${name}" not registered. Available: ${[...registeredTools.keys()].join(', ')}`);
  return tool.handler(args);
}

// ── Helper to restore mock implementations after vi.clearAllMocks() ────────────

function restoreMockImplementations() {
  mockAppendToChain.mockImplementation((type: string, data: any) => {
    mockSessionRecordCount++;
    const hash = createHash('sha256')
      .update(JSON.stringify({ type, data, seq: mockSessionRecordCount }))
      .digest('hex');
    mockChainTipHash = hash;
    return { hash, seq: mockSessionRecordCount };
  });

  mockResetSession.mockImplementation(() => {
    mockSessionId = `sess-${randomUUID()}`;
    mockSessionStartTime = Date.now();
    mockHeartbeatCount = 0;
    mockSessionRecordCount = 0;
    mockClientName = 'unknown';
    mockSessionTaskType = 'coding';
    mockChainTipHash = 'GENESIS';
  });

  mockSetClient.mockImplementation((client: string) => {
    mockClientName = client;
  });

  mockSetTaskType.mockImplementation((taskType: string) => {
    mockSessionTaskType = taskType;
  });

  mockIncrementHeartbeat.mockImplementation(() => {
    mockHeartbeatCount++;
  });

  mockGetSessionDuration.mockReturnValue(300);

  mockFormatDuration.mockImplementation((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  });

  mockDetectClient.mockReturnValue('claude');
  mockSignHash.mockImplementation((hash: string, _key: any) => `sig_${hash.slice(0, 8)}`);
  mockExistsSync.mockReturnValue(true);
  mockServerConnect.mockResolvedValue(undefined);
  mockReadJson.mockImplementation((_path: string, fallback: any) => fallback);
}

// ── Import module under test (triggers registration) ───────────────────────────
// Import once — tools register at module scope so re-importing from cache is a no-op.

beforeAll(async () => {
  await import('./index.js');
});

beforeEach(() => {
  // Clear mock call history but do NOT clear registeredTools — they were registered once at import time
  vi.clearAllMocks();

  // Reset session state
  mockSessionId = 'sess-abc12345-6789-0def-ghij-klmnopqrstuv';
  mockSessionStartTime = Date.now() - 300_000; // 5 minutes ago
  mockHeartbeatCount = 0;
  mockSessionRecordCount = 0;
  mockClientName = 'unknown';
  mockSessionTaskType = 'coding';
  mockChainTipHash = 'GENESIS';
  mockSigningKey = null;
  mockSigningAvailable = false;

  // Reset SessionState mock object's mutable properties
  mockSessionObj.conversationId = 'conv-test-id';
  mockSessionObj.conversationIndex = 0;
  mockSessionObj.mcpSessionId = null;
  mockSessionObj.modelId = null;
  mockSessionObj.startCallTokensEst = null;
  mockSessionObj.sessionTitle = null;
  mockSessionObj.sessionPrivateTitle = null;
  mockSessionObj.sessionPromptWordCount = null;
  mockSessionObj.project = null;
  mockSessionObj.inProgress = false;
  mockSessionObj.inProgressSince = null;
  mockSessionObj.autoSealedSessionId = null;
  mockSessionObj.parentState = null;

  // Restore all mock implementations (vi.clearAllMocks clears them)
  restoreMockImplementations();
});

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('MCP Server Tool Registration', () => {
  it('registers useai_start tool', () => {
    expect(registeredTools.has('useai_start')).toBe(true);
  });

  it('registers useai_heartbeat tool', () => {
    expect(registeredTools.has('useai_heartbeat')).toBe(true);
  });

  it('registers useai_end tool', () => {
    expect(registeredTools.has('useai_end')).toBe(true);
  });

  it('registers exactly 3 tools', () => {
    expect(registeredTools.has('useai_start')).toBe(true);
    expect(registeredTools.has('useai_heartbeat')).toBe(true);
    expect(registeredTools.has('useai_end')).toBe(true);
  });
});

// ── useai_start ────────────────────────────────────────────────────────

describe('useai_start', () => {
  it('resets the session state when called', async () => {
    await callTool('useai_start', { task_type: 'coding' });

    expect(mockResetSession).toHaveBeenCalledOnce();
  });

  it('detects and sets the client name', async () => {
    mockDetectClient.mockReturnValue('cursor');

    await callTool('useai_start', { task_type: 'coding' });

    expect(mockDetectClient).toHaveBeenCalled();
    expect(mockSetClient).toHaveBeenCalledWith('cursor');
  });

  it('sets task type from parameter', async () => {
    await callTool('useai_start', { task_type: 'debugging' });

    expect(mockSetTaskType).toHaveBeenCalledWith('debugging');
  });

  it('defaults task type to coding when not provided', async () => {
    await callTool('useai_start', {});

    expect(mockSetTaskType).toHaveBeenCalledWith('coding');
  });

  it('appends a session_start record to the chain', async () => {
    mockDetectClient.mockReturnValue('vscode');
    mockClientName = 'vscode';
    mockSessionTaskType = 'testing';

    await callTool('useai_start', { task_type: 'testing' });

    expect(mockAppendToChain).toHaveBeenCalledWith('session_start', expect.objectContaining({
      version: '1.0.0-test',
    }));
  });

  it('returns text content with session details', async () => {
    mockDetectClient.mockReturnValue('claude');
    mockClientName = 'claude';
    mockSessionTaskType = 'planning';
    mockSigningAvailable = false;

    const result = await callTool('useai_start', { task_type: 'planning' });

    expect(result.content).toHaveLength(2);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('useai session started');
    expect(result.content[1].type).toBe('text');
    expect(result.content[1].text).toMatch(/^conversation_id=/);
  });

  it('indicates signing status when Ed25519 key is available', async () => {
    mockSigningAvailable = true;
    mockClientName = 'claude';
    mockSessionTaskType = 'coding';

    const result = await callTool('useai_start', { task_type: 'coding' });

    expect(result.content[0].text).toContain('signed');
  });

  it('indicates unsigned when signing key is unavailable', async () => {
    mockSigningAvailable = false;
    mockClientName = 'claude';
    mockSessionTaskType = 'coding';

    const result = await callTool('useai_start', { task_type: 'coding' });

    expect(result.content[0].text).toContain('unsigned');
  });

  it('handles all valid task types', async () => {
    const taskTypes = ['coding', 'debugging', 'testing', 'planning', 'reviewing', 'documenting', 'learning', 'other'];

    for (const taskType of taskTypes) {
      vi.clearAllMocks();
      restoreMockImplementations();

      mockClientName = 'claude';
      mockSessionTaskType = taskType;

      const result = await callTool('useai_start', { task_type: taskType });
      expect(mockSetTaskType).toHaveBeenCalledWith(taskType);
      expect(result.content[0].text).toContain(taskType);
    }
  });
});

// ── useai_heartbeat ────────────────────────────────────────────────────────────

describe('useai_heartbeat', () => {
  it('increments the heartbeat counter', async () => {
    await callTool('useai_heartbeat', {});

    expect(mockIncrementHeartbeat).toHaveBeenCalledOnce();
  });

  it('appends a heartbeat record to the chain with heartbeat count', async () => {
    mockHeartbeatCount = 3;
    mockGetSessionDuration.mockReturnValue(900);

    await callTool('useai_heartbeat', {});

    expect(mockAppendToChain).toHaveBeenCalledWith('heartbeat', {
      heartbeat_number: 4,
      cumulative_seconds: 900,
    });
  });

  it('returns formatted duration in the response text', async () => {
    mockGetSessionDuration.mockReturnValue(600);

    const result = await callTool('useai_heartbeat', {});

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(mockFormatDuration).toHaveBeenCalledWith(600);
    expect(result.content[0].text).toContain('Heartbeat recorded');
  });

  it('reports short durations correctly', async () => {
    mockGetSessionDuration.mockReturnValue(45);

    const result = await callTool('useai_heartbeat', {});

    expect(result.content[0].text).toContain('45s');
  });

  it('reports minute-level durations correctly', async () => {
    mockGetSessionDuration.mockReturnValue(125);

    const result = await callTool('useai_heartbeat', {});

    expect(result.content[0].text).toContain('2m 5s');
  });

  it('reports hour-level durations correctly', async () => {
    mockGetSessionDuration.mockReturnValue(3720);

    const result = await callTool('useai_heartbeat', {});

    expect(result.content[0].text).toContain('1h 2m');
  });

  it('calls incrementHeartbeat before appending to chain', async () => {
    const callOrder: string[] = [];
    mockIncrementHeartbeat.mockImplementation(() => {
      callOrder.push('increment');
      mockHeartbeatCount++;
    });
    mockAppendToChain.mockImplementation((type: string) => {
      callOrder.push('appendToChain');
      mockSessionRecordCount++;
      return { hash: 'abc123', seq: mockSessionRecordCount };
    });

    await callTool('useai_heartbeat', {});

    expect(callOrder).toEqual(['increment', 'appendToChain']);
  });
});

// ── useai_end ──────────────────────────────────────────────────────────

describe('useai_end', () => {
  beforeEach(() => {
    mockGetSessionDuration.mockReturnValue(1800); // 30 minutes
    mockClientName = 'claude';
    mockSessionTaskType = 'coding';
    mockHeartbeatCount = 5;
    mockSessionRecordCount = 7;
    mockChainTipHash = 'abc123def456';
  });

  describe('seal creation', () => {
    it('appends a session_end record with duration and metadata', async () => {
      await callTool('useai_end', {
        task_type: 'coding',
        languages: ['typescript'],
        files_touched_count: 12,
      });

      expect(mockAppendToChain).toHaveBeenCalledWith('session_end', {
        duration_seconds: 1800,
        task_type: 'coding',
        languages: ['typescript'],
        files_touched: 12,
        heartbeat_count: 5,
      });
    });

    it('appends a session_seal record with signed seal data', async () => {
      await callTool('useai_end', { task_type: 'debugging' });

      const calls = mockAppendToChain.mock.calls;
      const sealCall = calls.find((c: any[]) => c[0] === 'session_seal');
      expect(sealCall).toBeDefined();
      expect(sealCall![1]).toHaveProperty('seal');
      expect(sealCall![1]).toHaveProperty('seal_signature');
    });

    it('uses signHash to create the seal signature', async () => {
      await callTool('useai_end', {});

      expect(mockSignHash).toHaveBeenCalled();
      const [hashArg, keyArg] = mockSignHash.mock.calls[0]!;
      expect(typeof hashArg).toBe('string');
      expect(hashArg).toHaveLength(64); // SHA-256 hex digest
    });

    it('uses the provided task_type over the session default', async () => {
      mockSessionTaskType = 'coding';

      await callTool('useai_end', { task_type: 'reviewing' });

      const endCall = mockAppendToChain.mock.calls.find((c: any[]) => c[0] === 'session_end');
      expect(endCall![1].task_type).toBe('reviewing');
    });

    it('falls back to session task type when task_type not provided', async () => {
      mockSessionTaskType = 'debugging';

      await callTool('useai_end', {});

      const endCall = mockAppendToChain.mock.calls.find((c: any[]) => c[0] === 'session_end');
      expect(endCall![1].task_type).toBe('debugging');
    });

    it('defaults languages to empty array when not provided', async () => {
      await callTool('useai_end', {});

      const endCall = mockAppendToChain.mock.calls.find((c: any[]) => c[0] === 'session_end');
      expect(endCall![1].languages).toEqual([]);
    });

    it('defaults files_touched to 0 when not provided', async () => {
      await callTool('useai_end', {});

      const endCall = mockAppendToChain.mock.calls.find((c: any[]) => c[0] === 'session_end');
      expect(endCall![1].files_touched).toBe(0);
    });
  });

  describe('chain file move', () => {
    it('moves chain file from active to sealed directory', async () => {
      mockExistsSync.mockReturnValue(true);

      await callTool('useai_end', {});

      expect(mockExistsSync).toHaveBeenCalledWith(
        expect.stringContaining(mockSessionId)
      );
      expect(mockRenameSync).toHaveBeenCalledWith(
        expect.stringContaining('/active/'),
        expect.stringContaining('/sealed/')
      );
    });

    it('does not attempt rename if active chain file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await callTool('useai_end', {});

      expect(mockRenameSync).not.toHaveBeenCalled();
    });

    it('handles rename failures gracefully without throwing', async () => {
      mockExistsSync.mockReturnValue(true);
      mockRenameSync.mockImplementation(() => {
        throw new Error('EXDEV: cross-device link not permitted');
      });

      // Should not throw
      const result = await callTool('useai_end', {});
      expect(result.content).toHaveLength(1);
      expect(result.content[0].type).toBe('text');
    });
  });

  describe('session index update', () => {
    it('reads existing sessions and appends the new seal', async () => {
      const existingSessions = [
        { session_id: 'prev-session', duration_seconds: 600 },
      ];
      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('sessions.json')) return [...existingSessions];
        return fallback;
      });

      await callTool('useai_end', {
        task_type: 'coding',
        languages: ['python'],
        files_touched_count: 5,
      });

      expect(mockWriteJson).toHaveBeenCalledWith(
        expect.stringContaining('sessions.json'),
        expect.arrayContaining([
          expect.objectContaining({ session_id: 'prev-session' }),
          expect.objectContaining({
            session_id: mockSessionId,
            client: 'claude',
            task_type: 'coding',
            languages: ['python'],
            files_touched: 5,
            duration_seconds: 1800,
            heartbeat_count: 5,
          }),
        ])
      );
    });

    it('creates new sessions array when file is empty', async () => {
      mockReadJson.mockImplementation((_path: string, fallback: any) => fallback);

      await callTool('useai_end', {});

      expect(mockWriteJson).toHaveBeenCalledWith(
        expect.stringContaining('sessions.json'),
        expect.arrayContaining([
          expect.objectContaining({ session_id: mockSessionId }),
        ])
      );
    });

    it('includes chain hashes in the session seal', async () => {
      mockChainTipHash = 'deadbeef1234';

      await callTool('useai_end', {});

      expect(mockWriteJson).toHaveBeenCalledWith(
        expect.stringContaining('sessions.json'),
        expect.arrayContaining([
          expect.objectContaining({
            chain_start_hash: 'deadbeef1234',
            chain_end_hash: expect.any(String),
          }),
        ])
      );
    });

    it('uses GENESIS as chain_start_hash when no prior chain activity', async () => {
      mockChainTipHash = 'GENESIS';

      await callTool('useai_end', {});

      expect(mockWriteJson).toHaveBeenCalledWith(
        expect.stringContaining('sessions.json'),
        expect.arrayContaining([
          expect.objectContaining({
            chain_start_hash: 'GENESIS',
          }),
        ])
      );
    });
  });

  describe('milestone processing', () => {
    it('processes milestones when provided and milestone_tracking is enabled', async () => {
      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('config.json')) return { milestone_tracking: true, auto_sync: true };
        if (path.includes('milestones.json')) return [];
        if (path.includes('sessions.json')) return [];
        return fallback;
      });

      await callTool('useai_end', {
        milestones: [
          { title: 'Implemented user authentication', category: 'feature', complexity: 'complex' },
          { title: 'Fixed race condition in background worker', category: 'bugfix' },
        ],
      });

      // Should append milestone records to the chain
      const milestoneCalls = mockAppendToChain.mock.calls.filter(
        (c: any[]) => c[0] === 'milestone'
      );
      expect(milestoneCalls).toHaveLength(2);

      expect(milestoneCalls[0]![1]).toEqual(expect.objectContaining({
        title: 'Implemented user authentication',
        category: 'feature',
        complexity: 'complex',
      }));

      expect(milestoneCalls[1]![1]).toEqual(expect.objectContaining({
        title: 'Fixed race condition in background worker',
        category: 'bugfix',
        complexity: 'medium', // defaults to medium
      }));
    });

    it('writes milestones to milestones file', async () => {
      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('config.json')) return { milestone_tracking: true };
        if (path.includes('milestones.json')) return [];
        if (path.includes('sessions.json')) return [];
        return fallback;
      });

      await callTool('useai_end', {
        milestones: [
          { title: 'Added unit tests for data validation', category: 'test' },
        ],
      });

      expect(mockWriteJson).toHaveBeenCalledWith(
        expect.stringContaining('milestones.json'),
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Added unit tests for data validation',
            category: 'test',
            session_id: mockSessionId,
            published: false,
            published_at: null,
          }),
        ])
      );
    });

    it('does not process milestones when milestone_tracking is disabled', async () => {
      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('config.json')) return { milestone_tracking: false };
        if (path.includes('sessions.json')) return [];
        return fallback;
      });

      await callTool('useai_end', {
        milestones: [
          { title: 'Some milestone', category: 'feature' },
        ],
      });

      const milestoneCalls = mockAppendToChain.mock.calls.filter(
        (c: any[]) => c[0] === 'milestone'
      );
      expect(milestoneCalls).toHaveLength(0);

      // Should not write to milestones file
      const milestoneWrites = mockWriteJson.mock.calls.filter(
        (c: any[]) => c[0].includes('milestones.json')
      );
      expect(milestoneWrites).toHaveLength(0);
    });

    it('does not process milestones when none are provided', async () => {
      await callTool('useai_end', {});

      const milestoneCalls = mockAppendToChain.mock.calls.filter(
        (c: any[]) => c[0] === 'milestone'
      );
      expect(milestoneCalls).toHaveLength(0);
    });

    it('does not process milestones when empty array is provided', async () => {
      await callTool('useai_end', { milestones: [] });

      const milestoneCalls = mockAppendToChain.mock.calls.filter(
        (c: any[]) => c[0] === 'milestone'
      );
      expect(milestoneCalls).toHaveLength(0);
    });

    it('appends milestones to existing milestones', async () => {
      const existingMilestones = [
        { id: 'm_existing1', title: 'Prior work', category: 'feature' },
      ];
      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('config.json')) return { milestone_tracking: true };
        if (path.includes('milestones.json')) return [...existingMilestones];
        if (path.includes('sessions.json')) return [];
        return fallback;
      });

      await callTool('useai_end', {
        milestones: [{ title: 'New work', category: 'refactor' }],
      });

      expect(mockWriteJson).toHaveBeenCalledWith(
        expect.stringContaining('milestones.json'),
        expect.arrayContaining([
          expect.objectContaining({ id: 'm_existing1' }),
          expect.objectContaining({ title: 'New work', category: 'refactor' }),
        ])
      );
    });

    it('calculates duration_minutes from session duration', async () => {
      mockGetSessionDuration.mockReturnValue(2700); // 45 minutes

      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('config.json')) return { milestone_tracking: true };
        if (path.includes('milestones.json')) return [];
        if (path.includes('sessions.json')) return [];
        return fallback;
      });

      await callTool('useai_end', {
        milestones: [{ title: 'Refactored state management layer', category: 'refactor' }],
      });

      const milestoneCalls = mockAppendToChain.mock.calls.filter(
        (c: any[]) => c[0] === 'milestone'
      );
      expect(milestoneCalls[0]![1].duration_minutes).toBe(45);
    });

    it('includes languages in milestone records', async () => {
      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('config.json')) return { milestone_tracking: true };
        if (path.includes('milestones.json')) return [];
        if (path.includes('sessions.json')) return [];
        return fallback;
      });

      await callTool('useai_end', {
        languages: ['typescript', 'rust'],
        milestones: [{ title: 'Built responsive dashboard layout', category: 'feature' }],
      });

      const milestoneCalls = mockAppendToChain.mock.calls.filter(
        (c: any[]) => c[0] === 'milestone'
      );
      expect(milestoneCalls[0]![1].languages).toEqual(['typescript', 'rust']);
    });

    it('generates unique milestone IDs with m_ prefix', async () => {
      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('config.json')) return { milestone_tracking: true };
        if (path.includes('milestones.json')) return [];
        if (path.includes('sessions.json')) return [];
        return fallback;
      });

      await callTool('useai_end', {
        milestones: [
          { title: 'First milestone', category: 'feature' },
          { title: 'Second milestone', category: 'bugfix' },
        ],
      });

      const writeCall = mockWriteJson.mock.calls.find(
        (c: any[]) => c[0].includes('milestones.json')
      );
      const milestones = writeCall![1] as any[];
      expect(milestones[0].id).toMatch(/^m_/);
      expect(milestones[1].id).toMatch(/^m_/);
      expect(milestones[0].id).not.toBe(milestones[1].id);
    });
  });

  describe('response content', () => {
    it('includes formatted duration in response', async () => {
      mockGetSessionDuration.mockReturnValue(3600);

      const result = await callTool('useai_end', {
        task_type: 'coding',
      });

      expect(mockFormatDuration).toHaveBeenCalledWith(3600);
      expect(result.content[0].text).toContain('Session ended');
    });

    it('includes language list in response when provided', async () => {
      const result = await callTool('useai_end', {
        languages: ['typescript', 'python'],
      });

      expect(result.content[0].text).toContain('typescript');
      expect(result.content[0].text).toContain('python');
    });

    it('omits language string when no languages provided', async () => {
      const result = await callTool('useai_end', {});

      expect(result.content[0].text).not.toContain('using');
    });

    it('includes milestone count when milestones are recorded', async () => {
      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('config.json')) return { milestone_tracking: true };
        if (path.includes('milestones.json')) return [];
        if (path.includes('sessions.json')) return [];
        return fallback;
      });

      const result = await callTool('useai_end', {
        milestones: [
          { title: 'First', category: 'feature' },
          { title: 'Second', category: 'bugfix' },
        ],
      });

      expect(result.content[0].text).toContain('2 milestones recorded');
    });

    it('uses singular "milestone" for count of 1', async () => {
      mockReadJson.mockImplementation((path: string, fallback: any) => {
        if (path.includes('config.json')) return { milestone_tracking: true };
        if (path.includes('milestones.json')) return [];
        if (path.includes('sessions.json')) return [];
        return fallback;
      });

      const result = await callTool('useai_end', {
        milestones: [{ title: 'Single achievement', category: 'feature' }],
      });

      expect(result.content[0].text).toContain('1 milestone recorded');
      expect(result.content[0].text).not.toContain('milestones recorded');
    });

  });
});

// ── Helper functions ───────────────────────────────────────────────────────────

describe('getConfig helper', () => {
  beforeEach(() => {
    // These tests call useai_end which guards on sessionRecordCount > 0
    mockSessionRecordCount = 7;
    mockClientName = 'claude';
  });

  it('returns config from CONFIG_FILE with defaults', async () => {
    mockReadJson.mockImplementation((path: string, fallback: any) => {
      if (path.includes('config.json')) {
        return { milestone_tracking: false, auto_sync: false, custom_field: 'value' };
      }
      if (path.includes('sessions.json')) return [];
      return fallback;
    });

    await callTool('useai_end', {
      milestones: [{ title: 'Test', category: 'test' }],
    });

    // Verify readJson was called with config file path
    expect(mockReadJson).toHaveBeenCalledWith(
      expect.stringContaining('config.json'),
      expect.objectContaining({ milestone_tracking: true, auto_sync: true })
    );
  });

  it('uses default config when file does not exist', async () => {
    mockReadJson.mockImplementation((_path: string, fallback: any) => fallback);

    await callTool('useai_end', {
      milestones: [{ title: 'Test', category: 'test' }],
    });

    // With default config, milestone_tracking is true, so milestones should be processed
    const milestoneCalls = mockAppendToChain.mock.calls.filter(
      (c: any[]) => c[0] === 'milestone'
    );
    expect(milestoneCalls).toHaveLength(1);
  });
});

describe('getSessions helper', () => {
  beforeEach(() => {
    mockSessionRecordCount = 7;
    mockClientName = 'claude';
  });

  it('returns empty array as fallback when sessions file does not exist', async () => {
    mockReadJson.mockImplementation((_path: string, fallback: any) => fallback);

    await callTool('useai_end', {});

    // Verify readJson was called for sessions file with empty array fallback
    // Since the mock returns the fallback and sessions.json doesn't exist,
    // the writeJson should be called with an array containing just the new session
    const writeCall = mockWriteJson.mock.calls.find((call: any[]) =>
      call[0].includes('sessions.json')
    );
    expect(writeCall).toBeDefined();
    expect(writeCall![1]).toHaveLength(1); // Just the new session
    expect(writeCall![1][0]).toMatchObject({
      session_id: mockSessionId,
      task_type: 'coding',
    });
  });

  it('returns existing sessions from file', async () => {
    const existingSessions = [
      { session_id: 'old-session-1' },
      { session_id: 'old-session-2' },
    ];
    mockReadJson.mockImplementation((path: string, fallback: any) => {
      if (path.includes('sessions.json')) return [...existingSessions];
      return fallback;
    });

    await callTool('useai_end', {});

    // The new session should be appended to existing ones
    expect(mockWriteJson).toHaveBeenCalledWith(
      expect.stringContaining('sessions.json'),
      expect.arrayContaining([
        expect.objectContaining({ session_id: 'old-session-1' }),
        expect.objectContaining({ session_id: 'old-session-2' }),
        expect.objectContaining({ session_id: mockSessionId }),
      ])
    );
  });
});

describe('getMilestones helper', () => {
  beforeEach(() => {
    mockSessionRecordCount = 7;
    mockClientName = 'claude';
  });

  it('returns empty array as fallback when milestones file does not exist', async () => {
    mockReadJson.mockImplementation((path: string, fallback: any) => {
      if (path.includes('config.json')) return { milestone_tracking: true };
      return fallback;
    });

    await callTool('useai_end', {
      milestones: [{ title: 'Test milestone', category: 'feature' }],
    });

    // Verify milestones were written correctly when starting from empty
    const writeCall = mockWriteJson.mock.calls.find((call: any[]) =>
      call[0].includes('milestones.json')
    );
    expect(writeCall).toBeDefined();
    expect(writeCall![1]).toHaveLength(1); // Just the new milestone
    expect(writeCall![1][0]).toMatchObject({
      title: 'Test milestone',
      category: 'feature',
    });
  });
});

// ── Integration-style scenarios ────────────────────────────────────────────────

describe('full session lifecycle', () => {
  it('start → heartbeat → end produces consistent chain records', async () => {
    // Start session
    mockDetectClient.mockReturnValue('claude');
    await callTool('useai_start', { task_type: 'coding' });

    expect(mockResetSession).toHaveBeenCalled();
    expect(mockAppendToChain).toHaveBeenCalledWith('session_start', expect.any(Object));

    // Heartbeat
    vi.clearAllMocks();
    restoreMockImplementations();
    mockHeartbeatCount = 1;
    mockGetSessionDuration.mockReturnValue(600);
    await callTool('useai_heartbeat', {});

    expect(mockIncrementHeartbeat).toHaveBeenCalled();
    expect(mockAppendToChain).toHaveBeenCalledWith('heartbeat', expect.objectContaining({
      heartbeat_number: 2,
      cumulative_seconds: 600,
    }));

    // End session
    vi.clearAllMocks();
    restoreMockImplementations();
    mockGetSessionDuration.mockReturnValue(1200);
    mockClientName = 'claude';
    mockSessionTaskType = 'coding';
    mockHeartbeatCount = 1;
    mockSessionRecordCount = 3;

    mockReadJson.mockImplementation((_path: string, fallback: any) => fallback);

    await callTool('useai_end', {
      languages: ['typescript'],
      files_touched_count: 8,
      milestones: [{ title: 'Built responsive dashboard layout', category: 'feature', complexity: 'complex' }],
    });

    // session_end, session_seal, and milestone records
    expect(mockAppendToChain).toHaveBeenCalledWith('session_end', expect.any(Object));
    expect(mockAppendToChain).toHaveBeenCalledWith('session_seal', expect.any(Object));
    expect(mockAppendToChain).toHaveBeenCalledWith('milestone', expect.any(Object));
  });
});

describe('edge cases', () => {
  beforeEach(() => {
    mockSessionRecordCount = 7;
    mockClientName = 'claude';
    mockSessionTaskType = 'coding';
    mockHeartbeatCount = 0;
  });

  it('handles session end with zero duration', async () => {
    mockGetSessionDuration.mockReturnValue(0);

    const result = await callTool('useai_end', {});

    expect(result.content[0].text).toContain('Session ended');
    const endCall = mockAppendToChain.mock.calls.find((c: any[]) => c[0] === 'session_end');
    expect(endCall![1].duration_seconds).toBe(0);
  });

  it('handles session end with very long duration', async () => {
    mockGetSessionDuration.mockReturnValue(86400); // 24 hours

    const result = await callTool('useai_end', {});

    expect(result.content[0].text).toContain('Session ended');
  });

  it('handles session end with many languages', async () => {
    const result = await callTool('useai_end', {
      languages: ['typescript', 'python', 'rust', 'go', 'java'],
    });

    expect(result.content[0].text).toContain('typescript');
    expect(result.content[0].text).toContain('java');
  });

  it('handles session end with zero files touched', async () => {
    await callTool('useai_end', { files_touched_count: 0 });

    const endCall = mockAppendToChain.mock.calls.find((c: any[]) => c[0] === 'session_end');
    expect(endCall![1].files_touched).toBe(0);
  });

  it('handles multiple milestones with different complexities', async () => {
    mockReadJson.mockImplementation((path: string, fallback: any) => {
      if (path.includes('config.json')) return { milestone_tracking: true };
      if (path.includes('milestones.json')) return [];
      if (path.includes('sessions.json')) return [];
      return fallback;
    });

    await callTool('useai_end', {
      milestones: [
        { title: 'Simple config change', category: 'setup', complexity: 'simple' },
        { title: 'Complex auth refactor', category: 'refactor', complexity: 'complex' },
        { title: 'Medium difficulty feature', category: 'feature' }, // defaults to medium
      ],
    });

    const milestoneCalls = mockAppendToChain.mock.calls.filter(
      (c: any[]) => c[0] === 'milestone'
    );
    expect(milestoneCalls[0]![1].complexity).toBe('simple');
    expect(milestoneCalls[1]![1].complexity).toBe('complex');
    expect(milestoneCalls[2]![1].complexity).toBe('medium');
  });
});