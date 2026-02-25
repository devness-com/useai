export type TimeScale = '1h' | '3h' | '6h' | '12h' | '24h' | 'day' | '7d' | 'week' | '30d' | 'month';

/** Rolling scales shown as buttons */
export const ROLLING_SCALES: TimeScale[] = ['1h', '3h', '6h', '12h'];
/** Calendar scales shown as buttons */
export const CALENDAR_SCALES: TimeScale[] = ['day', 'week', 'month'];
/** All valid scales (including hidden scrub-transition ones, for localStorage validation) */
export const ALL_SCALES: TimeScale[] = ['1h', '3h', '6h', '12h', '24h', 'day', '7d', 'week', '30d', 'month'];

/** Calendar → rolling equivalent (used when scrubbing transitions out of calendar mode) */
export const CALENDAR_SCRUB_MAP: Partial<Record<TimeScale, TimeScale>> = {
  'day': '24h',
  'week': '7d',
  'month': '30d',
};

/** Rolling → calendar equivalent (used when returning to live mode) */
export const SCRUB_CALENDAR_MAP: Partial<Record<TimeScale, TimeScale>> = {
  '24h': 'day',
  '7d': 'week',
  '30d': 'month',
};

export function isCalendarScale(scale: TimeScale): boolean {
  return scale === 'day' || scale === 'week' || scale === 'month';
}

/** Fixed duration for rolling scales (ms). */
const ROLLING_MS: Record<string, number> = {
  '1h': 60 * 60 * 1000,
  '3h': 3 * 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

/**
 * @deprecated Use getTimeWindow() instead. Kept for backward-compat; only contains rolling scales.
 */
export const SCALE_MS: Record<string, number> = { ...ROLLING_MS };

export const SCALE_LABELS: Record<TimeScale, string> = {
  '1h': '1 Hour',
  '3h': '3 Hours',
  '6h': '6 Hours',
  '12h': '12 Hours',
  '24h': '24 Hours',
  'day': 'Day',
  '7d': '7 Days',
  'week': 'Week',
  '30d': '30 Days',
  'month': 'Month',
};

/**
 * Compute the viewing window for any scale.
 * Rolling: window ends at referenceTime, extends back by the scale duration.
 * Calendar: window is the calendar period containing referenceTime.
 */
export function getTimeWindow(scale: TimeScale, referenceTime: number): { start: number; end: number } {
  const ms = ROLLING_MS[scale];
  if (ms !== undefined) {
    return { start: referenceTime - ms, end: referenceTime };
  }

  const d = new Date(referenceTime);

  if (scale === 'day') {
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const end = start + 24 * 60 * 60 * 1000;
    return { start, end };
  }

  if (scale === 'week') {
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + mondayOffset);
    const start = monday.getTime();
    const end = start + 7 * 24 * 60 * 60 * 1000;
    return { start, end };
  }

  // month
  const start = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).getTime();
  return { start, end };
}

/**
 * Jump to the previous or next period.
 * Rolling: adds/subtracts the scale duration.
 * Calendar: moves to the adjacent calendar period (returns midday to avoid DST issues).
 */
export function jumpScale(scale: TimeScale, referenceTime: number, direction: -1 | 1): number {
  const ms = ROLLING_MS[scale];
  if (ms !== undefined) {
    return referenceTime + direction * ms;
  }

  const d = new Date(referenceTime);

  if (scale === 'day') {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + direction, 12).getTime();
  }

  if (scale === 'week') {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * direction, 12).getTime();
  }

  // month
  return new Date(d.getFullYear(), d.getMonth() + direction, Math.min(d.getDate(), 28), 12).getTime();
}

/**
 * Check if a timestamp falls within the current live period for a calendar scale.
 */
export function isCurrentPeriod(scale: TimeScale, referenceTime: number): boolean {
  if (!isCalendarScale(scale)) return false;
  const w = getTimeWindow(scale, referenceTime);
  const now = Date.now();
  return now >= w.start && now < w.end;
}

/**
 * Whether to snap to live after a jump.
 * Rolling: if within 60s of now.
 * Calendar: if the target period contains now.
 */
export function shouldSnapToLive(scale: TimeScale, newReferenceTime: number): boolean {
  if (isCalendarScale(scale)) {
    return isCurrentPeriod(scale, newReferenceTime);
  }
  return newReferenceTime >= Date.now() - 60_000;
}
