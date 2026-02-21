import { describe, it, expect } from 'vitest';
import { sign, verify, KeyObject } from 'node:crypto';
import { generateKeystore, decryptKeystore } from './keystore.js';
import { deriveEncryptionKey } from './derive.js';

describe('generateKeystore', () => {
  it('returns a keystore with all required fields populated', () => {
    const { keystore } = generateKeystore();

    expect(keystore.public_key_pem).toMatch(/^-----BEGIN PUBLIC KEY-----/);
    expect(keystore.public_key_pem).toMatch(/-----END PUBLIC KEY-----\n?$/);
    expect(keystore.encrypted_private_key).toMatch(/^[0-9a-f]+$/);
    expect(keystore.encrypted_private_key.length).toBeGreaterThan(0);
    expect(keystore.iv).toMatch(/^[0-9a-f]{24}$/); // 12 bytes = 24 hex chars
    expect(keystore.tag).toMatch(/^[0-9a-f]{32}$/); // 16 bytes = 32 hex chars
    expect(keystore.salt).toMatch(/^[0-9a-f]{64}$/); // 32 bytes = 64 hex chars
    expect(keystore.created_at).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO 8601 timestamp
  });

  it('returns a valid ed25519 signing key', () => {
    const { signingKey } = generateKeystore();

    expect(signingKey).toBeInstanceOf(KeyObject);
    expect(signingKey.type).toBe('private');
    expect(signingKey.asymmetricKeyType).toBe('ed25519');
  });

  it('produces a signing key that can sign and verify data using the public key PEM', () => {
    const { keystore, signingKey } = generateKeystore();

    const message = Buffer.from('test message for ed25519 signature verification');
    const signature = sign(null, message, signingKey);

    const verified = verify(null, message, keystore.public_key_pem, signature);

    expect(verified).toBe(true);
  });

  it('generates unique keystores on each invocation', () => {
    const first = generateKeystore();
    const second = generateKeystore();

    expect(first.keystore.salt).not.toBe(second.keystore.salt);
    expect(first.keystore.iv).not.toBe(second.keystore.iv);
    expect(first.keystore.encrypted_private_key).not.toBe(second.keystore.encrypted_private_key);
    expect(first.keystore.public_key_pem).not.toBe(second.keystore.public_key_pem);
  });
});

describe('decryptKeystore', () => {
  it('round-trips correctly: encrypting then decrypting recovers the original signing key', () => {
    const { keystore, signingKey } = generateKeystore();

    const recovered = decryptKeystore(keystore);

    const originalPem = signingKey.export({ type: 'pkcs8', format: 'pem' });
    const recoveredPem = recovered.export({ type: 'pkcs8', format: 'pem' });

    expect(recoveredPem).toBe(originalPem);
  });

  it('recovered key produces identical signatures as the original key', () => {
    const { keystore, signingKey } = generateKeystore();
    const recovered = decryptKeystore(keystore);

    const message = Buffer.from('cryptographic round-trip integrity check');

    const originalSig = sign(null, message, signingKey);
    const recoveredSig = sign(null, message, recovered);

    // ed25519 signatures are deterministic, so identical keys yield identical signatures
    expect(recoveredSig).toEqual(originalSig);
  });

  it('throws when the encrypted data has been tampered with', () => {
    const { keystore } = generateKeystore();

    const tamperedKeystore = {
      ...keystore,
      encrypted_private_key: 'ff' + keystore.encrypted_private_key.slice(2),
    };

    expect(() => decryptKeystore(tamperedKeystore)).toThrow();
  });

  it('throws when the auth tag is corrupted', () => {
    const { keystore } = generateKeystore();

    const corruptedTag = 'a'.repeat(32);
    const tamperedKeystore = { ...keystore, tag: corruptedTag };

    expect(() => decryptKeystore(tamperedKeystore)).toThrow();
  });

  it('throws when the IV is corrupted', () => {
    const { keystore } = generateKeystore();

    const corruptedIv = 'b'.repeat(24);
    const tamperedKeystore = { ...keystore, iv: corruptedIv };

    expect(() => decryptKeystore(tamperedKeystore)).toThrow();
  });

  it('throws when the salt is corrupted (derives wrong encryption key)', () => {
    const { keystore } = generateKeystore();

    const wrongSalt = 'c'.repeat(64);
    const tamperedKeystore = { ...keystore, salt: wrongSalt };

    expect(() => decryptKeystore(tamperedKeystore)).toThrow();
  });
});

describe('deriveEncryptionKey', () => {
  it('returns a 32-byte buffer', () => {
    const salt = Buffer.from('a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2', 'hex');
    const key = deriveEncryptionKey(salt);

    expect(Buffer.isBuffer(key)).toBe(true);
    expect(key.length).toBe(32);
  });

  it('returns consistent output for the same salt', () => {
    const salt = Buffer.from('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'hex');

    const key1 = deriveEncryptionKey(salt);
    const key2 = deriveEncryptionKey(salt);

    expect(key1).toEqual(key2);
  });

  it('returns different keys for different salts', () => {
    const salt1 = Buffer.from('aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'hex');
    const salt2 = Buffer.from('bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', 'hex');

    const key1 = deriveEncryptionKey(salt1);
    const key2 = deriveEncryptionKey(salt2);

    expect(key1).not.toEqual(key2);
  });

  it('produces a key suitable for AES-256 encryption (256 bits)', () => {
    const salt = Buffer.from('deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef', 'hex');
    const key = deriveEncryptionKey(salt);

    // AES-256 requires exactly 32 bytes (256 bits)
    expect(key.length * 8).toBe(256);
  });
});