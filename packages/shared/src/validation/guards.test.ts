import { describe, expect, it } from 'vitest';
import {
  exceedsMaxDailyHours,
  exceedsMaxContinuous,
  isSpikeFromAverage,
  hasTimeOverlap,
  MAX_DAILY_HOURS,
  MAX_CONTINUOUS_HOURS,
  SPIKE_MULTIPLIER,
} from './guards';

describe('exceedsMaxDailyHours', () => {
  const thresholdSeconds = MAX_DAILY_HOURS * 3600; // 18 * 3600 = 64800

  it('returns false when total seconds is well below the daily limit', () => {
    expect(exceedsMaxDailyHours(3600)).toBe(false); // 1 hour
  });

  it('returns false when total seconds is zero', () => {
    expect(exceedsMaxDailyHours(0)).toBe(false);
  });

  it('returns false when total seconds is exactly at the threshold', () => {
    expect(exceedsMaxDailyHours(thresholdSeconds)).toBe(false);
  });

  it('returns false when total seconds is one second below the threshold', () => {
    expect(exceedsMaxDailyHours(thresholdSeconds - 1)).toBe(false);
  });

  it('returns true when total seconds is one second above the threshold', () => {
    expect(exceedsMaxDailyHours(thresholdSeconds + 1)).toBe(true);
  });

  it('returns true when total seconds far exceeds the daily limit', () => {
    expect(exceedsMaxDailyHours(24 * 3600)).toBe(true); // 24 hours
  });

  it('returns false for negative values', () => {
    expect(exceedsMaxDailyHours(-1000)).toBe(false);
  });
});

describe('exceedsMaxContinuous', () => {
  const thresholdSeconds = MAX_CONTINUOUS_HOURS * 3600; // 6 * 3600 = 21600

  it('returns false when duration is well below the continuous limit', () => {
    expect(exceedsMaxContinuous(1800)).toBe(false); // 30 minutes
  });

  it('returns false when duration is zero', () => {
    expect(exceedsMaxContinuous(0)).toBe(false);
  });

  it('returns false when duration is exactly at the threshold', () => {
    expect(exceedsMaxContinuous(thresholdSeconds)).toBe(false);
  });

  it('returns false when duration is one second below the threshold', () => {
    expect(exceedsMaxContinuous(thresholdSeconds - 1)).toBe(false);
  });

  it('returns true when duration is one second above the threshold', () => {
    expect(exceedsMaxContinuous(thresholdSeconds + 1)).toBe(true);
  });

  it('returns true when duration far exceeds the continuous limit', () => {
    expect(exceedsMaxContinuous(12 * 3600)).toBe(true); // 12 hours
  });

  it('returns false for negative values', () => {
    expect(exceedsMaxContinuous(-500)).toBe(false);
  });
});

describe('isSpikeFromAverage', () => {
  it('returns true when current is more than SPIKE_MULTIPLIER times the average', () => {
    expect(isSpikeFromAverage(110, 10)).toBe(true); // 110 > 10 * 10
  });

  it('returns false when current equals exactly SPIKE_MULTIPLIER times the average', () => {
    expect(isSpikeFromAverage(100, 10)).toBe(false); // 100 is not > 100
  });

  it('returns false when current is below the spike threshold', () => {
    expect(isSpikeFromAverage(50, 10)).toBe(false); // 50 < 100
  });

  it('returns true when current is one unit above the spike threshold', () => {
    expect(isSpikeFromAverage(101, 10)).toBe(true); // 101 > 100
  });

  it('returns false when average is zero regardless of current value', () => {
    expect(isSpikeFromAverage(1000, 0)).toBe(false);
  });

  it('returns false when both current and average are zero', () => {
    expect(isSpikeFromAverage(0, 0)).toBe(false);
  });

  it('returns false when current is zero and average is positive', () => {
    expect(isSpikeFromAverage(0, 50)).toBe(false);
  });

  it('returns false when average is negative', () => {
    // average <= 0 short-circuits to false
    expect(isSpikeFromAverage(100, -5)).toBe(false);
  });

  it('handles fractional values correctly', () => {
    // average = 0.5, threshold = 5, current = 5.1 → spike
    expect(isSpikeFromAverage(5.1, 0.5)).toBe(true);
    // current = 5 → not spike (not strictly greater)
    expect(isSpikeFromAverage(5, 0.5)).toBe(false);
  });

  it('handles very large values without overflow issues', () => {
    expect(isSpikeFromAverage(Number.MAX_SAFE_INTEGER, 1)).toBe(true);
  });
});

describe('hasTimeOverlap', () => {
  it('detects overlap when interval A starts before B ends and B starts before A ends', () => {
    const a = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T11:00:00Z' };
    const b = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T12:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(true);
  });

  it('detects overlap when interval B starts before A ends and A starts before B ends', () => {
    const a = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T12:00:00Z' };
    const b = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T11:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(true);
  });

  it('detects overlap when one interval fully contains the other', () => {
    const a = { started_at: '2025-01-15T08:00:00Z', ended_at: '2025-01-15T17:00:00Z' };
    const b = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T12:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(true);
  });

  it('detects overlap when intervals are identical', () => {
    const a = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T17:00:00Z' };
    const b = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T17:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(true);
  });

  it('returns false when intervals are adjacent (A ends exactly when B starts)', () => {
    const a = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T10:00:00Z' };
    const b = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(false);
  });

  it('returns false when intervals are adjacent (B ends exactly when A starts)', () => {
    const a = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' };
    const b = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T10:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(false);
  });

  it('returns false when intervals are completely separate with A before B', () => {
    const a = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T10:00:00Z' };
    const b = { started_at: '2025-01-15T14:00:00Z', ended_at: '2025-01-15T16:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(false);
  });

  it('returns false when intervals are completely separate with B before A', () => {
    const a = { started_at: '2025-01-15T14:00:00Z', ended_at: '2025-01-15T16:00:00Z' };
    const b = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T10:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(false);
  });

  it('returns false when intervals are on different days with no overlap', () => {
    const a = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T17:00:00Z' };
    const b = { started_at: '2025-01-16T09:00:00Z', ended_at: '2025-01-16T17:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(false);
  });

  it('detects overlap spanning midnight', () => {
    const a = { started_at: '2025-01-15T22:00:00Z', ended_at: '2025-01-16T02:00:00Z' };
    const b = { started_at: '2025-01-16T01:00:00Z', ended_at: '2025-01-16T05:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(true);
  });

  it('detects overlap with millisecond precision', () => {
    const a = { started_at: '2025-01-15T10:00:00.000Z', ended_at: '2025-01-15T10:00:00.002Z' };
    const b = { started_at: '2025-01-15T10:00:00.001Z', ended_at: '2025-01-15T10:00:00.003Z' };
    expect(hasTimeOverlap(a, b)).toBe(true);
  });

  it('returns false for zero-duration intervals at the same instant', () => {
    const a = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T10:00:00Z' };
    const b = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T10:00:00Z' };
    // aStart < bEnd → false (10:00 is not < 10:00), so no overlap
    expect(hasTimeOverlap(a, b)).toBe(false);
  });

  it('returns false for zero-duration interval A touching start of B', () => {
    const a = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T10:00:00Z' };
    const b = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' };
    // aStart (10:00) < bEnd (11:00) → true, bStart (10:00) < aEnd (10:00) → false
    expect(hasTimeOverlap(a, b)).toBe(false);
  });

  it('is symmetric — hasTimeOverlap(a, b) equals hasTimeOverlap(b, a)', () => {
    const a = { started_at: '2025-01-15T09:00:00Z', ended_at: '2025-01-15T11:00:00Z' };
    const b = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T12:00:00Z' };
    expect(hasTimeOverlap(a, b)).toBe(hasTimeOverlap(b, a));
  });

  it('handles non-UTC timezone offsets in ISO strings', () => {
    // These represent the same instant: 10:00 UTC vs 12:00+02:00
    const a = { started_at: '2025-01-15T10:00:00Z', ended_at: '2025-01-15T11:00:00Z' };
    const b = { started_at: '2025-01-15T12:00:00+02:00', ended_at: '2025-01-15T13:00:00+02:00' };
    // b is actually 10:00-11:00 UTC, so identical → overlap
    expect(hasTimeOverlap(a, b)).toBe(true);
  });
});

describe('exported constants', () => {
  it('MAX_DAILY_HOURS is 18', () => {
    expect(MAX_DAILY_HOURS).toBe(18);
  });

  it('MAX_CONTINUOUS_HOURS is 6', () => {
    expect(MAX_CONTINUOUS_HOURS).toBe(6);
  });

  it('SPIKE_MULTIPLIER is 10', () => {
    expect(SPIKE_MULTIPLIER).toBe(10);
  });
});