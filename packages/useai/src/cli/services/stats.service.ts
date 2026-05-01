import type { Session } from "@devness/useai-types";
import { getDaemonUrl } from "@devness/useai-storage/config";

export interface StatsData {
  totalSessions: number;
  totalHours: number;
  coveredHours: number;
  aiMultiplier: number;
  totalMilestones: number;
  currentStreak: number;
  completionRate: number;
  filesTouched: number;
  featuresShipped: number;
  bugsFixed: number;
  /** Clock-time seconds per client */
  byToolClockTime: Record<string, number>;
  /** Cumulative session duration seconds per client */
  byAiToolDuration: Record<string, number>;
  /** Clock-time seconds per task type */
  byTaskTypeClockTime: Record<string, number>;
  /** Cumulative session duration seconds per task type */
  byTaskTypeAiTime: Record<string, number>;
  /** Clock-time seconds per project */
  byProjectAiTime: Record<string, number>;
  /** Clock-time seconds per project (sweep-line) */
  byProjectClock: Record<string, number>;
  /** Clock-time seconds per language */
  byLanguageClockTime: Record<string, number>;
  /** Cumulative session duration seconds per language */
  byLanguageAiTime: Record<string, number>;
  /** Milestone complexity distribution */
  complexity: { simple: number; medium: number; complex: number };
  /** Evaluation averages (1-5 scale), null if no evaluated sessions */
  evaluation: {
    promptQuality: number;
    contextProvided: number;
    independenceLevel: number;
    scopeQuality: number;
  } | null;
}

export async function getStats(start: string, end: string): Promise<StatsData> {
  const params = new URLSearchParams({ start, end });
  const daemonUrl = await getDaemonUrl();

  const res = await fetch(`${daemonUrl}/api/local/aggregations?${params}`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`Daemon returned ${res.status}`);

  const json = await res.json() as {
    displaySessionCount: number;
    stats: {
      totalSessions: number;
      totalHours: number;
      coveredHours: number;
      aiMultiplier: number;
      totalMilestones: number;
      currentStreak: number;
      completionRate: number;
      filesTouched: number;
      featuresShipped: number;
      bugsFixed: number;
      byToolClockTime: Record<string, number>;
      byAiToolDuration: Record<string, number>;
      byTaskTypeClockTime: Record<string, number>;
      byTaskTypeAiTime: Record<string, number>;
      byProjectAiTime: Record<string, number>;
      byProjectClock: Record<string, number>;
      byLanguageClockTime: Record<string, number>;
      byLanguageAiTime: Record<string, number>;
    };
    complexity: { simple: number; medium: number; complex: number };
    evaluation: {
      promptQuality: number;
      contextProvided: number;
      independenceLevel: number;
      scopeQuality: number;
    } | null;
  };

  return {
    totalSessions: json.displaySessionCount,
    totalHours: json.stats.totalHours,
    coveredHours: json.stats.coveredHours,
    aiMultiplier: json.stats.aiMultiplier,
    totalMilestones: json.stats.totalMilestones,
    currentStreak: json.stats.currentStreak,
    completionRate: json.stats.completionRate,
    filesTouched: json.stats.filesTouched,
    featuresShipped: json.stats.featuresShipped,
    bugsFixed: json.stats.bugsFixed,
    byToolClockTime: json.stats.byToolClockTime,
    byAiToolDuration: json.stats.byAiToolDuration,
    byTaskTypeClockTime: json.stats.byTaskTypeClockTime,
    byTaskTypeAiTime: json.stats.byTaskTypeAiTime,
    byProjectAiTime: json.stats.byProjectAiTime,
    byProjectClock: json.stats.byProjectClock,
    byLanguageClockTime: json.stats.byLanguageClockTime,
    byLanguageAiTime: json.stats.byLanguageAiTime,
    complexity: json.complexity,
    evaluation: json.evaluation,
  };
}

/** Compute calendar-aligned time windows matching the dashboard */
export function getTimeWindow(scale: string): { start: string; end: string; label: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (scale) {
    case "day":
      return {
        start: new Date(y, m, d).toISOString(),
        end: new Date(y, m, d + 1).toISOString(),
        label: "today",
      };
    case "week": {
      const dow = now.getDay() === 0 ? 6 : now.getDay() - 1;
      return {
        start: new Date(y, m, d - dow).toISOString(),
        end: new Date(y, m, d - dow + 7).toISOString(),
        label: "this week",
      };
    }
    case "month":
      return {
        start: new Date(y, m, 1).toISOString(),
        end: new Date(y, m + 1, 1).toISOString(),
        label: "this month",
      };
    case "year":
      return {
        start: new Date(y, 0, 1).toISOString(),
        end: new Date(y + 1, 0, 1).toISOString(),
        label: "this year",
      };
    default: {
      // Rolling: "7d", "30d", etc.
      const days = parseInt(scale, 10) || 7;
      return {
        start: new Date(Date.now() - days * 86400000).toISOString(),
        end: now.toISOString(),
        label: `last ${days} days`,
      };
    }
  }
}

export async function getSessions(days = 30): Promise<Session[]> {
  try {
    const daemonUrl = await getDaemonUrl();
    const res = await fetch(`${daemonUrl}/api/local/sessions?days=${days}`, { signal: AbortSignal.timeout(2000) });
    if (res.ok) {
      const json = await res.json() as { data: { sessions: Session[] } };
      return json.data.sessions;
    }
  } catch { /* daemon unavailable */ }
  return [];
}

