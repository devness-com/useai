import { createHash, createPublicKey, verify as cryptoVerify } from 'node:crypto';
import type { ChainRecord } from '../types/chain.js';

export function verifyChainRecord(record: ChainRecord, prevHash: string): boolean {
  const recordCore = JSON.stringify({
    id: record.id,
    type: record.type,
    session_id: record.session_id,
    timestamp: record.timestamp,
    data: record.data,
  });

  const expectedHash = createHash('sha256')
    .update(recordCore + prevHash)
    .digest('hex');

  return record.hash === expectedHash;
}

export function verifySignature(hash: string, signature: string, publicKeyPem: string): boolean {
  if (signature === 'unsigned') return false;
  try {
    const publicKey = createPublicKey(publicKeyPem);
    return cryptoVerify(null, Buffer.from(hash), publicKey, Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

export function verifyChain(
  records: ChainRecord[],
  publicKeyPem?: string,
): { valid: boolean; signatureValid: boolean; brokenAt?: number } {
  let prevHash = 'GENESIS';

  for (let i = 0; i < records.length; i++) {
    const record = records[i]!;
    if (!verifyChainRecord(record, prevHash)) {
      return { valid: false, signatureValid: false, brokenAt: i };
    }
    if (publicKeyPem && !verifySignature(record.hash, record.signature, publicKeyPem)) {
      return { valid: true, signatureValid: false, brokenAt: i };
    }
    prevHash = record.hash;
  }

  return { valid: true, signatureValid: publicKeyPem ? true : false };
}
