import type { CaptureConfig, SyncIncludeConfig, SyncConfig, LocalConfig } from '../types/config.js';

export const DEFAULT_CAPTURE_CONFIG: CaptureConfig = {
  prompt: true,
  prompt_images: true,
  evaluation: true,
  evaluation_reasons: 'all',
  milestones: true,
};

export const DEFAULT_SYNC_INCLUDE_CONFIG: SyncIncludeConfig = {
  sessions: true,
  evaluations: true,
  milestones: true,
  prompts: false,
  private_titles: false,
  projects: false,
  model: true,
  languages: true,
};

export const DEFAULT_SYNC_CONFIG: SyncConfig = {
  enabled: false,
  interval_hours: 3,
  include: { ...DEFAULT_SYNC_INCLUDE_CONFIG },
};

export const DEFAULT_CONFIG: LocalConfig = {
  capture: { ...DEFAULT_CAPTURE_CONFIG },
  sync: { ...DEFAULT_SYNC_CONFIG },
  evaluation_framework: 'space',
};

export const DEFAULT_SYNC_INTERVAL_HOURS = 3;

export const GENESIS_HASH = 'GENESIS';
