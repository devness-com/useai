import { readJson } from '@useai/shared/utils';
import { SESSIONS_FILE } from '@useai/shared/constants';
import type { SessionSeal } from '@useai/shared/types';

export interface AggregatedStats {
  totalHours: number;
  totalSessions: number;
  byClient: Record<string, number>;
  byLanguage: Record<string, number>;
  byTaskType: Record<string, number>;
  currentStreak: number;
}

export function getStats(): AggregatedStats {
  const sessions = readJson<SessionSeal[]>(SESSIONS_FILE, []);

  let totalSeconds = 0;
  const byClient: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  const byTaskType: Record<string, number> = {};

  for (const s of sessions) {
    totalSeconds += s.duration_seconds;

    byClient[s.client] = (byClient[s.client] ?? 0) + s.duration_seconds;

    for (const lang of s.languages) {
      byLanguage[lang] = (byLanguage[lang] ?? 0) + s.duration_seconds;
    }

    byTaskType[s.task_type] = (byTaskType[s.task_type] ?? 0) + s.duration_seconds;
  }

  const currentStreak = calculateStreak(sessions);

  return {
    totalHours: totalSeconds / 3600,
    totalSessions: sessions.length,
    byClient,
    byLanguage,
    byTaskType,
    currentStreak,
  };
}

function calculateStreak(sessions: SessionSeal[]): number {
  if (sessions.length === 0) return 0;

  const days = new Set<string>();
  for (const s of sessions) {
    days.add(s.started_at.slice(0, 10));
  }

  const sorted = [...days].sort().reverse();
  if (sorted.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  // Streak must include today or yesterday
  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
