import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { KeyObject } from 'node:crypto';

// ── Mock @useai/shared ──────────────────────────────────────────────
vi.mock('@useai/shared', () => {
  let sessionCounter = 0;
  return {
    ACTIVE_DIR: '/tmp/useai-test/active',
    KEYSTORE_FILE: '/tmp/useai-test/keystore.json',
    GENESIS_HASH: '0000000000000000000000000000000000000000000000000000000000000000',
    ensureDir: vi.fn(),
    readJson: vi.fn(),
    writeJson: vi.fn(),
    buildChainRecord: vi.fn(),
    decryptKeystore: vi.fn(),
    generateKeystore: vi.fn(),
    generateSessionId: vi.fn(() => `sess-test-${++sessionCounter}`),
  };
});

// ── Mock node:fs (only the specific functions used) ─────────────────
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

import { SessionState } from './session-state';
import {
  GENESIS_HASH,
  ensureDir,
  readJson,
  writeJson,
  buildChainRecord,
  decryptKeystore,
  generateKeystore,
  generateSessionId,
} from '@useai/shared';
import { existsSync, appendFileSync } from 'node:fs';

// ── Typed mocks ─────────────────────────────────────────────────────
const mockEnsureDir = ensureDir as ReturnType<typeof vi.fn>;
const mockReadJson = readJson as ReturnType<typeof vi.fn>;
const mockWriteJson = writeJson as ReturnType<typeof vi.fn>;
const mockBuildChainRecord = buildChainRecord as ReturnType<typeof vi.fn>;
const mockDecryptKeystore = decryptKeystore as ReturnType<typeof vi.fn>;
const mockGenerateKeystore = generateKeystore as ReturnType<typeof vi.fn>;
const mockGenerateSessionId = generateSessionId as ReturnType<typeof vi.fn>;
const mockExistsSync = existsSync as ReturnType<typeof vi.fn>;
const mockAppendFileSync = appendFileSync as ReturnType<typeof vi.fn>;

describe('SessionState', () => {
  let state: SessionState;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the counter for deterministic session IDs
    let counter = 0;
    mockGenerateSessionId.mockImplementation(() => `sess-test-${++counter}`);
    state = new SessionState();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('generates a unique session ID via generateSessionId()', () => {
      expect(mockGenerateSessionId).toHaveBeenCalled();
      expect(state.sessionId).toBe('sess-test-1');
    });

    it('sets sessionStartTime to approximately Date.now()', () => {
      const before = Date.now();
      const freshState = new SessionState();
      const after = Date.now();

      expect(freshState.sessionStartTime).toBeGreaterThanOrEqual(before);
      expect(freshState.sessionStartTime).toBeLessThanOrEqual(after);
    });

    it('initializes heartbeatCount to 0', () => {
      expect(state.heartbeatCount).toBe(0);
    });

    it('initializes sessionRecordCount to 0', () => {
      expect(state.sessionRecordCount).toBe(0);
    });

    it('defaults clientName to "unknown"', () => {
      expect(state.clientName).toBe('unknown');
    });

    it('defaults sessionTaskType to "coding"', () => {
      expect(state.sessionTaskType).toBe('coding');
    });

    it('sets chainTipHash to GENESIS_HASH', () => {
      expect(state.chainTipHash).toBe(GENESIS_HASH);
    });

    it('initializes signingKey as null', () => {
      expect(state.signingKey).toBeNull();
    });

    it('initializes signingAvailable as false', () => {
      expect(state.signingAvailable).toBe(false);
    });
  });

  describe('reset()', () => {
    it('generates a new session ID', () => {
      const originalId = state.sessionId;
      state.reset();
      expect(state.sessionId).not.toBe(originalId);
      // Constructor calls generateSessionId twice (sessionId + conversationId),
      // then reset() calls it once more for the new sessionId
      expect(mockGenerateSessionId).toHaveBeenCalledTimes(3);
    });

    it('refreshes sessionStartTime to current time', () => {
      state.sessionStartTime = Date.now() - 60_000;
      const before = Date.now();
      state.reset();
      const after = Date.now();

      expect(state.sessionStartTime).toBeGreaterThanOrEqual(before);
      expect(state.sessionStartTime).toBeLessThanOrEqual(after);
    });

    it('resets heartbeatCount to 0', () => {
      state.heartbeatCount = 15;
      state.reset();
      expect(state.heartbeatCount).toBe(0);
    });

    it('resets sessionRecordCount to 0', () => {
      state.sessionRecordCount = 42;
      state.reset();
      expect(state.sessionRecordCount).toBe(0);
    });

    it('resets chainTipHash to GENESIS_HASH', () => {
      state.chainTipHash = 'abc123deadbeef';
      state.reset();
      expect(state.chainTipHash).toBe(GENESIS_HASH);
    });

    it('preserves clientName across reset', () => {
      state.clientName = 'claude-code';
      state.reset();
      expect(state.clientName).toBe('claude-code');
    });

    it('resets sessionTaskType to "coding"', () => {
      state.sessionTaskType = 'debugging';
      state.reset();
      expect(state.sessionTaskType).toBe('coding');
    });

    it('does not reset signingKey or signingAvailable', () => {
      const fakeKey = { type: 'secret' } as unknown as KeyObject;
      state.signingKey = fakeKey;
      state.signingAvailable = true;
      state.reset();

      expect(state.signingKey).toBe(fakeKey);
      expect(state.signingAvailable).toBe(true);
    });
  });

  describe('setClient()', () => {
    it('updates clientName to the provided value', () => {
      state.setClient('cursor');
      expect(state.clientName).toBe('cursor');
    });

    it('allows updating clientName multiple times', () => {
      state.setClient('cursor');
      state.setClient('vscode');
      expect(state.clientName).toBe('vscode');
    });

    it('accepts an empty string as client name', () => {
      state.setClient('');
      expect(state.clientName).toBe('');
    });
  });

  describe('setTaskType()', () => {
    it('updates sessionTaskType to the provided value', () => {
      state.setTaskType('debugging');
      expect(state.sessionTaskType).toBe('debugging');
    });

    it('allows updating sessionTaskType multiple times', () => {
      state.setTaskType('debugging');
      state.setTaskType('testing');
      expect(state.sessionTaskType).toBe('testing');
    });

    it('accepts an empty string as task type', () => {
      state.setTaskType('');
      expect(state.sessionTaskType).toBe('');
    });
  });

  describe('incrementHeartbeat()', () => {
    it('increments heartbeatCount by 1', () => {
      expect(state.heartbeatCount).toBe(0);
      state.incrementHeartbeat();
      expect(state.heartbeatCount).toBe(1);
    });

    it('increments correctly when called multiple times', () => {
      state.incrementHeartbeat();
      state.incrementHeartbeat();
      state.incrementHeartbeat();
      expect(state.heartbeatCount).toBe(3);
    });

    it('increments from a non-zero starting value', () => {
      state.heartbeatCount = 100;
      state.incrementHeartbeat();
      expect(state.heartbeatCount).toBe(101);
    });
  });

  describe('getSessionDuration()', () => {
    it('returns 0 when called immediately after construction', () => {
      const duration = state.getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThanOrEqual(1);
    });

    it('returns duration in seconds rounded to the nearest integer', () => {
      state.sessionStartTime = Date.now() - 90_500;
      const duration = state.getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThanOrEqual(91);
    });

    it('computes correct duration for a 5-minute session', () => {
      state.sessionStartTime = Date.now() - 300_000;
      const duration = state.getSessionDuration();
      expect(duration).toBe(300);
    });

    it('uses Math.round for sub-second precision', () => {
      // 10.4 seconds ago → Math.round(10.4) = 10
      state.sessionStartTime = Date.now() - 10_400;
      expect(state.getSessionDuration()).toBe(10);

      // 10.6 seconds ago → Math.round(10.6) = 11
      state.sessionStartTime = Date.now() - 10_600;
      expect(state.getSessionDuration()).toBe(11);
    });

    it('returns 0 for a brand-new session after reset', () => {
      state.sessionStartTime = Date.now() - 60_000;
      state.reset();
      const duration = state.getSessionDuration();
      expect(duration).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThanOrEqual(1);
    });
  });

  describe('initializeKeystore()', () => {
    it('calls ensureDir() to guarantee the directory exists', () => {
      mockExistsSync.mockReturnValue(false);
      mockGenerateKeystore.mockReturnValue({
        keystore: { encrypted: 'data', iv: 'iv', salt: 'salt' },
        signingKey: { type: 'secret' } as unknown as KeyObject,
      });

      state.initializeKeystore();
      expect(mockEnsureDir).toHaveBeenCalled();
    });

    describe('when keystore file exists with valid data', () => {
      const fakeSigningKey = { type: 'secret' } as unknown as KeyObject;

      beforeEach(() => {
        mockExistsSync.mockReturnValue(true);
        mockReadJson.mockReturnValue({
          encrypted: 'valid-encrypted-data',
          iv: 'valid-iv',
          salt: 'valid-salt',
        });
        mockDecryptKeystore.mockReturnValue(fakeSigningKey);
      });

      it('reads and decrypts the existing keystore', () => {
        state.initializeKeystore();

        expect(mockReadJson).toHaveBeenCalledWith('/tmp/useai-test/keystore.json', null);
        expect(mockDecryptKeystore).toHaveBeenCalledWith({
          encrypted: 'valid-encrypted-data',
          iv: 'valid-iv',
          salt: 'valid-salt',
        });
      });

      it('sets signingKey to the decrypted key', () => {
        state.initializeKeystore();
        expect(state.signingKey).toBe(fakeSigningKey);
      });

      it('sets signingAvailable to true', () => {
        state.initializeKeystore();
        expect(state.signingAvailable).toBe(true);
      });

      it('does not generate a new keystore', () => {
        state.initializeKeystore();
        expect(mockGenerateKeystore).not.toHaveBeenCalled();
        expect(mockWriteJson).not.toHaveBeenCalled();
      });
    });

    describe('when keystore file exists but readJson returns null', () => {
      const newSigningKey = { type: 'secret-new' } as unknown as KeyObject;
      const newKeystore = { encrypted: 'new-data', iv: 'new-iv', salt: 'new-salt' };

      beforeEach(() => {
        mockExistsSync.mockReturnValue(true);
        mockReadJson.mockReturnValue(null);
        mockGenerateKeystore.mockReturnValue({
          keystore: newKeystore,
          signingKey: newSigningKey,
        });
      });

      it('generates a new keystore and writes it', () => {
        state.initializeKeystore();

        expect(mockGenerateKeystore).toHaveBeenCalled();
        expect(mockWriteJson).toHaveBeenCalledWith('/tmp/useai-test/keystore.json', newKeystore);
      });

      it('sets signingKey from the newly generated keystore', () => {
        state.initializeKeystore();
        expect(state.signingKey).toBe(newSigningKey);
      });

      it('sets signingAvailable to true', () => {
        state.initializeKeystore();
        expect(state.signingAvailable).toBe(true);
      });
    });

    describe('when keystore file exists but decryption throws (corrupted)', () => {
      const regeneratedKey = { type: 'regenerated' } as unknown as KeyObject;
      const regeneratedKeystore = { encrypted: 'regen', iv: 'regen-iv', salt: 'regen-salt' };

      beforeEach(() => {
        mockExistsSync.mockReturnValue(true);
        mockReadJson.mockReturnValue({
          encrypted: 'corrupted-data',
          iv: 'bad-iv',
          salt: 'bad-salt',
        });
        mockDecryptKeystore.mockImplementation(() => {
          throw new Error('Decryption failed: invalid key');
        });
        mockGenerateKeystore.mockReturnValue({
          keystore: regeneratedKeystore,
          signingKey: regeneratedKey,
        });
      });

      it('catches the decryption error and regenerates a new keystore', () => {
        state.initializeKeystore();

        expect(mockDecryptKeystore).toHaveBeenCalled();
        expect(mockGenerateKeystore).toHaveBeenCalled();
        expect(mockWriteJson).toHaveBeenCalledWith(
          '/tmp/useai-test/keystore.json',
          regeneratedKeystore,
        );
      });

      it('sets signingKey from the regenerated keystore', () => {
        state.initializeKeystore();
        expect(state.signingKey).toBe(regeneratedKey);
      });

      it('sets signingAvailable to true despite corruption', () => {
        state.initializeKeystore();
        expect(state.signingAvailable).toBe(true);
      });
    });

    describe('when keystore file does not exist', () => {
      const freshKey = { type: 'fresh' } as unknown as KeyObject;
      const freshKeystore = { encrypted: 'fresh-data', iv: 'fresh-iv', salt: 'fresh-salt' };

      beforeEach(() => {
        mockExistsSync.mockReturnValue(false);
        mockGenerateKeystore.mockReturnValue({
          keystore: freshKeystore,
          signingKey: freshKey,
        });
      });

      it('does not attempt to read or decrypt', () => {
        state.initializeKeystore();

        expect(mockReadJson).not.toHaveBeenCalled();
        expect(mockDecryptKeystore).not.toHaveBeenCalled();
      });

      it('generates a new keystore and persists it', () => {
        state.initializeKeystore();

        expect(mockGenerateKeystore).toHaveBeenCalled();
        expect(mockWriteJson).toHaveBeenCalledWith('/tmp/useai-test/keystore.json', freshKeystore);
      });

      it('sets signingKey and signingAvailable', () => {
        state.initializeKeystore();

        expect(state.signingKey).toBe(freshKey);
        expect(state.signingAvailable).toBe(true);
      });
    });
  });

  describe('appendToChain()', () => {
    const fakeSigningKey = { type: 'secret' } as unknown as KeyObject;

    beforeEach(() => {
      state.signingKey = fakeSigningKey;
    });

    it('calls buildChainRecord with the correct arguments', () => {
      const fakeRecord = {
        type: 'session_start',
        sessionId: state.sessionId,
        hash: 'abc123hash',
        prevHash: GENESIS_HASH,
        data: { task_type: 'coding' },
      };
      mockBuildChainRecord.mockReturnValue(fakeRecord);

      state.appendToChain('session_start', { task_type: 'coding' });

      expect(mockBuildChainRecord).toHaveBeenCalledWith(
        'session_start',
        state.sessionId,
        { task_type: 'coding' },
        GENESIS_HASH,
        fakeSigningKey,
      );
    });

    it('calls ensureDir() before writing', () => {
      mockBuildChainRecord.mockReturnValue({
        type: 'heartbeat',
        hash: 'heartbeat-hash',
      });

      state.appendToChain('heartbeat', { count: 1 });

      expect(mockEnsureDir).toHaveBeenCalled();
    });

    it('appends the JSON record as a newline-delimited entry', () => {
      const record = {
        type: 'session_start',
        sessionId: 'sess-test-1',
        hash: 'record-hash-1',
        data: { task_type: 'coding' },
      };
      mockBuildChainRecord.mockReturnValue(record);

      state.appendToChain('session_start', { task_type: 'coding' });

      expect(mockAppendFileSync).toHaveBeenCalledWith(
        `/tmp/useai-test/active/${state.sessionId}.jsonl`,
        JSON.stringify(record) + '\n',
        'utf-8',
      );
    });

    it('updates chainTipHash to the new record hash', () => {
      expect(state.chainTipHash).toBe(GENESIS_HASH);

      mockBuildChainRecord.mockReturnValue({ hash: 'first-record-hash' });
      state.appendToChain('session_start', { task_type: 'coding' });

      expect(state.chainTipHash).toBe('first-record-hash');
    });

    it('increments sessionRecordCount', () => {
      expect(state.sessionRecordCount).toBe(0);

      mockBuildChainRecord.mockReturnValue({ hash: 'hash-1' });
      state.appendToChain('session_start', {});

      expect(state.sessionRecordCount).toBe(1);
    });

    it('returns the chain record', () => {
      const expectedRecord = {
        type: 'session_start',
        hash: 'returned-hash',
        sessionId: 'sess-test-1',
      };
      mockBuildChainRecord.mockReturnValue(expectedRecord);

      const result = state.appendToChain('session_start', {});
      expect(result).toBe(expectedRecord);
    });

    it('chains multiple records by passing the previous hash', () => {
      mockBuildChainRecord.mockReturnValueOnce({ hash: 'hash-record-1' });
      state.appendToChain('session_start', { task_type: 'coding' });

      mockBuildChainRecord.mockReturnValueOnce({ hash: 'hash-record-2' });
      state.appendToChain('heartbeat', { count: 1 });

      expect(mockBuildChainRecord).toHaveBeenNthCalledWith(
        1,
        'session_start',
        state.sessionId,
        { task_type: 'coding' },
        GENESIS_HASH,
        fakeSigningKey,
      );
      expect(mockBuildChainRecord).toHaveBeenNthCalledWith(
        2,
        'heartbeat',
        state.sessionId,
        { count: 1 },
        'hash-record-1',
        fakeSigningKey,
      );
    });

    it('increments sessionRecordCount for each appended record', () => {
      mockBuildChainRecord
        .mockReturnValueOnce({ hash: 'h1' })
        .mockReturnValueOnce({ hash: 'h2' })
        .mockReturnValueOnce({ hash: 'h3' });

      state.appendToChain('session_start', {});
      state.appendToChain('heartbeat', {});
      state.appendToChain('session_end', {});

      expect(state.sessionRecordCount).toBe(3);
    });

    it('writes to the correct session-specific chain file path', () => {
      mockBuildChainRecord.mockReturnValue({ hash: 'some-hash' });

      state.appendToChain('session_start', {});

      const expectedPath = `/tmp/useai-test/active/sess-test-1.jsonl`;
      expect(mockAppendFileSync).toHaveBeenCalledWith(
        expectedPath,
        expect.any(String),
        'utf-8',
      );
    });
  });
});