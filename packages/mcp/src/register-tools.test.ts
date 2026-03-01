import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { registerTools, installGracefulToolHandler } from './register-tools';

// ── Mock @useai/shared ─────────────────────────────────────────────────────────

const mockReadJson = vi.fn();
const mockWriteJson = vi.fn();
const mockFormatDuration = vi.fn((s: number) => `${Math.round(s / 60)}m`);
const mockDetectClient = vi.fn(() => 'claude-code');
const mockSignHash = vi.fn((_hash: string, _key: string | null) => 'sig_abc123');
const mockNormalizeMcpClientName = vi.fn((name: string) => name.toLowerCase());

let generateIdCounter = 0;
const mockGenerateSessionId = vi.fn(() => `gen-id-${++generateIdCounter}`);

vi.mock('@useai/shared', async () => {
  const actual = await vi.importActual<typeof import('@useai/shared')>('@useai/shared');
  return {
    ...actual,
    VERSION: '1.0.0-test',
    ACTIVE_DIR: '/tmp/useai/active',
    SEALED_DIR: '/tmp/useai/sealed',
    CONFIG_FILE: '/tmp/useai/config.json',
    SESSIONS_FILE: '/tmp/useai/sessions.json',
    MILESTONES_FILE: '/tmp/useai/milestones.json',
    readJson: (...args: unknown[]) => mockReadJson(...args),
    writeJson: (...args: unknown[]) => mockWriteJson(...args),
    formatDuration: (s: number) => mockFormatDuration(s),
    detectClient: () => mockDetectClient(),
    normalizeMcpClientName: (name: string) => mockNormalizeMcpClientName(name),
    signHash: (_hash: string, _key: string | null) => mockSignHash(_hash, _key),
    generateSessionId: () => mockGenerateSessionId(),
  };
});

// ── Mock node:fs ───────────────────────────────────────────────────────────────

const mockExistsSync = vi.fn();
const mockRenameSync = vi.fn();
const mockReadFileSync = vi.fn();
const mockWriteFileSync = vi.fn();
const mockReaddirSync = vi.fn();
const mockMkdirSync = vi.fn();

vi.mock('node:fs', () => ({
  existsSync: (...args: unknown[]) => mockExistsSync(...args),
  renameSync: (...args: unknown[]) => mockRenameSync(...args),
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  writeFileSync: (...args: unknown[]) => mockWriteFileSync(...args),
  readdirSync: (...args: unknown[]) => mockReaddirSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

// ── Mock node:crypto (only randomUUID) ─────────────────────────────────────────

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
  return {
    ...actual,
    randomUUID: () => 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  };
});

// ── Helpers ────────────────────────────────────────────────────────────────────

type ToolHandler = (args: Record<string, unknown>) => Promise<{ content: Array<{ type: string; text: string }> }>;

interface RegisteredTool {
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: ToolHandler;
}

function createMockSession() {
  return {
    sessionId: 'sess-1234-5678-abcd-efgh',
    conversationId: 'conv-aaaa-bbbb-cccc-dddd',
    conversationIndex: 0,
    clientName: 'claude-code',
    sessionTaskType: 'coding',
    heartbeatCount: 0,
    chainTipHash: 'GENESIS',
    signingAvailable: true,
    signingKey: 'test-signing-key',
    sessionStartTime: Date.now() - 300_000, // 5 minutes ago
    sessionRecordCount: 1,
    sessionTitle: null as string | null,
    sessionPrivateTitle: null as string | null,
    sessionPromptWordCount: null as number | null,
    project: null as string | null,
    modelId: null as string | null,
    inProgress: false,
    inProgressSince: null as number | null,
    autoSealedSessionId: null as string | null,
    parentStateStack: [] as Array<{ sessionId: string; [key: string]: unknown }>,
    get parentState(): { sessionId: string; [key: string]: unknown } | null {
      return this.parentStateStack.length > 0
        ? this.parentStateStack[this.parentStateStack.length - 1]!
        : null;
    },
    getParentSessionIds(): string[] {
      return this.parentStateStack.map((p: { sessionId: string }) => p.sessionId);
    },
    mcpSessionId: null as string | null,
    reset: vi.fn(),
    setClient: vi.fn(),
    setTaskType: vi.fn(),
    setTitle: vi.fn(function (this: ReturnType<typeof createMockSession>, t: string | null) {
      this.sessionTitle = t;
    }),
    setPrivateTitle: vi.fn(function (this: ReturnType<typeof createMockSession>, t: string | null) {
      this.sessionPrivateTitle = t;
    }),
    setPromptWordCount: vi.fn(function (this: ReturnType<typeof createMockSession>, c: number | null) {
      this.sessionPromptWordCount = c;
    }),
    setModel: vi.fn(function (this: ReturnType<typeof createMockSession>, id: string) {
      this.modelId = id;
    }),
    incrementHeartbeat: vi.fn(function (this: ReturnType<typeof createMockSession>) {
      this.heartbeatCount++;
    }),
    getSessionDuration: vi.fn(() => 300),
    appendToChain: vi.fn((_event: string, _data: Record<string, unknown>) => ({
      hash: 'chain_hash_abc123def456',
    })),
    saveParentState: vi.fn(),
    restoreParentState: vi.fn(() => false),
  };
}

function createMockServer(clientVersion?: { name: string; version: string }) {
  const tools: RegisteredTool[] = [];
  return {
    tool: vi.fn(
      (
        name: string,
        description: string,
        schema: Record<string, unknown>,
        handler: ToolHandler,
      ) => {
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

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('registerTools', () => {
  let server: ReturnType<typeof createMockServer>;
  let session: ReturnType<typeof createMockSession>;

  beforeEach(() => {
    vi.clearAllMocks();
    generateIdCounter = 0;
    server = createMockServer();
    session = createMockSession();

    // Default mock returns
    mockReadJson.mockImplementation((_path: string, fallback: unknown) => fallback);
    mockExistsSync.mockReturnValue(false);
  });

  it('registers exactly five tools on the server', () => {
    registerTools(server as never, session as never);

    expect(server.tool).toHaveBeenCalledTimes(5);
    expect(server._tools.map((t) => t.name)).toEqual([
      'useai_start',
      'useai_heartbeat',
      'useai_end',
      'useai_backup',
      'useai_restore',
    ]);
  });

  // ── session_start ──────────────────────────────────────────────────────────

  describe('useai_start', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      registerTools(server as never, session as never);
      handler = server.getToolHandler('useai_start');
    });

    it('resets the session state when invoked', async () => {
      await handler({ task_type: 'debugging' });

      expect(session.reset).toHaveBeenCalledOnce();
    });

    it('skips detection when client already set', async () => {
      session.clientName = 'claude-code';

      await handler({ task_type: 'coding' });

      expect(server.server.getClientVersion).not.toHaveBeenCalled();
      expect(mockDetectClient).not.toHaveBeenCalled();
      expect(session.setClient).not.toHaveBeenCalled();
    });

    it('resolves client from MCP clientInfo when unknown (daemon mode)', async () => {
      session.clientName = 'unknown';
      server.server.getClientVersion = vi.fn(() => ({ name: 'claude-code', version: '2.1.0' }));

      await handler({ task_type: 'coding' });

      expect(mockNormalizeMcpClientName).toHaveBeenCalledWith('claude-code');
      expect(session.setClient).toHaveBeenCalledWith('claude-code');
      expect(mockDetectClient).not.toHaveBeenCalled();
    });

    it('falls back to env detection when MCP clientInfo is unavailable (stdio mode)', async () => {
      session.clientName = 'unknown';
      server.server.getClientVersion = vi.fn(() => undefined);
      mockDetectClient.mockReturnValue('cursor');

      await handler({ task_type: 'coding' });

      expect(mockDetectClient).toHaveBeenCalledOnce();
      expect(session.setClient).toHaveBeenCalledWith('cursor');
    });

    it('sets the provided task type on the session', async () => {
      await handler({ task_type: 'testing' });

      expect(session.setTaskType).toHaveBeenCalledWith('testing');
    });

    it('defaults task type to "coding" when not provided', async () => {
      await handler({ task_type: undefined });

      expect(session.setTaskType).toHaveBeenCalledWith('coding');
    });

    it('appends a session_start event to the chain with correct payload', async () => {
      mockDetectClient.mockReturnValue('vscode');
      session.clientName = 'vscode';
      session.sessionTaskType = 'debugging';

      await handler({ task_type: 'debugging' });

      // No conversation_id passed → generates a new one (gen-id-1 from mock)
      expect(session.appendToChain).toHaveBeenCalledWith('session_start', {
        client: 'vscode',
        task_type: 'debugging',
        project: null,
        conversation_id: 'gen-id-1',
        conversation_index: 0,
        version: '1.0.0-test',
      });
    });

    it('returns a text response with session ID and chain hash', async () => {
      session.sessionId = 'abcdef12-3456-7890-abcd-ef1234567890';
      session.clientName = 'claude-code';
      session.sessionTaskType = 'coding';
      session.signingAvailable = true;
      session.appendToChain = vi.fn(() => ({ hash: 'hashvalue_12chars_plus' }));

      const result = await handler({ task_type: 'coding' });

      expect(result.content).toHaveLength(2);
      expect(result.content[0]!.type).toBe('text');
      expect(result.content[0]!.text).toContain('useai session started');
      expect(result.content[0]!.text).toContain('coding');
      expect(result.content[0]!.text).toContain('claude-code');
      expect(result.content[0]!.text).toContain('abcdef12');
      expect(result.content[0]!.text).toContain('signed');
      expect(result.content[1]!.type).toBe('text');
      expect(result.content[1]!.text).toMatch(/^conversation_id=/);
    });

    it('indicates unsigned when signing is not available', async () => {
      session.signingAvailable = false;

      const result = await handler({ task_type: 'coding' });

      expect(result.content[0]!.text).toContain('unsigned');
    });

    it('stores model ID and includes it in chain data when provided', async () => {
      await handler({ task_type: 'coding', model: 'claude-opus-4-6' });

      expect(session.setModel).toHaveBeenCalledWith('claude-opus-4-6');
      expect(session.appendToChain).toHaveBeenCalledWith('session_start',
        expect.objectContaining({ model: 'claude-opus-4-6' }),
      );
    });

    it('omits model from chain data when not provided', async () => {
      await handler({ task_type: 'coding' });

      const chainCall = (session.appendToChain as Mock).mock.calls.find(
        (entry) => entry[0] === 'session_start',
      );
      expect(chainCall).toBeDefined();
      expect(chainCall![1]).not.toHaveProperty('model');
    });

  });

  // ── heartbeat ──────────────────────────────────────────────────────────────

  describe('useai_heartbeat', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      registerTools(server as never, session as never);
      handler = server.getToolHandler('useai_heartbeat');
    });

    it('increments the heartbeat counter', async () => {
      await handler({});

      expect(session.incrementHeartbeat).toHaveBeenCalledOnce();
    });

    it('appends a heartbeat event to the chain with count and duration', async () => {
      session.heartbeatCount = 3;
      session.getSessionDuration = vi.fn(() => 900);

      await handler({});

      expect(session.appendToChain).toHaveBeenCalledWith('heartbeat', {
        heartbeat_number: 4,
        cumulative_seconds: 900,
      });
    });

    it('returns a text response with formatted duration', async () => {
      session.getSessionDuration = vi.fn(() => 600);
      mockFormatDuration.mockReturnValue('10m 0s');

      const result = await handler({});

      expect(result.content).toHaveLength(1);
      expect(result.content[0]!.type).toBe('text');
      expect(result.content[0]!.text).toContain('Heartbeat recorded');
      expect(result.content[0]!.text).toContain('10m 0s');
    });

    it('reflects updated heartbeat count after increment in chain record', async () => {
      // Session starts at 0, incrementHeartbeat bumps to 1
      session.heartbeatCount = 0;
      session.incrementHeartbeat = vi.fn(() => {
        session.heartbeatCount = 1;
      });

      await handler({});

      expect(session.appendToChain).toHaveBeenCalledWith('heartbeat', {
        heartbeat_number: 1,
        cumulative_seconds: 300,
      });
    });
  });

  // ── session_end ────────────────────────────────────────────────────────────

  describe('useai_end', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      registerTools(server as never, session as never);
      handler = server.getToolHandler('useai_end');
    });

    it('appends a session_end event to the chain with session summary', async () => {
      session.getSessionDuration = vi.fn(() => 600);
      session.heartbeatCount = 2;

      await handler({
        task_type: 'debugging',
        languages: ['typescript', 'python'],
        files_touched_count: 5,
      });

      expect(session.appendToChain).toHaveBeenCalledWith('session_end', {
        duration_seconds: 600,
        task_type: 'debugging',
        languages: ['typescript', 'python'],
        files_touched: 5,
        heartbeat_count: 2,
      });
    });

    it('falls back to session task type when task_type not provided', async () => {
      session.sessionTaskType = 'reviewing';

      await handler({});

      expect(session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({ task_type: 'reviewing' }),
      );
    });

    it('defaults languages to empty array when not provided', async () => {
      await handler({});

      expect(session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({ languages: [] }),
      );
    });

    it('defaults files_touched to 0 when not provided', async () => {
      await handler({});

      expect(session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({ files_touched: 0 }),
      );
    });

    it('appends a session_seal event with seal data and signature', async () => {
      await handler({ task_type: 'coding' });

      const sealCall = (session.appendToChain as Mock).mock.calls.find(
        (entry) => entry[0] === 'session_seal',
      );
      expect(sealCall).toBeDefined();
      expect(sealCall![0]).toBe('session_seal');

      const sealPayload = sealCall![1] as { seal: string; seal_signature: string };
      expect(typeof sealPayload.seal).toBe('string');
      expect(typeof sealPayload.seal_signature).toBe('string');

      // Verify seal data contains session info
      const sealData = JSON.parse(sealPayload.seal);
      expect(sealData.session_id).toBe(session.sessionId);
      expect(sealData.client).toBe(session.clientName);
      expect(sealData.chain_end_hash).toBe('chain_hash_abc123def456');
    });

    it('calls signHash to sign the seal data', async () => {
      await handler({ task_type: 'coding' });

      expect(mockSignHash).toHaveBeenCalledOnce();
      expect(mockSignHash).toHaveBeenCalledWith(
        expect.any(String),
        session.signingKey,
      );
    });

    it('moves chain file from active to sealed directory when file exists', async () => {
      mockExistsSync.mockReturnValue(true);

      await handler({ task_type: 'coding' });

      expect(mockExistsSync).toHaveBeenCalledWith(
        `/tmp/useai/active/${session.sessionId}.jsonl`,
      );
      expect(mockRenameSync).toHaveBeenCalledWith(
        `/tmp/useai/active/${session.sessionId}.jsonl`,
        `/tmp/useai/sealed/${session.sessionId}.jsonl`,
      );
    });

    it('does not attempt rename when active chain file does not exist', async () => {
      mockExistsSync.mockReturnValue(false);

      await handler({ task_type: 'coding' });

      expect(mockRenameSync).not.toHaveBeenCalled();
    });

    it('handles rename failure gracefully without throwing', async () => {
      mockExistsSync.mockReturnValue(true);
      mockRenameSync.mockImplementation(() => {
        throw new Error('cross-device link');
      });

      const result = await handler({ task_type: 'coding' });

      // Should succeed without throwing
      expect(result.content[0]!.type).toBe('text');
      expect(result.content[0]!.text).toContain('Session ended');
    });

    it('writes session seal to the sessions index file', async () => {
      const existingSessions = [
        { session_id: 'old-session', client: 'vscode' },
      ];
      mockReadJson.mockImplementation((path: string, fallback: unknown) => {
        if (path === '/tmp/useai/sessions.json') return [...existingSessions];
        return fallback;
      });

      await handler({
        task_type: 'testing',
        languages: ['typescript'],
        files_touched_count: 3,
      });

      expect(mockWriteJson).toHaveBeenCalledWith(
        '/tmp/useai/sessions.json',
        expect.arrayContaining([
          expect.objectContaining({ session_id: 'old-session' }),
          expect.objectContaining({
            session_id: session.sessionId,
            client: session.clientName,
            task_type: 'testing',
            languages: ['typescript'],
            files_touched: 3,
            heartbeat_count: session.heartbeatCount,
            record_count: session.sessionRecordCount,
            chain_end_hash: 'chain_hash_abc123def456',
            seal_signature: 'sig_abc123',
          }),
        ]),
      );
    });

    it('includes chain_start_hash from chainTipHash in the seal', async () => {
      session.chainTipHash = 'previous_tip_hash_value';

      await handler({ task_type: 'coding' });

      expect(mockWriteJson).toHaveBeenCalledWith(
        '/tmp/useai/sessions.json',
        expect.arrayContaining([
          expect.objectContaining({
            chain_start_hash: 'previous_tip_hash_value',
          }),
        ]),
      );
    });

    it('uses GENESIS as chain_start_hash when tip hash is GENESIS', async () => {
      session.chainTipHash = 'GENESIS';

      await handler({ task_type: 'coding' });

      expect(mockWriteJson).toHaveBeenCalledWith(
        '/tmp/useai/sessions.json',
        expect.arrayContaining([
          expect.objectContaining({
            chain_start_hash: 'GENESIS',
          }),
        ]),
      );
    });

    it('includes evaluation data in session_end chain record when provided', async () => {
      const evaluation = {
        prompt_quality: 5,
        context_provided: 4,
        task_outcome: 'completed' as const,
        iteration_count: 3,
        independence_level: 5,
        scope_quality: 4,
        tools_leveraged: 2,
      };

      await handler({
        task_type: 'coding',
        evaluation,
      });

      expect(session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({ evaluation }),
      );
    });

    it('includes evaluation in session seal written to sessions.json when provided', async () => {
      const evaluation = {
        prompt_quality: 4,
        context_provided: 5,
        task_outcome: 'partial' as const,
        iteration_count: 5,
        independence_level: 3,
        scope_quality: 4,
        tools_leveraged: 3,
      };

      mockReadJson.mockImplementation((path: string, fallback: unknown) => {
        if (path === '/tmp/useai/sessions.json') return [];
        return fallback;
      });

      await handler({
        task_type: 'testing',
        languages: ['typescript'],
        files_touched_count: 2,
        evaluation,
      });

      // Check that evaluation is present in the seal data passed to appendToChain
      const sealCall = (session.appendToChain as Mock).mock.calls.find(
        (entry) => entry[0] === 'session_seal',
      );
      expect(sealCall).toBeDefined();
      const sealPayload = sealCall![1] as { seal: string };
      const sealData = JSON.parse(sealPayload.seal);
      expect(sealData.evaluation).toEqual(evaluation);
    });

    it('omits evaluation from session seal when not provided (backward compatibility)', async () => {
      mockReadJson.mockImplementation((path: string, fallback: unknown) => {
        if (path === '/tmp/useai/sessions.json') return [];
        return fallback;
      });

      await handler({
        task_type: 'coding',
        languages: ['python'],
        files_touched_count: 1,
      });

      // Check that evaluation is not present in the seal data
      const sealCall = (session.appendToChain as Mock).mock.calls.find(
        (entry) => entry[0] === 'session_seal',
      );
      expect(sealCall).toBeDefined();
      const sealPayload = sealCall![1] as { seal: string };
      const sealData = JSON.parse(sealPayload.seal);
      expect(sealData.evaluation).toBeUndefined();
    });

    it('returns formatted response with duration and task type', async () => {
      session.getSessionDuration = vi.fn(() => 1800);
      mockFormatDuration.mockReturnValue('30m 0s');

      const result = await handler({
        task_type: 'debugging',
        languages: ['rust', 'go'],
      });

      expect(result.content[0]!.text).toContain('Session ended');
      expect(result.content[0]!.text).toContain('30m 0s');
      expect(result.content[0]!.text).toContain('debugging');
      expect(result.content[0]!.text).toContain('rust, go');
    });

    it('omits language info from response when no languages provided', async () => {
      mockFormatDuration.mockReturnValue('5m');

      const result = await handler({ task_type: 'coding' });

      expect(result.content[0]!.text).not.toContain('using');
    });

    it('includes model in session_end chain record and seal when set', async () => {
      session.modelId = 'claude-opus-4-6';
      mockReadJson.mockImplementation((path: string, fallback: unknown) => {
        if (path === '/tmp/useai/sessions.json') return [];
        return fallback;
      });

      await handler({ task_type: 'coding' });

      // Check session_end chain record includes model
      expect(session.appendToChain).toHaveBeenCalledWith(
        'session_end',
        expect.objectContaining({ model: 'claude-opus-4-6' }),
      );

      // Check seal data includes model
      const sealCall = (session.appendToChain as Mock).mock.calls.find(
        (entry) => entry[0] === 'session_seal',
      );
      const sealData = JSON.parse((sealCall![1] as { seal: string }).seal);
      expect(sealData.model).toBe('claude-opus-4-6');

      // Check sessions.json includes model
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/tmp/useai/sessions.json',
        expect.arrayContaining([
          expect.objectContaining({ model: 'claude-opus-4-6' }),
        ]),
      );
    });

    // ── Milestone processing ───────────────────────────────────────────────

    describe('milestone processing', () => {
      const sampleMilestones = [
        {
          title: 'Implemented user authentication',
          category: 'feature' as const,
          complexity: 'complex' as const,
        },
        {
          title: 'Added unit tests for data validation',
          category: 'test' as const,
        },
      ];

      it('processes milestones when milestone_tracking is enabled in config', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: true, auto_sync: true };
          if (path === '/tmp/useai/milestones.json') return [];
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        session.getSessionDuration = vi.fn(() => 1200); // 20 minutes

        await handler({
          task_type: 'coding',
          languages: ['typescript'],
          milestones: sampleMilestones,
        });

        // Should write milestones file
        expect(mockWriteJson).toHaveBeenCalledWith(
          '/tmp/useai/milestones.json',
          expect.arrayContaining([
            expect.objectContaining({
              title: 'Implemented user authentication',
              category: 'feature',
              complexity: 'complex',
              duration_minutes: 20,
              languages: ['typescript'],
              client: session.clientName,
              session_id: session.sessionId,
              published: false,
              published_at: null,
              chain_hash: 'chain_hash_abc123def456',
            }),
            expect.objectContaining({
              title: 'Added unit tests for data validation',
              category: 'test',
              complexity: 'medium', // defaults to medium
            }),
          ]),
        );
      });

      it('generates milestone IDs with m_ prefix from randomUUID', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: true };
          if (path === '/tmp/useai/milestones.json') return [];
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        await handler({
          milestones: [
            { title: 'Built responsive dashboard', category: 'feature' },
          ],
        });

        expect(mockWriteJson).toHaveBeenCalledWith(
          '/tmp/useai/milestones.json',
          expect.arrayContaining([
            expect.objectContaining({
              id: 'm_a1b2c3d4',
            }),
          ]),
        );
      });

      it('appends milestone events to the chain for each milestone', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: true };
          if (path === '/tmp/useai/milestones.json') return [];
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        session.getSessionDuration = vi.fn(() => 600);

        await handler({
          languages: ['python'],
          milestones: [
            { title: 'Refactored state management', category: 'refactor', complexity: 'medium' },
          ],
        });

        expect(session.appendToChain).toHaveBeenCalledWith('milestone', {
          title: 'Refactored state management',
          category: 'refactor',
          complexity: 'medium',
          duration_minutes: 10,
          languages: ['python'],
        });
      });

      it('does NOT process milestones when milestone_tracking is disabled', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: false, auto_sync: true };
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        await handler({
          milestones: sampleMilestones,
        });

        // Should NOT write milestones file
        expect(mockWriteJson).not.toHaveBeenCalledWith(
          '/tmp/useai/milestones.json',
          expect.anything(),
        );

        // Should NOT append milestone chain events
        const milestoneCalls = (session.appendToChain as Mock).mock.calls.filter(
          (entry) => entry[0] === 'milestone',
        );
        expect(milestoneCalls).toHaveLength(0);
      });

      it('does NOT process milestones when milestones array is empty', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: true };
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        await handler({
          milestones: [],
        });

        expect(mockWriteJson).not.toHaveBeenCalledWith(
          '/tmp/useai/milestones.json',
          expect.anything(),
        );
      });

      it('does NOT process milestones when milestones is undefined', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: true };
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        await handler({ task_type: 'coding' });

        expect(mockWriteJson).not.toHaveBeenCalledWith(
          '/tmp/useai/milestones.json',
          expect.anything(),
        );
      });

      it('appends new milestones to existing milestones', async () => {
        const existingMilestones = [
          { id: 'm_existing1', title: 'Existing milestone', category: 'feature' },
        ];

        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: true };
          if (path === '/tmp/useai/milestones.json')
            return [...existingMilestones];
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        await handler({
          milestones: [
            { title: 'New milestone work', category: 'bugfix' },
          ],
        });

        expect(mockWriteJson).toHaveBeenCalledWith(
          '/tmp/useai/milestones.json',
          expect.arrayContaining([
            expect.objectContaining({ id: 'm_existing1' }),
            expect.objectContaining({ title: 'New milestone work', category: 'bugfix' }),
          ]),
        );
      });

      it('includes milestone count in the response text', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: true };
          if (path === '/tmp/useai/milestones.json') return [];
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        const result = await handler({
          milestones: sampleMilestones,
        });

        expect(result.content[0]!.text).toContain('2 milestones recorded');
      });

      it('uses singular "milestone" for a single milestone', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: true };
          if (path === '/tmp/useai/milestones.json') return [];
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        const result = await handler({
          milestones: [
            { title: 'Single accomplishment', category: 'feature' },
          ],
        });

        expect(result.content[0]!.text).toMatch(/1 milestone(?!s)/);
      });

      it('does not include milestone text in response when tracking is disabled', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: false };
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        const result = await handler({
          milestones: sampleMilestones,
        });

        expect(result.content[0]!.text).not.toContain('milestone');
      });

      it('defaults milestone complexity to medium when not specified', async () => {
        mockReadJson.mockImplementation((path: string, fallback: unknown) => {
          if (path === '/tmp/useai/config.json')
            return { milestone_tracking: true };
          if (path === '/tmp/useai/milestones.json') return [];
          if (path === '/tmp/useai/sessions.json') return [];
          return fallback;
        });

        await handler({
          milestones: [
            { title: 'Work without complexity', category: 'docs' },
          ],
        });

        expect(session.appendToChain).toHaveBeenCalledWith(
          'milestone',
          expect.objectContaining({ complexity: 'medium' }),
        );

        expect(mockWriteJson).toHaveBeenCalledWith(
          '/tmp/useai/milestones.json',
          expect.arrayContaining([
            expect.objectContaining({ complexity: 'medium' }),
          ]),
        );
      });
    });
  });

  // ── useai_backup ───────────────────────────────────────────────────────────

  describe('useai_backup', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      registerTools(server as never, session as never);
      handler = server.getToolHandler('useai_backup');
    });

    it('reads sessions and milestones from mocked paths', async () => {
      mockReadJson.mockImplementation((path: string) => {
        if (path.includes('sessions')) return [{ session_id: 's1' }];
        if (path.includes('milestones')) return [{ id: 'm1' }];
        return [];
      });
      mockExistsSync.mockReturnValue(false);

      const result = await handler({});
      const data = JSON.parse(result.content[0]!.text);

      expect(data.sessions).toEqual([{ session_id: 's1' }]);
      expect(data.milestones).toEqual([{ id: 'm1' }]);
    });

    it('reads sealed chain files from mocked SEALED_DIR', async () => {
      mockReadJson.mockReturnValue([]);
      mockExistsSync.mockReturnValue(true);
      mockReaddirSync.mockReturnValue(['abc.jsonl']);
      mockReadFileSync.mockReturnValue('chain-content');

      const result = await handler({});
      const data = JSON.parse(result.content[0]!.text);

      expect(mockReaddirSync).toHaveBeenCalledWith('/tmp/useai/sealed');
      expect(mockReadFileSync).toHaveBeenCalledWith('/tmp/useai/sealed/abc.jsonl', 'utf-8');
      expect(data.sealed_chains).toEqual({ 'abc.jsonl': 'chain-content' });
    });
  });

  // ── useai_restore ──────────────────────────────────────────────────────────

  describe('useai_restore', () => {
    let handler: ToolHandler;

    beforeEach(() => {
      registerTools(server as never, session as never);
      handler = server.getToolHandler('useai_restore');
    });

    it('rejects sessions missing required fields', async () => {
      mockReadJson.mockReturnValue([]);

      const backup = JSON.stringify({
        sessions: [
          { session_id: 'a', data: 'dummy' },
          { session_id: 'b', data: 'dummy' },
        ],
      });

      const result = await handler({ backup_json: backup });
      const data = JSON.parse(result.content[0]!.text);

      expect(data.success).toBe(true);
      expect(data.restored).toBe(0);
      expect(data.skipped_invalid).toBe(2);
      expect(mockWriteJson).not.toHaveBeenCalled();
    });

    it('accepts valid sessions and merges them', async () => {
      mockReadJson.mockReturnValue([]);

      const validSession = {
        session_id: 'valid-1234-5678-abcd-ef1234567890',
        started_at: '2026-02-27T10:00:00Z',
        ended_at: '2026-02-27T10:10:00Z',
        duration_seconds: 600,
        client: 'claude-code',
        task_type: 'coding',
        languages: ['typescript'],
        files_touched: 3,
        heartbeat_count: 0,
        record_count: 2,
        chain_start_hash: 'abc',
        chain_end_hash: 'def',
        seal_signature: 'sig',
      };

      const backup = JSON.stringify({ sessions: [validSession] });
      const result = await handler({ backup_json: backup });
      const data = JSON.parse(result.content[0]!.text);

      expect(data.success).toBe(true);
      expect(data.restored).toBe(1);
      expect(mockWriteJson).toHaveBeenCalledWith(
        '/tmp/useai/sessions.json',
        expect.arrayContaining([expect.objectContaining({ session_id: validSession.session_id })]),
      );
    });

    it('writes sealed chain files to mocked SEALED_DIR only', async () => {
      mockReadJson.mockReturnValue([]);
      mockExistsSync.mockReturnValue(false);

      const backup = JSON.stringify({
        sealed_chains: { 'test.jsonl': 'chain-data' },
      });

      const result = await handler({ backup_json: backup });
      const data = JSON.parse(result.content[0]!.text);

      expect(data.success).toBe(true);
      expect(mockMkdirSync).toHaveBeenCalledWith('/tmp/useai/sealed', { recursive: true });
      expect(mockWriteFileSync).toHaveBeenCalledWith('/tmp/useai/sealed/test.jsonl', 'chain-data', 'utf-8');
    });

    it('skips existing chain files without overwriting', async () => {
      mockReadJson.mockReturnValue([]);
      mockExistsSync.mockReturnValue(true);

      const backup = JSON.stringify({
        sealed_chains: { 'existing.jsonl': 'new-data' },
      });

      await handler({ backup_json: backup });

      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });
});

// ── installGracefulToolHandler ────────────────────────────────────────────────

describe('installGracefulToolHandler', () => {
  it('wraps the tools/call handler to catch errors', async () => {
    const throwingHandler = vi.fn().mockRejectedValue(new Error('Tool xyz not found'));
    const requestHandlers = new Map<string, Function>();
    requestHandlers.set('tools/call', throwingHandler);

    const fakeMcpServer = {
      server: { _requestHandlers: requestHandlers },
    };

    installGracefulToolHandler(fakeMcpServer as never);

    const wrappedHandler = requestHandlers.get('tools/call')!;
    expect(wrappedHandler).not.toBe(throwingHandler);

    const result = await wrappedHandler({}, {});
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Tool xyz not found' }],
      isError: true,
    });
  });

  it('passes through successful results unchanged', async () => {
    const successResult = { content: [{ type: 'text', text: 'ok' }] };
    const successHandler = vi.fn().mockResolvedValue(successResult);
    const requestHandlers = new Map<string, Function>();
    requestHandlers.set('tools/call', successHandler);

    const fakeMcpServer = {
      server: { _requestHandlers: requestHandlers },
    };

    installGracefulToolHandler(fakeMcpServer as never);

    const wrappedHandler = requestHandlers.get('tools/call')!;
    const result = await wrappedHandler({ params: { name: 'useai_start' } }, {});

    expect(result).toBe(successResult);
    expect(successHandler).toHaveBeenCalledWith({ params: { name: 'useai_start' } }, {});
  });

  it('does nothing when no tools/call handler exists', () => {
    const requestHandlers = new Map<string, Function>();
    const fakeMcpServer = {
      server: { _requestHandlers: requestHandlers },
    };

    // Should not throw
    installGracefulToolHandler(fakeMcpServer as never);
    expect(requestHandlers.has('tools/call')).toBe(false);
  });
});