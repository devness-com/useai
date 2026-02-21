export type TimeScale = '15m' | '30m' | '1h' | '12h' | '24h' | '7d' | '30d';

export const SCALE_MS: Record<TimeScale, number> = {
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '12h': 12 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export const SCALE_LABELS: Record<TimeScale, string> = {
  '15m': '15 Minutes',
  '30m': '30 Minutes',
  '1h': '1 Hour',
  '12h': '12 Hours',
  '24h': '24 Hours',
  '7d': '7 Days',
  '30d': '30 Days',
};
