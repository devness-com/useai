import { useState, useEffect, useCallback, useRef } from 'react';
import { RotateCcw, ChevronLeft, ChevronRight, Edit2, Calendar, Clock } from 'lucide-react';
import { StatusBadge } from '../StatusBadge';
import { TimeScrubber } from './TimeScrubber';
import { SCALE_MS, SCALE_LABELS } from './types';
import type { TimeScale } from './types';
import type { SessionSeal, Milestone } from '@useai/shared/types';

interface TimeTravelPanelProps {
  value: number | null;
  onChange: (time: number | null) => void;
  scale: TimeScale;
  onScaleChange: (scale: TimeScale) => void;
  sessions?: SessionSeal[];
  milestones?: Milestone[];
  showPublic?: boolean;
}

function parseTimeInput(input: string, referenceTimestamp: number): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const date = new Date(referenceTimestamp);

  // 12-hour format
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1]!, 10);
    const minutes = parseInt(match12[2]!, 10);
    const seconds = match12[3] ? parseInt(match12[3]!, 10) : 0;
    const period = match12[4]!.toUpperCase();

    if (hours < 1 || hours > 12 || minutes > 59 || seconds > 59) return null;
    if (period === 'AM' && hours === 12) hours = 0;
    if (period === 'PM' && hours !== 12) hours += 12;

    date.setHours(hours, minutes, seconds, 0);
    return date.getTime();
  }

  // 24-hour format
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (match24) {
    const hours = parseInt(match24[1]!, 10);
    const minutes = parseInt(match24[2]!, 10);
    const seconds = match24[3] ? parseInt(match24[3]!, 10) : 0;

    if (hours > 23 || minutes > 59 || seconds > 59) return null;
    date.setHours(hours, minutes, seconds, 0);
    return date.getTime();
  }

  return null;
}

const SCALES: TimeScale[] = ['15m', '30m', '1h', '12h', '24h', '7d', '30d'];

export function TimeTravelPanel({
  value,
  onChange,
  scale,
  onScaleChange,
  sessions,
  showPublic = false,
}: TimeTravelPanelProps) {
  const isLive = value === null;

  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!isLive) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [isLive]);

  const effectiveTime = isLive ? now : value;

  // Editing state
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [timeInput, setTimeInput] = useState('');
  const timeInputRef = useRef<HTMLInputElement>(null);
  const wasLiveRef = useRef(false);
  const originalTimeInputRef = useRef('');

  // Snap-to-live hysteresis
  const snappedToLiveRef = useRef(false);
  const snapTimeRef = useRef(0);

  const handleScrubberChange = useCallback(
    (newTime: number) => {
      const now = Date.now();

      if (newTime >= now - 2000) {
        snappedToLiveRef.current = true;
        snapTimeRef.current = now;
        onChange(null);
        return;
      }

      if (snappedToLiveRef.current && now - snapTimeRef.current < 300) {
        onChange(null);
        return;
      }

      if (snappedToLiveRef.current && newTime >= now - 10000) {
        onChange(null);
        return;
      }

      snappedToLiveRef.current = false;
      onChange(newTime);
    },
    [onChange],
  );

  const handleJump = (deltaMs: number) => {
    const base = effectiveTime;
    const newTime = base + deltaMs;
    // Use 60s threshold: when in history mode the `now` timer stops, so
    // effectiveTime is stale by however long the user waited before clicking.
    // 60s handles any realistic delay while being negligible vs the smallest
    // window scale (15m = 900s).
    if (newTime >= Date.now() - 60_000) {
      onChange(null); // snap to live
    } else {
      onChange(newTime);
    }
  };

  const startEditingTime = () => {
    wasLiveRef.current = isLive;
    onChange(effectiveTime);
    const formatted = new Date(effectiveTime).toLocaleTimeString([], {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    originalTimeInputRef.current = formatted;
    setTimeInput(formatted);
    setIsEditingTime(true);
    requestAnimationFrame(() => timeInputRef.current?.select());
  };

  const commitTimeEdit = () => {
    setIsEditingTime(false);
    if (wasLiveRef.current && timeInput === originalTimeInputRef.current) {
      onChange(null);
      return;
    }
    const parsed = parseTimeInput(timeInput, effectiveTime);
    if (parsed !== null) {
      onChange(Math.min(parsed, Date.now()));
    }
  };

  const handleTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      commitTimeEdit();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsEditingTime(false);
      if (wasLiveRef.current) onChange(null);
      return;
    }
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;

    e.preventDefault();
    const input = timeInputRef.current;
    if (!input) return;

    const cursorPos = input.selectionStart ?? 0;
    const direction = e.key === 'ArrowUp' ? 1 : -1;
    const parsed = parseTimeInput(timeInput, effectiveTime);
    if (parsed === null) return;

    const firstColon = timeInput.indexOf(':');
    const secondColon = timeInput.indexOf(':', firstColon + 1);
    const spacePos = timeInput.lastIndexOf(' ');

    let deltaMs: number;
    if (cursorPos <= firstColon) {
      deltaMs = direction * 3_600_000;
    } else if (secondColon > -1 && cursorPos <= secondColon) {
      deltaMs = direction * 60_000;
    } else if (spacePos > -1 && cursorPos <= spacePos) {
      deltaMs = direction * 1_000;
    } else {
      deltaMs = direction * 12 * 3_600_000;
    }

    const newTime = Math.min(parsed + deltaMs, Date.now());
    const formatted = new Date(newTime).toLocaleTimeString([], {
      hour12: true,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    setTimeInput(formatted);
    onChange(newTime);

    requestAnimationFrame(() => {
      if (input) input.setSelectionRange(cursorPos, cursorPos);
    });
  };

  return (
    <div className="flex flex-col bg-bg-surface-1 border border-border/50 rounded-2xl overflow-hidden mb-8 shadow-xl">
      {/* Top bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between px-6 py-3 border-b border-border/50 gap-4">
        {/* Left: Time + date display */}
        <div className="flex flex-col items-start gap-0.5">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 h-8">
              {isEditingTime ? (
                <input
                  ref={timeInputRef}
                  type="text"
                  value={timeInput}
                  onChange={(e) => setTimeInput(e.target.value)}
                  onBlur={commitTimeEdit}
                  onKeyDown={handleTimeKeyDown}
                  className={`text-xl font-mono font-bold tracking-tight bg-bg-surface-2 border rounded-lg px-2 -ml-2 w-[155px] outline-none text-text-primary ${isLive ? 'border-accent' : 'border-history'}`}
                  style={{ boxShadow: isLive ? '0 0 10px rgba(var(--accent-rgb), 0.2)' : '0 0 10px rgba(var(--history-rgb), 0.2)' }}
                />
              ) : (
                <button
                  onClick={startEditingTime}
                  className="group flex items-center gap-2 hover:bg-bg-surface-2/50 rounded-lg px-2 -ml-2 py-1 transition-all cursor-text"
                  title="Click to edit time"
                >
                  <Clock className={`w-5 h-5 ${isLive ? 'text-text-muted' : 'text-history'}`} />
                  <span
                    className={`text-xl font-mono font-bold tracking-tight tabular-nums ${isLive ? 'text-text-primary' : 'text-history'}`}
                  >
                    {new Date(effectiveTime).toLocaleTimeString([], {
                      hour12: true,
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })}
                  </span>
                </button>
              )}

              <button
                onClick={isEditingTime ? commitTimeEdit : startEditingTime}
                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                  isEditingTime
                    ? isLive
                      ? 'bg-accent text-bg-base hover:bg-accent-bright'
                      : 'bg-history text-white hover:brightness-110'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-surface-2'
                }`}
                title={isEditingTime ? 'Confirm time' : 'Edit time'}
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {isLive ? (
              <StatusBadge label="Live" color="success" dot glow />
            ) : (
              <StatusBadge label="History" color="muted" />
            )}
          </div>

          {/* Date display */}
          <div className="flex items-center gap-2 text-sm text-text-secondary font-medium px-0.5">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            {new Date(effectiveTime).toLocaleDateString([], {
              weekday: 'short',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          {/* Scale buttons */}
          <div className="flex items-center bg-bg-surface-2/50 border border-border/50 rounded-xl p-1 shadow-inner">
            {SCALES.map((s) => (
              <button
                key={s}
                onClick={() => onScaleChange(s)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  scale === s
                    ? 'bg-bg-surface-3 text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary hover:bg-bg-surface-2'
                }`}
                title={SCALE_LABELS[s]}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Nav arrows + Return to Now */}
          <div className="flex items-center gap-2">
            {!isLive && (
              <button
                onClick={() => onChange(null)}
                className="group flex items-center gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-widest bg-history/10 hover:bg-history text-history hover:text-white rounded-xl transition-all border border-history/20"
              >
                <RotateCcw className="w-3.5 h-3.5 group-hover:-rotate-90 transition-transform duration-500" />
                Live
              </button>
            )}

            <div className="flex items-center gap-1 bg-bg-surface-2/50 border border-border/50 rounded-xl p-1">
              <button
                onClick={() => handleJump(-SCALE_MS[scale])}
                className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-surface-2 rounded-lg transition-colors"
                title={`Back ${SCALE_LABELS[scale]}`}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <button
                onClick={() => handleJump(SCALE_MS[scale])}
                className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-surface-2 rounded-lg transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                title={`Forward ${SCALE_LABELS[scale]}`}
                disabled={isLive || effectiveTime >= Date.now() - 1000}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Scrubber */}
      <TimeScrubber
        value={effectiveTime}
        onChange={handleScrubberChange}
        scale={scale}
        sessions={sessions}
        milestones={undefined}
        showPublic={showPublic}
      />
    </div>
  );
}
