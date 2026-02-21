import { Trophy, Brain } from 'lucide-react';
import { motion } from 'motion/react';
import type { Milestone } from '@useai/shared/types';
import { CATEGORY_COLORS, TOOL_INITIALS, TOOL_COLORS } from '../constants';

const BADGE_CLASSES: Record<string, string> = {
  feature: 'bg-success/10 text-success border-success/20',
  bugfix: 'bg-error/10 text-error border-error/20',
  refactor: 'bg-purple/10 text-purple border-purple/20',
  test: 'bg-blue/10 text-blue border-blue/20',
  docs: 'bg-accent/10 text-accent border-accent/20',
  setup: 'bg-text-muted/10 text-text-muted border-text-muted/20',
  deployment: 'bg-emerald/10 text-emerald border-emerald/20',
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface RecentMilestonesProps {
  milestones: Milestone[];
  showPublic?: boolean;
}

export function RecentMilestones({ milestones, showPublic = false }: RecentMilestonesProps) {
  const recent = [...milestones]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-xl bg-bg-surface-1 border border-border/50 p-4"
    >
      {/* Section header */}
      <div className="flex items-center gap-2 mb-3 px-1">
        <Trophy className="w-4 h-4 text-accent" />
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
          Recent Achievements
        </h2>
        <span className="text-[10px] text-text-muted font-mono bg-bg-surface-2 px-2 py-0.5 rounded ml-auto">
          {milestones.length} total
        </span>
      </div>

      {recent.length === 0 ? (
        <div className="text-sm text-text-muted text-center py-6">
          No milestones yet — complete your first session!
        </div>
      ) : (
        <div className="space-y-0.5">
          {recent.map((m, i) => {
            const catColor = CATEGORY_COLORS[m.category] ?? '#9c9588';
            const badgeCls = BADGE_CLASSES[m.category] ?? 'bg-bg-surface-2 text-text-secondary border-border';
            const initials = TOOL_INITIALS[m.client] ?? m.client.slice(0, 2).toUpperCase();
            const toolColor = TOOL_COLORS[m.client] ?? '#91919a';
            const displayTitle = showPublic ? m.title : (m.private_title || m.title);
            const isComplex = m.complexity === 'complex';

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-bg-surface-2/40 transition-colors"
              >
                {/* Category dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: catColor }}
                />

                {/* Title */}
                <span className="text-sm font-medium text-text-secondary hover:text-text-primary truncate flex-1 min-w-0">
                  {displayTitle}
                </span>

                {/* Category badge */}
                <span className={`text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0 ${badgeCls}`}>
                  {m.category}
                </span>

                {/* Complexity badge */}
                {isComplex && (
                  <span className="flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border bg-purple/10 text-purple border-purple/20 flex-shrink-0">
                    <Brain className="w-2.5 h-2.5" />
                    complex
                  </span>
                )}

                {/* Relative time */}
                <span className="text-[10px] text-text-muted font-mono flex-shrink-0">
                  {relativeTime(m.created_at)}
                </span>

                {/* Client initials badge */}
                <div
                  className="w-5 h-5 rounded flex items-center justify-center text-[8px] font-bold font-mono flex-shrink-0"
                  style={{ backgroundColor: `${toolColor}15`, color: toolColor, border: `1px solid ${toolColor}20` }}
                >
                  {initials}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
