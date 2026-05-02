import { useEffect, useRef } from 'react';
import { Clock, Bot, Rocket, Bug, Zap, Target, Layers } from 'lucide-react';
import { motion } from 'motion/react';
import type { StatCardType } from './StatDetailPanel';
import type { StreakDetail } from '../../lib/api';

function animateCounter(
  el: HTMLSpanElement,
  target: number,
  decimals: number,
  formatter?: (value: number) => string,
) {
  let startTime: number | null = null;
  const duration = 800;

  function step(ts: number) {
    if (!startTime) startTime = ts;
    const progress = Math.min((ts - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 4); // Quartic ease out
    const current = target * eased;
    el.textContent = formatter
      ? formatter(current)
      : decimals > 0 ? current.toFixed(decimals) : String(Math.round(current));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function formatHrMin(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function StatCard({
  label,
  value,
  suffix,
  decimals = 0,
  formatter,
  icon: Icon,
  delay = 0,
  variant = 'default',
  clickable = false,
  selected = false,
  onClick,
  subtitle,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  formatter?: (value: number) => string;
  icon: any;
  delay?: number;
  variant?: 'default' | 'accent';
  clickable?: boolean;
  selected?: boolean;
  onClick?: () => void;
  subtitle?: string | undefined;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const prevValue = useRef(0);

  useEffect(() => {
    if (!ref.current) return;
    if (value !== prevValue.current) {
      animateCounter(ref.current, value, decimals, formatter);
      prevValue.current = value;
    }
  }, [value, decimals, formatter]);

  const isAccent = variant === 'accent';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      onClick={clickable && value > 0 ? onClick : undefined}
      className={`px-3 py-2 rounded-lg border flex items-center gap-2.5 group transition-all duration-300 ${
        isAccent
          ? 'shrink-0 bg-bg-surface-1 border-border/50 hover:border-accent/30'
          : 'min-w-0 bg-bg-surface-1 border-border/50 hover:border-accent/30'
      } ${
        clickable && value > 0 ? 'cursor-pointer' : ''
      } ${
        selected ? 'border-accent/50 bg-accent/5' : ''
      }`}
    >
      <div className={`p-1.5 rounded-md transition-colors ${
        selected ? 'bg-accent/15' : 'bg-bg-surface-2 group-hover:bg-accent/10'
      }`}>
        <Icon className={`w-3.5 h-3.5 transition-colors ${
          selected ? 'text-accent' : 'text-text-muted group-hover:text-accent'
        }`} />
      </div>
      <div className="flex flex-col min-w-0">
        <div className="flex items-baseline gap-0.5">
          <span ref={ref} className="text-lg font-bold text-text-primary tracking-tight leading-none whitespace-nowrap">
            {formatter ? formatter(value) : decimals > 0 ? value.toFixed(decimals) : Math.round(value)}
          </span>
          {!formatter && suffix && <span className="text-[10px] text-text-muted font-medium">{suffix}</span>}
        </div>
        <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider leading-none mt-0.5">{label}</span>
        {subtitle && <span className="text-[8px] text-text-muted/50 leading-none mt-0.5 truncate">{subtitle}</span>}
      </div>
    </motion.div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="px-3 py-2 rounded-lg border border-border/50 bg-bg-surface-1 flex items-center gap-2.5">
      <div className="p-1.5 rounded-md bg-bg-surface-2">
        <div className="w-3.5 h-3.5 rounded bg-bg-surface-3 animate-pulse" />
      </div>
      <div className="flex flex-col min-w-0 gap-1.5">
        <div className="h-4 w-12 rounded bg-bg-surface-3 animate-pulse" />
        <div className="h-2 w-16 rounded bg-bg-surface-3/70 animate-pulse" />
      </div>
    </div>
  );
}

interface StatsBarProps {
  totalHours: number;
  totalSessions: number;
  coveredHours: number;
  aiMultiplier: number;
  peakConcurrency: number;
  currentStreak: number;
  streakDetail?: StreakDetail;
  filesTouched: number;
  featuresShipped: number;
  bugsFixed: number;
  complexSolved: number;
  totalMilestones: number;
  completionRate: number;
  activeProjects: number;
  selectedCard?: StatCardType;
  onCardClick?: (type: StatCardType) => void;
  loading?: boolean;
}

function buildStreakSubtitle(s?: StreakDetail): string | undefined {
  if (!s) return undefined;
  const parts: string[] = [];
  if (s.longest > s.current) parts.push(`Best ${s.longest}`);
  if (s.freezesUsed > 0) parts.push(`❄${s.freezesUsed} used`);
  else if (s.freezesRemaining > 0) parts.push(`❄${s.freezesRemaining}`);
  if (s.activeDaysInWindow > 0 && s.windowDays > 0) {
    parts.push(`${s.activeDaysInWindow}/${s.windowDays}d`);
  }
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function StatsBar({
  totalHours,
  coveredHours,
  aiMultiplier,
  featuresShipped,
  bugsFixed,
  complexSolved: _complexSolved,
  currentStreak,
  streakDetail,
  totalMilestones,
  selectedCard,
  onCardClick,
  loading = false,
}: StatsBarProps) {
  const handleClick = (type: Exclude<StatCardType, null>) => {
    onCardClick?.(selectedCard === type ? null : type);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-4 lg:grid-cols-7 gap-2 mb-4">
      <StatCard
        label="Clock Time"
        value={coveredHours}
        formatter={formatHrMin}
        icon={Clock}
        delay={0.1}
        clickable
        selected={selectedCard === 'activeTime'}
        onClick={() => handleClick('activeTime')}
      />
      <StatCard
        label="AI Time"
        value={totalHours}
        formatter={formatHrMin}
        icon={Bot}
        delay={0.12}
        clickable
        selected={selectedCard === 'aiTime'}
        onClick={() => handleClick('aiTime')}
      />
      <StatCard
        label="Multiplier"
        value={aiMultiplier}
        suffix="x"
        decimals={2}
        icon={Layers}
        delay={0.15}
        clickable
        selected={selectedCard === 'parallel'}
        onClick={() => handleClick('parallel')}
      />
      <StatCard
        label="Milestones"
        value={totalMilestones}
        icon={Target}
        delay={0.2}
        clickable
        selected={selectedCard === 'milestones'}
        onClick={() => handleClick('milestones')}
      />
      <StatCard
        label="Features"
        value={featuresShipped}
        icon={Rocket}
        delay={0.25}
        clickable
        selected={selectedCard === 'features'}
        onClick={() => handleClick('features')}
      />
      <StatCard
        label="Bugs Fixed"
        value={bugsFixed}
        icon={Bug}
        delay={0.3}
        clickable
        selected={selectedCard === 'bugs'}
        onClick={() => handleClick('bugs')}
      />
      <StatCard
        label="Streak"
        value={currentStreak}
        suffix="days"
        icon={Zap}
        delay={0.45}
        variant="accent"
        clickable
        selected={selectedCard === 'streak'}
        onClick={() => handleClick('streak')}
        subtitle={buildStreakSubtitle(streakDetail)}
      />
    </div>
  );
}
