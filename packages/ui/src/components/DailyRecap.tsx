import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import type { SessionSeal } from '@useai/shared/types';
import type { Milestone } from '@useai/shared/types';
import { TOOL_DISPLAY_NAMES } from '../constants';

interface DailyRecapProps {
  sessions: SessionSeal[];
  milestones: Milestone[];
  isLive: boolean;
  windowStart: number;
  windowEnd: number;
  /** All sessions (not filtered) — needed for comparisons */
  allSessions?: SessionSeal[];
  allMilestones?: Milestone[];
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-text-primary font-medium">{children}</span>;
}

/** Helpers */
function getSessionsInRange(sessions: SessionSeal[], start: number, end: number): SessionSeal[] {
  return sessions.filter((s) => {
    const t = new Date(s.started_at).getTime();
    return t >= start && t <= end;
  });
}

function getMilestonesInRange(milestones: Milestone[], start: number, end: number): Milestone[] {
  return milestones.filter((m) => {
    const t = new Date(m.created_at).getTime();
    return t >= start && t <= end;
  });
}

function totalHours(sessions: SessionSeal[]): number {
  return sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 3600;
}

function avgEval(sessions: SessionSeal[], field: keyof NonNullable<SessionSeal['evaluation']>): number | null {
  const evaluated = sessions.filter((s) => s.evaluation != null);
  if (evaluated.length < 2) return null;
  const sum = evaluated.reduce((acc, s) => acc + (s.evaluation![field] as number), 0);
  return sum / evaluated.length;
}

function dominantTaskType(sessions: SessionSeal[]): { type: string; pct: number } | null {
  if (sessions.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const s of sessions) {
    const t = s.task_type || 'coding';
    counts[t] = (counts[t] ?? 0) + s.duration_seconds;
  }
  const totalSec = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  if (!top || totalSec === 0) return null;
  return { type: top[0], pct: Math.round((top[1] / totalSec) * 100) };
}

interface Insight {
  priority: number;
  node: React.ReactNode;
}

function generateInsights(
  sessions: SessionSeal[],
  milestones: Milestone[],
  allSessions: SessionSeal[],
  allMilestones: Milestone[],
  windowStart: number,
  windowEnd: number,
): Insight[] {
  const insights: Insight[] = [];
  const windowMs = windowEnd - windowStart;
  const prevStart = windowStart - windowMs;
  const prevEnd = windowStart;

  const prevSessions = getSessionsInRange(allSessions, prevStart, prevEnd);
  const prevMilestones = getMilestonesInRange(allMilestones, prevStart, prevEnd);

  const currentHours = totalHours(sessions);
  const prevHours = totalHours(prevSessions);

  // 1. Evaluation improvement trend
  const currentPQ = avgEval(sessions, 'prompt_quality');
  const prevPQ = avgEval(prevSessions, 'prompt_quality');
  if (currentPQ !== null && prevPQ !== null && currentPQ > prevPQ + 0.3) {
    insights.push({
      priority: 10,
      node: (
        <span>
          Your prompt quality improved from <Strong>{prevPQ.toFixed(1)}</Strong> to{' '}
          <Strong>{currentPQ.toFixed(1)}</Strong> — clearer prompts mean faster results.
        </span>
      ),
    });
  }

  // 2. Productivity comparison
  if (prevSessions.length > 0 && sessions.length > 0) {
    const currentMilestoneRate = milestones.length / Math.max(currentHours, 0.1);
    const prevMilestoneRate = prevMilestones.length / Math.max(prevHours, 0.1);
    if (currentMilestoneRate > prevMilestoneRate * 1.2 && milestones.length >= 2) {
      insights.push({
        priority: 9,
        node: (
          <span>
            You're shipping <Strong>{Math.round((currentMilestoneRate / prevMilestoneRate - 1) * 100)}% faster</Strong>{' '}
            this period — great momentum.
          </span>
        ),
      });
    }
  }

  // 3. Complexity growth
  const currentComplex = milestones.filter((m) => m.complexity === 'complex').length;
  const prevComplex = prevMilestones.filter((m) => m.complexity === 'complex').length;
  if (currentComplex > prevComplex && currentComplex >= 2) {
    insights.push({
      priority: 8,
      node: (
        <span>
          <Strong>{currentComplex}</Strong> complex {currentComplex === 1 ? 'task' : 'tasks'} this period vs{' '}
          <Strong>{prevComplex}</Strong> before — you're taking on harder problems.
        </span>
      ),
    });
  }

  // 4. One-shot efficiency
  const evaluated = sessions.filter((s) => s.evaluation != null);
  const oneShot = evaluated.filter(
    (s) => s.evaluation!.task_outcome === 'completed' && s.evaluation!.iteration_count <= 3,
  );
  if (evaluated.length >= 3 && oneShot.length > 0) {
    const pct = Math.round((oneShot.length / evaluated.length) * 100);
    if (pct >= 50) {
      insights.push({
        priority: 7,
        node: (
          <span>
            <Strong>{pct}%</Strong> of your sessions completed in 3 or fewer turns — efficient prompting.
          </span>
        ),
      });
    }
  }

  // 5. Focus mode insight
  const dominant = dominantTaskType(sessions);
  if (dominant && dominant.pct >= 60 && sessions.length >= 2) {
    const labels: Record<string, string> = {
      coding: 'building', debugging: 'debugging', testing: 'testing',
      planning: 'planning', reviewing: 'reviewing', documenting: 'documenting',
      refactoring: 'refactoring', research: 'researching', analysis: 'analyzing',
    };
    const label = labels[dominant.type] ?? dominant.type;
    insights.push({
      priority: 6,
      node: (
        <span>
          Deep focus: <Strong>{dominant.pct}%</Strong> of your time spent {label}.
        </span>
      ),
    });
  }

  // 6. Tool comparison (if using multiple tools)
  const clientSessions: Record<string, SessionSeal[]> = {};
  for (const s of sessions) {
    if (s.client) {
      (clientSessions[s.client] ??= []).push(s);
    }
  }
  const clients = Object.entries(clientSessions).filter(([, arr]) => arr.length >= 2);
  if (clients.length >= 2) {
    // Find most productive tool by milestones/hour
    const toolEfficiency = clients.map(([name, arr]) => {
      const hrs = totalHours(arr);
      const sessionIds = new Set(arr.map((s) => s.session_id));
      const toolMilestones = milestones.filter((m) => sessionIds.has(m.session_id));
      return { name, rate: toolMilestones.length / Math.max(hrs, 0.1), count: toolMilestones.length };
    }).filter((t) => t.count > 0);

    if (toolEfficiency.length >= 2) {
      toolEfficiency.sort((a, b) => b.rate - a.rate);
      const best = toolEfficiency[0]!;
      const displayName = TOOL_DISPLAY_NAMES[best.name] ?? best.name;
      insights.push({
        priority: 5,
        node: (
          <span>
            <Strong>{displayName}</Strong> is your most productive tool this period — {best.count}{' '}
            {best.count === 1 ? 'milestone' : 'milestones'} shipped.
          </span>
        ),
      });
    }
  }

  // 7. Context score insight
  const currentCtx = avgEval(sessions, 'context_provided');
  if (currentCtx !== null && currentCtx < 3.5) {
    insights.push({
      priority: 4,
      node: (
        <span>
          Tip: Your context score averages <Strong>{currentCtx.toFixed(1)}/5</Strong> — try including specific files
          and error messages for faster results.
        </span>
      ),
    });
  }

  // 8. Completion rate
  if (evaluated.length >= 3) {
    const completed = evaluated.filter((s) => s.evaluation!.task_outcome === 'completed').length;
    const rate = Math.round((completed / evaluated.length) * 100);
    if (rate === 100) {
      insights.push({
        priority: 3,
        node: (
          <span>
            <Strong>100%</Strong> completion rate — every task landed.
          </span>
        ),
      });
    } else if (rate < 70) {
      insights.push({
        priority: 4,
        node: (
          <span>
            <Strong>{rate}%</Strong> completion rate — try breaking tasks into smaller, well-scoped pieces.
          </span>
        ),
      });
    }
  }

  // 9. Hours trend
  if (prevHours > 0 && currentHours > prevHours * 1.5 && currentHours >= 1) {
    insights.push({
      priority: 2,
      node: (
        <span>
          <Strong>{Math.round((currentHours / prevHours - 1) * 100)}% more</Strong> AI-paired time this period —
          you're leaning in.
        </span>
      ),
    });
  }

  // 10. Fallback: no sessions
  if (sessions.length === 0) {
    insights.push({
      priority: 1,
      node: <span className="text-text-muted">No sessions in this window. Start coding with AI to see insights here.</span>,
    });
  }

  return insights.sort((a, b) => b.priority - a.priority);
}

export function DailyRecap({ sessions, milestones, windowStart, windowEnd, allSessions, allMilestones }: DailyRecapProps) {
  const insight = useMemo(() => {
    const all = allSessions ?? sessions;
    const allM = allMilestones ?? milestones;
    const insights = generateInsights(sessions, milestones, all, allM, windowStart, windowEnd);
    return insights[0]?.node ?? null;
  }, [sessions, milestones, allSessions, allMilestones, windowStart, windowEnd]);

  if (!insight) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl bg-bg-surface-1 border border-border/50 px-4 py-3"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-sm text-text-secondary leading-relaxed">{insight}</p>
      </div>
    </motion.div>
  );
}
