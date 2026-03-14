/**
 * Chain ↔ Index Reconciliation
 *
 * Verifies that sessions.json matches the authoritative sealed chain files.
 * If a session's index entry has been tampered with (e.g. inflated duration),
 * this module detects and corrects it from the chain source of truth.
 *
 * Called on:
 *  - Dashboard session reads (so the UI always shows verified data)
 *  - Before sync to server (so tampered data never leaves the machine)
 */

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  SEALED_DIR,
  SESSIONS_FILE,
  readJson,
  writeJson,
  verifyChain,
  type SessionSeal,
  type ChainRecord,
} from '@useai/shared';

// Fields that must match between sessions.json and the sealed chain.
// These are the ones a user might tamper with to inflate stats.
const RECONCILE_FIELDS: (keyof SessionSeal)[] = [
  'duration_seconds',
  'ended_at',
  'started_at',
  'session_score',
  'files_touched',
];

export interface ReconcileResult {
  /** Number of sessions checked against their chain files */
  checked: number;
  /** Number of sessions corrected (index didn't match chain) */
  corrected: number;
  /** Number of chain files that failed integrity verification */
  corrupted: number;
  /** Session IDs that were corrected */
  correctedIds: string[];
  /** Session IDs with corrupted chains */
  corruptedIds: string[];
}

/**
 * Extract the authoritative SessionSeal from a sealed chain file.
 * Returns null if the file doesn't exist or can't be parsed.
 */
function extractSealFromChain(sessionId: string): SessionSeal | null {
  const chainPath = join(SEALED_DIR, `${sessionId}.jsonl`);
  if (!existsSync(chainPath)) return null;

  try {
    const content = readFileSync(chainPath, 'utf-8').trim();
    const lines = content.split('\n').filter(Boolean);
    if (lines.length === 0) return null;

    const records: ChainRecord[] = lines.map(line => JSON.parse(line) as ChainRecord);

    // Verify chain integrity (hash linkage)
    const integrity = verifyChain(records);
    if (!integrity.valid) return null; // Chain is corrupted — can't trust it

    // Find the session_seal record (last record in a properly sealed chain)
    const sealRecord = records.find(r => r.type === 'session_seal');
    if (!sealRecord || !sealRecord.data['seal']) return null;

    const sealData = JSON.parse(sealRecord.data['seal'] as string) as SessionSeal;
    return sealData;
  } catch {
    return null;
  }
}

/**
 * Reconcile a single session: compare the index entry against the chain.
 * Returns the corrected session (from chain) if tampered, or the original if clean.
 * Returns null if the chain is corrupted (untrusted).
 */
function reconcileSession(
  indexEntry: SessionSeal,
): { session: SessionSeal; corrected: boolean; corrupted: boolean } {
  const chainSeal = extractSealFromChain(indexEntry.session_id);

  // No chain file — session might be from cloud-pull or pre-chain era. Keep as-is.
  if (chainSeal === null) {
    // Check if chain exists but is corrupted (vs simply missing)
    const chainPath = join(SEALED_DIR, `${indexEntry.session_id}.jsonl`);
    const corrupted = existsSync(chainPath); // File exists but failed verification
    return { session: indexEntry, corrected: false, corrupted };
  }

  // Compare reconcilable fields
  let corrected = false;
  const fixed = { ...indexEntry };

  for (const field of RECONCILE_FIELDS) {
    let chainValue = chainSeal[field];
    const indexValue = indexEntry[field];

    // Skip if chain doesn't have this field (e.g. session_score not computed yet)
    if (chainValue === undefined || chainValue === null) continue;

    // Clamp negative durations to 0: parallel child sessions can produce
    // negative duration_seconds in auto-sealed chain records (childPausedMs overflow).
    if (field === 'duration_seconds' && typeof chainValue === 'number' && chainValue < 0) {
      chainValue = 0;
    }

    if (chainValue !== indexValue) {
      (fixed as Record<string, unknown>)[field] = chainValue;
      corrected = true;
    }
  }

  // Also reconcile evaluation if the chain has it and index doesn't (or differs)
  if (chainSeal.evaluation && JSON.stringify(chainSeal.evaluation) !== JSON.stringify(indexEntry.evaluation)) {
    fixed.evaluation = chainSeal.evaluation;
    corrected = true;
  }

  return { session: fixed, corrected, corrupted: false };
}

/**
 * Reconcile all sessions in sessions.json against their sealed chain files.
 * Corrects any tampered entries and writes the corrected index back to disk.
 *
 * This is safe to call frequently — it only writes if corrections are needed.
 */
export function reconcileSessions(sessions: SessionSeal[]): {
  sessions: SessionSeal[];
  result: ReconcileResult;
} {
  const result: ReconcileResult = {
    checked: 0,
    corrected: 0,
    corrupted: 0,
    correctedIds: [],
    corruptedIds: [],
  };

  const reconciled: SessionSeal[] = [];

  for (const session of sessions) {
    const { session: fixed, corrected, corrupted } = reconcileSession(session);
    result.checked++;

    if (corrupted) {
      result.corrupted++;
      result.corruptedIds.push(session.session_id);
    }

    if (corrected) {
      result.corrected++;
      result.correctedIds.push(session.session_id);
    }

    reconciled.push(fixed);
  }

  // Persist corrections to disk so they don't need to be recomputed
  if (result.corrected > 0) {
    const allSessions = readJson<SessionSeal[]>(SESSIONS_FILE, []);
    for (const correctedId of result.correctedIds) {
      const correctedSession = reconciled.find(s => s.session_id === correctedId);
      const idx = allSessions.findIndex(s => s.session_id === correctedId);
      if (correctedSession && idx >= 0) {
        allSessions[idx] = correctedSession;
      }
    }
    writeJson(SESSIONS_FILE, allSessions);
  }

  return { sessions: reconciled, result };
}

/**
 * Reconcile sessions for sync — same as reconcileSessions but also
 * filters out sessions with corrupted chains (don't sync unverifiable data).
 */
export function reconcileForSync(sessions: SessionSeal[]): {
  sessions: SessionSeal[];
  result: ReconcileResult;
} {
  const { sessions: reconciled, result } = reconcileSessions(sessions);

  // For sync: exclude sessions with corrupted chains
  const filtered = reconciled.filter(
    s => !result.corruptedIds.includes(s.session_id),
  );

  return { sessions: filtered, result };
}
