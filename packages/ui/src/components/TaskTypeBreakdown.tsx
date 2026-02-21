import { motion } from 'motion/react';

const TASK_TYPE_COLORS: Record<string, string> = {
  coding: '#b4f82c',
  debugging: '#f87171',
  testing: '#60a5fa',
  planning: '#a78bfa',
  reviewing: '#34d399',
  documenting: '#fbbf24',
  learning: '#f472b6',
  deployment: '#fb923c',
  devops: '#e879f9',
  research: '#22d3ee',
  migration: '#facc15',
  design: '#c084fc',
  data: '#2dd4bf',
  security: '#f43f5e',
  configuration: '#a3e635',
  other: '#94a3b8',
};

function formatTime(seconds: number): string {
  if (seconds < 60) return '<1m';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = (seconds / 3600).toFixed(1);
  return `${h}h`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface TaskTypeBreakdownProps {
  byTaskType: Record<string, number>;
}

export function TaskTypeBreakdown({ byTaskType }: TaskTypeBreakdownProps) {
  const entries = Object.entries(byTaskType)
    .filter(([, seconds]) => seconds > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  const maxValue = entries[0]![1];

  return (
    <div className="rounded-xl bg-bg-surface-1 border border-border/50 p-4 mb-8">
      <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-4 px-1">
        Task Types
      </h2>

      <div className="space-y-2.5">
        {entries.map(([type, seconds], index) => {
          const color = TASK_TYPE_COLORS[type] ?? TASK_TYPE_COLORS.other!;
          const widthPercent = (seconds / maxValue) * 100;

          return (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary font-medium w-24 text-right shrink-0">
                {capitalize(type)}
              </span>

              <div className="flex-1 h-5 rounded bg-bg-surface-2/50 overflow-hidden">
                <motion.div
                  className="h-full rounded"
                  style={{ backgroundColor: color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.05,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>

              <span className="text-xs text-text-muted font-mono w-12 text-right shrink-0">
                {formatTime(seconds)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
