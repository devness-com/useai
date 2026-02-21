import { type KeyObject, createHash, sign as cryptoSign, randomUUID } from 'node:crypto';
import type { ChainRecord } from '../types/chain.js';

export function computeHash(recordJson: string, prevHash: string): string {
  return createHash('sha256')
    .update(recordJson + prevHash)
    .digest('hex');
}

export function signHash(hash: string, signingKey: KeyObject | null): string {
  if (!signingKey) return 'unsigned';
  try {
    return cryptoSign(null, Buffer.from(hash), signingKey).toString('hex');
  } catch {
    return 'unsigned';
  }
}

export function buildChainRecord(
  type: ChainRecord['type'],
  sessionId: string,
  data: Record<string, unknown>,
  prevHash: string,
  signingKey: KeyObject | null,
): ChainRecord {
  const id = `r_${randomUUID().slice(0, 12)}`;
  const timestamp = new Date().toISOString();

  const recordCore = JSON.stringify({ id, type, session_id: sessionId, timestamp, data });
  const hash = computeHash(recordCore, prevHash);
  const signature = signHash(hash, signingKey);

  return {
    id,
    type,
    session_id: sessionId,
    timestamp,
    data,
    prev_hash: prevHash,
    hash,
    signature,
  };
}
