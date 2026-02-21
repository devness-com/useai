import { type KeyObject } from 'node:crypto';
import type { ChainRecord } from '@useai/shared';
import { SessionState } from './session-state.js';

// ── Session State ──────────────────────────────────────────────────────────────
//
// Delegates to a singleton SessionState instance. Re-exports mutable vars
// so that existing consumers (index.ts, tests) see the same API as before.
//

const state = new SessionState();

export let sessionStartTime = state.sessionStartTime;
export let sessionId = state.sessionId;
export let heartbeatCount = state.heartbeatCount;
export let sessionRecordCount = state.sessionRecordCount;
export let clientName = state.clientName;
export let sessionTaskType = state.sessionTaskType;
export let chainTipHash = state.chainTipHash;
export let signingKey: KeyObject | null = state.signingKey;
export let signingAvailable = state.signingAvailable;

// ── Sync helper ──────────────────────────────────────────────────────────────

/** Copy all state fields from the SessionState instance to module-level vars. */
function sync(): void {
  sessionStartTime = state.sessionStartTime;
  sessionId = state.sessionId;
  heartbeatCount = state.heartbeatCount;
  sessionRecordCount = state.sessionRecordCount;
  clientName = state.clientName;
  sessionTaskType = state.sessionTaskType;
  chainTipHash = state.chainTipHash;
  signingKey = state.signingKey;
  signingAvailable = state.signingAvailable;
}

// ── Delegating functions ────────────────────────────────────────────────────

export function resetSession(): void {
  state.reset();
  sync();
}

export function setClient(name: string): void {
  state.setClient(name);
  clientName = state.clientName;
}

export function setTaskType(type: string): void {
  state.setTaskType(type);
  sessionTaskType = state.sessionTaskType;
}

export function incrementHeartbeat(): void {
  state.incrementHeartbeat();
  heartbeatCount = state.heartbeatCount;
}

export function getSessionDuration(): number {
  return state.getSessionDuration();
}

export function initializeKeystore(): void {
  state.initializeKeystore();
  signingKey = state.signingKey;
  signingAvailable = state.signingAvailable;
}

export function appendToChain(
  type: ChainRecord['type'],
  data: Record<string, unknown>,
): ChainRecord {
  const record = state.appendToChain(type, data);
  chainTipHash = state.chainTipHash;
  sessionRecordCount = state.sessionRecordCount;
  return record;
}
