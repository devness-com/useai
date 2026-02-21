export const MAX_DAILY_HOURS = 18;
export const MAX_CONTINUOUS_HOURS = 6;
export const SPIKE_MULTIPLIER = 10;

export function exceedsMaxDailyHours(totalSeconds: number): boolean {
  return totalSeconds > MAX_DAILY_HOURS * 3600;
}

export function exceedsMaxContinuous(durationSeconds: number): boolean {
  return durationSeconds > MAX_CONTINUOUS_HOURS * 3600;
}

export function isSpikeFromAverage(current: number, average: number): boolean {
  return average > 0 && current > average * SPIKE_MULTIPLIER;
}

export function hasTimeOverlap(
  a: { started_at: string; ended_at: string },
  b: { started_at: string; ended_at: string },
): boolean {
  const aStart = new Date(a.started_at).getTime();
  const aEnd = new Date(a.ended_at).getTime();
  const bStart = new Date(b.started_at).getTime();
  const bEnd = new Date(b.ended_at).getTime();
  return aStart < bEnd && bStart < aEnd;
}
