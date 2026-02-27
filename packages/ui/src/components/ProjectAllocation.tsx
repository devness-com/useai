import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { FolderKanban, ChevronDown } from 'lucide-react';
import type { SessionSeal } from '@useai/shared/types';

const PROJECT_COLORS = [
  '#b4f82c',
  '#60a5fa',
  '#f87171',
  '#a78bfa',
  '#fbbf24',
  '#34d399',
  '#f472b6',
  '#22d3ee',
];

const OTHER_COLOR = '#64748b';

type TimeMode = 'user' | 'ai';

function formatTime(seconds: number): string {
  if (seconds < 60) return '<1m';
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = (seconds / 3600).toFixed(1);
  return `${h}h`;
}

interface ProjectAllocationProps {
  sessions: SessionSeal[];
  byProject: Record<string, number>;
}

interface Segment {
  name: string;
  seconds: number;
  color: string;
  percentage: number;
}

function buildSegments(data: Record<string, number>): Segment[] {
  const entries = Object.entries(data)
    .filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]);

  if (entries.length === 0) return [];

  const total = entries.reduce((sum, [, s]) => sum + s, 0);
  const MAX_SLICES = 6;

  let visible: [string, number][];
  let otherSeconds = 0;

  if (entries.length <= MAX_SLICES) {
    visible = entries;
  } else {
    visible = entries.slice(0, MAX_SLICES);
    otherSeconds = entries.slice(MAX_SLICES).reduce((sum, [, s]) => sum + s, 0);
  }

  const result: Segment[] = visible.map(([name, seconds], i) => ({
    name,
    seconds,
    color: PROJECT_COLORS[i % PROJECT_COLORS.length]!,
    percentage: (seconds / total) * 100,
  }));

  if (otherSeconds > 0) {
    result.push({
      name: 'Other',
      seconds: otherSeconds,
      color: OTHER_COLOR,
      percentage: (otherSeconds / total) * 100,
    });
  }

  return result;
}

export function ProjectAllocation({ sessions, byProject }: ProjectAllocationProps) {
  const [timeMode, setTimeMode] = useState<TimeMode>('user');
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Proportional time-sharing sweep-line: when N projects run concurrently,
  // each gets 1/N of the wall-clock slice. This ensures per-project totals
  // sum to the global "User Time" (coveredHours) shown in the StatsBar.
  const byProjectUserTime = useMemo(() => {
    type Event = { time: number; project: string; delta: 1 | -1 };
    const events: Event[] = [];

    for (const s of sessions) {
      if (!s.project) continue;
      const start = new Date(s.started_at).getTime();
      const end = new Date(s.ended_at).getTime();
      if (end <= start) continue;
      events.push({ time: start, project: s.project, delta: 1 });
      events.push({ time: end, project: s.project, delta: -1 });
    }

    // Sort by time; at same time, ends before starts
    events.sort((a, b) => a.time - b.time || a.delta - b.delta);

    const map: Record<string, number> = {};
    // Track how many sessions each project has running
    const activeCount: Record<string, number> = {};
    let totalActive = 0;
    let prevTime = 0;

    for (const e of events) {
      // Distribute time from prevTime to e.time among active projects
      if (totalActive > 0 && e.time > prevTime) {
        const sliceMs = e.time - prevTime;
        // Count distinct active projects
        const activeProjects = Object.keys(activeCount).filter((p) => activeCount[p]! > 0);
        const numProjects = activeProjects.length;
        if (numProjects > 0) {
          const share = sliceMs / numProjects;
          for (const p of activeProjects) {
            map[p] = (map[p] ?? 0) + share;
          }
        }
      }

      prevTime = e.time;
      activeCount[e.project] = (activeCount[e.project] ?? 0) + e.delta;
      if (activeCount[e.project] === 0) delete activeCount[e.project];
      totalActive = Object.values(activeCount).reduce((sum, n) => sum + n, 0);
    }

    // Convert ms to seconds
    const result: Record<string, number> = {};
    for (const [project, ms] of Object.entries(map)) {
      if (ms > 0) result[project] = ms / 1000;
    }
    return result;
  }, [sessions]);

  const data = timeMode === 'user' ? byProjectUserTime : byProject;
  const segments = useMemo(() => buildSegments(data), [data]);

  if (segments.length === 0) return null;

  const totalSeconds = segments.reduce((sum, s) => sum + s.seconds, 0);

  // SVG donut geometry
  const size = 140;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 52;
  const strokeWidth = 18;
  const circumference = 2 * Math.PI * radius;

  // Build arc offsets
  let accumulated = 0;
  const arcs = segments.map((seg) => {
    const dashLength = (seg.percentage / 100) * circumference;
    const gap = circumference - dashLength;
    const offset = -accumulated + circumference * 0.25; // rotate to start at top
    accumulated += dashLength;
    return { ...seg, dashLength, gap, offset };
  });

  const LABELS: Record<TimeMode, string> = {
    user: 'User Time',
    ai: 'AI Time',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="rounded-xl bg-bg-surface-1 border border-border/50 p-4"
    >
      <div className="flex items-center justify-between mb-4 px-1">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-bg-surface-2">
            <FolderKanban className="w-3.5 h-3.5 text-text-muted" />
          </div>
          <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
            Project Allocation
          </h2>
        </div>

        {/* Time mode dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border/50 bg-bg-surface-2 text-[11px] text-text-secondary font-medium hover:border-text-muted/50 transition-colors"
          >
            {LABELS[timeMode]}
            <ChevronDown className="w-3 h-3 text-text-muted" />
          </button>
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 min-w-[120px] rounded-lg border border-border/50 bg-bg-surface-1 shadow-lg py-1">
                {(Object.entries(LABELS) as [TimeMode, string][]).map(([mode, label]) => (
                  <button
                    key={mode}
                    onClick={() => { setTimeMode(mode); setDropdownOpen(false); }}
                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                      mode === timeMode
                        ? 'text-accent bg-accent/10 font-medium'
                        : 'text-text-secondary hover:bg-bg-surface-2'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-6">
        {/* Donut chart */}
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            {/* Background ring */}
            <circle
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke="var(--color-bg-surface-2, #1e293b)"
              strokeWidth={strokeWidth}
              opacity={0.3}
            />
            {/* Segment arcs */}
            {arcs.map((arc, i) => (
              <motion.circle
                key={`${timeMode}-${arc.name}`}
                cx={cx}
                cy={cy}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${arc.dashLength} ${arc.gap}`}
                strokeDashoffset={arc.offset}
                strokeLinecap="butt"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{
                  duration: 0.5,
                  delay: 0.1 + i * 0.08,
                  ease: [0.22, 1, 0.36, 1],
                }}
              />
            ))}
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-lg font-bold text-text-primary leading-none">
              {segments.length}
            </span>
            <span className="text-[10px] text-text-muted mt-0.5">
              {segments.length === 1 ? 'project' : 'projects'}
            </span>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 min-w-0 space-y-1.5 w-full">
          {segments.map((seg, i) => (
            <motion.div
              key={seg.name}
              className="flex items-center gap-2.5"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                duration: 0.4,
                delay: 0.15 + i * 0.06,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: seg.color }}
              />
              <span className="text-xs text-text-secondary font-medium truncate flex-1 min-w-0">
                {seg.name}
              </span>
              <span className="text-[10px] text-text-muted font-mono shrink-0">
                {formatTime(seg.seconds)}
              </span>
              <span className="text-[10px] text-text-muted/70 font-mono w-10 text-right shrink-0">
                {seg.percentage.toFixed(0)}%
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Stacked bar summary */}
      <div className="mt-4 flex h-2 rounded-full overflow-hidden bg-bg-surface-2/30">
        {segments.map((seg) => {
          const pct = totalSeconds > 0 ? (seg.seconds / totalSeconds) * 100 : 0;
          if (pct === 0) return null;
          return (
            <motion.div
              key={seg.name}
              className="h-full"
              style={{ backgroundColor: seg.color }}
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
