import { type KeyObject } from 'node:crypto';
import { appendFileSync, existsSync } from 'node:fs';
import { basename, join } from 'node:path';

import {
  ACTIVE_DIR,
  KEYSTORE_FILE,
  GENESIS_HASH,
  ensureDir,
  readJson,
  writeJson,
  buildChainRecord,
  decryptKeystore,
  generateKeystore,
  generateSessionId,
} from '@useai/shared';
import type { ChainRecord, Keystore } from '@useai/shared';

/**
 * Encapsulates all mutable session state for a single MCP session.
 * In stdio mode a single instance is shared; in daemon mode each
 * connected client gets its own SessionState.
 */
export class SessionState {
  sessionId: string;
  sessionStartTime: number;
  heartbeatCount: number;
  sessionRecordCount: number;
  clientName: string;
  sessionTaskType: string;
  sessionTitle: string | null;
  sessionPrivateTitle: string | null;
  sessionPromptWordCount: number | null;
  project: string | null;
  chainTipHash: string;
  signingKey: KeyObject | null;
  signingAvailable: boolean;
  /** Stable ID for the entire MCP connection (conversation). Survives reset(). */
  conversationId: string;
  /** 0-based index of the current session within this conversation. */
  conversationIndex: number;
  /** MCP transport session ID (set in daemon mode). Survives reset(). */
  mcpSessionId: string | null;
  /** Self-reported model ID from useai_start (e.g. "claude-opus-4-6"). */
  modelId: string | null;
  /** Token estimates for the useai_start tool call. */
  startCallTokensEst: { input: number; output: number } | null;

  constructor() {
    this.sessionId = generateSessionId();
    this.conversationId = generateSessionId(); // One ID for the whole conversation
    this.conversationIndex = 0;
    this.mcpSessionId = null;
    this.modelId = null;
    this.startCallTokensEst = null;
    this.sessionStartTime = Date.now();
    this.heartbeatCount = 0;
    this.sessionRecordCount = 0;
    this.clientName = 'unknown';
    this.sessionTaskType = 'coding';
    this.sessionTitle = null;
    this.sessionPrivateTitle = null;
    this.sessionPromptWordCount = null;
    this.project = null;
    this.chainTipHash = GENESIS_HASH;
    this.signingKey = null;
    this.signingAvailable = false;
  }

  reset(): void {
    this.sessionStartTime = Date.now();
    this.sessionId = generateSessionId();
    this.heartbeatCount = 0;
    this.sessionRecordCount = 0;
    this.chainTipHash = GENESIS_HASH;
    // Preserve clientName and conversationId — set once per MCP connection
    this.conversationIndex++;
    this.sessionTaskType = 'coding';
    this.sessionTitle = null;
    this.sessionPrivateTitle = null;
    this.sessionPromptWordCount = null;
    this.modelId = null;
    this.startCallTokensEst = null;
    this.detectProject();
  }

  detectProject(): void {
    this.project = basename(process.cwd());
  }

  setProject(project: string): void {
    this.project = project;
  }

  setClient(name: string): void {
    this.clientName = name;
  }

  setTaskType(type: string): void {
    this.sessionTaskType = type;
  }

  setTitle(title: string | null): void {
    this.sessionTitle = title;
  }

  setPrivateTitle(title: string | null): void {
    this.sessionPrivateTitle = title;
  }

  setPromptWordCount(count: number | null): void {
    this.sessionPromptWordCount = count;
  }

  setModel(id: string): void {
    this.modelId = id;
  }

  incrementHeartbeat(): void {
    this.heartbeatCount++;
  }

  getSessionDuration(): number {
    return Math.round((Date.now() - this.sessionStartTime) / 1000);
  }

  initializeKeystore(): void {
    ensureDir();

    if (existsSync(KEYSTORE_FILE)) {
      const ks = readJson<Keystore | null>(KEYSTORE_FILE, null);
      if (ks) {
        try {
          this.signingKey = decryptKeystore(ks);
          this.signingAvailable = true;
          return;
        } catch {
          // Keystore corrupted or machine changed — regenerate
        }
      }
    }

    const result = generateKeystore();
    writeJson(KEYSTORE_FILE, result.keystore);
    this.signingKey = result.signingKey;
    this.signingAvailable = true;
  }

  /** Path to this session's chain file in the active directory */
  private sessionChainPath(): string {
    return join(ACTIVE_DIR, `${this.sessionId}.jsonl`);
  }

  appendToChain(
    type: ChainRecord['type'],
    data: Record<string, unknown>,
  ): ChainRecord {
    const record = buildChainRecord(type, this.sessionId, data, this.chainTipHash, this.signingKey);

    ensureDir();
    appendFileSync(this.sessionChainPath(), JSON.stringify(record) + '\n', 'utf-8');

    this.chainTipHash = record.hash;
    this.sessionRecordCount++;

    return record;
  }
}
