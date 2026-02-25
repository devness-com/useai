import { useEffect, useRef } from 'react';
import { Rocket, Bug, Brain, Clock, Zap } from 'lucide-react';
import { motion } from 'motion/react';

function animateCounter(
  el: HTMLSpanElement,
  target: number,
  decimals: number,
) {
  let startTime: number | null = null;
  const duration = 800;

  function step(ts: number) {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4);
    const current = target * eased;
    el.textContent =
      decimals > 0 ? current.toFixed(decimals) : String(Math.round(current));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function EvalStatCard({
  label,
  value,
  suffix,
  decimals = 0,
  icon: Icon,
  delay = 0,
  color = 'default',
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon: React.ComponentType<{ className?: string }>;
  delay?: number;
  color?: 'default' | 'accent' | 'success' | 'warning';
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    if (value !== prevValue.current) {
      animateCounter(ref.current, value, decimals);
      prevValue.current = value;
    }
  }, [value, decimals]);

  const iconColorMap: Record<string, string> = {
    default: 'text-text-muted group-hover:text-accent',
    accent: 'text-accent',
    success: 'text-success',
    warning: 'text-warning',
  };

  const iconBgMap: Record<string, string> = {
    default: 'bg-bg-surface-2 group-hover:bg-accent/10',
    accent: 'bg-accent/10',
    success: 'bg-success/10',
    warning: 'bg-warning/10',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="flex-1 min-w-[100px] px-3 py-2.5 rounded-lg border border-border/50 bg-bg-surface-1 hover:border-accent/30 flex items-center gap-2.5 group transition-all duration-300"
    >
      <div className={`p-1.5 rounded-md transition-colors ${iconBgMap[color] ?? iconBgMap.default}`}>
        <Icon className={`w-3.5 h-3.5 transition-colors ${iconColorMap[color] ?? iconColorMap.default}`} />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-baseline gap-0.5">
          <span ref={ref} className="text-lg font-bold text-text-primary tracking-tight leading-none">
            {decimals > 0 ? value.toFixed(decimals) : value}
          </span>
          {suffix && <span className="text-[10px] text-text-muted font-medium">{suffix}</span>}
        </div>
        <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider leading-none mt-0.5">
          {label}
        </span>
      </div>
    </motion.div>
  );
}

interface EvaluationStatsBarProps {
  features: number;
  bugs: number;
  complex: number;
  hours: number;
  streak: number;
}

export function EvaluationStatsBar({
  features,
  bugs,
  complex,
  hours,
  streak,
}: EvaluationStatsBarProps) {
  return (
    <div className="flex gap-2">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 flex-1">
        <EvalStatCard
          label={hours < 1 ? 'Active Time' : 'Active Hours'}
          value={hours < 1 ? Math.round(hours * 60) : hours}
          suffix={hours < 1 ? 'min' : 'hrs'}
          decimals={hours < 1 ? 0 : 1}
          icon={Clock}
          delay={0.1}
        />
        <EvalStatCard
          label="Features"
          value={features}
          icon={Rocket}
          delay={0.15}
          color="success"
        />
        <EvalStatCard
          label="Bugs Fixed"
          value={bugs}
          icon={Bug}
          delay={0.2}
          color="warning"
        />
        <EvalStatCard
          label="Complex"
          value={complex}
          icon={Brain}
          delay={0.25}
          color="accent"
        />
        <EvalStatCard
          label="Streak"
          value={streak}
          suffix="days"
          icon={Zap}
          delay={0.3}
          color="accent"
        />
      </div>
    </div>
  );
}
