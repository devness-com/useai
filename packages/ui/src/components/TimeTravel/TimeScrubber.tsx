import { useRef, useMemo, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import type { SessionSeal, Milestone } from '@useai/shared/types';
import { CATEGORY_COLORS, TOOL_DISPLAY_NAMES } from '../../constants';
import type { TimeScale } from './types';

interface TimeScrubberProps {
  value: number;
  onChange: (newValue: number) => void;
  scale: TimeScale;
  sessions?: SessionSeal[];
  milestones?: Milestone[];
  showPublic?: boolean;
}

const SCALE_CONFIG: Record<
  TimeScale,
  {
    visibleDuration: number;
    majorTickInterval: number;
    minorTickInterval: number;
    labelFormat: (date: Date) => string;
  }
> = {
  '15m': {
    visibleDuration: 15 * 60 * 1000,
    majorTickInterval: 5 * 60 * 1000,
    minorTickInterval: 1 * 60 * 1000,
    labelFormat: (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
  },
  '30m': {
    visibleDuration: 30 * 60 * 1000,
    majorTickInterval: 10 * 60 * 1000,
    minorTickInterval: 2 * 60 * 1000,
    labelFormat: (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
  },
  '1h': {
    visibleDuration: 60 * 60 * 1000,
    majorTickInterval: 15 * 60 * 1000,
    minorTickInterval: 5 * 60 * 1000,
    labelFormat: (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
  },
  '12h': {
    visibleDuration: 12 * 60 * 60 * 1000,
    majorTickInterval: 2 * 60 * 60 * 1000,
    minorTickInterval: 30 * 60 * 1000,
    labelFormat: (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
  },
  '24h': {
    visibleDuration: 24 * 60 * 60 * 1000,
    majorTickInterval: 4 * 60 * 60 * 1000,
    minorTickInterval: 1 * 60 * 60 * 1000,
    labelFormat: (d) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true }),
  },
  '7d': {
    visibleDuration: 7 * 24 * 60 * 60 * 1000,
    majorTickInterval: 24 * 60 * 60 * 1000,
    minorTickInterval: 6 * 60 * 60 * 1000,
    labelFormat: (d) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }),
  },
  '30d': {
    visibleDuration: 30 * 24 * 60 * 60 * 1000,
    majorTickInterval: 7 * 24 * 60 * 60 * 1000,
    minorTickInterval: 24 * 60 * 60 * 1000,
    labelFormat: (d) => d.toLocaleDateString([], { month: 'short', day: 'numeric' }),
  },
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function TimeScrubber({
  value,
  onChange,
  scale,
  sessions = [],
  milestones = [],
  showPublic = false,
}: TimeScrubberProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    setWidth(containerRef.current.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  const config = SCALE_CONFIG[scale];
  const pxPerMs = width > 0 ? width / config.visibleDuration : 0;

  // Drag handling (native pointer events)
  const [dragging, setDragging] = useState(false);
  const lastX = useRef(0);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      setDragging(true);
      lastX.current = e.clientX;
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragging || pxPerMs === 0) return;
      const dx = e.clientX - lastX.current;
      lastX.current = e.clientX;
      onChange(value + -dx / pxPerMs);
    },
    [dragging, pxPerMs, value, onChange],
  );

  const handlePointerUp = useCallback(() => {
    setDragging(false);
  }, []);

  // Generate ticks — right-edge anchored (value = right edge)
  const ticks = useMemo(() => {
    if (!width || pxPerMs === 0) return [];

    const startTime = value - config.visibleDuration;
    const endTime = value;
    const renderStart = startTime - config.majorTickInterval;
    const renderEnd = endTime + config.majorTickInterval;

    const result: { type: 'major' | 'minor'; time: number; position: number; label?: string }[] = [];

    // Major ticks
    const firstMajorTick =
      Math.ceil(renderStart / config.majorTickInterval) * config.majorTickInterval;
    for (let t = firstMajorTick; t <= renderEnd; t += config.majorTickInterval) {
      result.push({
        type: 'major',
        time: t,
        position: (t - value) * pxPerMs,
        label: config.labelFormat(new Date(t)),
      });
    }

    // Minor ticks
    const firstMinorTick =
      Math.ceil(renderStart / config.minorTickInterval) * config.minorTickInterval;
    for (let t = firstMinorTick; t <= renderEnd; t += config.minorTickInterval) {
      if (t % config.majorTickInterval === 0) continue;
      result.push({
        type: 'minor',
        time: t,
        position: (t - value) * pxPerMs,
      });
    }

    return result;
  }, [value, width, pxPerMs, config]);

  // Pre-parse sessions for efficient rendering
  const parsedSessions = useMemo(
    () =>
      sessions.map((s) => ({
        session: s,
        start: new Date(s.started_at).getTime(),
        end: new Date(s.ended_at).getTime(),
      })),
    [sessions],
  );

  // Visible session blocks — right-edge anchored
  const sessionBlocks = useMemo(() => {
    if (!width || pxPerMs === 0) return [];

    const startTime = value - config.visibleDuration;
    const endTime = value;

    return parsedSessions
      .filter((s) => s.start <= endTime && s.end >= startTime)
      .map((s) => ({
        session: s.session,
        leftOffset: (Math.max(s.start, startTime) - value) * pxPerMs,
        width: (Math.min(s.end, endTime) - Math.max(s.start, startTime)) * pxPerMs,
      }));
  }, [parsedSessions, value, width, pxPerMs, config]);

  // Pre-parse milestones
  const parsedMilestones = useMemo(
    () =>
      milestones
        .map((m) => ({ milestone: m, time: new Date(m.created_at).getTime() }))
        .sort((a, b) => a.time - b.time),
    [milestones],
  );

  // Visible milestone dots (binary search for range) — right-edge anchored
  const milestoneDots = useMemo(() => {
    if (!width || pxPerMs === 0 || !parsedMilestones.length) return [];

    const startTime = value - config.visibleDuration;
    const endTime = value;

    // Binary search for start
    let lo = 0,
      hi = parsedMilestones.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (parsedMilestones[mid]!.time < startTime) lo = mid + 1;
      else hi = mid;
    }
    const startIdx = lo;

    // Binary search for end
    hi = parsedMilestones.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (parsedMilestones[mid]!.time <= endTime) lo = mid + 1;
      else hi = mid;
    }
    const endIdx = lo;

    const result = [];
    for (let i = startIdx; i < endIdx; i++) {
      const m = parsedMilestones[i]!;
      result.push({
        ...m,
        offset: (m.time - value) * pxPerMs,
      });
    }
    return result;
  }, [parsedMilestones, value, width, pxPerMs, config]);

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    type: 'session' | 'milestone';
    data: SessionSeal | Milestone;
    x: number;
    y: number;
  } | null>(null);

  // Dismiss tooltip on drag
  const tooltipValueRef = useRef(value);
  useEffect(() => {
    if (tooltip && Math.abs(value - tooltipValueRef.current) > 1000) {
      setTooltip(null);
    }
    tooltipValueRef.current = value;
  }, [value, tooltip]);

  return (
    <div className="relative h-16">
      <div
        className="absolute inset-0 bg-transparent border-t border-border/50 overflow-hidden select-none touch-none cursor-grab active:cursor-grabbing"
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        {/* Right-edge "now" indicator */}
        <div className="absolute right-0 top-0 bottom-0 w-[2px] bg-accent/40 z-30" />

        {/* Ticks + markers container (anchored at right edge) */}
        <div className="absolute right-0 top-0 bottom-0 w-0 pointer-events-none">
          {/* Ticks */}
          {ticks.map((tick) => (
            <div
              key={tick.time}
              className={`absolute top-0 border-l ${tick.type === 'major' ? 'border-border/60' : 'border-border/30'}`}
              style={{
                left: tick.position,
                height: tick.type === 'major' ? '100%' : '35%',
                bottom: 0,
              }}
            >
              {tick.type === 'major' && tick.label && (
                <span className="absolute top-2 left-2 text-[9px] font-bold text-text-muted uppercase tracking-wider whitespace-nowrap bg-bg-surface-1/80 px-1 py-0.5 rounded">
                  {tick.label}
                </span>
              )}
            </div>
          ))}

          {/* Session blocks */}
          {sessionBlocks.map((block) => (
            <div
              key={block.session.session_id}
              className="absolute bottom-0 rounded-t-md pointer-events-auto cursor-pointer transition-opacity hover:opacity-80"
              style={{
                left: block.leftOffset,
                width: Math.max(block.width, 3),
                height: '45%',
                backgroundColor: 'rgba(var(--accent-rgb), 0.15)',
                borderTop: '2px solid rgba(var(--accent-rgb), 0.5)',
                boxShadow: 'inset 0 1px 10px rgba(var(--accent-rgb), 0.05)',
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  type: 'session',
                  data: block.session,
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}

          {/* Milestone dots */}
          {milestoneDots.map((dot, i) => (
            <div
              key={i}
              className="absolute bottom-2 pointer-events-auto cursor-pointer z-40 transition-transform hover:scale-125"
              style={{
                left: dot.offset,
                transform: 'translateX(-50%)',
              }}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setTooltip({
                  type: 'milestone',
                  data: dot.milestone,
                  x: rect.left + rect.width / 2,
                  y: rect.top,
                });
              }}
              onMouseLeave={() => setTooltip(null)}
              onClick={(e) => {
                e.stopPropagation();
                onChange(dot.time);
              }}
            >
              <div
                className="w-3.5 h-3.5 rounded-full border-2 border-bg-surface-1 shadow-lg"
                style={{
                  backgroundColor:
                    CATEGORY_COLORS[dot.milestone.category] ?? '#9c9588',
                  boxShadow: `0 0 10px ${CATEGORY_COLORS[dot.milestone.category]}50`,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip portal */}
      {tooltip &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              transform: 'translate(-50%, -100%)',
            }}
          >
            <div className="mb-3 bg-bg-surface-3/95 backdrop-blur-md text-text-primary rounded-xl shadow-2xl px-3 py-2.5 text-[11px] min-w-[180px] max-w-[280px] border border-border/50 animate-in fade-in zoom-in-95 duration-200">
              {tooltip.type === 'session' ? (
                <SessionTooltip session={tooltip.data as SessionSeal} showPublic={showPublic} />
              ) : (
                <MilestoneTooltip milestone={tooltip.data as Milestone} showPublic={showPublic} />
              )}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-bg-surface-3/95 border-r border-b border-border/50 rotate-45" />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function SessionTooltip({ session, showPublic }: { session: SessionSeal; showPublic: boolean }) {
  const name = TOOL_DISPLAY_NAMES[session.client] ?? session.client;
  const displayTitle = showPublic
    ? (session.title || session.project || `${name} Session`)
    : (session.private_title || session.title || session.project || `${name} Session`);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-bold text-xs text-accent uppercase tracking-widest">{name}</span>
        <span className="text-[10px] text-text-muted font-mono">{formatDuration(session.duration_seconds)}</span>
      </div>
      <div className="h-px bg-border/50 my-0.5" />
      <div className="text-text-primary font-medium">{displayTitle}</div>
      <div className="text-text-secondary capitalize text-[10px]">{session.task_type}</div>
    </div>
  );
}

function MilestoneTooltip({ milestone, showPublic }: { milestone: Milestone; showPublic: boolean }) {
  const title = showPublic ? milestone.title : (milestone.private_title ?? milestone.title);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="font-bold text-[10px] uppercase tracking-widest" style={{ color: CATEGORY_COLORS[milestone.category] ?? '#9c9588' }}>
          {milestone.category}
        </span>
        {milestone.complexity && (
          <span className="text-[9px] font-mono text-text-muted font-bold border border-border/50 px-1 rounded uppercase">
            {milestone.complexity}
          </span>
        )}
      </div>
      <div className="h-px bg-border/50 my-0.5" />
      <div className="font-bold text-xs break-words text-text-primary">{title}</div>
      {!showPublic && milestone.private_title && (
        <div className="text-[10px] text-text-muted italic opacity-70">Public: {milestone.title}</div>
      )}
    </div>
  );
}
