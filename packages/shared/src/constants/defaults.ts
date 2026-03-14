import type { CaptureConfig, SyncConfig, LocalConfig } from '../types/config.js';

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  prompt: true,
  prompt_images: true,
  evaluation: true,
  evaluation_reasons: 'all',
  milestones: true,
};

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  interval_hours: 1,
  include_stats: true,
  include_details: true,
};

export const DEFAULT_CONFIG: LocalConfig = {
  capture: { ...DEFAULT_CAPTURE_CONFIG },
  sync: { ...DEFAULT_SYNC_CONFIG },
  evaluation_framework: 'space',
};

export const DEFAULT_SYNC_INTERVAL_HOURS = 1;

export const GENESIS_HASH = 'GENESIS';
