import { motion } from 'motion/react';
import { Layers } from 'lucide-react';

interface ComplexityDistributionProps {
  data: {
    simple: number;
    medium: number;
    complex: number;
  };
}

const BARS: { key: keyof ComplexityDistributionProps['data']; label: string; color: string }[] = [
  { key: 'simple', label: 'Simple', color: '#34d399' },
  { key: 'medium', label: 'Medium', color: '#fbbf24' },
  { key: 'complex', label: 'Complex', color: '#f87171' },
];

export function ComplexityDistribution({ data }: ComplexityDistributionProps) {
  const total = data.simple + data.medium + data.complex;

  if (total === 0) return null;

  const maxCount = Math.max(data.simple, data.medium, data.complex);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-xl bg-bg-surface-1 border border-border/50 p-4"
    >
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-bg-surface-2">
          <Layers className="w-3.5 h-3.5 text-text-muted" />
        </div>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
          Complexity
        </h2>
      </div>

      <div className="space-y-3">
        {BARS.map((bar, index) => {
          const count = data[bar.key];
          const widthPercent = maxCount > 0 ? (count / maxCount) * 100 : 0;
          const percentage = total > 0 ? ((count / total) * 100).toFixed(0) : '0';

          return (
            <div key={bar.key} className="flex items-center gap-3">
              <span className="text-xs text-text-secondary font-medium w-16 text-right shrink-0">
                {bar.label}
              </span>

              <div className="flex-1 h-5 rounded bg-bg-surface-2/50 overflow-hidden">
                <motion.div
                  className="h-full rounded"
                  style={{ backgroundColor: bar.color }}
                  initial={{ width: 0 }}
                  animate={{ width: `${widthPercent}%` }}
                  transition={{
                    duration: 0.6,
                    delay: index * 0.08,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-text-primary font-mono font-bold w-6 text-right">
                  {count}
                </span>
                <span className="text-[10px] text-text-muted/70 font-mono w-8 text-right">
                  {percentage}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stacked summary bar */}
      <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-bg-surface-2/30">
        {BARS.map((bar) => {
          const count = data[bar.key];
          const pct = total > 0 ? (count / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <motion.div
              key={bar.key}
              className="h-full"
              style={{ backgroundColor: bar.color }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            />
          );
        })}
      </div>
    </motion.div>
  );
}
