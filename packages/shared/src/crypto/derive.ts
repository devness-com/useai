import { pbkdf2Sync } from 'node:crypto';
import { hostname, userInfo } from 'node:os';

export function deriveEncryptionKey(salt: Buffer): Buffer {
  const machineData = `${hostname()}:${userInfo().username}:useai-keystore`;
  return pbkdf2Sync(machineData, salt, 100_000, 32, 'sha256');
}
