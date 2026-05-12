import { randomUUID } from "node:crypto";

/** Idle gap threshold: gaps longer than this between heartbeats are counted as idle time. */
export const IDLE_GAP_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

/** Default timeout for acquiring the chain lock (ms). */
const CHAIN_LOCK_TIMEOUT_MS = 10_000;

export class ChainLockTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Chain lock acquisition timed out after ${timeoutMs}ms`);
    this.name = "ChainLockTimeoutError";
  }
}

/**
 * Async mutex that serializes access to the hash chain head (prevHash).
 * Guarantees zero collision even when multiple useai_end calls are in flight.
 */
export class ChainLock {
  private _queue: Array<{
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  private _locked = false;

  async acquire(timeoutMs: number = CHAIN_LOCK_TIMEOUT_MS): Promise<void> {
    if (!this._locked) {
      this._locked = true;
      return;
    }
    return new Promise<void>((resolve, reject) => {
      const entry = { resolve, reject };
      this._queue.push(entry);

      const timer = setTimeout(() => {
        const idx = this._queue.indexOf(entry);
        if (idx !== -1) {
          this._queue.splice(idx, 1);
          reject(new ChainLockTimeoutError(timeoutMs));
        }
      }, timeoutMs);

      // Allow the process to exit cleanly (e.g. SIGTERM) without waiting for this timeout
      if (typeof timer === "object" && "unref" in timer) timer.unref();

      const originalResolve = entry.resolve;
      entry.resolve = () => {
        clearTimeout(timer);
        originalResolve();
      };
    });
  }

  release(): void {
    const next = this._queue.shift();
    if (next) {
      next.resolve();
    } else {
      this._locked = false;
    }
  }
}

/**
 * Global registry of active child sessions keyed by promptId.
 * Child sessions are registered here when created so they remain findable
 * even after the parent's concurrentChildren map is reset by a new root useai_start.
 */
export const globalSessionRegistry = new Map<string, PromptContext>();

export interface PromptContext {
  promptId: string;
  connectionId: string;
  /**
   * Host name from the MCP initialize handshake — the IDE the transport
   * reports itself as ("windsurf", "claude-code", "opencode", ...). Set
   * once when the MCP handshake completes (HTTP: via
   * server.server.oninitialized in connection-factory; stdio: via the same
   * hook in cli/commands/mcp). Tool handlers prefer this over the
   * LLM-supplied `client` argument because the agent has no reliable way
   * to know which IDE it's running inside and routinely hallucinates the
   * value (e.g. Claude-in-Windsurf reports "claude-code").
   */
  mcpClientName?: string;
  prevHash: string;
  /** Mutex that serializes hash chain reads + writes across concurrent useai_end calls. */
  chainLock: ChainLock;
  startedAt: Date | null;
  /** Timestamp (ms) of the last heartbeat call. Null if no heartbeat has fired yet. */
  lastActivityTime: number | null;
  /** Accumulated idle ms detected via heartbeat gaps. */
  idleMs: number;
  /** Active time segments as [startMs, endMs] pairs. Used for accurate User Time union in dashboard. */
  activeSegments: [number, number][];
  client: string;
  taskType: string;
  title: string | null;
  privateTitle: string | null;
  project: string | null;
  model: string | null;
  prompt: string | null;
  promptImages: Array<{ type: "image"; description: string }> | null;
  // ---- v3: session nesting ----
  /** @deprecated Use concurrentChildren + activeChildStack instead. Kept for type compat. */
  parentStack: SavedPromptContext[];
  /** Total milliseconds spent in child sessions — subtracted from this session's duration. */
  childPausedMs: number;
  /** 0 = root session, 1+ = nested child. */
  sessionDepth: number;
  // ---- v3.1: concurrent child sessions ----
  /** Map of concurrent child sessions, keyed by promptId. */
  concurrentChildren: Map<string, PromptContext>;
}

/**
 * Snapshot of a parent PromptContext saved before a child session starts.
 * @deprecated Kept for type compatibility. New code uses concurrentChildren map.
 */
export interface SavedPromptContext {
  promptId: string;
  connectionId: string;
  prevHash: string;
  startedAt: Date;
  lastActivityTime: number | null;
  idleMs: number;
  activeSegments: [number, number][];
  client: string;
  taskType: string;
  title: string | null;
  privateTitle: string | null;
  project: string | null;
  model: string | null;
  prompt: string | null;
  promptImages: Array<{ type: "image"; description: string }> | null;
  childPausedMs: number;
  /** Wall-clock ms when this parent was paused (child started). */
  pausedAt: number;
}

export function createPromptContext(): PromptContext {
  return {
    promptId: `prompt_${randomUUID()}`,
    connectionId: "",
    prevHash: "0".repeat(64),
    chainLock: new ChainLock(),
    startedAt: null,
    lastActivityTime: null,
    idleMs: 0,
    activeSegments: [],
    client: "",
    taskType: "",
    title: null,
    privateTitle: null,
    project: null,
    model: null,
    prompt: null,
    promptImages: null,
    parentStack: [],
    childPausedMs: 0,
    sessionDepth: 0,
    concurrentChildren: new Map(),
  };
}

/**
 * Create a child PromptContext for a concurrent nested session.
 * The child inherits connection/chain/client from the parent but gets its own tracking state.
 */
export function createChildContext(
  parent: PromptContext,
  overrides: {
    client?: string | undefined;
    taskType?: string | undefined;
    title?: string | null | undefined;
    privateTitle?: string | null | undefined;
    project?: string | null | undefined;
    model?: string | null | undefined;
    prompt?: string | null | undefined;
    promptImages?:
      | Array<{ type: "image"; description: string }>
      | null
      | undefined;
  },
): PromptContext {
  const now = new Date();
  return {
    promptId: `prompt_${randomUUID()}`,
    connectionId: parent.connectionId,
    ...(parent.mcpClientName && { mcpClientName: parent.mcpClientName }),
    prevHash: "", // resolved at seal time from ctx.prevHash — not used at spawn
    chainLock: parent.chainLock, // children share the parent's lock — same chain head
    startedAt: now,
    lastActivityTime: null,
    idleMs: 0,
    activeSegments: [[now.getTime(), now.getTime()]],
    client: overrides.client ?? parent.client,
    taskType: overrides.taskType ?? "other",
    title: overrides.title ?? null,
    privateTitle: overrides.privateTitle ?? null,
    project: overrides.project ?? parent.project,
    model: overrides.model ?? parent.model,
    prompt: overrides.prompt ?? null,
    promptImages: overrides.promptImages ?? null,
    parentStack: [],
    childPausedMs: 0,
    sessionDepth: parent.sessionDepth + 1,
    concurrentChildren: new Map(),
  };
}

/**
 * Resolve which session context to operate on.
 * - If sessionId is provided, look it up in the root's concurrentChildren map.
 * - If not provided, return the most recently started child (top of activeChildStack),
 *   or the root ctx itself if no children are active.
 */
export function resolveSession(
  rootCtx: PromptContext,
  promptId?: string,
): PromptContext | null {
  if (promptId) {
    if (rootCtx.promptId === promptId) return rootCtx;
    const child = rootCtx.concurrentChildren.get(promptId);
    if (child) return child;
    // Fall back to global registry for orphaned children (e.g. parent was reset by a new root session)
    return globalSessionRegistry.get(promptId) ?? null;
  } else return null;
}

/**
 * Remove a finished child session from the root context's tracking.
 * Accumulates child duration into root's childPausedMs and updates prevHash for chain continuity.
 */
export function removeChildSession(
  rootCtx: PromptContext,
  childId: string,
  childDurationMs: number,
): void {
  rootCtx.concurrentChildren.delete(childId);
  rootCtx.childPausedMs += childDurationMs;
  // Reset lastActivityTime so the parent doesn't see the child's duration as idle
  rootCtx.lastActivityTime = Date.now();
}

/**
 * Return the IDs of all active sessions (root + concurrent children).
 * Used to protect sessions from orphan sweeps.
 */
export function getActiveSessionIds(ctx: PromptContext): string[] {
  return [ctx.promptId, ...ctx.concurrentChildren.keys()];
}

/** @deprecated Use getActiveSessionIds instead. Kept for export compat. */
export function getParentSessionIds(ctx: PromptContext): string[] {
  return [...ctx.concurrentChildren.keys()];
}

/**
 * @deprecated Use createChildContext + concurrentChildren map instead.
 * Kept for reference — no longer called by tools.
 */
export function saveParentState(ctx: PromptContext): void {
  const saved: SavedPromptContext = {
    promptId: ctx.promptId,
    connectionId: ctx.connectionId,
    prevHash: ctx.prevHash,
    startedAt: ctx.startedAt!,
    lastActivityTime: ctx.lastActivityTime,
    idleMs: ctx.idleMs,
    activeSegments: ctx.activeSegments,
    client: ctx.client,
    taskType: ctx.taskType,
    title: ctx.title,
    privateTitle: ctx.privateTitle,
    project: ctx.project,
    model: ctx.model,
    prompt: ctx.prompt,
    promptImages: ctx.promptImages,
    childPausedMs: ctx.childPausedMs,
    pausedAt: Date.now(),
  };
  ctx.parentStack.push(saved);
}

/**
 * @deprecated Use removeChildSession instead.
 * Kept for reference — no longer called by tools.
 */
export function restoreParentState(
  ctx: PromptContext,
  childDurationMs: number,
  childHash: string,
): void {
  const saved = ctx.parentStack.pop();
  if (!saved) return;

  const now = Date.now();
  const pausedGapMs = now - saved.pausedAt;

  ctx.promptId = saved.promptId;
  ctx.connectionId = saved.connectionId;
  ctx.prevHash = childHash;
  ctx.startedAt = saved.startedAt;
  ctx.lastActivityTime = now;
  ctx.idleMs = saved.idleMs + pausedGapMs;
  ctx.activeSegments = saved.activeSegments;
  ctx.client = saved.client;
  ctx.taskType = saved.taskType;
  ctx.title = saved.title;
  ctx.privateTitle = saved.privateTitle;
  ctx.project = saved.project;
  ctx.model = saved.model;
  ctx.prompt = saved.prompt;
  ctx.promptImages = saved.promptImages;
  ctx.childPausedMs = saved.childPausedMs + childDurationMs;
  ctx.sessionDepth--;
}

/**
 * Record activity at the given timestamp (defaults to now).
 * If the gap since the last activity exceeds the idle threshold, the gap is
 * accumulated as idle time and the current active segment is closed.
 * Used by both the heartbeat tool and useai_end.
 */
export function touchActivity(
  ctx: PromptContext,
  now: number = Date.now(),
): void {
  const baseline = ctx.lastActivityTime || ctx.startedAt?.getTime() || 0;
  const gap = now - baseline;
  if (gap > IDLE_GAP_THRESHOLD_MS) {
    ctx.idleMs += gap;
    // Close the current segment at the last known activity time
    if (ctx.activeSegments.length > 0) {
      const last = ctx.activeSegments[ctx.activeSegments.length - 1]!;
      last[1] = baseline;
    }
    // Start a new segment at the current time
    ctx.activeSegments.push([now, now]);
  } else if (ctx.activeSegments.length > 0) {
    // Extend the current segment
    ctx.activeSegments[ctx.activeSegments.length - 1]![1] = now;
  }

  ctx.lastActivityTime = now;
}

/**
 * Return finalized active segments as ISO pairs for storage.
 * Ensures the last segment is closed at the given end time.
 */
export function finalizeActiveSegments(ctx: PromptContext): [string, string][] {
  return ctx.activeSegments.map(([start, end]) => [
    new Date(start).toISOString(),
    new Date(end).toISOString(),
  ]);
}

/**
 * Compute honest active duration, excluding idle gaps and child session time.
 */
export function getActiveDurationMs(
  startedAt: Date,
  lastActivityTime: number | null,
  idleMs: number,
  childPausedMs: number,
): number {
  const durationMs =
    (lastActivityTime ?? startedAt.getTime()) - startedAt.getTime();
  return Math.max(0, durationMs - idleMs - childPausedMs);
}
