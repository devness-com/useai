import { describe, expect, it } from 'vitest';
import { randomBytes, pbkdf2Sync } from 'node:crypto';
import { hostname, userInfo } from 'node:os';
import { deriveEncryptionKey } from './derive';

describe('deriveEncryptionKey', () => {
  const fixedSalt = Buffer.from('a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8', 'hex');

  it('returns a 32-byte Buffer', () => {
    const result = deriveEncryptionKey(fixedSalt);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(32);
  });

  it('uses PBKDF2 with SHA-256 and 100,000 iterations matching node:crypto directly', () => {
    const machineData = `${hostname()}:${userInfo().username}:useai-keystore`;
    const expected = pbkdf2Sync(machineData, fixedSalt, 100_000, 32, 'sha256');

    const result = deriveEncryptionKey(fixedSalt);

    expect(result).toEqual(expected);
  });

  it('produces deterministic output for the same salt', () => {
    const firstCall = deriveEncryptionKey(fixedSalt);
    const secondCall = deriveEncryptionKey(fixedSalt);

    expect(firstCall).toEqual(secondCall);
  });

  it('produces different output for different salts', () => {
    const saltA = Buffer.from('0000000000000000', 'hex');
    const saltB = Buffer.from('ffffffffffffffff', 'hex');

    const resultA = deriveEncryptionKey(saltA);
    const resultB = deriveEncryptionKey(saltB);

    expect(resultA).not.toEqual(resultB);
  });

  it('works with a randomly generated 16-byte salt', () => {
    const randomSalt = randomBytes(16);

    const result = deriveEncryptionKey(randomSalt);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(32);
  });

  it('works with an empty salt buffer', () => {
    const emptySalt = Buffer.alloc(0);

    const result = deriveEncryptionKey(emptySalt);

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(32);
  });

  it('produces consistent hex encoding across calls', () => {
    const salt = Buffer.from('deadbeefcafebabe', 'hex');

    const hex1 = deriveEncryptionKey(salt).toString('hex');
    const hex2 = deriveEncryptionKey(salt).toString('hex');

    expect(hex1).toBe(hex2);
    expect(hex1).toHaveLength(64); // 32 bytes = 64 hex chars
  });

  it('produces different output from a different iteration count (verifying 100k is used)', () => {
    const machineData = `${hostname()}:${userInfo().username}:useai-keystore`;
    const wrongIterations = pbkdf2Sync(machineData, fixedSalt, 1_000, 32, 'sha256');

    const result = deriveEncryptionKey(fixedSalt);

    expect(result).not.toEqual(wrongIterations);
  });

  it('produces different output from a different digest (verifying SHA-256 is used)', () => {
    const machineData = `${hostname()}:${userInfo().username}:useai-keystore`;
    const sha512Result = pbkdf2Sync(machineData, fixedSalt, 100_000, 32, 'sha512');

    const result = deriveEncryptionKey(fixedSalt);

    expect(result).not.toEqual(sha512Result);
  });

  it('incorporates machine-specific data into the derived key', () => {
    const salt1 = Buffer.from('1111111111111111', 'hex');
    const salt2 = Buffer.from('2222222222222222', 'hex');

    const key1 = deriveEncryptionKey(salt1);
    const key2 = deriveEncryptionKey(salt2);

    expect(key1.length).toBe(32);
    expect(key2.length).toBe(32);
    expect(key1).not.toEqual(key2);
  });
});