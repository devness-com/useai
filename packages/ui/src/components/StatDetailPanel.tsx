import { useEffect } from 'react';
import { X, Brain, Rocket, Bug, Sparkles, Target } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Milestone } from '@useai/shared/types';
import { CATEGORY_COLORS, TOOL_INITIALS, TOOL_COLORS, TOOL_ICONS, resolveClient } from '../constants';

export type StatCardType = 'features' | 'bugs' | 'complex' | 'milestones' | 'activeTime' | 'aiTime' | 'parallel' | 'streak' | null;

type MilestoneCardType = 'features' | 'bugs' | 'complex' | 'milestones';

const PANEL_CONFIG: Record<MilestoneCardType, {
  title: string;
  icon: typeof Rocket;
  filter: (m: Milestone) => boolean;
  emptyText: string;
  accentColor: string;
}> = {
  milestones: {
    title: 'All Milestones',
    icon: Target,
    filter: () => true,
    emptyText: 'No milestones in this time window.',
    accentColor: '#60a5fa',
  },
  features: {
    title: 'Features Shipped',
    icon: Rocket,
    filter: (m) => m.category === 'feature',
    emptyText: 'No features shipped in this time window.',
    accentColor: '#4ade80',
  },
  bugs: {
    title: 'Bugs Fixed',
    icon: Bug,
    filter: (m) => m.category === 'bugfix',
    emptyText: 'No bugs fixed in this time window.',
    accentColor: '#f87171',
  },
  complex: {
    title: 'Complex Tasks',
    icon: Brain,
    filter: (m) => m.complexity === 'complex',
    emptyText: 'No complex tasks in this time window.',
    accentColor: '#a78bfa',
  },
};

const BADGE_CLASSES: Record<string, string> = {
  feature: 'bg-success/10 text-success border-success/20',
  bugfix: 'bg-error/10 text-error border-error/20',
  refactor: 'bg-purple/10 text-purple border-purple/20',
  test: 'bg-blue/10 text-blue border-blue/20',
  docs: 'bg-accent/10 text-accent border-accent/20',
  setup: 'bg-text-muted/10 text-text-muted border-text-muted/20',
  deployment: 'bg-emerald/10 text-emerald border-emerald/20',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

interface StatDetailPanelProps {
  type: StatCardType;
  milestones: Milestone[];
  showPublic?: boolean;
  onClose: () => void;
}

export function StatDetailPanel({ type, milestones, showPublic = false, onClose }: StatDetailPanelProps) {
  useEffect(() => {
    if (!type) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [type]);

  const isMilestoneType = type === 'features' || type === 'bugs' || type === 'complex' || type === 'milestones';
  if (!type || !isMilestoneType) return null;

  const config = PANEL_CONFIG[type];
  const Icon = config.icon;
  const filtered = milestones
    .filter(config.filter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  // Group by date
  const groups = new Map<string, Milestone[]>();
  for (const m of filtered) {
    const dateKey = new Date(m.created_at).toLocaleDateString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const existing = groups.get(dateKey);
    if (existing) existing.push(m);
    else groups.set(dateKey, [m]);
  }

  return (
    <AnimatePresence>
      {type && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-bg-base border-l border-border/50 z-50 flex flex-col shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border/50">
              <div
                className="p-2 rounded-lg"
                style={{ backgroundColor: `${config.accentColor}15` }}
              >
                <Icon className="w-4 h-4" style={{ color: config.accentColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-text-primary">{config.title}</h2>
                <span className="text-[10px] font-mono text-text-muted">
                  {filtered.length} {filtered.length === 1 ? 'item' : 'items'} in window
                </span>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-md hover:bg-bg-surface-2 text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Sparkles className="w-8 h-8 text-text-muted/30 mb-3" />
                  <p className="text-sm text-text-muted">{config.emptyText}</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {[...groups.entries()].map(([dateLabel, items]) => (
                    <div key={dateLabel}>
                      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider mb-2 px-1">
                        {dateLabel}
                      </div>
                      <div className="space-y-1">
                        {items.map((m, i) => {
                          const catColor = CATEGORY_COLORS[m.category] ?? '#9c9588';
                          const badgeCls = BADGE_CLASSES[m.category] ?? 'bg-bg-surface-2 text-text-secondary border-border';
                          const client = resolveClient(m.client);
                          const initials = TOOL_INITIALS[client] ?? client.slice(0, 2).toUpperCase();
                          const toolColor = TOOL_COLORS[client] ?? '#91919a';
                          const isCursor = client === 'cursor';
                          const iconColor = isCursor ? 'var(--text-primary)' : toolColor;
                          const iconPath = TOOL_ICONS[client];
                          const displayTitle = showPublic ? m.title : (m.private_title || m.title);
                          const isComplex = m.complexity === 'complex';

                          return (
                            <motion.div
                              key={m.id}
                              initial={{ opacity: 0, y: 4 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: i * 0.03 }}
                              className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-bg-surface-1 transition-colors group"
                            >
                              {/* Category dot */}
                              <div
                                className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                                style={{ backgroundColor: catColor }}
                              />

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-text-secondary group-hover:text-text-primary transition-colors leading-snug">
                                  {displayTitle}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                  {/* Category badge (for views that mix categories) */}
                                  {(type === 'complex' || type === 'milestones') && (
                                    <span className={`text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border ${badgeCls}`}>
                                      {m.category}
                                    </span>
                                  )}
                                  {isComplex && type !== 'complex' && (
                                    <span className="flex items-center gap-0.5 text-[8px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full border bg-purple/10 text-purple border-purple/20">
                                      <Brain className="w-2 h-2" />
                                      complex
                                    </span>
                                  )}
                                  <span className="text-[10px] text-text-muted font-mono">
                                    {formatDate(m.created_at)}
                                  </span>
                                  {m.languages.length > 0 && (
                                    <span className="text-[9px] text-text-muted font-mono">
                                      {m.languages.join(', ')}
                                    </span>
                                  )}
                                  <div
                                    className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold font-mono flex-shrink-0 ml-auto"
                                    style={{ backgroundColor: `${toolColor}15`, color: toolColor, border: `1px solid ${toolColor}20` }}
                                  >
                                    {iconPath ? (
                                      <div
                                        className="w-2.5 h-2.5"
                                        style={{
                                          backgroundColor: iconColor,
                                          maskImage: `url(${iconPath})`,
                                          maskSize: 'contain',
                                          maskRepeat: 'no-repeat',
                                          maskPosition: 'center',
                                          WebkitMaskImage: `url(${iconPath})`,
                                          WebkitMaskSize: 'contain',
                                          WebkitMaskRepeat: 'no-repeat',
                                          WebkitMaskPosition: 'center',
                                        }}
                                      />
                                    ) : (
                                      initials
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
