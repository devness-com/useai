import { describe, it, expect } from 'vitest';
import { createHash, generateKeyPairSync, type KeyObject } from 'node:crypto';
import { computeHash, signHash, buildChainRecord } from './chain.js';

function makeEd25519Key(): { publicKey: KeyObject; privateKey: KeyObject } {
  return generateKeyPairSync('ed25519');
}

describe('computeHash', () => {
  it('returns the SHA-256 hex digest of recordJson + prevHash', () => {
    const recordJson = '{"id":"r_abc","type":"heartbeat"}';
    const prevHash = '0000000000000000000000000000000000000000000000000000000000000000';

    const result = computeHash(recordJson, prevHash);

    const expected = createHash('sha256')
      .update(recordJson + prevHash)
      .digest('hex');
    expect(result).toBe(expected);
  });

  it('produces deterministic output for identical inputs', () => {
    const recordJson = '{"session_id":"sess-123","data":{"files":5}}';
    const prevHash = 'abcdef1234567890';

    const hash1 = computeHash(recordJson, prevHash);
    const hash2 = computeHash(recordJson, prevHash);

    expect(hash1).toBe(hash2);
  });

  it('produces different hashes when recordJson differs', () => {
    const prevHash = '0'.repeat(64);
    const hash1 = computeHash('{"type":"heartbeat"}', prevHash);
    const hash2 = computeHash('{"type":"session_end"}', prevHash);

    expect(hash1).not.toBe(hash2);
  });

  it('produces different hashes when prevHash differs', () => {
    const recordJson = '{"id":"r_abc"}';
    const hash1 = computeHash(recordJson, 'a'.repeat(64));
    const hash2 = computeHash(recordJson, 'b'.repeat(64));

    expect(hash1).not.toBe(hash2);
  });

  it('returns a 64-character hex string', () => {
    const result = computeHash('{"data":{}}', 'prev');

    expect(result).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles empty strings for both arguments', () => {
    const result = computeHash('', '');

    const expected = createHash('sha256').update('').digest('hex');
    expect(result).toBe(expected);
  });
});

describe('signHash', () => {
  it('returns "unsigned" when signingKey is null', () => {
    const hash = 'a'.repeat(64);

    const result = signHash(hash, null);

    expect(result).toBe('unsigned');
  });

  it('returns a valid hex signature when given an ed25519 private key', () => {
    const { privateKey } = makeEd25519Key();
    const hash = computeHash('{"type":"heartbeat"}', '0'.repeat(64));

    const result = signHash(hash, privateKey);

    expect(result).not.toBe('unsigned');
    expect(result).toMatch(/^[0-9a-f]+$/);
    // Ed25519 signatures are 64 bytes = 128 hex chars
    expect(result).toHaveLength(128);
  });

  it('produces deterministic signatures for the same key and hash', () => {
    const { privateKey } = makeEd25519Key();
    const hash = computeHash('{"session":"sess-001"}', 'abc');

    const sig1 = signHash(hash, privateKey);
    const sig2 = signHash(hash, privateKey);

    expect(sig1).toBe(sig2);
  });

  it('produces different signatures for different hashes with the same key', () => {
    const { privateKey } = makeEd25519Key();
    const hash1 = computeHash('record-a', 'prev-a');
    const hash2 = computeHash('record-b', 'prev-b');

    const sig1 = signHash(hash1, privateKey);
    const sig2 = signHash(hash2, privateKey);

    expect(sig1).not.toBe(sig2);
  });

  it('produces different signatures for different keys with the same hash', () => {
    const key1 = makeEd25519Key();
    const key2 = makeEd25519Key();
    const hash = computeHash('{"same":"data"}', 'same-prev');

    const sig1 = signHash(hash, key1.privateKey);
    const sig2 = signHash(hash, key2.privateKey);

    expect(sig1).not.toBe(sig2);
  });

  it('returns "unsigned" when the key cannot sign (e.g. public key)', () => {
    const { publicKey } = makeEd25519Key();
    const hash = 'a'.repeat(64);

    const result = signHash(hash, publicKey);

    expect(result).toBe('unsigned');
  });
});

describe('buildChainRecord', () => {
  const sessionId = 'sess-integration-test-001';
  const prevHash = '0'.repeat(64);
  const sampleData = { files_touched: 3, language: 'typescript' };

  it('returns a record with all required ChainRecord fields', () => {
    const record = buildChainRecord('heartbeat', sessionId, sampleData, prevHash, null);

    expect(record).toEqual(
      expect.objectContaining({
        id: expect.stringMatching(/^r_[a-f0-9]{8}-[a-f0-9]{3}$/),
        type: 'heartbeat',
        session_id: sessionId,
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        data: sampleData,
        prev_hash: prevHash,
        hash: expect.stringMatching(/^[0-9a-f]{64}$/),
        signature: 'unsigned',
      }),
    );
  });

  it('generates unique IDs for successive calls', () => {
    const record1 = buildChainRecord('heartbeat', sessionId, {}, prevHash, null);
    const record2 = buildChainRecord('heartbeat', sessionId, {}, prevHash, null);

    expect(record1.id).not.toBe(record2.id);
  });

  it('sets the correct type on the record', () => {
    const types = ['session_start', 'heartbeat', 'session_end', 'session_seal', 'milestone'] as const;

    for (const type of types) {
      const record = buildChainRecord(type, sessionId, {}, prevHash, null);
      expect(record.type).toBe(type);
    }
  });

  it('stores the session_id passed in', () => {
    const record = buildChainRecord('session_start', 'sess-my-session-42', {}, prevHash, null);

    expect(record.session_id).toBe('sess-my-session-42');
  });

  it('stores the data payload unchanged', () => {
    const data = { editor: 'vscode', files: ['main.ts', 'utils.ts'], count: 7 };
    const record = buildChainRecord('milestone', sessionId, data, prevHash, null);

    expect(record.data).toEqual(data);
  });

  it('sets prev_hash to the value passed in', () => {
    const customPrev = 'cafebabe'.repeat(8);
    const record = buildChainRecord('heartbeat', sessionId, {}, customPrev, null);

    expect(record.prev_hash).toBe(customPrev);
  });

  it('computes a hash that matches computeHash of the record core + prevHash', () => {
    const record = buildChainRecord('heartbeat', sessionId, sampleData, prevHash, null);

    const recordCore = JSON.stringify({
      id: record.id,
      type: record.type,
      session_id: record.session_id,
      timestamp: record.timestamp,
      data: record.data,
    });
    const expectedHash = computeHash(recordCore, prevHash);

    expect(record.hash).toBe(expectedHash);
  });

  it('produces "unsigned" signature when signingKey is null', () => {
    const record = buildChainRecord('session_start', sessionId, {}, prevHash, null);

    expect(record.signature).toBe('unsigned');
  });

  it('produces a valid cryptographic signature when given an ed25519 key', () => {
    const { privateKey } = makeEd25519Key();
    const record = buildChainRecord('session_end', sessionId, sampleData, prevHash, privateKey);

    expect(record.signature).not.toBe('unsigned');
    expect(record.signature).toMatch(/^[0-9a-f]+$/);
    expect(record.signature).toHaveLength(128);
  });

  it('chains records correctly: each record uses the previous hash as prev_hash', () => {
    const genesisHash = '0'.repeat(64);

    const record1 = buildChainRecord('session_start', sessionId, { step: 1 }, genesisHash, null);
    const record2 = buildChainRecord('heartbeat', sessionId, { step: 2 }, record1.hash, null);
    const record3 = buildChainRecord('session_end', sessionId, { step: 3 }, record2.hash, null);

    expect(record1.prev_hash).toBe(genesisHash);
    expect(record2.prev_hash).toBe(record1.hash);
    expect(record3.prev_hash).toBe(record2.hash);

    // Each hash should be distinct
    const hashes = [record1.hash, record2.hash, record3.hash];
    expect(new Set(hashes).size).toBe(3);
  });

  it('produces verifiable hashes in a chain of records', () => {
    const genesisHash = '0'.repeat(64);

    const record1 = buildChainRecord('session_start', sessionId, { action: 'init' }, genesisHash, null);
    const record2 = buildChainRecord('heartbeat', sessionId, { action: 'work' }, record1.hash, null);

    // Verify record2's hash can be recomputed from its core data and record1's hash
    const record2Core = JSON.stringify({
      id: record2.id,
      type: record2.type,
      session_id: record2.session_id,
      timestamp: record2.timestamp,
      data: record2.data,
    });
    const recomputedHash = computeHash(record2Core, record1.hash);

    expect(record2.hash).toBe(recomputedHash);
  });

  it('produces different hashes for records with different data even at same chain position', () => {
    const record1 = buildChainRecord('heartbeat', sessionId, { value: 'alpha' }, prevHash, null);
    const record2 = buildChainRecord('heartbeat', sessionId, { value: 'beta' }, prevHash, null);

    // Different IDs and timestamps mean different hashes
    expect(record1.hash).not.toBe(record2.hash);
  });

  it('generates an ISO 8601 timestamp', () => {
    const record = buildChainRecord('heartbeat', sessionId, {}, prevHash, null);

    // Validate ISO 8601 format
    const parsed = new Date(record.timestamp);
    expect(parsed.toISOString()).toBe(record.timestamp);
  });
});