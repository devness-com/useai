'use client';

import { useState, useMemo } from 'react';

interface DayData {
  date: string;
  hours: number;
}

interface ActivityHeatmapProps {
  data?: DayData[];
}

const DURATION_OPTIONS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 364 },
] as const;

function generateMockData(): DayData[] {
  const days: DayData[] = [];
  const today = new Date();
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const seed = d.getDay() + d.getDate() + d.getMonth();
    const random = Math.abs(Math.sin(seed * 9301 + 49297) * 233280) % 1;
    const isWeekend = d.getDay() === 0 || d.getDay() === 6;
    const hours =
      random < 0.3 ? 0 : isWeekend ? Math.round(random * 3 * 10) / 10 : Math.round(random * 7 * 10) / 10;
    days.push({ date: dateStr, hours });
  }
  return days;
}

function getColor(hours: number): string {
  if (hours === 0) return 'var(--bg-surface-2)';
  if (hours < 1) return 'rgba(var(--accent-rgb), 0.15)';
  if (hours < 2) return 'rgba(var(--accent-rgb), 0.3)';
  if (hours < 3) return 'rgba(var(--accent-rgb), 0.45)';
  if (hours < 5) return 'rgba(var(--accent-rgb), 0.65)';
  return 'rgba(var(--accent-rgb), 0.9)';
}

const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];
const CELL_SIZE = 12;
const CELL_GAP = 2;
const LABEL_WIDTH = 28;
const HEADER_HEIGHT = 18;

export function ActivityHeatmap({ data }: ActivityHeatmapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; date: string; hours: number } | null>(
    null,
  );
  const [durationDays, setDurationDays] = useState(364);

  const dayData = useMemo(() => data ?? generateMockData(), [data]);

  // Build a map for quick lookup
  const dataMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of dayData) {
      map.set(d.date, d.hours);
    }
    return map;
  }, [dayData]);

  // Build weeks grid based on selected duration
  const grid = useMemo(() => {
    const weeks: { date: string; hours: number; dayOfWeek: number }[][] = [];
    const today = new Date();

    const start = new Date(today);
    start.setDate(start.getDate() - durationDays);
    // Align to previous Sunday
    while (start.getDay() !== 0) {
      start.setDate(start.getDate() - 1);
    }

    let currentWeek: { date: string; hours: number; dayOfWeek: number }[] = [];
    const cursor = new Date(start);

    while (cursor <= today) {
      const dateStr = cursor.toISOString().split('T')[0];
      currentWeek.push({
        date: dateStr,
        hours: dataMap.get(dateStr) ?? 0,
        dayOfWeek: cursor.getDay(),
      });

      if (cursor.getDay() === 6) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
    }

    return weeks;
  }, [dataMap, durationDays]);

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; weekIndex: number }[] = [];
    let lastMonth = -1;

    grid.forEach((week, weekIdx) => {
      const firstDay = week[0];
      if (!firstDay) return;
      const d = new Date(firstDay.date);
      const month = d.getMonth();
      if (month !== lastMonth) {
        labels.push({
          label: d.toLocaleString('en', { month: 'short' }),
          weekIndex: weekIdx,
        });
        lastMonth = month;
      }
    });
    return labels;
  }, [grid]);

  const totalWidth = LABEL_WIDTH + grid.length * (CELL_SIZE + CELL_GAP);
  const totalHeight = HEADER_HEIGHT + 7 * (CELL_SIZE + CELL_GAP);

  // Compute hours for the visible window
  const today = new Date();
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - durationDays);
  const cutoffStr = cutoff.toISOString().split('T')[0];
  const visibleHours = dayData
    .filter((d) => d.date >= cutoffStr)
    .reduce((sum, d) => sum + d.hours, 0);

  const durationLabel = DURATION_OPTIONS.find((o) => o.days === durationDays)?.label ?? '1Y';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-mono text-text-muted tracking-wider">
          {Math.round(visibleHours)}h total in the last {durationLabel === '1Y' ? 'year' : durationLabel === '6M' ? '6 months' : durationLabel === '3M' ? '3 months' : 'month'}
        </span>
        <div className="flex items-center gap-3">
          {/* Duration selector */}
          <div className="flex items-center gap-0.5">
            {DURATION_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setDurationDays(opt.days)}
                className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded-md transition-colors ${
                  durationDays === opt.days
                    ? 'bg-accent/15 text-accent border border-accent/30'
                    : 'text-text-muted hover:text-text-secondary border border-transparent'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1 text-[10px] text-text-muted font-mono">
            <span>Less</span>
            {[0, 1, 2, 4, 6].map((h) => (
              <div
                key={h}
                className="w-[10px] h-[10px] rounded-[2px]"
                style={{ backgroundColor: getColor(h) }}
              />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-2">
        <svg
          width={totalWidth}
          height={totalHeight}
          viewBox={`0 0 ${totalWidth} ${totalHeight}`}
          className="max-w-full"
          role="img"
          aria-label={`Activity heatmap showing coding hours over the past ${durationLabel}`}
        >
          {/* Month labels */}
          {monthLabels.map((m) => (
            <text
              key={`${m.label}-${m.weekIndex}`}
              x={LABEL_WIDTH + m.weekIndex * (CELL_SIZE + CELL_GAP)}
              y={12}
              className="fill-text-muted text-[9px] font-mono"
            >
              {m.label}
            </text>
          ))}

          {/* Day labels */}
          {DAY_LABELS.map((label, i) =>
            label ? (
              <text
                key={`day-${i}`}
                x={0}
                y={HEADER_HEIGHT + i * (CELL_SIZE + CELL_GAP) + CELL_SIZE - 2}
                className="fill-text-muted text-[9px] font-mono"
              >
                {label}
              </text>
            ) : null,
          )}

          {/* Cells */}
          {grid.map((week, weekIdx) =>
            week.map((day) => {
              const x = LABEL_WIDTH + weekIdx * (CELL_SIZE + CELL_GAP);
              const y = HEADER_HEIGHT + day.dayOfWeek * (CELL_SIZE + CELL_GAP);
              return (
                <rect
                  key={day.date}
                  x={x}
                  y={y}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  rx={2}
                  fill={getColor(day.hours)}
                  className="cursor-pointer transition-opacity hover:opacity-80"
                  onMouseEnter={(e) => {
                    const rect = (e.target as SVGRectElement).getBoundingClientRect();
                    setTooltip({
                      x: rect.left + rect.width / 2,
                      y: rect.top,
                      date: day.date,
                      hours: day.hours,
                    });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
              );
            }),
          )}
        </svg>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 px-3 py-1.5 rounded-lg bg-bg-surface-1 border border-border text-xs font-mono text-text-primary shadow-lg pointer-events-none"
          style={{
            left: tooltip.x,
            top: tooltip.y - 36,
            transform: 'translateX(-50%)',
          }}
        >
          <span className="text-accent font-bold">{tooltip.hours}h</span>{' '}
          <span className="text-text-muted">on {tooltip.date}</span>
        </div>
      )}
    </div>
  );
}
