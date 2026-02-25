import { motion } from 'motion/react';
import { Briefcase } from 'lucide-react';

const TASK_TYPE_COLORS: Record<string, string> = {
  coding: '#60a5fa',
  debugging: '#f87171',
  testing: '#34d399',
  planning: '#a78bfa',
  reviewing: '#fb923c',
  documenting: '#2dd4bf',
  learning: '#f472b6',
  deployment: '#fbbf24',
  devops: '#e879f9',
  research: '#22d3ee',
  migration: '#facc15',
  design: '#c084fc',
  data: '#38bdf8',
  security: '#f43f5e',
  configuration: '#a3e635',
  other: '#94a3b8',
};

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface TaskTypeBreakdownProps {
  data: Record<string, number>;
}

export function TaskTypeBreakdown({ data }: TaskTypeBreakdownProps) {
  const entries = Object.entries(data)
    .filter(([, hours]) => hours > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return null;

  const maxValue = entries[0]![1];
  const totalHours = entries.reduce((sum, [, h]) => sum + h, 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-xl bg-bg-surface-1 border border-border/50 p-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-bg-surface-2">
          <Briefcase className="w-3.5 h-3.5 text-text-muted" />
        </div>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
          Time by Task Type
        </h2>
      </div>

      <div className="space-y-2.5">
        {entries.map(([type, hours], index) => {
          const color = TASK_TYPE_COLORS[type] ?? TASK_TYPE_COLORS.other!;
          const widthPercent = (hours / maxValue) * 100;
          const percentage = totalHours > 0 ? ((hours / totalHours) * 100).toFixed(0) : '0';
          const hoursStr = hours < 1 ? `${Math.round(hours * 60)}m` : `${hours.toFixed(1)}h`;

          return (
            <div key={type} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary font-medium w-24 text-right shrink-0">
                {capitalize(type)}
              </span>

              <div className="flex-1 h-5 rounded bg-bg-surface-2/50 overflow-hidden relative">
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

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-text-muted font-mono w-10 text-right">
                  {hoursStr}
                </span>
                <span className="text-[10px] text-text-muted/70 font-mono w-8 text-right">
                  {percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
