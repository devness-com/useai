import type { SessionSeal } from '@useai/shared/types';
import type { Milestone } from '@useai/shared/types';

// Module-level timestamp cache — avoids repeated new Date(iso).getTime()
// across filterSessionsByWindow, countSessionsOutsideWindow, etc.
const _tsCache = new Map<string, number>();
export function parseTimestamp(iso: string): number {
  let v = _tsCache.get(iso);
  if (v === undefined) {
    v = new Date(iso).getTime();
    _tsCache.set(iso, v);
  }
  return v;
}

export interface ComputedStats {
  totalHours: number;
  totalSessions: number;
  currentStreak: number;
  filesTouched: number;
  featuresShipped: number;
  bugsFixed: number;
  complexSolved: number;
  totalMilestones: number;
  completionRate: number;
  activeProjects: number;
  byClient: Record<string, number>;
  byLanguage: Record<string, number>;
  byTaskType: Record<string, number>;
  byProject: Record<string, number>;
}

export function computeMilestoneStats(milestones: Milestone[]): {
  featuresShipped: number;
  bugsFixed: number;
  complexSolved: number;
} {
  let featuresShipped = 0;
  let bugsFixed = 0;
  let complexSolved = 0;

  for (const m of milestones) {
    if (m.category === 'feature') featuresShipped++;
    if (m.category === 'bugfix') bugsFixed++;
    if (m.complexity === 'complex') complexSolved++;
  }

  return { featuresShipped, bugsFixed, complexSolved };
}

export function computeStats(sessions: SessionSeal[], milestones: Milestone[] = []): ComputedStats {
  let totalSeconds = 0;
  let filesTouched = 0;
  const byClient: Record<string, number> = {};
  const byLanguage: Record<string, number> = {};
  const byTaskType: Record<string, number> = {};
  const byProject: Record<string, number> = {};

  for (const s of sessions) {
    totalSeconds += s.duration_seconds;
    filesTouched += s.files_touched;

    byClient[s.client] = (byClient[s.client] ?? 0) + s.duration_seconds;

    for (const lang of s.languages) {
      byLanguage[lang] = (byLanguage[lang] ?? 0) + s.duration_seconds;
    }

    byTaskType[s.task_type] = (byTaskType[s.task_type] ?? 0) + s.duration_seconds;

    if (s.project) {
      byProject[s.project] = (byProject[s.project] ?? 0) + s.duration_seconds;
    }
  }

  const milestoneStats = computeMilestoneStats(milestones);

  // Completion rate from sessions with evaluations
  const evaluated = sessions.filter((s) => s.evaluation && typeof s.evaluation === 'object');
  const completed = evaluated.filter((s) => s.evaluation!.task_outcome === 'completed').length;
  const completionRate = evaluated.length > 0 ? Math.round((completed / evaluated.length) * 100) : 0;

  // Active projects
  const activeProjects = Object.keys(byProject).length;

  return {
    totalHours: totalSeconds / 3600,
    totalSessions: sessions.length,
    currentStreak: calculateStreak(sessions),
    filesTouched: Math.round(filesTouched),
    ...milestoneStats,
    totalMilestones: milestones.length,
    completionRate,
    activeProjects,
    byClient,
    byLanguage,
    byTaskType,
    byProject,
  };
}

export function calculateStreak(sessions: SessionSeal[]): number {
  if (sessions.length === 0) return 0;

  const days = new Set<string>();
  for (const s of sessions) {
    days.add(s.started_at.slice(0, 10));
  }

  const sorted = [...days].sort().reverse();
  if (sorted.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

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

/** Count sessions that fall entirely outside a time window */
export function countSessionsOutsideWindow(
  allSessions: SessionSeal[],
  windowStart: number,
  windowEnd: number,
): { before: number; after: number } {
  let before = 0;
  let after = 0;
  for (const s of allSessions) {
    const sEnd = parseTimestamp(s.ended_at);
    const sStart = parseTimestamp(s.started_at);
    if (sEnd < windowStart) before++;
    else if (sStart > windowEnd) after++;
  }
  return { before, after };
}

/** Filter sessions that overlap with a time window */
export function filterSessionsByWindow(
  sessions: SessionSeal[],
  start: number,
  end: number,
): SessionSeal[] {
  return sessions.filter((s) => {
    const sStart = parseTimestamp(s.started_at);
    const sEnd = parseTimestamp(s.ended_at);
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
    const t = parseTimestamp(m.created_at);
    return t >= start && t <= end;
  });
}

export interface SessionGroup {
  session: SessionSeal;
  milestones: Milestone[];
}

/** A conversation is a group of sessions sharing the same conversation_id */
export interface ConversationGroup {
  conversationId: string | null;
  sessions: SessionGroup[];
  /** Aggregate evaluation across all sessions in the conversation */
  aggregateEval: AggregateEvaluation | null;
  totalDuration: number;
  totalMilestones: number;
  startedAt: string;
  endedAt: string;
}

export interface AggregateEvaluation {
  prompt_quality: number;
  context_provided: number;
  independence_level: number;
  scope_quality: number;
  tools_leveraged: number;
  total_iterations: number;
  outcomes: Record<string, number>;
  session_count: number;
}

/** Group ALL sessions with their milestones attached (empty array if none) */
export function groupSessionsWithMilestones(
  sessions: SessionSeal[],
  milestones: Milestone[],
): SessionGroup[] {
  const milestoneMap = new Map<string, Milestone[]>();
  for (const m of milestones) {
    const existing = milestoneMap.get(m.session_id);
    if (existing) {
      existing.push(m);
    } else {
      milestoneMap.set(m.session_id, [m]);
    }
  }

  const result: SessionGroup[] = sessions.map((session) => ({
    session,
    milestones: milestoneMap.get(session.session_id) ?? [],
  }));

  // Sort by session start time, most recent first
  result.sort((a, b) => parseTimestamp(b.session.started_at) - parseTimestamp(a.session.started_at));

  return result;
}

/** Compute aggregate evaluation from multiple sessions */
function computeAggregateEval(sessions: SessionGroup[]): AggregateEvaluation | null {
  const withEval = sessions.filter((s) => s.session.evaluation);
  if (withEval.length === 0) return null;

  let promptSum = 0, contextSum = 0, indepSum = 0, scopeSum = 0, toolsSum = 0, iterSum = 0;
  const outcomes: Record<string, number> = {};

  for (const s of withEval) {
    const e = s.session.evaluation!;
    promptSum += e.prompt_quality;
    contextSum += e.context_provided;
    indepSum += e.independence_level;
    scopeSum += e.scope_quality;
    toolsSum += e.tools_leveraged;
    iterSum += e.iteration_count;
    outcomes[e.task_outcome] = (outcomes[e.task_outcome] ?? 0) + 1;
  }

  const n = withEval.length;
  return {
    prompt_quality: Math.round((promptSum / n) * 10) / 10,
    context_provided: Math.round((contextSum / n) * 10) / 10,
    independence_level: Math.round((indepSum / n) * 10) / 10,
    scope_quality: Math.round((scopeSum / n) * 10) / 10,
    tools_leveraged: Math.round(toolsSum / n),
    total_iterations: iterSum,
    outcomes,
    session_count: n,
  };
}

/** Group sessions into conversations. Sessions without conversation_id are standalone. */
export function groupIntoConversations(
  sessionGroups: SessionGroup[],
): ConversationGroup[] {
  const convMap = new Map<string, SessionGroup[]>();
  const standalone: SessionGroup[] = [];

  for (const sg of sessionGroups) {
    const convId = sg.session.conversation_id;
    if (convId) {
      const existing = convMap.get(convId);
      if (existing) {
        existing.push(sg);
      } else {
        convMap.set(convId, [sg]);
      }
    } else {
      standalone.push(sg);
    }
  }

  const result: ConversationGroup[] = [];

  for (const [convId, sessions] of convMap) {
    sessions.sort((a, b) => (a.session.conversation_index ?? 0) - (b.session.conversation_index ?? 0));

    const totalDuration = sessions.reduce((sum, s) => sum + s.session.duration_seconds, 0);
    const totalMilestones = sessions.reduce((sum, s) => sum + s.milestones.length, 0);
    const startedAt = sessions[0]!.session.started_at;
    const endedAt = sessions[sessions.length - 1]!.session.ended_at;

    result.push({
      conversationId: convId,
      sessions,
      aggregateEval: computeAggregateEval(sessions),
      totalDuration,
      totalMilestones,
      startedAt,
      endedAt,
    });
  }

  for (const sg of standalone) {
    result.push({
      conversationId: null,
      sessions: [sg],
      aggregateEval: sg.session.evaluation ? computeAggregateEval([sg]) : null,
      totalDuration: sg.session.duration_seconds,
      totalMilestones: sg.milestones.length,
      startedAt: sg.session.started_at,
      endedAt: sg.session.ended_at,
    });
  }

  result.sort((a, b) => parseTimestamp(b.startedAt) - parseTimestamp(a.startedAt));

  return result;
}

/** Get a human-readable label for the current time window */
export function getTimeContextLabel(windowStart: number, windowEnd: number, isLive: boolean): string {
  if (isLive) return 'Live';

  const midpoint = (windowStart + windowEnd) / 2;
  const midDate = new Date(midpoint);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);

  if (midDate.toDateString() === today.toDateString()) return 'Today';
  if (midDate.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return midDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

/** Get hourly activity for a given day — returns 24 entries with minutes per hour */
export function getHourlyActivity(sessions: SessionSeal[], date: string): { hour: number; minutes: number }[] {
  const dayStart = new Date(`${date}T00:00:00`).getTime();
  const dayEnd = dayStart + 86400000;

  const result: { hour: number; minutes: number }[] = [];
  for (let h = 0; h < 24; h++) {
    result.push({ hour: h, minutes: 0 });
  }

  for (const s of sessions) {
    const sStart = parseTimestamp(s.started_at);
    const sEnd = parseTimestamp(s.ended_at);

    if (sEnd < dayStart || sStart > dayEnd) continue;

    const clampedStart = Math.max(sStart, dayStart);
    const clampedEnd = Math.min(sEnd, dayEnd);

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

/** Get daily hours for last N days */
export function getDailyActivity(sessions: SessionSeal[], days: number): { date: string; hours: number }[] {
  const now = new Date();
  const result: { date: string; hours: number }[] = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    let seconds = 0;
    for (const s of sessions) {
      const sDate = s.started_at.slice(0, 10);
      if (sDate === dateStr) {
        seconds += s.duration_seconds;
      }
    }

    result.push({ date: dateStr, hours: seconds / 3600 });
  }

  return result;
}
