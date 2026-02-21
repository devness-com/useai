import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import type { ChainRecord } from '../types/chain.js';
import { verifyChain, verifyChainRecord, verifySignature } from './verify.js';

// --- Helpers ---

function makeRecordCore(record: {
  id: string;
  type: string;
  session_id: string;
  timestamp: string;
  data: unknown;
}): string {
  return JSON.stringify({
    id: record.id,
    type: record.type,
    session_id: record.session_id,
    timestamp: record.timestamp,
    data: record.data,
  });
}

function computeHash(recordCore: string, prevHash: string): string {
  return createHash('sha256')
    .update(recordCore + prevHash)
    .digest('hex');
}

const { publicKey: pubKeyObj, privateKey: privKeyObj } = generateKeyPairSync('ed25519');
const publicKeyPem = pubKeyObj.export({ type: 'spki', format: 'pem' }) as string;
const privateKeyPem = privKeyObj.export({ type: 'pkcs8', format: 'pem' }) as string;

function signHash(hash: string): string {
  const privKey = createPrivateKey(privateKeyPem);
  return sign(null, Buffer.from(hash), privKey).toString('hex');
}

function buildChainRecord(
  overrides: Partial<ChainRecord> & { prevHash?: string } = {},
): ChainRecord & { prevHash: string } {
  const prevHash = overrides.prevHash ?? 'GENESIS';
  const base = {
    id: overrides.id ?? 'rec-001',
    type: overrides.type ?? 'task',
    session_id: overrides.session_id ?? 'sess-abc',
    timestamp: overrides.timestamp ?? '2026-01-15T10:00:00Z',
    data: overrides.data ?? { title: 'Implement auth module' },
  };
  const core = makeRecordCore(base);
  const hash = overrides.hash ?? computeHash(core, prevHash);
  const signature = overrides.signature ?? signHash(hash);
  return { ...base, hash, signature, prevHash } as ChainRecord & { prevHash: string };
}

function buildChain(length: number, signed = true): ChainRecord[] {
  const records: ChainRecord[] = [];
  let prevHash = 'GENESIS';
  for (let i = 0; i < length; i++) {
    const rec = buildChainRecord({
      id: `rec-${String(i + 1).padStart(3, '0')}`,
      timestamp: `2026-01-15T10:${String(i).padStart(2, '0')}:00Z`,
      data: { step: i + 1, description: `Step ${i + 1} of the process` },
      signature: signed ? undefined : 'unsigned',
      prevHash,
    });
    prevHash = rec.hash;
    records.push(rec);
  }
  return records;
}

// --- Tests ---

describe('verifyChainRecord', () => {
  it('returns true for a correctly hashed record with GENESIS as prevHash', () => {
    const record = buildChainRecord({ prevHash: 'GENESIS' });
    expect(verifyChainRecord(record, 'GENESIS')).toBe(true);
  });

  it('returns true when prevHash is an arbitrary previous hash', () => {
    const firstRecord = buildChainRecord({ prevHash: 'GENESIS' });
    const secondRecord = buildChainRecord({
      id: 'rec-002',
      timestamp: '2026-01-15T10:01:00Z',
      data: { title: 'Second record' },
      prevHash: firstRecord.hash,
    });
    expect(verifyChainRecord(secondRecord, firstRecord.hash)).toBe(true);
  });

  it('returns false when the record hash has been tampered with', () => {
    const record = buildChainRecord();
    const tampered = { ...record, hash: 'deadbeef'.repeat(8) };
    expect(verifyChainRecord(tampered, 'GENESIS')).toBe(false);
  });

  it('returns false when the record data has been tampered with', () => {
    const record = buildChainRecord();
    const tampered = { ...record, data: { title: 'Tampered data!' } };
    expect(verifyChainRecord(tampered, 'GENESIS')).toBe(false);
  });

  it('returns false when prevHash does not match the one used for hashing', () => {
    const record = buildChainRecord({ prevHash: 'GENESIS' });
    expect(verifyChainRecord(record, 'WRONG_PREV_HASH')).toBe(false);
  });

  it('returns false when the id field has been altered', () => {
    const record = buildChainRecord();
    const tampered = { ...record, id: 'rec-tampered' };
    expect(verifyChainRecord(tampered, 'GENESIS')).toBe(false);
  });

  it('returns false when the timestamp has been altered', () => {
    const record = buildChainRecord();
    const tampered = { ...record, timestamp: '2099-12-31T23:59:59Z' };
    expect(verifyChainRecord(tampered, 'GENESIS')).toBe(false);
  });

  it('returns false when the type has been altered', () => {
    const record = buildChainRecord();
    const tampered = { ...record, type: 'corrupted' };
    expect(verifyChainRecord(tampered, 'GENESIS')).toBe(false);
  });

  it('returns false when the session_id has been altered', () => {
    const record = buildChainRecord();
    const tampered = { ...record, session_id: 'sess-evil' };
    expect(verifyChainRecord(tampered, 'GENESIS')).toBe(false);
  });

  it('handles records with complex nested data objects', () => {
    const complexData = {
      items: [1, 2, 3],
      nested: { deep: { value: 'test' } },
      tags: ['security', 'crypto'],
    };
    const record = buildChainRecord({ data: complexData });
    expect(verifyChainRecord(record, 'GENESIS')).toBe(true);
  });

  it('handles records with null data', () => {
    const record = buildChainRecord({ data: null });
    expect(verifyChainRecord(record, 'GENESIS')).toBe(true);
  });

  it('handles records with empty string data', () => {
    const record = buildChainRecord({ data: '' });
    expect(verifyChainRecord(record, 'GENESIS')).toBe(true);
  });
});

describe('verifySignature', () => {
  it('returns true for a valid signature matching the hash', () => {
    const hash = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';
    const signature = signHash(hash);
    expect(verifySignature(hash, signature, publicKeyPem)).toBe(true);
  });

  it('returns false when the signature is the literal string "unsigned"', () => {
    const hash = 'a1b2c3d4e5f6';
    expect(verifySignature(hash, 'unsigned', publicKeyPem)).toBe(false);
  });

  it('returns false when the signature does not match the hash', () => {
    const hash = 'original_hash_value';
    const differentHash = 'different_hash_value';
    const signature = signHash(differentHash);
    expect(verifySignature(hash, signature, publicKeyPem)).toBe(false);
  });

  it('returns false when given an invalid public key PEM', () => {
    const hash = 'some_hash';
    const signature = signHash(hash);
    expect(verifySignature(hash, signature, 'not-a-valid-pem')).toBe(false);
  });

  it('returns false when the signature is malformed hex', () => {
    const hash = 'some_hash';
    expect(verifySignature(hash, 'zzzz-not-hex', publicKeyPem)).toBe(false);
  });

  it('returns false when the public key belongs to a different keypair', () => {
    const otherKeypair = generateKeyPairSync('ed25519');
    const otherPubPem = otherKeypair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
    const hash = 'cross_key_test_hash';
    const signature = signHash(hash); // signed with the original private key
    expect(verifySignature(hash, signature, otherPubPem)).toBe(false);
  });

  it('returns true for a record hash signed and verified end-to-end', () => {
    const record = buildChainRecord();
    const signature = signHash(record.hash);
    expect(verifySignature(record.hash, signature, publicKeyPem)).toBe(true);
  });

  it('returns false for an empty string signature', () => {
    const hash = 'some_hash';
    expect(verifySignature(hash, '', publicKeyPem)).toBe(false);
  });
});

describe('verifyChain', () => {
  describe('with an intact chain', () => {
    it('returns valid=true for a single-record chain without signature verification', () => {
      const chain = buildChain(1, false);
      const result = verifyChain(chain);
      expect(result).toEqual({ valid: true, signatureValid: false });
    });

    it('returns valid=true and signatureValid=true for a signed single-record chain', () => {
      const chain = buildChain(1, true);
      const result = verifyChain(chain, publicKeyPem);
      expect(result).toEqual({ valid: true, signatureValid: true });
    });

    it('returns valid=true for a multi-record chain without signature verification', () => {
      const chain = buildChain(5, false);
      const result = verifyChain(chain);
      expect(result).toEqual({ valid: true, signatureValid: false });
    });

    it('returns valid=true and signatureValid=true for a fully signed multi-record chain', () => {
      const chain = buildChain(5, true);
      const result = verifyChain(chain, publicKeyPem);
      expect(result).toEqual({ valid: true, signatureValid: true });
    });

    it('returns valid=true and signatureValid=false for an empty chain without a public key', () => {
      const result = verifyChain([]);
      expect(result).toEqual({ valid: true, signatureValid: false });
    });

    it('returns valid=true and signatureValid=true for an empty chain with a public key', () => {
      const result = verifyChain([], publicKeyPem);
      expect(result).toEqual({ valid: true, signatureValid: true });
    });
  });

  describe('with a broken hash chain', () => {
    it('reports brokenAt index 0 when the first record hash is corrupted', () => {
      const chain = buildChain(3);
      chain[0] = { ...chain[0]!, hash: 'corrupted_hash_value' };
      const result = verifyChain(chain);
      expect(result).toEqual({ valid: false, signatureValid: false, brokenAt: 0 });
    });

    it('reports brokenAt the correct index when a middle record is tampered', () => {
      const chain = buildChain(5);
      chain[2] = { ...chain[2]!, data: { tampered: true } };
      const result = verifyChain(chain);
      expect(result).toEqual({ valid: false, signatureValid: false, brokenAt: 2 });
    });

    it('reports brokenAt the last index when the final record is tampered', () => {
      const chain = buildChain(4);
      chain[3] = { ...chain[3]!, hash: 'bad_hash' };
      const result = verifyChain(chain);
      expect(result).toEqual({ valid: false, signatureValid: false, brokenAt: 3 });
    });

    it('detects a broken link when prevHash continuity is disrupted', () => {
      const chainA = buildChain(2);
      const chainB = buildChain(2);
      const spliced = [...chainA, chainB[0]!];
      const result = verifyChain(spliced);
      expect(result.valid).toBe(false);
      expect(result.brokenAt).toBe(2);
    });
  });

  describe('with signature verification', () => {
    it('returns signatureValid=false with brokenAt when a record is unsigned', () => {
      const chain = buildChain(3, true);
      chain[1] = { ...chain[1]!, signature: 'unsigned' };
      const result = verifyChain(chain, publicKeyPem);
      expect(result).toEqual({ valid: true, signatureValid: false, brokenAt: 1 });
    });

    it('returns signatureValid=false when a signature is corrupted', () => {
      const chain = buildChain(3, true);
      chain[2] = { ...chain[2]!, signature: 'ff'.repeat(32) };
      const result = verifyChain(chain, publicKeyPem);
      expect(result).toEqual({ valid: true, signatureValid: false, brokenAt: 2 });
    });

    it('returns signatureValid=false when using a wrong public key', () => {
      const chain = buildChain(3, true);
      const otherKeypair = generateKeyPairSync('ed25519');
      const wrongPubPem = otherKeypair.publicKey.export({ type: 'spki', format: 'pem' }) as string;
      const result = verifyChain(chain, wrongPubPem);
      expect(result).toEqual({ valid: true, signatureValid: false, brokenAt: 0 });
    });

    it('does not check signatures when no publicKeyPem is provided', () => {
      const chain = buildChain(3, true);
      const result = verifyChain(chain);
      expect(result).toEqual({ valid: true, signatureValid: false });
      expect(result.brokenAt).toBeUndefined();
    });

    it('reports hash failure before signature failure when both are broken', () => {
      const chain = buildChain(3, true);
      chain[1] = { ...chain[1]!, hash: 'broken_hash', signature: 'broken_sig' };
      const result = verifyChain(chain, publicKeyPem);
      expect(result).toEqual({ valid: false, signatureValid: false, brokenAt: 1 });
    });
  });
});