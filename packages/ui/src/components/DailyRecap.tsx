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
}

/** Category labels used in the sentence (plural forms). */
const CATEGORY_VERBS: Record<string, { verb: string; noun: string; plural: string }> = {
  feature: { verb: 'shipped', noun: 'feature', plural: 'features' },
  bugfix: { verb: 'fixed', noun: 'bug', plural: 'bugs' },
  refactor: { verb: 'refactored', noun: 'module', plural: 'modules' },
  test: { verb: 'added', noun: 'test suite', plural: 'test suites' },
  docs: { verb: 'wrote', noun: 'doc', plural: 'docs' },
  setup: { verb: 'configured', noun: 'setup', plural: 'setups' },
  deployment: { verb: 'deployed', noun: 'release', plural: 'releases' },
  other: { verb: 'completed', noun: 'task', plural: 'tasks' },
};

function buildRecapLine(sessions: SessionSeal[], milestones: Milestone[]): React.ReactNode {
  if (sessions.length === 0) {
    return <span className="text-text-muted">No sessions in this time window.</span>;
  }

  const parts: React.ReactNode[] = [];

  // 1. Session count + total hours
  const totalSeconds = sessions.reduce((sum, s) => sum + s.duration_seconds, 0);
  const totalHours = totalSeconds / 3600;
  const hoursStr = totalHours < 0.1 ? '<0.1' : totalHours.toFixed(1);

  parts.push(
    <span key="sessions">
      <Strong>{sessions.length}</Strong> {sessions.length === 1 ? 'session' : 'sessions'},{' '}
      <Strong>{hoursStr}</Strong> hrs
    </span>,
  );

  // 2. Milestone breakdown by category
  if (milestones.length > 0) {
    const byCategory: Record<string, number> = {};
    let complexFeatures = 0;

    for (const m of milestones) {
      byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
      if (m.category === 'feature' && m.complexity === 'complex') {
        complexFeatures++;
      }
    }

    const categoryParts: React.ReactNode[] = [];

    // Order: features first, then bugs, then the rest
    const orderedCategories = ['feature', 'bugfix', 'refactor', 'test', 'docs', 'setup', 'deployment', 'other'];
    for (const cat of orderedCategories) {
      const count = byCategory[cat];
      if (!count) continue;

      const info = CATEGORY_VERBS[cat] ?? CATEGORY_VERBS.other!;
      const label = count === 1 ? info.noun : info.plural;

      const complexNote =
        cat === 'feature' && complexFeatures > 0 ? (
          <span key={`${cat}-complex`}>
            {' '}
            (<Strong>{complexFeatures}</Strong> complex)
          </span>
        ) : null;

      categoryParts.push(
        <span key={cat}>
          {info.verb} <Strong>{count}</Strong> {label}
          {complexNote}
        </span>,
      );
    }

    if (categoryParts.length > 0) {
      parts.push(
        <span key="milestone-sep"> &mdash; </span>,
      );

      for (let i = 0; i < categoryParts.length; i++) {
        if (i > 0) parts.push(<span key={`sep-${i}`}>, </span>);
        parts.push(categoryParts[i]);
      }
    }
  }

  // 3. Most-used client
  const clientCounts: Record<string, number> = {};
  for (const s of sessions) {
    if (s.client) {
      clientCounts[s.client] = (clientCounts[s.client] ?? 0) + 1;
    }
  }
  const topClient = Object.entries(clientCounts).sort((a, b) => b[1] - a[1])[0];
  if (topClient) {
    const displayName = TOOL_DISPLAY_NAMES[topClient[0]] ?? topClient[0];
    parts.push(
      <span key="client">
        . Most active: <Strong>{displayName}</Strong>
      </span>,
    );
  }

  // 4. Most-used language (first language from each session)
  const langCounts: Record<string, number> = {};
  for (const s of sessions) {
    const lang = s.languages?.[0];
    if (lang) {
      langCounts[lang] = (langCounts[lang] ?? 0) + 1;
    }
  }
  const topLang = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0];
  if (topLang) {
    const capitalized = topLang[0].charAt(0).toUpperCase() + topLang[0].slice(1);
    parts.push(
      <span key="lang">
        . Primary: <Strong>{capitalized}</Strong>
      </span>,
    );
  }

  parts.push(<span key="end">.</span>);

  return <>{parts}</>;
}

function Strong({ children }: { children: React.ReactNode }) {
  return <span className="text-text-primary font-medium">{children}</span>;
}

export function DailyRecap({ sessions, milestones }: DailyRecapProps) {
  const recap = useMemo(() => buildRecapLine(sessions, milestones), [sessions, milestones]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-xl bg-bg-surface-1 border border-border/50 px-4 py-3 mb-4"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
        <p className="text-sm text-text-secondary leading-relaxed">{recap}</p>
      </div>
    </motion.div>
  );
}
