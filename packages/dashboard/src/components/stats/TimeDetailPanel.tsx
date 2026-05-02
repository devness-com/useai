import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Clock, Bot, Layers, Zap, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { SessionSeal, StreakDetail } from '../../lib/api';
import type { StatCardType } from './StatDetailPanel';
import { TOOL_INITIALS, TOOL_COLORS, TOOL_ICONS, resolveClient } from '../../constants/tools';
import { parseTimestamp } from '../../lib/stats';

type TimeCardType = 'activeTime' | 'aiTime' | 'parallel' | 'streak';

function isTimeCard(type: StatCardType): type is TimeCardType {
  return type === 'activeTime' || type === 'aiTime' || type === 'parallel' || type === 'streak';
}

interface TimeStats {
  totalHours: number;
  coveredHours: number;
  aiMultiplier: number;
  peakConcurrency: number;
}

const PANEL_CONFIG: Record<TimeCardType, {
  title: string;
  icon: typeof Clock;
  accentColor: string;
}> = {
  activeTime: {
    title: 'Clock Time',
    icon: Clock,
    accentColor: '#60a5fa',
  },
  aiTime: {
    title: 'AI Time',
    icon: Bot,
    accentColor: '#4ade80',
  },
  parallel: {
    title: 'Multiplier',
    icon: Layers,
    accentColor: '#a78bfa',
  },
  streak: {
    title: 'Streak',
    icon: Zap,
    accentColor: '#facc15',
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatHours(hours: number): string {
  if (hours < 1 / 60) return '< 1 min';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toFixed(1)} hrs`;
}

/** Compute merged active periods from sessions using sweep-line.
 *  Uses activeSegments when available (same logic as computeStats) to exclude idle time. */
function computeActivePeriods(sessions: SessionSeal[]): { start: number; end: number }[] {
  if (sessions.length === 0) return [];

  const events: { time: number; delta: number }[] = [];
  for (const s of sessions) {
    const sStart = parseTimestamp(s.startedAt);
    const sEnd = parseTimestamp(s.endedAt);

    if (s.activeSegments && s.activeSegments.length > 0) {
      for (const [segStart, segEnd] of s.activeSegments) {
        const t0 = parseTimestamp(segStart);
        const t1 = parseTimestamp(segEnd);
        if (t1 <= t0) continue;
        events.push({ time: t0, delta: 1 });
        events.push({ time: t1, delta: -1 });
      }
    } else {
      // Fallback: cap end to startedAt + duration (same as computeStats)
      if (sEnd <= sStart) continue;
      const activeEnd = Math.min(sStart + s.durationMs, sEnd);
      events.push({ time: sStart, delta: 1 });
      events.push({ time: activeEnd, delta: -1 });
    }
  }
  events.sort((a, b) => a.time - b.time || a.delta - b.delta);

  const periods: { start: number; end: number }[] = [];
  let running = 0;
  let periodStart = 0;
  for (const e of events) {
    const wasActive = running > 0;
    running += e.delta;
    if (!wasActive && running > 0) {
      periodStart = e.time;
    } else if (wasActive && running === 0) {
      periods.push({ start: periodStart, end: e.time });
    }
  }
  return periods;
}

function ExplanationBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-2.5 rounded-lg bg-bg-surface-1 border border-border/50 text-xs text-text-secondary leading-relaxed">
      {children}
    </div>
  );
}

function CalcRow({ label, value, tooltip }: { label: string; value: string; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-1" title={tooltip}>
      <span className={`text-xs text-text-muted ${tooltip ? 'cursor-help' : ''}`}>{label}</span>
      <span className="text-xs font-mono font-bold text-text-primary">{value}</span>
    </div>
  );
}

interface TimeDetailPanelProps {
  type: StatCardType;
  sessions: SessionSeal[];
  allSessions?: SessionSeal[];
  currentStreak?: number;
  streakDetail?: StreakDetail;
  stats: TimeStats;
  showPublic?: boolean;
  onClose: () => void;
}

export function TimeDetailPanel({ type, sessions, allSessions, currentStreak = 0, streakDetail, stats, showPublic = false, onClose }: TimeDetailPanelProps) {
  useEffect(() => {
    if (!type || !isTimeCard(type)) return;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [type]);

  if (!type || !isTimeCard(type)) return null;

  const config = PANEL_CONFIG[type];
  const Icon = config.icon;
  const sorted = [...sessions].sort(
    (a, b) => parseTimestamp(b.startedAt) - parseTimestamp(a.startedAt),
  );

  return (
    <AnimatePresence>
      {type && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-0 bottom-0 top-[53px] bg-black/40 backdrop-blur-sm z-40"
            onClick={onClose}
          />

          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed top-[53px] right-0 h-[calc(100%-53px)] w-full max-w-md bg-bg-base border-l border-border/50 z-40 flex flex-col shadow-2xl"
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
                  {type === 'streak'
                    ? `${currentStreak} day${currentStreak === 1 ? '' : 's'} consecutive`
                    : `${sessions.length} prompts in window`}
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
            <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-4">
              {/* Explanation + calculation */}
              {type === 'activeTime' && (
                <ActiveTimeContent stats={stats} sessions={sessions} />
              )}
              {type === 'aiTime' && (
                <AITimeContent stats={stats} sessions={sorted} showPublic={showPublic} />
              )}
              {type === 'parallel' && (
                <ParallelContent stats={stats} sessions={sorted} showPublic={showPublic} />
              )}
              {type === 'streak' && (
                <StreakContent
                  allSessions={allSessions ?? sessions}
                  currentStreak={currentStreak}
                  streakDetail={streakDetail}
                />
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function ActiveTimeContent({ stats, sessions }: { stats: TimeStats; sessions: SessionSeal[] }) {
  const periods = computeActivePeriods(sessions);

  return (
    <>
      <ExplanationBlock>
        How long <strong>you</strong> were actively working with AI. Overlapping sessions count once.
      </ExplanationBlock>

      <div className="rounded-lg border border-border/50 bg-bg-surface-1 divide-y divide-border/30">
        <CalcRow label="Clock time" value={formatHours(stats.coveredHours)} />
        <CalcRow label="AI time" value={formatHours(stats.totalHours)} />
        <CalcRow label="Prompts" value={String(sessions.length)} tooltip="Inclusive of subagent prompts — when a main agent spawns subagents, each subagent prompt is counted separately" />
      </div>

      {periods.length > 0 && (
        <>
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider px-1 pt-2">
            Active Periods
          </div>
          <div className="space-y-1">
            {periods.map((p, i) => {
              const durMin = (p.end - p.start) / 60000;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: i * 0.02 }}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-bg-surface-1 transition-colors"
                >
                  <div className="w-2 h-2 rounded-full bg-accent/60 flex-shrink-0" />
                  <span className="text-xs font-mono text-text-secondary flex-1">
                    {new Date(p.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                    {' → '}
                    {new Date(p.end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true })}
                  </span>
                  <span className="text-xs font-mono font-bold text-text-primary">
                    {durMin < 1 ? '< 1m' : durMin < 60 ? `${Math.round(durMin)}m` : `${(durMin / 60).toFixed(1)}h`}
                  </span>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

function AITimeContent({ stats, sessions, showPublic }: { stats: TimeStats; sessions: SessionSeal[]; showPublic: boolean }) {
  return (
    <>
      <ExplanationBlock>
        Total AI work done across all sessions. Parallel sessions stack &mdash; so this can be more than Clock Time.
      </ExplanationBlock>

      <div className="rounded-lg border border-border/50 bg-bg-surface-1 divide-y divide-border/30">
        <CalcRow label="AI time" value={formatHours(stats.totalHours)} />
        <CalcRow label="Clock time" value={formatHours(stats.coveredHours)} />
        <CalcRow label="Multiplier" value={`${stats.aiMultiplier.toFixed(2)}x`} />
        <CalcRow label="Prompts" value={String(sessions.length)} tooltip="Inclusive of subagent prompts — when a main agent spawns subagents, each subagent prompt is counted separately" />
      </div>

      <SessionList sessions={sessions} showPublic={showPublic} />
    </>
  );
}

function ParallelContent({ stats, sessions, showPublic }: { stats: TimeStats; sessions: SessionSeal[]; showPublic: boolean }) {
  return (
    <>
      <ExplanationBlock>
        AI Time &divide; Clock Time
      </ExplanationBlock>

      <div className="rounded-lg border border-border/50 bg-bg-surface-1 divide-y divide-border/30">
        <CalcRow label="Multiplier" value={`${stats.aiMultiplier.toFixed(2)}x`} />
        <CalcRow label="Peak concurrent" value={String(stats.peakConcurrency)} />
        <CalcRow label="Prompts" value={String(sessions.length)} tooltip="Inclusive of subagent prompts — when a main agent spawns subagents, each subagent prompt is counted separately" />
      </div>

      <SessionList sessions={sessions} showPublic={showPublic} />
    </>
  );
}

/** Compute per-day stats from all sessions, sorted newest first */
function computeActiveDays(sessions: SessionSeal[]): {
  date: string; label: string; count: number;
  gainedSeconds: number; spentSeconds: number; boost: number;
}[] {
  // Group sessions by date
  const dayMap = new Map<string, SessionSeal[]>();
  for (const s of sessions) {
    const d = new Date(parseTimestamp(s.startedAt));
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const existing = dayMap.get(key);
    if (existing) existing.push(s);
    else dayMap.set(key, [s]);
  }

  return [...dayMap.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([date, daySessions]) => {
      const d = new Date(date + 'T12:00:00');
      const label = d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      const gainedSeconds = daySessions.reduce((sum, s) => sum + Math.round(s.durationMs / 1000), 0);
      // Compute spent time (union of intervals) for this day
      const periods = computeActivePeriods(daySessions);
      const spentMs = periods.reduce((sum, p) => sum + (p.end - p.start), 0);
      const spentSeconds = spentMs / 1000;
      const boost = spentSeconds > 0 ? gainedSeconds / spentSeconds : 0;
      return { date, label, count: daySessions.length, gainedSeconds, spentSeconds, boost };
    });
}

function StreakContent({
  allSessions,
  currentStreak,
  streakDetail,
}: {
  allSessions: SessionSeal[];
  currentStreak: number;
  streakDetail?: StreakDetail | undefined;
}) {
  const validSessions = useMemo(() => allSessions.filter(s => !!s.endedAt && s.durationMs > 0), [allSessions]);
  const activeDays = computeActiveDays(validSessions);

  // Mark which days are part of the current streak (consecutive from today backwards).
  // Daemon's streak length already accounts for freezes + weekend forgiveness, so
  // walking back N calendar days isn't quite right anymore — but it's close enough
  // for the calendar visualization, and the precise data is shown in the rows below.
  const streakDates = new Set<string>();
  const today = new Date();
  for (let i = 0; i < currentStreak; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    streakDates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }

  return (
    <>
      <ExplanationBlock>
        Days in a row you used AI. Weekends are free; you have 2 freezes a month
        for missed weekdays. Keep it going!
      </ExplanationBlock>

      <div className="rounded-lg border border-border/50 bg-bg-surface-1 divide-y divide-border/30">
        <CalcRow label="Current streak" value={`${currentStreak} day${currentStreak === 1 ? '' : 's'}`} />
        {streakDetail && streakDetail.longest > 0 && (
          <CalcRow label="Longest streak" value={`${streakDetail.longest} day${streakDetail.longest === 1 ? '' : 's'}`} />
        )}
        {streakDetail && (
          <CalcRow
            label={`Active days (last ${streakDetail.windowDays})`}
            value={`${streakDetail.activeDaysInWindow} of ${streakDetail.windowDays}`}
          />
        )}
        {streakDetail && (
          <CalcRow
            label="Freezes"
            value={
              streakDetail.freezesUsed > 0
                ? `❄ ${streakDetail.freezesUsed} used · ${streakDetail.freezesRemaining} left`
                : `❄ ${streakDetail.freezesRemaining} available`
            }
          />
        )}
        <CalcRow label="Total active days" value={String(activeDays.length)} />
      </div>

      {activeDays.length > 0 && (
        <>
          <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider px-1 pt-2">
            Active Days
          </div>
          <div className="space-y-1">
            {activeDays.map((day, i) => {
              const inStreak = streakDates.has(day.date);
              return (
                <motion.div
                  key={day.date}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.6) }}
                  className="flex items-center gap-2 py-2 px-2 rounded-lg hover:bg-bg-surface-1 transition-colors"
                >
                  {inStreak ? (
                    <Zap className="w-3 h-3 flex-shrink-0" style={{ color: '#facc15' }} />
                  ) : (
                    <Calendar className="w-3 h-3 flex-shrink-0 text-text-muted" />
                  )}
                  <span className={`text-xs font-mono flex-1 min-w-0 ${inStreak ? 'text-text-primary' : 'text-text-secondary'}`}>
                    {day.label}
                  </span>
                  <span className="text-[10px] text-text-muted font-mono whitespace-nowrap" title="User time">
                    {formatDuration(day.spentSeconds)}
                  </span>
                  <span className="text-[10px] text-text-muted">/</span>
                  <span className="text-[10px] font-mono font-bold text-text-primary whitespace-nowrap" title="AI time">
                    {formatDuration(day.gainedSeconds)}
                  </span>
                  {day.boost > 0 && (
                    <span className="text-[10px] font-mono font-bold whitespace-nowrap" style={{ color: '#a78bfa' }} title="Multiplier">
                      {day.boost.toFixed(2)}x
                    </span>
                  )}
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

const SESSION_BATCH_SIZE = 25;

function SessionList({ sessions, showPublic }: { sessions: SessionSeal[]; showPublic: boolean }) {
  const [visibleCount, setVisibleCount] = useState(SESSION_BATCH_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisibleCount((prev) => prev + SESSION_BATCH_SIZE);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sessions, visibleCount]);

  useEffect(() => {
    setVisibleCount(SESSION_BATCH_SIZE);
  }, [sessions.length]);

  if (sessions.length === 0) return null;

  const visible = sessions.slice(0, visibleCount);
  const hasMore = visibleCount < sessions.length;

  return (
    <>
      <div className="text-[10px] font-mono text-text-muted uppercase tracking-wider px-1 pt-2">
        Prompts
      </div>
      <div className="space-y-1">
        {visible.map((s, i) => {
          const client = resolveClient(s.client);
          const initials = TOOL_INITIALS[client] ?? client.slice(0, 2).toUpperCase();
          const toolColor = TOOL_COLORS[client] ?? '#91919a';
          const isCursor = client === 'cursor';
          const iconColor = isCursor ? 'var(--text-primary)' : toolColor;
          const iconPath = TOOL_ICONS[client];
          const displayTitle = showPublic ? (s.title ?? 'Untitled') : (s.privateTitle || s.title || 'Untitled');

          return (
            <motion.div
              key={s.promptId}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.02, 0.6) }}
              className="flex items-start gap-2.5 py-2 px-2 rounded-lg hover:bg-bg-surface-1 transition-colors group"
            >
              <div
                className="w-5 h-5 rounded flex items-center justify-center text-[7px] font-bold font-mono flex-shrink-0 mt-0.5"
                style={{ backgroundColor: `${toolColor}15`, color: toolColor, border: `1px solid ${toolColor}20` }}
              >
                {iconPath ? (
                  <div
                    className="w-3 h-3"
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

              <div className="flex-1 min-w-0">
                <p className="text-sm text-text-secondary group-hover:text-text-primary transition-colors leading-snug truncate">
                  {displayTitle}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] font-mono text-text-muted">
                    {formatDuration(Math.round(s.durationMs / 1000))}
                  </span>
                  <span className="text-[10px] text-text-muted">
                    {formatTime(s.startedAt)}
                  </span>
                  {s.project && (
                    <span className="text-[10px] text-text-muted font-mono truncate">
                      {s.project}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
        {hasMore && (
          <div ref={sentinelRef} className="py-2 text-center">
            <span className="text-[10px] text-text-muted font-mono">
              Showing {visible.length} of {sessions.length}...
            </span>
          </div>
        )}
      </div>
    </>
  );
}
