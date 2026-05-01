import type { Session, UseaiConfig } from "@devness/useai-types";
import { getDaemonUrl } from "@devness/useai-storage/config";
import { apiFetch } from "./api-client.js";
import type { SanitizedSession, SyncPayload, SyncResult } from "./types.js";

// ---------------------------------------------------------------------------
// Sanitization — builds session for sync based on settings toggles.
// Each section matches a toggle in the dashboard settings UI.
// Fields listed here match the (i) info tooltips exactly.
// ---------------------------------------------------------------------------

function sanitizeSession(
  session: Session,
  sync: UseaiConfig["sync"],
): SanitizedSession {
  // ── Always sent ───────────────────────────────────
  const result: Record<string, unknown> = {
    promptId: session.promptId,
    connectionId: session.connectionId,
    client: session.client,
    taskType: session.taskType,
    title: session.title,
    model: session.model,
    startedAt: session.startedAt,
    endedAt: session.endedAt,
    durationMs: session.durationMs,
    languages: session.languages,
    filesTouchedCount: session.filesTouchedCount,
    activeSegments: session.activeSegments,
    promptImageCount: session.promptImageCount,
    prevHash: session.prevHash,
    hash: session.hash,
    signature: session.signature,
  };

  // ── Evaluation (scores always sent, reasons controlled by evaluationReasons) ─
  if (session.evaluation) {
    const ev = session.evaluation as unknown as Record<string, unknown>;
    const evalObj: Record<string, unknown> = {
      promptQuality: ev["promptQuality"],
      contextProvided: ev["contextProvided"],
      scopeQuality: ev["scopeQuality"],
      independenceLevel: ev["independenceLevel"],
      taskOutcome: ev["taskOutcome"],
      iterationCount: ev["iterationCount"],
      toolsLeveraged: ev["toolsLeveraged"],
    };

    if (sync.evaluationReasons === "all") {
      evalObj["promptQualityReason"] = ev["promptQualityReason"];
      evalObj["contextProvidedReason"] = ev["contextProvidedReason"];
      evalObj["scopeQualityReason"] = ev["scopeQualityReason"];
      evalObj["independenceLevelReason"] = ev["independenceLevelReason"];
      evalObj["taskOutcomeReason"] = ev["taskOutcomeReason"];
      evalObj["promptQualityIdeal"] = ev["promptQualityIdeal"];
      evalObj["contextProvidedIdeal"] = ev["contextProvidedIdeal"];
      evalObj["scopeQualityIdeal"] = ev["scopeQualityIdeal"];
      evalObj["independenceLevelIdeal"] = ev["independenceLevelIdeal"];
      evalObj["taskOutcomeIdeal"] = ev["taskOutcomeIdeal"];
    } else if (sync.evaluationReasons === "belowPerfect") {
      const pq = ev["promptQuality"] as number;
      const cp = ev["contextProvided"] as number;
      const sq = ev["scopeQuality"] as number;
      const il = ev["independenceLevel"] as number;
      if (pq < 5) { evalObj["promptQualityReason"] = ev["promptQualityReason"]; evalObj["promptQualityIdeal"] = ev["promptQualityIdeal"]; }
      if (cp < 5) { evalObj["contextProvidedReason"] = ev["contextProvidedReason"]; evalObj["contextProvidedIdeal"] = ev["contextProvidedIdeal"]; }
      if (sq < 5) { evalObj["scopeQualityReason"] = ev["scopeQualityReason"]; evalObj["scopeQualityIdeal"] = ev["scopeQualityIdeal"]; }
      if (il < 5) { evalObj["independenceLevelReason"] = ev["independenceLevelReason"]; evalObj["independenceLevelIdeal"] = ev["independenceLevelIdeal"]; }
      if (ev["taskOutcome"] !== "completed") { evalObj["taskOutcomeReason"] = ev["taskOutcomeReason"]; }
    }

    result["evaluation"] = evalObj;
  }

  // ── Milestones (always synced, only visible to owner) ──────────────────
  if (session.milestones) {
    result["milestones"] = session.milestones;
  }

  // ── Private details (always synced, only visible to owner on web) ────
  // Fields: privateTitle, project
  result["privateTitle"] = session.privateTitle;
  result["project"] = session.project;

  return result as unknown as SanitizedSession;
}

// ---------------------------------------------------------------------------
// Group by date
// ---------------------------------------------------------------------------

function groupByDate(
  sessions: SanitizedSession[],
): Map<string, SanitizedSession[]> {
  const byDate = new Map<string, SanitizedSession[]>();
  for (const s of sessions) {
    const date = s.startedAt.slice(0, 10);
    const arr = byDate.get(date);
    if (arr) arr.push(s);
    else byDate.set(date, [s]);
  }
  return byDate;
}

// ---------------------------------------------------------------------------
// Daemon aggregations response shape (subset we use)
// ---------------------------------------------------------------------------

interface DaemonStats {
  totalHours: number;
  coveredHours: number;
  aiMultiplier: number;
  currentStreak: number;
  byAiToolDuration: Record<string, number>;
  byLanguageAiTime: Record<string, number>;
  byTaskTypeAiTime: Record<string, number>;
}

interface DaemonAggregationsResponse {
  stats: DaemonStats;
  sessionCount: number;
}

/** Fetch aggregated stats for a single date from the daemon. */
async function fetchDaemonAggregations(
  date: string,
): Promise<DaemonAggregationsResponse | null> {
  const start = `${date}T00:00:00.000Z`;
  const end = `${date}T23:59:59.999Z`;
  const params = new URLSearchParams({ start, end });

  try {
    const daemonUrl = await getDaemonUrl();
    const res = await fetch(`${daemonUrl}/api/local/aggregations?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    return (await res.json()) as DaemonAggregationsResponse;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch sessions from daemon
// ---------------------------------------------------------------------------

async function fetchSessionsFromDaemon(days: number): Promise<Session[]> {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - days);
  const start = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, "0")}-${String(startDate.getDate()).padStart(2, "0")}T00:00:00.000Z`;
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T23:59:59.999Z`;
  const daemonUrl = await getDaemonUrl();
  const all: Session[] = [];
  let offset = 0;
  const limit = 50;

  while (true) {
    const params = new URLSearchParams({
      start,
      end,
      offset: String(offset),
      limit: String(limit),
    });
    const res = await fetch(`${daemonUrl}/api/local/prompts?${params}`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) break;
    const json = (await res.json()) as {
      conversations: Array<{ prompts: Array<{ prompt: Session; milestones: unknown[] }> }>;
      hasMore: boolean;
    };
    for (const conv of json.conversations) {
      for (const pg of conv.prompts) {
        const session = pg.prompt;
        if (pg.milestones && pg.milestones.length > 0) {
          (session as unknown as Record<string, unknown>)["milestones"] = pg.milestones;
        }
        all.push(session);
      }
    }
    if (!json.hasMore) break;
    offset += limit;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Main sync
// ---------------------------------------------------------------------------

export async function syncPrompts(
  token: string,
  config: UseaiConfig,
  days?: number,
): Promise<SyncResult> {
  const result: SyncResult = { synced: 0, skipped: 0, errors: 0, dates: [] };

  const sessions = await fetchSessionsFromDaemon(days ?? 180);

  if (sessions.length === 0) return result;

  // Sanitize (strip private data based on user's privacy settings)
  const sanitized = sessions.map((s) => sanitizeSession(s, config.sync));

  // Group by date for per-day cloud sync
  const byDate = groupByDate(sanitized);

  // Fetch streak once (same value regardless of date)
  const today = new Date().toISOString().slice(0, 10);
  const streakAgg = await fetchDaemonAggregations(today);
  const streakDays = streakAgg?.stats.currentStreak ?? 0;

  // Build all payloads first, then send in one batch request
  const payloads: SyncPayload[] = [];

  for (const [date, daySessions] of byDate) {
    payloads.push({
      date,
      streakDays,
      sessions: daySessions,
    });
  }

  // Send all payloads in a single batch request
  const totalSessions = payloads.reduce((n, p) => n + p.sessions.length, 0);

  const batchRes = await apiFetch<{
    synced?: boolean;
    results?: Array<{ synced?: boolean; sessions_inserted?: number }>;
  }>("/api/sync", {
    method: "POST",
    token,
    body: payloads,
  });

  result.payload = payloads;

  if (batchRes.ok) {
    result.synced += totalSessions;
    for (const p of payloads) {
      result.dates.push({ date: p.date, sessions: p.sessions.length });
    }
  } else {
    console.error(
      `[sync] Batch failed: ${batchRes.error} (status ${batchRes.status})`,
    );
    result.errors += totalSessions;
  }

  return result;
}

