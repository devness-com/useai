import {
  type KeyObject,
  generateKeyPairSync,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  createPrivateKey,
} from 'node:crypto';
import type { Keystore } from '../types/keystore.js';
import { deriveEncryptionKey } from './derive.js';

export interface KeystoreResult {
  signingKey: KeyObject;
  publicKeyPem: string;
}

export function decryptKeystore(ks: Keystore): KeyObject {
  const salt = Buffer.from(ks.salt, 'hex');
  const iv = Buffer.from(ks.iv, 'hex');
  const tag = Buffer.from(ks.tag, 'hex');
  const encrypted = Buffer.from(ks.encrypted_private_key, 'hex');
  const encKey = deriveEncryptionKey(salt);

  const decipher = createDecipheriv('aes-256-gcm', encKey, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);

  return createPrivateKey(decrypted.toString('utf-8'));
}

export function generateKeystore(): { keystore: Keystore; signingKey: KeyObject } {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }) as string;
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }) as string;

  const salt = randomBytes(32);
  const encKey = deriveEncryptionKey(salt);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);
  const encrypted = Buffer.concat([cipher.update(privateKeyPem, 'utf-8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const keystore: Keystore = {
    public_key_pem: publicKeyPem,
    encrypted_private_key: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    salt: salt.toString('hex'),
    created_at: new Date().toISOString(),
  };

  return { keystore, signingKey: privateKey };
}
