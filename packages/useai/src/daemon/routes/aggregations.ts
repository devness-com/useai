import { Hono } from "hono";
import type { Session } from "@devness/useai-types";
import {
  parseTimeRange,
  getFilteredSessions,
  toEnrichedMilestones,
} from "../lib/sessions.js";
import {
  computeStats,
  calculateStreakDetailed,
  getHourlyActivity,
  getHourlyActivityAI,
  collectSessionIntervals,
  mergeIntervals,
} from "../lib/stats.js";

export const aggregationsRoutes = new Hono();

// ── Projection helpers ───────────────────────────────────────────────────────

function toSessionSummary(s: Session) {
  return {
    promptId: s.promptId,
    client: s.client,
    taskType: s.taskType,
    title: s.title,
    ...(s.privateTitle && { privateTitle: s.privateTitle }),
    ...(s.project && { project: s.project }),
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    durationMs: s.durationMs,
    languages: s.languages ?? [],
    ...(s.activeSegments && { activeSegments: s.activeSegments }),
  };
}



// ── Helpers ──────────────────────────────────────────────────────────────────

function avg<T>(items: T[], fn: (item: T) => number): number {
  if (items.length === 0) return 0;
  return (
    Math.round((items.reduce((s, i) => s + fn(i), 0) / items.length) * 10) / 10
  );
}

function countBy<T>(
  items: T[],
  fn: (item: T) => string,
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const item of items) {
    const key = fn(item);
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
}

function toLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Compute daily clock-time activity for each day in the window */
function computeDailyClockTime(
  sessions: Session[],
  windowStart: string,
  windowEnd: string,
): { date: string; hours: number }[] {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const result: { date: string; hours: number }[] = [];

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const dateStr = toLocalDate(d);
    const dayStart = new Date(`${dateStr}T00:00:00`).getTime();
    const dayEnd = dayStart + 86400000;

    const intervals: [number, number][] = [];
    for (const s of sessions) {
      intervals.push(...collectSessionIntervals(s, dayStart, dayEnd));
    }

    let totalMs = 0;
    for (const [s, e] of mergeIntervals(intervals)) {
      totalMs += e - s;
    }

    result.push({ date: dateStr, hours: totalMs / 3600000 });
  }

  return result;
}

/** Compute daily AI-time activity for each day in the window */
function computeDailyAiTime(
  sessions: Session[],
  windowStart: string,
  windowEnd: string,
): { date: string; hours: number }[] {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const result: { date: string; hours: number }[] = [];

  for (let d = new Date(start); d < end; d.setDate(d.getDate() + 1)) {
    const dateStr = toLocalDate(d);

    let ms = 0;
    for (const s of sessions) {
      const sDate = toLocalDate(new Date(s.startedAt));
      if (sDate === dateStr) {
        ms += s.durationMs;
      }
    }

    result.push({ date: dateStr, hours: ms / 3600000 });
  }

  return result;
}

/** Compute weekly clock-time activity for weeks in the window */
function computeWeeklyClockTime(
  sessions: Session[],
  windowStart: string,
  windowEnd: string,
): { label: string; hours: number }[] {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const now = new Date();
  const result: { label: string; hours: number }[] = [];
  let week = 1;

  for (let d = new Date(start); d < end && d <= now; d.setDate(d.getDate() + 7)) {
    const wStart = new Date(`${toLocalDate(d)}T00:00:00`).getTime();
    const wEndDate = new Date(d);
    wEndDate.setDate(wEndDate.getDate() + 7);
    const wEnd = Math.min(wEndDate.getTime(), end.getTime());

    const intervals: [number, number][] = [];
    for (const s of sessions) {
      intervals.push(...collectSessionIntervals(s, wStart, wEnd));
    }

    let totalMs = 0;
    for (const [s, e] of mergeIntervals(intervals)) {
      totalMs += e - s;
    }

    result.push({ label: `W${week}`, hours: totalMs / 3600000 });
    week++;
  }

  return result;
}

/** Compute weekly AI-time activity for weeks in the window */
function computeWeeklyAiTime(
  sessions: Session[],
  windowStart: string,
  windowEnd: string,
): { label: string; hours: number }[] {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const now = new Date();
  const result: { label: string; hours: number }[] = [];
  let week = 1;

  for (let d = new Date(start); d < end && d <= now; d.setDate(d.getDate() + 7)) {
    const wStartStr = toLocalDate(d);
    const wEndDate = new Date(d);
    wEndDate.setDate(wEndDate.getDate() + 7);
    const wEndStr = toLocalDate(new Date(Math.min(wEndDate.getTime(), end.getTime())));

    let ms = 0;
    for (const s of sessions) {
      const sDate = toLocalDate(new Date(s.startedAt));
      if (sDate >= wStartStr && sDate < wEndStr) {
        ms += s.durationMs;
      }
    }

    result.push({ label: `W${week}`, hours: ms / 3600000 });
    week++;
  }

  return result;
}

/** Compute monthly clock-time activity for months in the window */
function computeMonthlyClockTime(
  sessions: Session[],
  windowStart: string,
  windowEnd: string,
): { label: string; hours: number }[] {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const result: { label: string; hours: number }[] = [];

  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d < end) {
    const mStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    const mEnd = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();

    const intervals: [number, number][] = [];
    for (const s of sessions) {
      intervals.push(...collectSessionIntervals(s, mStart, mEnd));
    }

    let totalMs = 0;
    for (const [s, e] of mergeIntervals(intervals)) {
      totalMs += e - s;
    }

    const label = d.toLocaleDateString([], { month: "short" });
    result.push({ label, hours: totalMs / 3600000 });
    d.setMonth(d.getMonth() + 1);
  }

  return result;
}

/** Compute monthly AI-time activity for months in the window */
function computeMonthlyAiTime(
  sessions: Session[],
  windowStart: string,
  windowEnd: string,
): { label: string; hours: number }[] {
  const start = new Date(windowStart);
  const end = new Date(windowEnd);
  const result: { label: string; hours: number }[] = [];

  const d = new Date(start.getFullYear(), start.getMonth(), 1);
  while (d < end) {
    const mStartStr = toLocalDate(d);
    const nextMonth = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const mEndStr = toLocalDate(nextMonth);

    let ms = 0;
    for (const s of sessions) {
      const sDate = toLocalDate(new Date(s.startedAt));
      if (sDate >= mStartStr && sDate < mEndStr) {
        ms += s.durationMs;
      }
    }

    const label = d.toLocaleDateString([], { month: "short" });
    result.push({ label, hours: ms / 3600000 });
    d.setMonth(d.getMonth() + 1);
  }

  return result;
}

// ── Route ────────────────────────────────────────────────────────────────────

aggregationsRoutes.get("/", async (c) => {
  const range = parseTimeRange(c.req.query("start"), c.req.query("end"));
  if (!range) {
    return c.json(
      { error: "start and end query params required (ISO string)" },
      400,
    );
  }

  const filteredSessions = await getFilteredSessions(range.start, range.end);

  // Fetch all sessions for streak (streak is global, not window-scoped)
  const allSessions = await getFilteredSessions(
    new Date(Date.now() - 365 * 86400000).toISOString(),
    new Date().toISOString(),
  );

  // Restructure milestones to a common format.
  const milestones = filteredSessions.flatMap(toEnrichedMilestones);

  // Compute stats
  const stats = computeStats(filteredSessions, milestones);

  // Compute streak globally (not window-scoped) with freeze + weekend forgiveness
  const streak = calculateStreakDetailed(allSessions);
  stats.currentStreak = streak.current;

  // Evaluation summary
  const evaluated = filteredSessions.filter(
    (s) => s.evaluation && typeof s.evaluation === "object",
  );
  const evalSummary =
    evaluated.length > 0
      ? {
          sessionCount: evaluated.length,
          promptQuality: avg(evaluated, (s) => s.evaluation!.prompt_quality),
          contextProvided: avg(
            evaluated,
            (s) => s.evaluation!.context_provided,
          ),
          independenceLevel: avg(
            evaluated,
            (s) => s.evaluation!.independence_level,
          ),
          scopeQuality: avg(evaluated, (s) => s.evaluation!.scope_quality),
          toolsLeveraged: Math.round(
            avg(evaluated, (s) => s.evaluation!.tools_leveraged),
          ),
          totalIterations: evaluated.reduce(
            (sum, s) => sum + s.evaluation!.iteration_count,
            0,
          ),
          outcomes: countBy(evaluated, (s) => s.evaluation!.task_outcome),
        }
      : null;

  // Complexity distribution
  let simple = 0,
    medium = 0,
    complex = 0;
  for (const m of milestones) {
    const comp =
      ((m as unknown as Record<string, unknown>)["complexity"] as string) ??
      "medium";
    if (comp === "simple") simple++;
    else if (comp === "medium") medium++;
    else if (comp === "complex") complex++;
  }

  // Activity charts — compute hourly for effective date + daily for all days in window
  const windowMid = (new Date(range.start).getTime() + new Date(range.end).getTime()) / 2;
  const midDate = new Date(windowMid);
  const effectiveDate = `${midDate.getFullYear()}-${String(midDate.getMonth() + 1).padStart(2, "0")}-${String(midDate.getDate()).padStart(2, "0")}`;

  const activity = {
    hourlyClockTime: getHourlyActivity(filteredSessions, effectiveDate),
    hourlyAiTime: getHourlyActivityAI(filteredSessions, effectiveDate),
    dailyClockTime: computeDailyClockTime(filteredSessions, range.start, range.end),
    dailyAiTime: computeDailyAiTime(filteredSessions, range.start, range.end),
    weeklyClockTime: computeWeeklyClockTime(filteredSessions, range.start, range.end),
    weeklyAiTime: computeWeeklyAiTime(filteredSessions, range.start, range.end),
    monthlyClockTime: computeMonthlyClockTime(filteredSessions, range.start, range.end),
    monthlyAiTime: computeMonthlyAiTime(filteredSessions, range.start, range.end),
    effectiveDate,
  };

  return c.json({
    window: { start: range.start, end: range.end },
    stats,
    streak,
    evaluation: evalSummary,
    sessionCount: filteredSessions.length,
    milestoneCount: milestones.length,
    complexity: { simple, medium, complex },
    sessions: filteredSessions.map(toSessionSummary),
    milestones,
    activity,
  });
});
