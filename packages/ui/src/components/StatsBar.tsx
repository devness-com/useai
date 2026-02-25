import { useEffect, useRef } from 'react';
import { Clock, Rocket, Bug, Brain, Zap, Target, CheckCircle, FolderGit2 } from 'lucide-react';
import { motion } from 'motion/react';
import type { StatCardType } from './StatDetailPanel';

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
    const eased = 1 - Math.pow(1 - progress, 4); // Quartic ease out
    const current = target * eased;
    el.textContent =
      decimals > 0 ? current.toFixed(decimals) : String(Math.round(current));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

function StatCard({
  label,
  value,
  suffix,
  decimals = 0,
  icon: Icon,
  delay = 0,
  variant = 'default',
  clickable = false,
  selected = false,
  onClick,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  icon: any;
  delay?: number;
  variant?: 'default' | 'accent';
  clickable?: boolean;
  selected?: boolean;
  onClick?: () => void;
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
          : 'flex-1 min-w-[120px] bg-bg-surface-1 border-border/50 hover:border-accent/30'
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
          <span ref={ref} className="text-lg font-bold text-text-primary tracking-tight leading-none">
            {decimals > 0 ? value.toFixed(decimals) : Math.round(value)}
          </span>
          {suffix && <span className="text-[10px] text-text-muted font-medium">{suffix}</span>}
        </div>
        <span className="text-[9px] font-mono text-text-muted uppercase tracking-wider leading-none mt-0.5">{label}</span>
      </div>
    </motion.div>
  );
}

interface StatsBarProps {
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
  selectedCard?: StatCardType;
  onCardClick?: (type: StatCardType) => void;
}

export function StatsBar({
  totalHours,
  featuresShipped,
  bugsFixed,
  complexSolved,
  currentStreak,
  totalMilestones,
  completionRate,
  activeProjects,
  selectedCard,
  onCardClick,
}: StatsBarProps) {
  const handleClick = (type: Exclude<StatCardType, null>) => {
    onCardClick?.(selectedCard === type ? null : type);
  };

  return (
    <div className="flex gap-2 mb-4">
      <div className="grid grid-cols-3 lg:grid-cols-7 gap-2 flex-1">
        <StatCard
          label={totalHours < 1 ? 'Active Time' : 'Active Hours'}
          value={totalHours < 1 ? Math.round(totalHours * 60) : totalHours}
          suffix={totalHours < 1 ? 'min' : 'hrs'}
          decimals={totalHours < 1 ? 0 : 1}
          icon={Clock}
          delay={0.1}
        />
        <StatCard
          label="Milestones"
          value={totalMilestones}
          icon={Target}
          delay={0.15}
          clickable
          selected={selectedCard === 'milestones'}
          onClick={() => handleClick('milestones')}
        />
        <StatCard
          label="Features"
          value={featuresShipped}
          icon={Rocket}
          delay={0.2}
          clickable
          selected={selectedCard === 'features'}
          onClick={() => handleClick('features')}
        />
        <StatCard
          label="Bugs Fixed"
          value={bugsFixed}
          icon={Bug}
          delay={0.25}
          clickable
          selected={selectedCard === 'bugs'}
          onClick={() => handleClick('bugs')}
        />
        <StatCard
          label="Complex"
          value={complexSolved}
          icon={Brain}
          delay={0.3}
          clickable
          selected={selectedCard === 'complex'}
          onClick={() => handleClick('complex')}
        />
        <StatCard
          label="Completed"
          value={completionRate}
          suffix="%"
          icon={CheckCircle}
          delay={0.35}
        />
        <StatCard
          label="Projects"
          value={activeProjects}
          icon={FolderGit2}
          delay={0.4}
        />
      </div>
      <div className="w-px bg-border/30 self-stretch my-1" />
      <StatCard
        label="Streak"
        value={currentStreak}
        suffix="days"
        icon={Zap}
        delay={0.45}
        variant="accent"
      />
    </div>
  );
}
