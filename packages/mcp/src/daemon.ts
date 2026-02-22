import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createHash, randomUUID, type KeyObject } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, appendFileSync, renameSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import { join } from 'node:path';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

import {
  VERSION,
  ACTIVE_DIR,
  SEALED_DIR,
  SESSIONS_FILE,
  MILESTONES_FILE,
  DAEMON_PID_FILE,
  DAEMON_PORT,
  KEYSTORE_FILE,
  CONFIG_FILE,
  ensureDir,
  readJson,
  writeJson,
  signHash,
  buildChainRecord,
  decryptKeystore,
  generateKeystore,
  fetchDaemonHealth,
  findPidsByPort,
  killDaemon,
  fetchLatestVersion,
  formatDuration,
} from '@useai/shared';
import type { SessionSeal, SessionEvaluation, ChainRecord, Keystore, Milestone, LocalConfig } from '@useai/shared';
import { SessionState } from './session-state.js';
import { registerTools } from './register-tools.js';
import { readMcpMap, writeMcpMapping } from './mcp-map.js';
import { getDashboardHtml } from './dashboard/html.js';
import {
  handleLocalStats,
  handleLocalSessions,
  handleLocalMilestones,
  handleLocalConfig,
  handleLocalSync,
  handleLocalSendOtp,
  handleLocalVerifyOtp,
  handleDeleteSession,
  handleDeleteConversation,
  handleDeleteMilestone,
} from './dashboard/local-api.js';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActiveSession {
  transport: StreamableHTTPServerTransport;
  server: McpServer;
  session: SessionState;
  idleTimer: ReturnType<typeof setTimeout>;
}

// ── Session Store ──────────────────────────────────────────────────────────────

const sessions = new Map<string, ActiveSession>();

// Daemon-level signing key for orphan sealing
let daemonSigningKey: KeyObject | null = null;

// ── Orphan Recovery ─────────────────────────────────────────────────────────────

const ORPHAN_SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/** Get the set of UseAI session IDs that are currently active in memory. */
function getActiveUseaiSessionIds(): Set<string> {
  const ids = new Set<string>();
  for (const [, active] of sessions) {
    ids.add(active.session.sessionId);
  }
  return ids;
}

/** Seal a single orphaned chain file: append session_end + session_seal, move to sealed/. */
function sealOrphanFile(sessionId: string): void {
  const filePath = join(ACTIVE_DIR, `${sessionId}.jsonl`);
  if (!existsSync(filePath)) return;

  try {
    const content = readFileSync(filePath, 'utf-8').trim();
    if (!content) return;

    const lines = content.split('\n').filter(Boolean);
    if (lines.length === 0) return;

    const firstRecord = JSON.parse(lines[0]!) as ChainRecord;
    const lastRecord = JSON.parse(lines[lines.length - 1]!) as ChainRecord;

    // Already has session_end or session_seal — just move to sealed/
    if (lastRecord.type === 'session_end' || lastRecord.type === 'session_seal') {
      try { renameSync(filePath, join(SEALED_DIR, `${sessionId}.jsonl`)); } catch { /* ignore */ }
      return;
    }

    // Extract metadata from first record (session_start)
    const startData = firstRecord.data;
    const client = (startData['client'] as string) ?? 'unknown';
    const taskType = (startData['task_type'] as string) ?? 'coding';
    const startTime = firstRecord.timestamp;
    const orphanTitle = (startData['title'] as string) ?? undefined;
    const orphanPrivateTitle = (startData['private_title'] as string) ?? undefined;
    const orphanProject = (startData['project'] as string) ?? undefined;

    // Count heartbeats
    let heartbeatCount = 0;
    for (const line of lines) {
      try {
        if ((JSON.parse(line) as ChainRecord).type === 'heartbeat') heartbeatCount++;
      } catch { /* ignore */ }
    }

    const chainTip = lastRecord.hash;
    // Use the last record's timestamp as the end time — not Date.now() —
    // so orphan-sealed sessions reflect actual activity, not sweep delay.
    const endTime = lastRecord.timestamp;
    const duration = Math.round((new Date(endTime).getTime() - new Date(startTime).getTime()) / 1000);
    const now = endTime;

    // Append session_end
    const endRecord = buildChainRecord('session_end', sessionId, {
      duration_seconds: duration,
      task_type: taskType,
      languages: [],
      files_touched: 0,
      heartbeat_count: heartbeatCount,
      auto_sealed: true,
    }, chainTip, daemonSigningKey);
    appendFileSync(filePath, JSON.stringify(endRecord) + '\n');

    // Append session_seal
    const sealData = JSON.stringify({
      session_id: sessionId,
      client,
      task_type: taskType,
      languages: [],
      files_touched: 0,
      started_at: startTime,
      ended_at: now,
      duration_seconds: duration,
      heartbeat_count: heartbeatCount,
      record_count: lines.length + 2,
      chain_end_hash: endRecord.hash,
    });
    const sealSignature = signHash(
      createHash('sha256').update(sealData).digest('hex'),
      daemonSigningKey,
    );
    appendFileSync(filePath, JSON.stringify(
      buildChainRecord('session_seal', sessionId, {
        seal: sealData,
        seal_signature: sealSignature,
        auto_sealed: true,
      }, endRecord.hash, daemonSigningKey),
    ) + '\n');

    // Move to sealed/
    try { renameSync(filePath, join(SEALED_DIR, `${sessionId}.jsonl`)); } catch { /* ignore */ }

    // Keep MCP mapping — sealed chain file is still readable by recoverStartSession
    // for client name inheritance. Mapping is overwritten on next recoverStartSession.

    // Upsert seal into sessions index (replace if existing entry is less rich)
    const convId = (startData['conversation_id'] as string) ?? undefined;
    const convIdx = (startData['conversation_index'] as number) ?? undefined;

    const seal: SessionSeal = {
      session_id: sessionId,
      conversation_id: convId,
      conversation_index: convIdx,
      client,
      task_type: taskType,
      languages: [],
      files_touched: 0,
      project: orphanProject,
      title: orphanTitle,
      private_title: orphanPrivateTitle,
      started_at: startTime,
      ended_at: now,
      duration_seconds: duration,
      heartbeat_count: heartbeatCount,
      record_count: lines.length + 2,
      chain_start_hash: firstRecord.prev_hash,
      chain_end_hash: endRecord.hash,
      seal_signature: sealSignature,
    };
    upsertSessionSeal(seal);
  } catch { /* skip individual file errors */ }
}

/** Scan active/ for orphaned chain files and seal them. */
function sealOrphanedSessions(): void {
  if (!existsSync(ACTIVE_DIR)) return;

  const activeIds = getActiveUseaiSessionIds();

  // Sessions with MCP mapping entries may still receive a useai_end call
  // from a client that hasn't noticed the daemon restart yet — skip them.
  const mcpMap = readMcpMap();
  const mappedUseaiIds = new Set(Object.values(mcpMap));

  let sealed = 0;

  try {
    const files = readdirSync(ACTIVE_DIR).filter((f) => f.endsWith('.jsonl'));
    for (const file of files) {
      const sessionId = file.replace('.jsonl', '');
      if (activeIds.has(sessionId)) continue;
      if (mappedUseaiIds.has(sessionId)) {
        // Recoverable — skip unless the chain file is stale (>30 min since last write).
        // This prevents mapped sessions from lingering forever if the client never calls useai_end.
        try {
          const mtime = statSync(join(ACTIVE_DIR, file)).mtimeMs;
          if (Date.now() - mtime < IDLE_TIMEOUT_MS) continue;
        } catch {
          continue; // Can't stat — skip to be safe
        }
      }
      sealOrphanFile(sessionId);
      sealed++;
    }
  } catch { /* ignore readdir errors */ }

  if (sealed > 0) {
    console.log(`Sealed ${sealed} orphaned session${sealed === 1 ? '' : 's'}`);
  }
}

// ── Auto-seal ──────────────────────────────────────────────────────────────────

/** Check whether the UseAI session data has already been sealed (chain file moved to sealed/). */
function isSessionAlreadySealed(session: SessionState): boolean {
  const activePath = join(ACTIVE_DIR, `${session.sessionId}.jsonl`);
  return !existsSync(activePath);
}

/** Score a session seal by data richness — higher = more complete. */
function sealRichness(s: SessionSeal): number {
  let score = 0;
  if (s.title) score += 10;
  if (s.private_title) score += 10;
  if (s.conversation_id) score += 20;
  if (s.evaluation) score += 20;
  if (s.languages && s.languages.length > 0) score += 5;
  if (s.files_touched > 0) score += 5;
  if (s.project && !['untitled', 'mcp', 'unknown'].includes(s.project)) score += 5;
  return score;
}

/** Deduplicate sessions.json, keeping the richest entry per session_id. */
function deduplicateSessionsIndex(): void {
  const allSessions = readJson<SessionSeal[]>(SESSIONS_FILE, []);
  if (allSessions.length === 0) return;

  const seen = new Map<string, SessionSeal>();
  for (const s of allSessions) {
    const existing = seen.get(s.session_id);
    if (!existing || sealRichness(s) > sealRichness(existing)) {
      seen.set(s.session_id, s);
    }
  }

  const deduped = [...seen.values()];
  if (deduped.length < allSessions.length) {
    console.log(`Deduplicated sessions.json: ${allSessions.length} → ${deduped.length} entries`);
    writeJson(SESSIONS_FILE, deduped);
  }
}

/** Upsert a session seal into sessions.json, keeping the richer entry on conflict. */
function upsertSessionSeal(seal: SessionSeal): void {
  const allSessions = readJson<SessionSeal[]>(SESSIONS_FILE, []);
  const existingIdx = allSessions.findIndex(s => s.session_id === seal.session_id);
  if (existingIdx >= 0) {
    if (sealRichness(seal) >= sealRichness(allSessions[existingIdx]!)) {
      allSessions[existingIdx] = seal;
    }
    // else: existing entry is richer, keep it
  } else {
    allSessions.push(seal);
  }
  writeJson(SESSIONS_FILE, allSessions);
}

function autoSealSession(active: ActiveSession): void {
  const { session } = active;

  if (session.sessionRecordCount === 0) return;
  if (isSessionAlreadySealed(session)) return; // Already sealed by session_end tool

  const duration = session.getSessionDuration();
  const now = new Date().toISOString();

  // Append session_end to chain
  const endRecord = session.appendToChain('session_end', {
    duration_seconds: duration,
    task_type: session.sessionTaskType,
    languages: [],
    files_touched: 0,
    heartbeat_count: session.heartbeatCount,
    auto_sealed: true,
  });

  // Create and write seal
  const sealData = JSON.stringify({
    session_id: session.sessionId,
    conversation_id: session.conversationId,
    conversation_index: session.conversationIndex,
    client: session.clientName,
    task_type: session.sessionTaskType,
    languages: [],
    files_touched: 0,
    project: session.project ?? undefined,
    title: session.sessionTitle ?? undefined,
    private_title: session.sessionPrivateTitle ?? undefined,
    started_at: new Date(session.sessionStartTime).toISOString(),
    ended_at: now,
    duration_seconds: duration,
    heartbeat_count: session.heartbeatCount,
    record_count: session.sessionRecordCount,
    chain_end_hash: endRecord.hash,
  });

  const sealSignature = signHash(
    createHash('sha256').update(sealData).digest('hex'),
    session.signingKey,
  );

  session.appendToChain('session_seal', {
    seal: sealData,
    seal_signature: sealSignature,
    auto_sealed: true,
  });

  // Move chain file from active/ to sealed/
  const activePath = join(ACTIVE_DIR, `${session.sessionId}.jsonl`);
  const sealedPath = join(SEALED_DIR, `${session.sessionId}.jsonl`);
  try {
    if (existsSync(activePath)) {
      renameSync(activePath, sealedPath);
    }
  } catch {
    // If rename fails, file stays in active/
  }

  // Upsert seal into sessions index
  const chainStartHash = session.chainTipHash === 'GENESIS' ? 'GENESIS' : session.chainTipHash;
  const seal: SessionSeal = {
    session_id: session.sessionId,
    conversation_id: session.conversationId,
    conversation_index: session.conversationIndex,
    client: session.clientName,
    task_type: session.sessionTaskType,
    languages: [],
    files_touched: 0,
    project: session.project ?? undefined,
    title: session.sessionTitle ?? undefined,
    private_title: session.sessionPrivateTitle ?? undefined,
    started_at: new Date(session.sessionStartTime).toISOString(),
    ended_at: now,
    duration_seconds: duration,
    heartbeat_count: session.heartbeatCount,
    record_count: session.sessionRecordCount,
    chain_start_hash: chainStartHash,
    chain_end_hash: endRecord.hash,
    seal_signature: sealSignature,
  };
  upsertSessionSeal(seal);
}

/**
 * Seal the UseAI data for a session without destroying the MCP transport.
 * Called by /api/seal-active (SessionEnd hook). The transport stays alive
 * so the client can start a new UseAI session on the next prompt.
 */
function sealSessionData(active: ActiveSession): void {
  autoSealSession(active);
  active.session.reset(); // Ready for a new UseAI session
}

// ── Idle Timer ─────────────────────────────────────────────────────────────────

function resetIdleTimer(sessionId: string): void {
  const active = sessions.get(sessionId);
  if (!active) return;

  clearTimeout(active.idleTimer);
  active.idleTimer = setTimeout(async () => {
    autoSealSession(active);
    try {
      await active.transport.close();
    } catch { /* ignore */ }
    sessions.delete(sessionId);
  }, IDLE_TIMEOUT_MS);
}

// ── Cleanup helper ─────────────────────────────────────────────────────────────

async function cleanupSession(sessionId: string): Promise<void> {
  const active = sessions.get(sessionId);
  if (!active) return;

  clearTimeout(active.idleTimer);
  autoSealSession(active);
  try {
    await active.transport.close();
  } catch { /* ignore */ }
  sessions.delete(sessionId);
}

// ── Health endpoint ────────────────────────────────────────────────────────────

const startedAt = Date.now();

function countActiveSessionFiles(): number {
  try {
    return readdirSync(ACTIVE_DIR).filter(f => f.endsWith('.jsonl')).length;
  } catch {
    return 0;
  }
}

function handleHealth(res: ServerResponse): void {
  const body = JSON.stringify({
    status: 'ok',
    version: VERSION,
    active_sessions: countActiveSessionFiles(),
    mcp_connections: sessions.size,
    uptime_seconds: Math.round((Date.now() - startedAt) / 1000),
  });
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(body);
}

// ── Update check (cached) ───────────────────────────────────────────────────────

interface UpdateCheckCache {
  latest: string;
  checkedAt: number;
}

let updateCheckCache: UpdateCheckCache | null = null;
const UPDATE_CHECK_TTL_MS = 60 * 60 * 1000; // 1 hour

async function handleUpdateCheck(res: ServerResponse): Promise<void> {
  const now = Date.now();

  if (!updateCheckCache || now - updateCheckCache.checkedAt > UPDATE_CHECK_TTL_MS) {
    const latest = await fetchLatestVersion();
    if (latest) {
      updateCheckCache = { latest, checkedAt: now };
    }
  }

  const latest = updateCheckCache?.latest ?? VERSION;
  const body = JSON.stringify({
    current: VERSION,
    latest,
    update_available: latest !== VERSION,
  });
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

// ── JSON body parser ───────────────────────────────────────────────────────────

function parseBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        resolve(raw ? JSON.parse(raw) : undefined);
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

// ── Stale session recovery ──────────────────────────────────────────────────────
//
// When the daemon restarts, in-memory MCP sessions are lost but the chain files
// and mcp-map.json persist on disk. This handles ALL tool calls from stale
// sessions by bypassing the MCP SDK and responding directly at the HTTP level.

type JsonRpcBody = {
  jsonrpc?: string;
  method?: string;
  params?: { name?: string; arguments?: Record<string, unknown> };
  id?: unknown;
};

/**
 * Detect client from HTTP request headers as a fallback when no MCP mapping exists.
 * Claude Code sends a User-Agent like "claude-code/1.x.x" or similar.
 */
function detectClientFromHeaders(req: IncomingMessage): string {
  const ua = (req.headers['user-agent'] ?? '').toLowerCase();
  if (ua.includes('claude-code') || ua.includes('claudecode')) return 'claude-code';
  if (ua.includes('cursor')) return 'cursor';
  if (ua.includes('windsurf') || ua.includes('codeium')) return 'windsurf';
  if (ua.includes('vscode') || ua.includes('visual studio code')) return 'vscode';
  if (ua.includes('codex')) return 'codex';
  if (ua.includes('gemini')) return 'gemini-cli';
  if (ua.includes('zed')) return 'zed';
  return 'unknown';
}

function sendJsonRpcResult(res: ServerResponse, rpcId: unknown, text: string): void {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    jsonrpc: '2.0',
    result: { content: [{ type: 'text', text }] },
    id: rpcId,
  }));
}

/** Read the first record from a chain file (active/ or sealed/) to extract session metadata. */
function readChainMetadata(useaiSessionId: string): {
  client: string; startTime: string; taskType: string;
  title?: string; privateTitle?: string; project?: string;
  convId?: string; convIdx?: number;
} | null {
  const activePath = join(ACTIVE_DIR, `${useaiSessionId}.jsonl`);
  const sealedPath = join(SEALED_DIR, `${useaiSessionId}.jsonl`);
  const chainPath = existsSync(activePath) ? activePath : existsSync(sealedPath) ? sealedPath : null;
  if (!chainPath) return null;

  try {
    const firstLine = readFileSync(chainPath, 'utf-8').split('\n')[0];
    if (!firstLine) return null;
    const record = JSON.parse(firstLine) as ChainRecord;
    const d = record.data;
    return {
      client: (d['client'] as string) ?? 'unknown',
      startTime: record.timestamp,
      taskType: (d['task_type'] as string) ?? 'coding',
      title: (d['title'] as string) ?? undefined,
      privateTitle: (d['private_title'] as string) ?? undefined,
      project: (d['project'] as string) ?? undefined,
      convId: (d['conversation_id'] as string) ?? undefined,
      convIdx: (d['conversation_index'] as number) ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Recover a useai_start call for a stale MCP session.
 * Creates a brand new UseAI session, sealing any previous one if needed.
 */
function recoverStartSession(
  staleMcpSessionId: string,
  args: Record<string, unknown>,
  rpcId: unknown,
  res: ServerResponse,
  req: IncomingMessage,
): boolean {
  // Seal previous session if it's still in active/
  const map = readMcpMap();
  const prevSessionId = map[staleMcpSessionId];

  const prevActivePath = prevSessionId ? join(ACTIVE_DIR, `${prevSessionId}.jsonl`) : null;
  if (prevActivePath && existsSync(prevActivePath)) {
    sealOrphanFile(prevSessionId!);
  }

  // Get client name: prefer chain data from previous session, fall back to HTTP headers
  const meta = prevSessionId ? readChainMetadata(prevSessionId) : null;
  const chainClient = meta?.client;
  const client = (chainClient && chainClient !== 'unknown')
    ? chainClient
    : detectClientFromHeaders(req);

  // Create new UseAI session
  const newSessionId = randomUUID();
  const taskType = (args['task_type'] as string) ?? 'coding';
  const title = args['title'] as string | undefined;
  const privateTitle = args['private_title'] as string | undefined;
  const project = args['project'] as string | undefined;
  const model = args['model'] as string | undefined;
  const argConvId = args['conversation_id'] as string | undefined;
  const convId = argConvId ?? randomUUID();

  const chainData: Record<string, unknown> = {
    client,
    task_type: taskType,
    project,
    conversation_id: convId,
    version: VERSION,
    recovered: true,
  };
  if (title) chainData['title'] = title;
  if (privateTitle) chainData['private_title'] = privateTitle;
  if (model) chainData['model'] = model;

  const record = buildChainRecord('session_start', newSessionId, chainData, 'GENESIS', daemonSigningKey);
  const chainPath = join(ACTIVE_DIR, `${newSessionId}.jsonl`);
  appendFileSync(chainPath, JSON.stringify(record) + '\n');

  // Update MCP mapping to point to new session
  writeMcpMapping(staleMcpSessionId, newSessionId);

  sendJsonRpcResult(res, rpcId,
    `useai session started — ${taskType} on ${client} · ${newSessionId.slice(0, 8)} · conv ${convId.slice(0, 8)} · recovered · ${daemonSigningKey ? 'signed' : 'unsigned'}`);

  console.log(`Recovered useai_start: new session ${newSessionId.slice(0, 8)} (MCP ${staleMcpSessionId.slice(0, 8)})`);
  return true;
}

/**
 * Recover a useai_heartbeat call for a stale MCP session.
 * Appends a heartbeat to the active chain file, or returns success if already sealed.
 */
function recoverHeartbeat(
  staleMcpSessionId: string,
  rpcId: unknown,
  res: ServerResponse,
): boolean {
  const map = readMcpMap();
  const useaiSessionId = map[staleMcpSessionId];
  if (!useaiSessionId) return false;

  const chainPath = join(ACTIVE_DIR, `${useaiSessionId}.jsonl`);
  if (!existsSync(chainPath)) {
    // Session already sealed — heartbeat is a no-op
    sendJsonRpcResult(res, rpcId, 'Session already ended (recovered).');
    return true;
  }

  try {
    const content = readFileSync(chainPath, 'utf-8').trim();
    const lines = content.split('\n').filter(Boolean);
    if (lines.length === 0) return false;

    const firstRecord = JSON.parse(lines[0]!) as ChainRecord;
    const lastRecord = JSON.parse(lines[lines.length - 1]!) as ChainRecord;

    let heartbeatCount = 0;
    for (const line of lines) {
      try { if ((JSON.parse(line) as ChainRecord).type === 'heartbeat') heartbeatCount++; } catch { /* skip */ }
    }
    heartbeatCount++;

    const duration = Math.round((Date.now() - new Date(firstRecord.timestamp).getTime()) / 1000);

    const record = buildChainRecord('heartbeat', useaiSessionId, {
      heartbeat_number: heartbeatCount,
      cumulative_seconds: duration,
      recovered: true,
    }, lastRecord.hash, daemonSigningKey);
    appendFileSync(chainPath, JSON.stringify(record) + '\n');

    sendJsonRpcResult(res, rpcId, `Heartbeat recorded. Session active for ${formatDuration(duration)}.`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Recover a useai_end call for a stale MCP session.
 * Handles both active (not yet swept) and already-sealed (orphan sweep got it) sessions.
 */
function recoverEndSession(
  staleMcpSessionId: string,
  args: Record<string, unknown>,
  rpcId: unknown,
  res: ServerResponse,
): boolean {
  const map = readMcpMap();
  const useaiSessionId = map[staleMcpSessionId];
  if (!useaiSessionId) return false;

  const activePath = join(ACTIVE_DIR, `${useaiSessionId}.jsonl`);
  const sealedPath = join(SEALED_DIR, `${useaiSessionId}.jsonl`);
  const chainPath = existsSync(activePath) ? activePath : existsSync(sealedPath) ? sealedPath : null;
  if (!chainPath) return false;

  const isAlreadySealed = chainPath === sealedPath;
  const content = readFileSync(chainPath, 'utf-8').trim();
  if (!content) return false;

  const lines = content.split('\n').filter(Boolean);
  if (lines.length === 0) return false;

  const firstRecord = JSON.parse(lines[0]!) as ChainRecord;
  const startData = firstRecord.data;
  const client = (startData['client'] as string) ?? 'unknown';
  const startTime = firstRecord.timestamp;
  const sessionTitle = (startData['title'] as string) ?? undefined;
  const sessionPrivateTitle = (startData['private_title'] as string) ?? undefined;
  const sessionProject = (startData['project'] as string) ?? undefined;
  const sessionModel = (startData['model'] as string) ?? undefined;
  const convId = (startData['conversation_id'] as string) ?? undefined;
  const convIdx = (startData['conversation_index'] as number) ?? undefined;

  // Extract useai_end arguments
  const taskType = (args['task_type'] as string) ?? (startData['task_type'] as string) ?? 'coding';
  const languages = (args['languages'] as string[]) ?? [];
  const filesTouched = (args['files_touched_count'] as number) ?? 0;
  const milestonesInput = args['milestones'] as Array<{ title: string; private_title?: string; category: string; complexity?: string }> | undefined;
  const evaluation = args['evaluation'] as SessionEvaluation | undefined;

  // For already-sealed sessions, extract the duration from the existing seal
  // rather than recalculating with Date.now() (which inflates idle time).
  // For active sessions, use the last record's timestamp as the effective end.
  const lastLine = lines[lines.length - 1]!;
  const lastParsed = JSON.parse(lastLine) as ChainRecord;
  let duration: number;
  let now: string;
  if (isAlreadySealed && lastParsed.type === 'session_seal' && lastParsed.data['seal']) {
    try {
      const existingSeal = JSON.parse(lastParsed.data['seal'] as string) as { duration_seconds?: number; ended_at?: string };
      duration = existingSeal.duration_seconds ?? Math.round((new Date(lastParsed.timestamp).getTime() - new Date(startTime).getTime()) / 1000);
      now = existingSeal.ended_at ?? lastParsed.timestamp;
    } catch {
      duration = Math.round((new Date(lastParsed.timestamp).getTime() - new Date(startTime).getTime()) / 1000);
      now = lastParsed.timestamp;
    }
  } else {
    now = lastParsed.timestamp;
    duration = Math.round((new Date(now).getTime() - new Date(startTime).getTime()) / 1000);
  }

  // If already sealed by orphan sweep, just update sessions.json with richer data + save milestones
  if (isAlreadySealed) {
    let milestoneCount = 0;
    if (milestonesInput && milestonesInput.length > 0) {
      const config = readJson<LocalConfig>(CONFIG_FILE, { milestone_tracking: true, auto_sync: true });
      if (config.milestone_tracking) {
        const durationMinutes = Math.round(duration / 60);
        const allMilestones = readJson<Milestone[]>(MILESTONES_FILE, []);
        for (const m of milestonesInput) {
          allMilestones.push({
            id: `m_${randomUUID().slice(0, 8)}`,
            session_id: useaiSessionId,
            title: m.title,
            private_title: m.private_title,
            project: sessionProject,
            category: m.category as Milestone['category'],
            complexity: (m.complexity ?? 'medium') as Milestone['complexity'],
            duration_minutes: durationMinutes,
            languages,
            client,
            created_at: now,
            published: false,
            published_at: null,
            chain_hash: '',
          });
          milestoneCount++;
        }
        writeJson(MILESTONES_FILE, allMilestones);
      }
    }

    // Upsert sessions.json with richer data (evaluation, languages, etc.)
    const richSeal: SessionSeal = {
      session_id: useaiSessionId,
      conversation_id: convId,
      conversation_index: convIdx,
      client,
      task_type: taskType,
      languages,
      files_touched: filesTouched,
      project: sessionProject,
      title: sessionTitle,
      private_title: sessionPrivateTitle,
      model: sessionModel,
      evaluation: evaluation ?? undefined,
      started_at: startTime,
      ended_at: now,
      duration_seconds: duration,
      heartbeat_count: 0,
      record_count: lines.length,
      chain_start_hash: firstRecord.prev_hash,
      chain_end_hash: '',
      seal_signature: '',
    };
    upsertSessionSeal(richSeal);
    // Keep MCP mapping — recoverStartSession will overwrite it on next session

    const durationStr = formatDuration(duration);
    sendJsonRpcResult(res, rpcId,
      `Session ended (recovered): ${durationStr} ${taskType}` +
      (milestoneCount > 0 ? ` · ${milestoneCount} milestone${milestoneCount > 1 ? 's' : ''} recorded` : '') +
      (evaluation ? ` · eval: ${evaluation.task_outcome}` : ''));

    console.log(`Recovered useai_end for already-sealed session ${useaiSessionId.slice(0, 8)} (MCP ${staleMcpSessionId.slice(0, 8)})`);
    return true;
  }

  // Session is still in active/ — full seal with chain records
  const lastRecord = JSON.parse(lines[lines.length - 1]!) as ChainRecord;

  // Already has session_end — nothing more to do
  if (lastRecord.type === 'session_end' || lastRecord.type === 'session_seal') {
    sendJsonRpcResult(res, rpcId, 'Session already ended.');
    return true;
  }

  let heartbeatCount = 0;
  for (const line of lines) {
    try { if ((JSON.parse(line) as ChainRecord).type === 'heartbeat') heartbeatCount++; } catch { /* skip */ }
  }

  let chainTip = lastRecord.hash;
  let recordCount = lines.length;

  // Process milestones
  let milestoneCount = 0;
  if (milestonesInput && milestonesInput.length > 0) {
    const config = readJson<LocalConfig>(CONFIG_FILE, { milestone_tracking: true, auto_sync: true });
    if (config.milestone_tracking) {
      const durationMinutes = Math.round(duration / 60);
      const allMilestones = readJson<Milestone[]>(MILESTONES_FILE, []);
      for (const m of milestonesInput) {
        const mRecord = buildChainRecord('milestone', useaiSessionId, {
          title: m.title, private_title: m.private_title,
          category: m.category, complexity: m.complexity ?? 'medium',
          duration_minutes: durationMinutes, languages,
        }, chainTip, daemonSigningKey);
        appendFileSync(activePath, JSON.stringify(mRecord) + '\n');
        chainTip = mRecord.hash;
        recordCount++;
        allMilestones.push({
          id: `m_${randomUUID().slice(0, 8)}`,
          session_id: useaiSessionId,
          title: m.title, private_title: m.private_title,
          project: sessionProject,
          category: m.category as Milestone['category'],
          complexity: (m.complexity ?? 'medium') as Milestone['complexity'],
          duration_minutes: durationMinutes, languages, client,
          created_at: now, published: false, published_at: null,
          chain_hash: mRecord.hash,
        });
        milestoneCount++;
      }
      writeJson(MILESTONES_FILE, allMilestones);
    }
  }

  // Append session_end
  const endRecord = buildChainRecord('session_end', useaiSessionId, {
    duration_seconds: duration, task_type: taskType, languages,
    files_touched: filesTouched, heartbeat_count: heartbeatCount,
    recovered: true,
    ...(evaluation ? { evaluation } : {}),
    ...(sessionModel ? { model: sessionModel } : {}),
  }, chainTip, daemonSigningKey);
  appendFileSync(activePath, JSON.stringify(endRecord) + '\n');
  recordCount++;

  // Create and append session_seal
  const sealData = JSON.stringify({
    session_id: useaiSessionId, conversation_id: convId, conversation_index: convIdx,
    client, task_type: taskType, languages, files_touched: filesTouched,
    project: sessionProject, title: sessionTitle, private_title: sessionPrivateTitle,
    model: sessionModel,
    evaluation: evaluation ?? undefined,
    started_at: startTime, ended_at: now, duration_seconds: duration,
    heartbeat_count: heartbeatCount, record_count: recordCount + 1,
    chain_end_hash: endRecord.hash,
  });
  const sealSignature = signHash(
    createHash('sha256').update(sealData).digest('hex'),
    daemonSigningKey,
  );
  appendFileSync(activePath, JSON.stringify(
    buildChainRecord('session_seal', useaiSessionId, {
      seal: sealData, seal_signature: sealSignature, recovered: true,
    }, endRecord.hash, daemonSigningKey),
  ) + '\n');

  // Move to sealed/
  try { renameSync(activePath, sealedPath); } catch { /* ignore */ }

  // Upsert seal into sessions index
  upsertSessionSeal({
    session_id: useaiSessionId, conversation_id: convId, conversation_index: convIdx,
    client, task_type: taskType, languages, files_touched: filesTouched,
    project: sessionProject, title: sessionTitle, private_title: sessionPrivateTitle,
    model: sessionModel,
    evaluation: evaluation ?? undefined,
    started_at: startTime, ended_at: now, duration_seconds: duration,
    heartbeat_count: heartbeatCount, record_count: recordCount + 1,
    chain_start_hash: firstRecord.prev_hash, chain_end_hash: endRecord.hash,
    seal_signature: sealSignature,
  });

  // Keep MCP mapping — recoverStartSession will overwrite it on next session

  const durationStr = formatDuration(duration);
  sendJsonRpcResult(res, rpcId,
    `Session ended (recovered): ${durationStr} ${taskType}` +
    (milestoneCount > 0 ? ` · ${milestoneCount} milestone${milestoneCount > 1 ? 's' : ''} recorded` : '') +
    (evaluation ? ` · eval: ${evaluation.task_outcome}` : ''));

  console.log(`Recovered useai_end for stale session ${useaiSessionId.slice(0, 8)} (MCP ${staleMcpSessionId.slice(0, 8)})`);
  return true;
}

/**
 * Attempt to recover ANY tool call for a stale MCP session.
 * Dispatches to specific recovery handlers based on the tool name.
 * Returns true if recovery was handled (response sent), false otherwise.
 */
function tryRecoverStaleSession(
  staleMcpSessionId: string,
  body: unknown,
  res: ServerResponse,
  req: IncomingMessage,
): boolean {
  try {
    const rpc = body as JsonRpcBody;
    if (rpc?.method !== 'tools/call') return false;

    const toolName = rpc.params?.name;
    const args = rpc.params?.arguments ?? {};
    const rpcId = rpc.id;

    switch (toolName) {
      case 'useai_start':
        return recoverStartSession(staleMcpSessionId, args, rpcId, res, req);
      case 'useai_heartbeat':
        return recoverHeartbeat(staleMcpSessionId, rpcId, res);
      case 'useai_end':
        return recoverEndSession(staleMcpSessionId, args, rpcId, res);
      default:
        return false;
    }
  } catch (err) {
    console.error('Stale session recovery failed:', (err as Error).message);
    return false;
  }
}

// ── EADDRINUSE resilience ──────────────────────────────────────────────────────

async function listenWithRetry(
  server: ReturnType<typeof createServer>,
  port: number,
  maxRetries = 3,
): Promise<void> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (err: Error) => {
          server.removeListener('listening', onListening);
          reject(err);
        };
        const onListening = () => {
          server.removeListener('error', onError);
          resolve();
        };
        server.once('error', onError);
        server.once('listening', onListening);
        server.listen(port, '127.0.0.1');
      });
      return; // Successfully listening
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;

      if (code !== 'EADDRINUSE') {
        console.error(`Server error: ${(err as Error).message}`);
        process.exit(0); // Clean exit to prevent service manager crash loop
      }

      console.log(`Port ${port} already in use (attempt ${attempt}/${maxRetries})`);

      // Check if the existing process is a healthy UseAI daemon
      const health = await fetchDaemonHealth(port);

      if (health && health['version'] === VERSION) {
        console.log(`Healthy daemon v${VERSION} already running on port ${port}, exiting cleanly`);
        process.exit(0); // Clean exit — service manager won't restart
      }

      if (attempt >= maxRetries) {
        console.log('All retry attempts exhausted, exiting cleanly to prevent crash loop');
        process.exit(0);
      }

      // Unhealthy or version mismatch — try to kill and retry
      console.log(`Killing existing process on port ${port}...`);
      await killDaemon();

      // Also kill by port in case PID file is stale
      const pids = findPidsByPort(port);
      for (const pid of pids) {
        if (pid !== process.pid) {
          try { process.kill(pid, 'SIGKILL'); } catch { /* ignore */ }
        }
      }

      // Wait for port to be released
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// ── Daemon entry point ─────────────────────────────────────────────────────────

export async function startDaemon(port?: number): Promise<void> {
  const listenPort = port ?? DAEMON_PORT;

  ensureDir();

  // Initialize daemon-level signing key for orphan sealing
  try {
    if (existsSync(KEYSTORE_FILE)) {
      const ks = readJson<Keystore | null>(KEYSTORE_FILE, null);
      if (ks) daemonSigningKey = decryptKeystore(ks);
    }
    if (!daemonSigningKey) {
      const result = generateKeystore();
      writeJson(KEYSTORE_FILE, result.keystore);
      daemonSigningKey = result.signingKey;
    }
  } catch { /* signing not available for orphan sealing */ }

  // Deduplicate sessions.json on startup (keeps richest entry per session_id)
  deduplicateSessionsIndex();

  // Seal any orphaned sessions left from a previous daemon crash/restart
  sealOrphanedSessions();

  // Periodic orphan sweep (every 15 minutes)
  const sweepInterval = setInterval(sealOrphanedSessions, ORPHAN_SWEEP_INTERVAL_MS);
  sweepInterval.unref();

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    // Health endpoint
    if (url.pathname === '/health' && req.method === 'GET') {
      handleHealth(res);
      return;
    }

    // Dashboard
    if ((url.pathname === '/' || url.pathname === '/dashboard') && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getDashboardHtml());
      return;
    }

    // Local API
    if (url.pathname.startsWith('/api/local/') && req.method === 'GET') {
      if (url.pathname === '/api/local/stats') { handleLocalStats(req, res); return; }
      if (url.pathname === '/api/local/sessions') { handleLocalSessions(req, res); return; }
      if (url.pathname === '/api/local/milestones') { handleLocalMilestones(req, res); return; }
      if (url.pathname === '/api/local/config') { handleLocalConfig(req, res); return; }
      if (url.pathname === '/api/local/update-check') { await handleUpdateCheck(res); return; }
    }
    if (url.pathname === '/api/local/sync' && req.method === 'POST') {
      await handleLocalSync(req, res);
      return;
    }
    if (url.pathname === '/api/local/auth/send-otp' && req.method === 'POST') {
      await handleLocalSendOtp(req, res);
      return;
    }
    if (url.pathname === '/api/local/auth/verify-otp' && req.method === 'POST') {
      await handleLocalVerifyOtp(req, res);
      return;
    }

    // Local API — DELETE
    if (url.pathname.startsWith('/api/local/') && req.method === 'DELETE') {
      const sessionMatch = url.pathname.match(/^\/api\/local\/sessions\/(.+)$/);
      if (sessionMatch) { handleDeleteSession(req, res, decodeURIComponent(sessionMatch[1]!)); return; }

      const convMatch = url.pathname.match(/^\/api\/local\/conversations\/(.+)$/);
      if (convMatch) { handleDeleteConversation(req, res, decodeURIComponent(convMatch[1]!)); return; }

      const milestoneMatch = url.pathname.match(/^\/api\/local\/milestones\/(.+)$/);
      if (milestoneMatch) { handleDeleteMilestone(req, res, decodeURIComponent(milestoneMatch[1]!)); return; }
    }

    // Seal UseAI data for active sessions (called by Claude Code SessionEnd hook).
    // Does NOT close MCP transports — the client may start a new session on the next prompt.
    if (url.pathname === '/api/seal-active' && req.method === 'POST') {
      let sealed = 0;
      for (const [, active] of sessions) {
        if (active.session.sessionRecordCount > 0 && !isSessionAlreadySealed(active.session)) {
          sealSessionData(active);
          sealed++;
        }
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ sealed }));
      return;
    }

    // CORS preflight
    if ((url.pathname.startsWith('/api/local/') || url.pathname === '/api/seal-active') && req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    // Only /mcp is routed beyond here
    if (url.pathname !== '/mcp') {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }

    try {
      if (req.method === 'POST') {
        const body = await parseBody(req);
        const sid = req.headers['mcp-session-id'] as string | undefined;

        if (sid && sessions.has(sid)) {
          // Existing session
          resetIdleTimer(sid);
          await sessions.get(sid)!.transport.handleRequest(req, res, body);
        } else if (sid && !sessions.has(sid)) {
          // Stale/unknown session ID — attempt recovery for any useai tool, else 404
          if (!tryRecoverStaleSession(sid, body, res, req)) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
              jsonrpc: '2.0',
              error: { code: -32000, message: 'Session not found' },
              id: null,
            }));
          }
        } else if (!sid && isInitializeRequest(body)) {
          // New session
          const sessionState = new SessionState();
          try {
            sessionState.initializeKeystore();
          } catch { /* signingAvailable remains false */ }

          const mcpServer = new McpServer({
            name: 'UseAI',
            version: VERSION,
          });

          registerTools(mcpServer, sessionState, {
            sealBeforeReset: () => {
              // Find the active session for this sessionState and seal it
              for (const [, active] of sessions) {
                if (active.session === sessionState) {
                  if (active.session.sessionRecordCount > 0 && !isSessionAlreadySealed(active.session)) {
                    autoSealSession(active);
                  }
                  break;
                }
              }
            },
          });

          const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (newSid: string) => {
              sessionState.mcpSessionId = newSid;

              const idleTimer = setTimeout(async () => {
                await cleanupSession(newSid);
              }, IDLE_TIMEOUT_MS);

              sessions.set(newSid, {
                transport,
                server: mcpServer,
                session: sessionState,
                idleTimer,
              });
            },
          });

          transport.onclose = () => {
            const closedSid = transport.sessionId;
            if (closedSid && sessions.has(closedSid)) {
              const active = sessions.get(closedSid)!;
              clearTimeout(active.idleTimer);
              autoSealSession(active);
              sessions.delete(closedSid);
            }
          };

          await mcpServer.connect(transport);
          await transport.handleRequest(req, res, body);
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
            id: null,
          }));
        }
      } else if (req.method === 'GET') {
        // SSE stream for server-initiated messages
        const sid = req.headers['mcp-session-id'] as string | undefined;
        if (!sid || !sessions.has(sid)) {
          res.writeHead(sid ? 404 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: sid ? 'Session not found' : 'Missing session ID' }));
          return;
        }
        resetIdleTimer(sid);
        await sessions.get(sid)!.transport.handleRequest(req, res);
      } else if (req.method === 'DELETE') {
        // Explicit session close
        const sid = req.headers['mcp-session-id'] as string | undefined;
        if (!sid || !sessions.has(sid)) {
          res.writeHead(sid ? 404 : 400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: sid ? 'Session not found' : 'Missing session ID' }));
          return;
        }
        await sessions.get(sid)!.transport.handleRequest(req, res);
      } else {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      }
    } catch (error) {
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        }));
      }
    }
  });

  // Graceful shutdown — register BEFORE listen so SIGTERM works during retry waits
  const shutdown = async (signal: string) => {
    // Seal active sessions — but skip those with MCP mappings (recoverable by useai_end)
    for (const [sid, active] of sessions) {
      if (active.session.mcpSessionId && active.session.sessionRecordCount > 0) {
        // This session has an MCP mapping — leave the chain file in active/
        // so the client can recover it via useai_end after restart.
        // Delete from map BEFORE closing transport to prevent the onclose
        // callback from auto-sealing the session.
        clearTimeout(active.idleTimer);
        sessions.delete(sid);
        try { await active.transport.close(); } catch { /* ignore */ }
      } else {
        await cleanupSession(sid);
      }
    }

    // Remove PID file
    try {
      if (existsSync(DAEMON_PID_FILE)) {
        unlinkSync(DAEMON_PID_FILE);
      }
    } catch { /* ignore */ }

    server.close(() => {
      process.exit(0);
    });

    // Force exit after 5 seconds if server.close hangs
    setTimeout(() => process.exit(0), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Listen with EADDRINUSE resilience
  await listenWithRetry(server, listenPort);

  // Write PID file AFTER successful listen (avoids stale PID file on bind failure)
  const pidData = JSON.stringify({
    pid: process.pid,
    port: listenPort,
    started_at: new Date().toISOString(),
  });
  writeFileSync(DAEMON_PID_FILE, pidData + '\n');

  console.log(`UseAI daemon listening on http://127.0.0.1:${listenPort}`);
  console.log(`PID: ${process.pid}`);
}