/**
 * Server-side stats computation — ported from dashboard/src/lib/stats.ts
 * Uses Session type from @devness/useai-types as the canonical session shape.
 */

import type { Session } from "@devness/useai-types";

// ── Backward-compat alias ────────────────────────────────────────────────────

/** @deprecated Use `Session` from `@devness/useai-types` directly */
export type SessionSeal = Session;

// ── Inlined display types ────────────────────────────────────────────────────

export interface Milestone {
  id: string;
  promptId: string;
  title: string;
  privateTitle?: string;
  project?: string;
  category: string;
  complexity: string;
  durationMinutes: number;
  languages: string[];
  client: string;
  createdAt: string;
  published: boolean;
  publishedAt: string | null;
  chainHash: string;
}

// ── Computed types ────────────────────────────────────────────────────────────

export interface ComputedStats {
  totalHours: number;
  totalSessions: number;
  /** Union of all active session intervals (idle-excluded) — real user time where at least 1 session was active (hours) */
  coveredHours: number;
  /** Ratio of total AI time to user time (totalHours / coveredHours). >= 1.0 always. */
  aiMultiplier: number;
  /** Maximum number of sessions running concurrently at any point */
  peakConcurrency: number;
  currentStreak: number;
  filesTouched: number;
  featuresShipped: number;
  bugsFixed: number;
  complexSolved: number;
  totalMilestones: number;
  completionRate: number;
  activeProjects: number;
  byToolClockTime: Record<string, number>;
  byLanguageClockTime: Record<string, number>;
  byTaskTypeClockTime: Record<string, number>;
  byProjectAiTime: Record<string, number>;
  /** Clock-time project breakdown via shared sweep-line */
  byProjectClock: Record<string, number>;
  /** Cumulative session duration breakdowns — no concurrency dedup */
  byAiToolDuration: Record<string, number>;
  byLanguageAiTime: Record<string, number>;
  byTaskTypeAiTime: Record<string, number>;
  /** Raw clock-time per tool — each session's full active time, no concurrency splitting */
  byToolRawClock: Record<string, number>;
  /** Raw clock-time per language — each session's full active time, no concurrency splitting */
  byLanguageRawClock: Record<string, number>;
  /** Raw clock-time per task type — each session's full active time, no concurrency splitting */
  byTaskTypeRawClock: Record<string, number>;
  /** Raw clock-time per project — each session's full active time, no concurrency splitting */
  byProjectRawClock: Record<string, number>;
}

export interface PromptGroup {
  prompt: Session;
  milestones: Milestone[];
}

/** A conversation is a group of prompts sharing the same connectionId */
export interface ConversationGroup {
  connectionId: string;
  prompts: PromptGroup[];
  /** Aggregate evaluation across all prompts in the conversation */
  aggregateEval: AggregateEvaluation | null;
  aiTime: number;
  totalMilestones: number;
  startedAt: string;
  endedAt: string;
  /** Start time of the most recent prompt (for display, matches child row times) */
  lastSessionAt: string;
}

export interface AggregateEvaluation {
  promptQuality: number;
  contextProvided: number;
  independenceLevel: number;
  scopeQuality: number;
  toolsLeveraged: number;
  promptCount: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert an ISO timestamp (or Date) to a local YYYY-MM-DD string */
function toLocalDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Module-level timestamp cache — avoids repeated new Date(iso).getTime()
const _tsCache = new Map<string, number>();
export function parseTimestamp(iso: string): number {
  let v = _tsCache.get(iso);
  if (v === undefined) {
    v = new Date(iso).getTime();
    _tsCache.set(iso, v);
  }
  return v;
}

/** Helper: get duration in seconds from a Session (durationMs → seconds) */
function durationSec(s: Session): number {
  return Math.round(s.durationMs / 1000);
}

// ── Milestone stats ───────────────────────────────────────────────────────────

export function computeMilestoneStats(milestones: Milestone[]): {
  featuresShipped: number;
  bugsFixed: number;
  complexSolved: number;
} {
  let featuresShipped = 0;
  let bugsFixed = 0;
  let complexSolved = 0;

  for (const m of milestones) {
    if (m.category === "feature") featuresShipped++;
    if (m.category === "bugfix") bugsFixed++;
    if (m.complexity === "complex") complexSolved++;
  }

  return { featuresShipped, bugsFixed, complexSolved };
}

// ── Clock-time breakdown (sweep-line) ─────────────────────────────────────────

/**
 * Sweep-line clock-time breakdown: distributes wall-clock time proportionally
 * among distinct active keys. When N keys are active concurrently, each gets
 * 1/N of the wall-clock slice.
 *
 * Uses activeSegments when available; falls back to
 * [startedAt, startedAt + durationMs] for older sessions.
 */
export function computeClockTimeBreakdown(
  prompts: Session[],
  getKeys: (s: Session) => string[],
): Record<string, number> {
  type Event = { time: number; key: string; delta: 1 | -1 };
  const events: Event[] = [];

  for (const s of prompts) {
    const keys = getKeys(s);
    if (keys.length === 0) continue;

    const sStart = parseTimestamp(s.startedAt);
    const sEnd = parseTimestamp(s.endedAt);
    if (sEnd <= sStart) continue;

    // Gather active time intervals
    const segments: [number, number][] = [];
    if (s.activeSegments && s.activeSegments.length > 0) {
      for (const [segStart, segEnd] of s.activeSegments) {
        const t0 = parseTimestamp(segStart);
        const t1 = parseTimestamp(segEnd);
        if (t1 > t0) segments.push([t0, t1]);
      }
    } else {
      // Backward compat: approximate with [start, start + duration]
      const activeDurationMs = s.durationMs;
      const activeEnd = Math.min(sStart + activeDurationMs, sEnd);
      if (activeEnd > sStart) segments.push([sStart, activeEnd]);
    }

    for (const [t0, t1] of segments) {
      for (const key of keys) {
        events.push({ time: t0, key, delta: 1 });
        events.push({ time: t1, key, delta: -1 });
      }
    }
  }

  //core time logic do not edit unless you know the flow thoroughly.(sweep happens here)
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);

  //Logic of count distribution(time taken by each language for ex.)
  const map: Record<string, number> = {};
  const activeCount: Record<string, number> = {};
  let prevTime = 0;

  for (const e of events) {
    const activeKeys = Object.keys(activeCount);
    if (activeKeys.length > 0 && e.time > prevTime) {
      const sliceMs = e.time - prevTime;
      const share = sliceMs / activeKeys.length;
      for (const k of activeKeys) {
        map[k] = (map[k] ?? 0) + share;
      }
    }

    prevTime = e.time;
    activeCount[e.key] = (activeCount[e.key] ?? 0) + e.delta;
    if (activeCount[e.key] === 0) delete activeCount[e.key];
  }

  //ms to seconds conversion.
  const result: Record<string, number> = {};
  for (const [key, ms] of Object.entries(map)) {
    if (ms > 0) result[key] = ms / 1000;
  }
  return result;
}

// ── Raw clock-time breakdown (no concurrency splitting) ──────────────────────

/**
 * Raw clock-time breakdown: each session's full active time is attributed
 * to every key it maps to. No sweep-line, no division between concurrent
 * sessions — each session's individual active time goes entirely to each key.
 *
 * Uses activeSegments when available; falls back to durationMs.
 */
/**
 * Raw clock breakdown: merges all overlapping segments within each key
 * (union per key), then sums the merged duration. No cross-key division.
 * Two sessions on the same project that overlap = counted once.
 * Two sessions on different projects that overlap = each gets full time.
 */
function computeRawClockBreakdown(
  sessions: Session[],
  getKeys: (s: Session) => string[],
): Record<string, number> {
  const keyIntervals: Record<string, [number, number][]> = {};

  for (const s of sessions) {
    const keys = getKeys(s);
    if (keys.length === 0) continue;

    const sStart = parseTimestamp(s.startedAt);
    const sEnd = parseTimestamp(s.endedAt);
    if (sEnd <= sStart) continue;

    const segments: [number, number][] = [];
    if (s.activeSegments && s.activeSegments.length > 0) {
      for (const [segStart, segEnd] of s.activeSegments) {
        const t0 = parseTimestamp(segStart);
        const t1 = parseTimestamp(segEnd);
        if (t1 > t0) segments.push([t0, t1]);
      }
    } else {
      const activeEnd = Math.min(sStart + s.durationMs, sEnd);
      if (activeEnd > sStart) segments.push([sStart, activeEnd]);
    }

    for (const key of keys) {
      if (!keyIntervals[key]) keyIntervals[key] = [];
      for (const seg of segments) keyIntervals[key].push(seg);
    }
  }

  const map: Record<string, number> = {};
  for (const [key, intervals] of Object.entries(keyIntervals)) {
    let totalMs = 0;
    for (const [s, e] of mergeIntervals(intervals)) {
      totalMs += e - s;
    }
    if (totalMs > 0) map[key] = totalMs / 1000;
  }
  return map;
}

// ── Main computeStats ─────────────────────────────────────────────────────────

export function computeStats(
  prompts: Session[],
  milestones: Milestone[] = [],
): ComputedStats {
  let totalSeconds = 0;
  let filesTouched = 0;
  const byProjectAiTime: Record<string, number> = {};
  const byAiToolDuration: Record<string, number> = {};
  const byLanguageAiTime: Record<string, number> = {};
  const byTaskTypeAiTime: Record<string, number> = {};

  //insights calculation, excluding milestone chart

  //Note converting durationMs to seconds.
  //AI time calculation
  for (const s of prompts) {
    const durSec = durationSec(s);
    totalSeconds += durSec;
    filesTouched += s.filesTouchedCount ?? 0;

    const project = s.project || "other";
    byProjectAiTime[project] = (byProjectAiTime[project] ?? 0) + durSec;

    byAiToolDuration[s.client] = (byAiToolDuration[s.client] ?? 0) + durSec;
    byTaskTypeAiTime[s.taskType] = (byTaskTypeAiTime[s.taskType] ?? 0) + durSec;

    const langs = (s.languages ?? []).map((l) => l.toLowerCase());
    if (langs.length > 0) {
      const share = durSec / langs.length;
      for (const lang of langs) {
        byLanguageAiTime[lang] = (byLanguageAiTime[lang] ?? 0) + share;
      }
    } else {
      byLanguageAiTime["other"] = (byLanguageAiTime["other"] ?? 0) + durSec;
    }
  }

  // Clock-time calculation, breakdowns via sweep-line (uses activeSegments, falls back to durationMs)
  const byToolClockTime = computeClockTimeBreakdown(prompts, (s) => [s.client]);
  const byLanguageClockTime = computeClockTimeBreakdown(prompts, (s) => {
    const langs = (s.languages ?? []).map((l) => l.toLowerCase());
    return langs.length > 0 ? langs : ["other"];
  });
  const byTaskTypeClockTime = computeClockTimeBreakdown(prompts, (s) => [
    s.taskType,
  ]);
  const byProjectClock = computeClockTimeBreakdown(prompts, (s) => [
    s.project || "other",
  ]);

  // Raw clock-time breakdowns (no concurrency splitting)
  const byToolRawClock = computeRawClockBreakdown(prompts, (s) => [s.client]);
  const byLanguageRawClock = computeRawClockBreakdown(prompts, (s) => {
    const langs = (s.languages ?? []).map((l) => l.toLowerCase());
    return langs.length > 0 ? langs : ["other"];
  });
  const byTaskTypeRawClock = computeRawClockBreakdown(prompts, (s) => [
    s.taskType,
  ]);
  const byProjectRawClock = computeRawClockBreakdown(prompts, (s) => [
    s.project || "other",
  ]);

  //prompts page calculations

  // Actual time span, covered time, and peak concurrency (sweep-line)
  let coveredHours = 0;
  let aiMultiplier = 0;
  let peakConcurrency = 0;

  if (prompts.length > 0) {
    const events: { time: number; delta: number }[] = [];

    for (const s of prompts) {
      const sStart = parseTimestamp(s.startedAt);
      const sEnd = parseTimestamp(s.endedAt);

      if (s.activeSegments && s.activeSegments.length > 0) {
        // Use actual active segments for accurate union
        for (const [segStart, segEnd] of s.activeSegments) {
          events.push({ time: parseTimestamp(segStart), delta: 1 });
          events.push({ time: parseTimestamp(segEnd), delta: -1 });
        }
      } else {
        // Fallback: approximate with [startedAt, startedAt + duration]
        const activeDurationMs = s.durationMs;
        const activeEnd = Math.min(sStart + activeDurationMs, sEnd);
        events.push({ time: sStart, delta: 1 });
        events.push({ time: activeEnd, delta: -1 });
      }
    }

    // Sort events: by time, then ends (-1) before starts (+1) at same timestamp
    events.sort((a, b) => a.time - b.time || a.delta - b.delta);
    let running = 0;
    let coveredMs = 0; // total time where at least 1 session was active
    let lastActiveStart = 0;
    for (const e of events) {
      const wasActive = running > 0;
      running += e.delta;
      if (running > peakConcurrency) peakConcurrency = running;

      if (!wasActive && running > 0) {
        // Transition from idle → active
        lastActiveStart = e.time;
      } else if (wasActive && running === 0) {
        // Transition from active → idle
        coveredMs += e.time - lastActiveStart;
      }
    }

    //1 hour is 3600000 milliseconds
    coveredHours = Math.round((coveredMs / 3600000) * 100) / 100;
    aiMultiplier = coveredHours > 0 ? Math.round((totalSeconds / 3600 / coveredHours) * 100) / 100 : 0;
  }

  const milestoneStats = computeMilestoneStats(milestones);

  // Completion rate from sessions with evaluations
  const evaluated = prompts.filter(
    (s) => s.evaluation && typeof s.evaluation === "object",
  );
  const completed = evaluated.filter(
    (s) => s.evaluation!.task_outcome === "completed",
  ).length;
  const completionRate =
    evaluated.length > 0 ? Math.round((completed / evaluated.length) * 100) : 0;

  // Active projects
  const activeProjects = Object.keys(byProjectAiTime).length;

  const dropZero = (rec: Record<string, number>) =>
    Object.fromEntries(
      Object.entries(rec)
        .filter(([, v]) => Math.round(v) > 0)
        .map(([k, v]) => [k, Math.round(v)]),
    );

  return {
    totalHours: Math.round((totalSeconds / 3600) * 100) / 100,
    totalSessions: prompts.length,
    coveredHours,
    aiMultiplier,
    peakConcurrency,
    currentStreak: calculateStreak(prompts),
    filesTouched: Math.round(filesTouched),
    ...milestoneStats,
    totalMilestones: milestones.length,
    completionRate,
    activeProjects,
    byToolClockTime: dropZero(byToolClockTime),
    byLanguageClockTime: dropZero(byLanguageClockTime),
    byTaskTypeClockTime: dropZero(byTaskTypeClockTime),
    byProjectAiTime: dropZero(byProjectAiTime),
    byProjectClock: dropZero(byProjectClock),
    byAiToolDuration: dropZero(byAiToolDuration),
    byLanguageAiTime: dropZero(byLanguageAiTime),
    byTaskTypeAiTime: dropZero(byTaskTypeAiTime),
    byToolRawClock: dropZero(byToolRawClock),
    byLanguageRawClock: dropZero(byLanguageRawClock),
    byTaskTypeRawClock: dropZero(byTaskTypeRawClock),
    byProjectRawClock: dropZero(byProjectRawClock),
  };
}

// ── Streak calculation ────────────────────────────────────────────────────────

export interface StreakOptions {
  /** Max number of weekday gaps allowed without breaking the streak. */
  freezesAllowed: number;
  /** Lookback bound for the streak walk and active-days window. */
  windowDays: number;
  /** When true, Saturday and Sunday gaps are free (no freeze consumed). */
  weekendFreezeFree: boolean;
}

export interface StreakResult {
  /** Current consecutive-day streak with freezes/weekend-forgiveness applied. */
  current: number;
  /** Longest streak ever observed under the same forgiveness rules. */
  longest: number;
  /** Freezes consumed by the current streak. */
  freezesUsed: number;
  /** Freezes still available for the current streak. */
  freezesRemaining: number;
  /** Number of distinct active days within the rolling window (soft-streak signal). */
  activeDaysInWindow: number;
  /** Echoes the window length used. */
  windowDays: number;
}

export const DEFAULT_STREAK_OPTIONS: StreakOptions = {
  freezesAllowed: 2,
  windowDays: 30,
  weekendFreezeFree: true,
};

function dayOfWeek(yyyymmdd: string): number {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return new Date(y!, m! - 1, d!).getDay();
}

function isWeekend(yyyymmdd: string): boolean {
  const dow = dayOfWeek(yyyymmdd);
  return dow === 0 || dow === 6;
}

function shiftDay(yyyymmdd: string, days: number): string {
  const [y, m, d] = yyyymmdd.split("-").map(Number);
  return toLocalDate(new Date(y!, m! - 1, d! + days));
}

function collectActiveDays(prompts: Session[]): Set<string> {
  const days = new Set<string>();
  for (const s of prompts) {
    if (s.startedAt && s.endedAt && s.durationMs > 0) {
      days.add(toLocalDate(s.startedAt));
    }
  }
  return days;
}

function computeLongestStreak(
  activeDays: Set<string>,
  opts: StreakOptions,
): number {
  if (activeDays.size === 0) return 0;
  const sorted = [...activeDays].sort();
  const start = sorted[0]!;
  const today = toLocalDate(new Date());

  let best = 0;
  let current = 0;
  let freezesUsed = 0;
  let day = start;
  while (day <= today) {
    if (activeDays.has(day)) {
      current++;
      if (current > best) best = current;
    } else if (opts.weekendFreezeFree && isWeekend(day)) {
      // Free skip — preserves run, doesn't extend it.
    } else if (freezesUsed < opts.freezesAllowed) {
      freezesUsed++;
    } else {
      current = 0;
      freezesUsed = 0;
    }
    day = shiftDay(day, 1);
  }
  return best;
}

/**
 * Forgiving streak with freezes and weekend forgiveness.
 *
 * Anchored on today or yesterday (1-day grace). Walks backward up to
 * `windowDays` days. Active days extend the streak. Weekend gaps are free
 * when `weekendFreezeFree`. Weekday gaps consume freezes until exhausted,
 * then the streak ends. `longest` is computed across all history under the
 * same rules, so it can never be lower than `current`.
 */
export function calculateStreakDetailed(
  prompts: Session[],
  options: Partial<StreakOptions> = {},
): StreakResult {
  const opts: StreakOptions = { ...DEFAULT_STREAK_OPTIONS, ...options };
  const activeDays = collectActiveDays(prompts);

  const today = toLocalDate(new Date());
  const yesterday = toLocalDate(new Date(Date.now() - 86400000));

  const windowStart = toLocalDate(
    new Date(Date.now() - (opts.windowDays - 1) * 86400000),
  );
  let activeDaysInWindow = 0;
  for (const day of activeDays) {
    if (day >= windowStart && day <= today) activeDaysInWindow++;
  }

  const longest = computeLongestStreak(activeDays, opts);

  let cursor: string | null = null;
  if (activeDays.has(today)) cursor = today;
  else if (activeDays.has(yesterday)) cursor = yesterday;

  if (cursor === null) {
    return {
      current: 0,
      longest,
      freezesUsed: 0,
      freezesRemaining: opts.freezesAllowed,
      activeDaysInWindow,
      windowDays: opts.windowDays,
    };
  }

  let current = 1;
  let freezesUsed = 0;
  // Freezes consumed since the last active day. They only "count" once a
  // subsequent active day folds them in — otherwise they were just trailing
  // padding past the real streak end and shouldn't be charged.
  let pendingFreezes = 0;
  for (let i = 1; i < opts.windowDays; i++) {
    cursor = shiftDay(cursor, -1);
    if (activeDays.has(cursor)) {
      current++;
      freezesUsed += pendingFreezes;
      pendingFreezes = 0;
      continue;
    }
    if (opts.weekendFreezeFree && isWeekend(cursor)) {
      continue;
    }
    if (freezesUsed + pendingFreezes < opts.freezesAllowed) {
      pendingFreezes++;
      continue;
    }
    break;
  }

  return {
    current,
    longest: Math.max(current, longest),
    freezesUsed,
    freezesRemaining: opts.freezesAllowed - freezesUsed,
    activeDaysInWindow,
    windowDays: opts.windowDays,
  };
}

/** Backward-compatible single-number streak. */
export function calculateStreak(prompts: Session[]): number {
  return calculateStreakDetailed(prompts).current;
}

// ── Window filtering ──────────────────────────────────────────────────────────

/** Count sessions that fall entirely outside a time window */
export function countSessionsOutsideWindow(
  allSessions: Session[],
  windowStart: number,
  windowEnd: number,
): { before: number; after: number } {
  let before = 0;
  let after = 0;
  for (const s of allSessions) {
    if (!s.endedAt || s.durationMs <= 0) continue;
    const sEnd = parseTimestamp(s.endedAt);
    const sStart = parseTimestamp(s.startedAt);
    if (sEnd < windowStart) before++;
    else if (sStart > windowEnd) after++;
  }
  return { before, after };
}

/** Filter sessions that overlap with a time window */
export function filterSessionsByWindow(
  sessions: Session[],
  start: number,
  end: number,
): Session[] {
  return sessions.filter((s) => {
    const sStart = parseTimestamp(s.startedAt);
    const sEnd = parseTimestamp(s.endedAt);
    return sStart <= end && sEnd >= start;
  });
}

/** Filter milestones by time window */
export function filterMilestonesByWindow(
  milestones: Milestone[],
  start: number,
  end: number,
): Milestone[] {
  return milestones.filter((m) => {
    const t = parseTimestamp(m.createdAt);
    return t >= start && t <= end;
  });
}

// ── Prompt grouping ──────────────────────────────────────────────────────────

/** Group ALL prompts with their milestones attached (empty array if none) */
export function groupPromptsWithMilestones(
  prompts: Session[],
  milestones: Milestone[],
): PromptGroup[] {
  const milestoneMap = new Map<string, Milestone[]>();
  for (const m of milestones) {
    const existing = milestoneMap.get(m.promptId);
    if (existing) {
      existing.push(m);
    } else {
      milestoneMap.set(m.promptId, [m]);
    }
  }

  const result: PromptGroup[] = prompts.map((prompt) => ({
    prompt: prompt,
    milestones: milestoneMap.get(prompt.promptId) ?? [],
  }));

  // Sort by session end time, most recent first
  result.sort(
    (a, b) =>
      parseTimestamp(b.prompt.endedAt) - parseTimestamp(a.prompt.endedAt),
  );

  return result;
}

/** Compute aggregate evaluation from multiple sessions */
export function computeAggregateEval(
  prompts: PromptGroup[],
): AggregateEvaluation | null {
  const withEval = prompts.filter((p) => p.prompt.evaluation);
  if (withEval.length === 0) return null;

  let promptSum = 0,
    contextSum = 0,
    indepSum = 0,
    scopeSum = 0,
    toolsSum = 0;
  for (const p of withEval) {
    const e = p.prompt.evaluation as unknown as Record<string, number>;
    promptSum += e["promptQuality"] ?? e["prompt_quality"] ?? 0;
    contextSum += e["contextProvided"] ?? e["context_provided"] ?? 0;
    indepSum += e["independenceLevel"] ?? e["independence_level"] ?? 0;
    scopeSum += e["scopeQuality"] ?? e["scope_quality"] ?? 0;
    toolsSum += e["toolsLeveraged"] ?? e["tools_leveraged"] ?? 0;
  }

  const n = withEval.length;
  return {
    //For rounding we are using 10 logic, scale is still 1-5
    promptQuality: Math.round((promptSum / n) * 10) / 10,
    contextProvided: Math.round((contextSum / n) * 10) / 10,
    independenceLevel: Math.round((indepSum / n) * 10) / 10,
    scopeQuality: Math.round((scopeSum / n) * 10) / 10,
    toolsLeveraged: Math.round(toolsSum / n),
    promptCount: n,
  };
}

/**
 * Group prompts into conversations by connectionId.
 *
 * Sessions originating from a stdio MCP transport (e.g. OpenCode) carry no
 * `mcp-session-id` header, so their `connectionId` is "". We can't group
 * them by transport, so each becomes its own single-prompt conversation
 * keyed by `prompt:<promptId>` — without this, the prompts feed would
 * silently drop every stdio-only client.
 */
export function groupIntoConversations(
  promptGroups: PromptGroup[],
): ConversationGroup[] {
  const convMap = new Map<string, PromptGroup[]>();

  for (const pg of promptGroups) {
    const key =
      pg.prompt.connectionId || `prompt:${pg.prompt.promptId}`;
    const existing = convMap.get(key);
    if (existing) {
      existing.push(pg);
    } else {
      convMap.set(key, [pg]);
    }
  }

  const result: ConversationGroup[] = [];

  for (const [key, prompts] of convMap) {
    // Sort prompts within conversation: latest first (descending by end time)
    prompts.sort(
      (a, b) =>
        parseTimestamp(b.prompt.endedAt) - parseTimestamp(a.prompt.endedAt),
    );

    const aiTime = prompts.reduce((sum, p) => sum + durationSec(p.prompt), 0);
    const totalMilestones = prompts.reduce(
      (sum, p) => sum + p.milestones.length,
      0,
    );
    // First element is now the latest prompt (descending order)
    const startedAt = prompts[prompts.length - 1]!.prompt.startedAt;
    const endedAt = prompts[0]!.prompt.endedAt;
    const lastSessionAt = prompts[0]!.prompt.endedAt;

    result.push({
      connectionId: key,
      prompts,
      aggregateEval: computeAggregateEval(prompts),
      aiTime,
      totalMilestones,
      startedAt,
      endedAt,
      lastSessionAt,
    });
  }

  result.sort(
    (a, b) => parseTimestamp(b.lastSessionAt) - parseTimestamp(a.lastSessionAt),
  );

  return result;
}

// ── Time context label ────────────────────────────────────────────────────────

/** Get a human-readable label for the current time window */
export function getTimeContextLabel(
  windowStart: number,
  windowEnd: number,
  isLive: boolean,
): string {
  if (isLive) return "Live";

  const midpoint = (windowStart + windowEnd) / 2;
  const midDate = new Date(midpoint);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  if (midDate.toDateString() === today.toDateString()) return "Today";
  if (midDate.toDateString() === yesterday.toDateString()) return "Yesterday";

  return midDate.toLocaleDateString([], { month: "short", day: "numeric" });
}

// ── Interval helpers ──────────────────────────────────────────────────────────

/** Merge overlapping/adjacent time intervals into non-overlapping spans */
export function mergeIntervals(
  intervals: [number, number][],
): [number, number][] {
  if (intervals.length === 0) return [];
  intervals.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [intervals[0]!];
  for (let i = 1; i < intervals.length; i++) {
    const [start, end] = intervals[i]!;
    const last = merged[merged.length - 1]!;
    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }
  return merged;
}

/** Collect active intervals for a session, clamped to a time window.
 *  Uses activeSegments when available; falls back to duration-capped range. */
export function collectSessionIntervals(
  s: Session,
  windowStart: number,
  windowEnd: number,
): [number, number][] {
  const sStart = parseTimestamp(s.startedAt);
  const sEnd = parseTimestamp(s.endedAt);
  const intervals: [number, number][] = [];

  if (s.activeSegments && s.activeSegments.length > 0) {
    for (const [segStart, segEnd] of s.activeSegments) {
      const t0 = parseTimestamp(segStart);
      const t1 = parseTimestamp(segEnd);
      if (t1 <= t0 || t1 < windowStart || t0 > windowEnd) continue;
      intervals.push([Math.max(t0, windowStart), Math.min(t1, windowEnd)]);
    }
  } else {
    // Backward compat: cap to [start, start + duration] to avoid inflation
    const durationMs = s.durationMs ?? 0;
    const wallClockMs = sEnd - sStart;
    const gapThresholdMs = 10 * 60 * 1000;

    if (durationMs === 0 && wallClockMs > gapThresholdMs) return [];

    const effectiveEnd =
      durationMs > 0 && wallClockMs > durationMs + gapThresholdMs
        ? sStart + durationMs
        : sEnd;

    if (
      effectiveEnd <= sStart ||
      effectiveEnd < windowStart ||
      sStart > windowEnd
    )
      return [];
    intervals.push([
      Math.max(sStart, windowStart),
      Math.min(effectiveEnd, windowEnd),
    ]);
  }

  return intervals;
}

// ── Activity charts ───────────────────────────────────────────────────────────

/** Get hourly activity for a given day — returns 24 entries with minutes per hour */
export function getHourlyActivity(
  sessions: Session[],
  date: string,
): { hour: number; minutes: number }[] {
  const dayStart = new Date(`${date}T00:00:00`).getTime();
  const dayEnd = dayStart + 86400000;

  const result: { hour: number; minutes: number }[] = [];
  for (let h = 0; h < 24; h++) {
    result.push({ hour: h, minutes: 0 });
  }

  const intervals: [number, number][] = [];
  for (const s of sessions) {
    intervals.push(...collectSessionIntervals(s, dayStart, dayEnd));
  }

  for (const [clampedStart, clampedEnd] of mergeIntervals(intervals)) {
    for (let h = 0; h < 24; h++) {
      const hourStart = dayStart + h * 3600000;
      const hourEnd = hourStart + 3600000;
      const overlapStart = Math.max(clampedStart, hourStart);
      const overlapEnd = Math.min(clampedEnd, hourEnd);
      if (overlapEnd > overlapStart) {
        result[h]!.minutes += (overlapEnd - overlapStart) / 60000;
      }
    }
  }

  return result;
}

/** Get daily hours for last N days — uses activeSegments with backward compat */
export function getDailyActivity(
  sessions: Session[],
  days: number,
): { date: string; hours: number }[] {
  const now = new Date();
  const result: { date: string; hours: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = toLocalDate(d);
    const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
    const dayEnd = dayStart + 86400000;

    const intervals: [number, number][] = [];
    for (const s of sessions) {
      intervals.push(...collectSessionIntervals(s, dayStart, dayEnd));
    }

    let totalMs = 0;
    for (const [start, end] of mergeIntervals(intervals)) {
      totalMs += end - start;
    }

    result.push({ date: dateStr, hours: totalMs / 3600000 });
  }

  return result;
}

/** AI-time hourly activity — sums durationMs per hour (no dedup) */
export function getHourlyActivityAI(
  sessions: Session[],
  date: string,
): { hour: number; minutes: number }[] {
  const dayStart = new Date(`${date}T00:00:00`).getTime();
  const dayEnd = dayStart + 86400000;

  const result: { hour: number; minutes: number }[] = [];
  for (let h = 0; h < 24; h++) {
    result.push({ hour: h, minutes: 0 });
  }

  for (const s of sessions) {
    const sStart = parseTimestamp(s.startedAt);
    if (sStart < dayStart || sStart >= dayEnd) continue;
    const hour = new Date(sStart).getHours();
    result[hour]!.minutes += s.durationMs / 60000;
  }

  return result;
}

/** AI-time daily activity — sums durationMs per day (no dedup) */
export function getDailyActivityAI(
  sessions: Session[],
  days: number,
): { date: string; hours: number }[] {
  const now = new Date();
  const result: { date: string; hours: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = toLocalDate(d);

    let ms = 0;
    for (const s of sessions) {
      if (toLocalDate(s.startedAt) === dateStr) {
        ms += s.durationMs;
      }
    }

    result.push({ date: dateStr, hours: ms / 3600000 });
  }

  return result;
}
