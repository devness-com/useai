import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChainRecord } from '@useai/shared';

// ── Mock SessionState ───────────────────────────────────────────────────────

// vi.hoisted runs before vi.mock factories, avoiding TDZ issues
const mockState = vi.hoisted(() => ({
  sessionStartTime: 1000,
  sessionId: 'initial-session-id',
  heartbeatCount: 0,
  sessionRecordCount: 0,
  clientName: 'initial-client',
  sessionTaskType: 'coding',
  chainTipHash: 'initial-hash',
  signingKey: null as any,
  signingAvailable: false,

  reset: vi.fn(),
  setClient: vi.fn(),
  setTaskType: vi.fn(),
  incrementHeartbeat: vi.fn(),
  getSessionDuration: vi.fn(),
  initializeKeystore: vi.fn(),
  appendToChain: vi.fn(),
}));

vi.mock('./session-state.js', () => ({
  // Use a regular function (not arrow) so it's valid as a constructor
  SessionState: vi.fn(function () { return mockState; }),
}));

// ── Import after mock ───────────────────────────────────────────────────────

let mod: typeof import('./session.js');

beforeEach(async () => {
  vi.resetModules();

  // Reset mock state to defaults
  mockState.sessionStartTime = 1000;
  mockState.sessionId = 'initial-session-id';
  mockState.heartbeatCount = 0;
  mockState.sessionRecordCount = 0;
  mockState.clientName = 'initial-client';
  mockState.sessionTaskType = 'coding';
  mockState.chainTipHash = 'initial-hash';
  mockState.signingKey = null;
  mockState.signingAvailable = false;

  mockState.reset.mockReset();
  mockState.setClient.mockReset();
  mockState.setTaskType.mockReset();
  mockState.incrementHeartbeat.mockReset();
  mockState.getSessionDuration.mockReset();
  mockState.initializeKeystore.mockReset();
  mockState.appendToChain.mockReset();

  mod = await import('./session.js');
});

// ── Tests ───────────────────────────────────────────────────────────────────

describe('session module delegation', () => {
  describe('initial module-level exports', () => {
    it('exports initial values from the SessionState singleton', () => {
      expect(mod.sessionStartTime).toBe(1000);
      expect(mod.sessionId).toBe('initial-session-id');
      expect(mod.heartbeatCount).toBe(0);
      expect(mod.sessionRecordCount).toBe(0);
      expect(mod.clientName).toBe('initial-client');
      expect(mod.sessionTaskType).toBe('coding');
      expect(mod.chainTipHash).toBe('initial-hash');
      expect(mod.signingKey).toBeNull();
      expect(mod.signingAvailable).toBe(false);
    });
  });

  describe('resetSession', () => {
    it('delegates to state.reset() and syncs all vars to new state', () => {
      mockState.reset.mockImplementation(() => {
        mockState.sessionStartTime = 2000;
        mockState.sessionId = 'reset-session-id';
        mockState.heartbeatCount = 0;
        mockState.sessionRecordCount = 0;
        mockState.clientName = '';
        mockState.sessionTaskType = '';
        mockState.chainTipHash = '';
        mockState.signingKey = null;
        mockState.signingAvailable = false;
      });

      mod.resetSession();

      expect(mockState.reset).toHaveBeenCalledOnce();
      expect(mod.sessionStartTime).toBe(2000);
      expect(mod.sessionId).toBe('reset-session-id');
      expect(mod.heartbeatCount).toBe(0);
      expect(mod.clientName).toBe('');
      expect(mod.sessionTaskType).toBe('');
      expect(mod.chainTipHash).toBe('');
    });

    it('syncs signingKey and signingAvailable after reset', () => {
      const fakeKey = { type: 'secret' } as unknown as import('node:crypto').KeyObject;
      mockState.reset.mockImplementation(() => {
        mockState.signingKey = fakeKey;
        mockState.signingAvailable = true;
      });

      mod.resetSession();

      expect(mod.signingKey).toBe(fakeKey);
      expect(mod.signingAvailable).toBe(true);
    });

    it('syncs sessionRecordCount after reset', () => {
      mockState.reset.mockImplementation(() => {
        mockState.sessionRecordCount = 5;
      });

      mod.resetSession();

      expect(mod.sessionRecordCount).toBe(5);
    });
  });

  describe('setClient', () => {
    it('delegates to state.setClient and syncs clientName export', () => {
      mockState.setClient.mockImplementation((name: string) => {
        mockState.clientName = name;
      });

      mod.setClient('claude-desktop');

      expect(mockState.setClient).toHaveBeenCalledWith('claude-desktop');
      expect(mod.clientName).toBe('claude-desktop');
    });

    it('handles empty string client name', () => {
      mockState.setClient.mockImplementation((name: string) => {
        mockState.clientName = name;
      });

      mod.setClient('');

      expect(mockState.setClient).toHaveBeenCalledWith('');
      expect(mod.clientName).toBe('');
    });

    it('does not affect other module-level exports', () => {
      mockState.setClient.mockImplementation((name: string) => {
        mockState.clientName = name;
      });

      mod.setClient('cursor');

      expect(mod.sessionTaskType).toBe('coding');
      expect(mod.heartbeatCount).toBe(0);
      expect(mod.sessionId).toBe('initial-session-id');
    });
  });

  describe('setTaskType', () => {
    it('delegates to state.setTaskType and syncs sessionTaskType export', () => {
      mockState.setTaskType.mockImplementation((type: string) => {
        mockState.sessionTaskType = type;
      });

      mod.setTaskType('debugging');

      expect(mockState.setTaskType).toHaveBeenCalledWith('debugging');
      expect(mod.sessionTaskType).toBe('debugging');
    });

    it('handles empty string task type', () => {
      mockState.setTaskType.mockImplementation((type: string) => {
        mockState.sessionTaskType = type;
      });

      mod.setTaskType('');

      expect(mockState.setTaskType).toHaveBeenCalledWith('');
      expect(mod.sessionTaskType).toBe('');
    });

    it('does not affect other module-level exports', () => {
      mockState.setTaskType.mockImplementation((type: string) => {
        mockState.sessionTaskType = type;
      });

      mod.setTaskType('review');

      expect(mod.clientName).toBe('initial-client');
      expect(mod.heartbeatCount).toBe(0);
    });
  });

  describe('incrementHeartbeat', () => {
    it('delegates to state.incrementHeartbeat and syncs heartbeatCount export', () => {
      mockState.incrementHeartbeat.mockImplementation(() => {
        mockState.heartbeatCount += 1;
      });

      mod.incrementHeartbeat();

      expect(mockState.incrementHeartbeat).toHaveBeenCalledOnce();
      expect(mod.heartbeatCount).toBe(1);
    });

    it('correctly tracks multiple heartbeat increments', () => {
      let count = 0;
      mockState.incrementHeartbeat.mockImplementation(() => {
        count += 1;
        mockState.heartbeatCount = count;
      });

      mod.incrementHeartbeat();
      mod.incrementHeartbeat();
      mod.incrementHeartbeat();

      expect(mockState.incrementHeartbeat).toHaveBeenCalledTimes(3);
      expect(mod.heartbeatCount).toBe(3);
    });

    it('does not affect other module-level exports', () => {
      mockState.incrementHeartbeat.mockImplementation(() => {
        mockState.heartbeatCount = 1;
      });

      mod.incrementHeartbeat();

      expect(mod.clientName).toBe('initial-client');
      expect(mod.sessionRecordCount).toBe(0);
    });
  });

  describe('getSessionDuration', () => {
    it('delegates to state.getSessionDuration and returns the result', () => {
      mockState.getSessionDuration.mockReturnValue(45_000);

      const duration = mod.getSessionDuration();

      expect(mockState.getSessionDuration).toHaveBeenCalledOnce();
      expect(duration).toBe(45_000);
    });

    it('returns zero for a just-started session', () => {
      mockState.getSessionDuration.mockReturnValue(0);

      expect(mod.getSessionDuration()).toBe(0);
    });

    it('returns the value from state without modifying module-level exports', () => {
      mockState.getSessionDuration.mockReturnValue(120_000);

      const duration = mod.getSessionDuration();

      expect(duration).toBe(120_000);
      // getSessionDuration is a pure read — no sync side-effects
      expect(mod.sessionStartTime).toBe(1000);
    });
  });

  describe('appendToChain', () => {
    it('delegates to state.appendToChain and returns the chain record', () => {
      const fakeRecord: ChainRecord = {
        type: 'session_start',
        timestamp: '2026-02-15T10:00:00Z',
        hash: 'abc123',
        prevHash: 'initial-hash',
        data: { taskType: 'coding' },
      } as unknown as ChainRecord;

      mockState.appendToChain.mockImplementation(() => {
        mockState.chainTipHash = 'abc123';
        mockState.sessionRecordCount = 1;
        return fakeRecord;
      });

      const result = mod.appendToChain('session_start', { taskType: 'coding' });

      expect(mockState.appendToChain).toHaveBeenCalledWith('session_start', {
        taskType: 'coding',
      });
      expect(result).toBe(fakeRecord);
    });

    it('syncs chainTipHash after appending', () => {
      mockState.appendToChain.mockImplementation(() => {
        mockState.chainTipHash = 'new-tip-hash-after-append';
        mockState.sessionRecordCount = 1;
        return {} as ChainRecord;
      });

      mod.appendToChain('heartbeat', { count: 1 });

      expect(mod.chainTipHash).toBe('new-tip-hash-after-append');
    });

    it('syncs sessionRecordCount after appending', () => {
      mockState.appendToChain.mockImplementation(() => {
        mockState.chainTipHash = 'hash-1';
        mockState.sessionRecordCount = 3;
        return {} as ChainRecord;
      });

      mod.appendToChain('session_end', { duration: 60_000 });

      expect(mod.sessionRecordCount).toBe(3);
    });

    it('correctly tracks multiple appends', () => {
      let recordCount = 0;
      mockState.appendToChain.mockImplementation(
        (type: string, _data: Record<string, unknown>) => {
          recordCount += 1;
          mockState.chainTipHash = `hash-${recordCount}`;
          mockState.sessionRecordCount = recordCount;
          return { type, hash: `hash-${recordCount}` } as unknown as ChainRecord;
        },
      );

      const r1 = mod.appendToChain('session_start', { taskType: 'coding' });
      const r2 = mod.appendToChain('heartbeat', { count: 1 });
      const r3 = mod.appendToChain('session_end', { duration: 5000 });

      expect(mod.chainTipHash).toBe('hash-3');
      expect(mod.sessionRecordCount).toBe(3);
      expect((r1 as unknown as { hash: string }).hash).toBe('hash-1');
      expect((r2 as unknown as { hash: string }).hash).toBe('hash-2');
      expect((r3 as unknown as { hash: string }).hash).toBe('hash-3');
    });

    it('does not affect unrelated module-level exports', () => {
      mockState.appendToChain.mockImplementation(() => {
        mockState.chainTipHash = 'updated-hash';
        mockState.sessionRecordCount = 1;
        return {} as ChainRecord;
      });

      mod.appendToChain('heartbeat', { count: 1 });

      expect(mod.clientName).toBe('initial-client');
      expect(mod.heartbeatCount).toBe(0);
      expect(mod.sessionTaskType).toBe('coding');
    });
  });

  describe('initializeKeystore', () => {
    it('delegates to state.initializeKeystore and syncs signing exports', () => {
      const fakeKey = { type: 'secret' } as unknown as import('node:crypto').KeyObject;
      mockState.initializeKeystore.mockImplementation(() => {
        mockState.signingKey = fakeKey;
        mockState.signingAvailable = true;
      });

      mod.initializeKeystore();

      expect(mockState.initializeKeystore).toHaveBeenCalledOnce();
      expect(mod.signingKey).toBe(fakeKey);
      expect(mod.signingAvailable).toBe(true);
    });

    it('handles keystore initialization failure (signingAvailable remains false)', () => {
      mockState.initializeKeystore.mockImplementation(() => {
        mockState.signingKey = null;
        mockState.signingAvailable = false;
      });

      mod.initializeKeystore();

      expect(mod.signingKey).toBeNull();
      expect(mod.signingAvailable).toBe(false);
    });

    it('does not affect unrelated module-level exports', () => {
      mockState.initializeKeystore.mockImplementation(() => {
        mockState.signingKey = null;
        mockState.signingAvailable = true;
      });

      mod.initializeKeystore();

      expect(mod.clientName).toBe('initial-client');
      expect(mod.heartbeatCount).toBe(0);
      expect(mod.chainTipHash).toBe('initial-hash');
    });
  });

  describe('cross-function interactions', () => {
    it('resetSession clears state set by setClient and setTaskType', () => {
      mockState.setClient.mockImplementation((name: string) => {
        mockState.clientName = name;
      });
      mockState.setTaskType.mockImplementation((type: string) => {
        mockState.sessionTaskType = type;
      });
      mockState.reset.mockImplementation(() => {
        mockState.sessionStartTime = 3000;
        mockState.sessionId = 'fresh-session';
        mockState.heartbeatCount = 0;
        mockState.sessionRecordCount = 0;
        mockState.clientName = '';
        mockState.sessionTaskType = '';
        mockState.chainTipHash = '';
        mockState.signingKey = null;
        mockState.signingAvailable = false;
      });

      mod.setClient('vscode');
      mod.setTaskType('testing');
      expect(mod.clientName).toBe('vscode');
      expect(mod.sessionTaskType).toBe('testing');

      mod.resetSession();

      expect(mod.clientName).toBe('');
      expect(mod.sessionTaskType).toBe('');
      expect(mod.sessionId).toBe('fresh-session');
      expect(mod.sessionStartTime).toBe(3000);
    });

    it('appendToChain after incrementHeartbeat preserves heartbeat count', () => {
      let hbCount = 0;
      mockState.incrementHeartbeat.mockImplementation(() => {
        hbCount += 1;
        mockState.heartbeatCount = hbCount;
      });
      mockState.appendToChain.mockImplementation(() => {
        mockState.chainTipHash = 'post-append-hash';
        mockState.sessionRecordCount = 1;
        return {} as ChainRecord;
      });

      mod.incrementHeartbeat();
      mod.incrementHeartbeat();
      mod.appendToChain('heartbeat', { count: 2 });

      expect(mod.heartbeatCount).toBe(2);
      expect(mod.chainTipHash).toBe('post-append-hash');
      expect(mod.sessionRecordCount).toBe(1);
    });
  });
});