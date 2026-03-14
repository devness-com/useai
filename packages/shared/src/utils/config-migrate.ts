import type { UseaiConfig, CaptureConfig, SyncConfig } from '../types/config.js';
import { DEFAULT_CAPTURE_CONFIG, DEFAULT_SYNC_CONFIG } from '../constants/defaults.js';

/**
 * Migrate a raw config (possibly old flat format) to the current nested structure.
 * - Detects legacy flat fields (milestone_tracking, auto_sync, sync_interval_hours)
 * - Maps them to the new nested capture/sync structure
 * - Fills missing nested fields with defaults
 * - Strips removed fields (sync.include) from old configs
 */
export function migrateConfig(raw: Record<string, unknown>): UseaiConfig {
  const config = { ...raw } as unknown as UseaiConfig;

  // ── Capture config ──────────────────────────────────────────────────────
  if (!config.capture || typeof config.capture !== 'object') {
    config.capture = { ...DEFAULT_CAPTURE_CONFIG };

    // Legacy: milestone_tracking controls capture.milestones
    if (typeof raw['milestone_tracking'] === 'boolean') {
      config.capture.milestones = raw['milestone_tracking'] as boolean;
    }
  } else {
    // Fill missing capture fields with defaults
    const c = config.capture as Partial<CaptureConfig>;
    config.capture = {
      prompt: c.prompt ?? DEFAULT_CAPTURE_CONFIG.prompt,
      prompt_images: c.prompt_images ?? DEFAULT_CAPTURE_CONFIG.prompt_images,
      evaluation: c.evaluation ?? DEFAULT_CAPTURE_CONFIG.evaluation,
      evaluation_reasons: c.evaluation_reasons ?? DEFAULT_CAPTURE_CONFIG.evaluation_reasons,
      milestones: c.milestones ?? DEFAULT_CAPTURE_CONFIG.milestones,
    };
  }

  // ── Sync config ─────────────────────────────────────────────────────────
  if (!config.sync || typeof config.sync !== 'object') {
    config.sync = { ...DEFAULT_SYNC_CONFIG };

    // Legacy: auto_sync → sync.enabled
    if (typeof raw['auto_sync'] === 'boolean') {
      config.sync.enabled = raw['auto_sync'] as boolean;
    }

    // Legacy: sync_interval_hours → sync.interval_hours
    if (typeof raw['sync_interval_hours'] === 'number') {
      config.sync.interval_hours = raw['sync_interval_hours'] as number;
    }
  } else {
    // Fill missing sync fields with defaults
    const s = config.sync as Partial<SyncConfig>;

    config.sync = {
      enabled: s.enabled ?? DEFAULT_SYNC_CONFIG.enabled,
      interval_hours: s.interval_hours ?? DEFAULT_SYNC_CONFIG.interval_hours,
      include_stats: s.include_stats ?? DEFAULT_SYNC_CONFIG.include_stats,
      include_details: s.include_details ?? DEFAULT_SYNC_CONFIG.include_details,
    };
  }

  // Strip removed sync.include from old configs
  delete (config.sync as any).include;

  // Ensure sync.enabled is coherent with auth state
  // (prior default was true, which made no sense without auth)
  if (config.sync.enabled && !config.auth?.token) {
    config.sync.enabled = false;
  }

  // Default evaluation_framework
  if (!config.evaluation_framework) {
    config.evaluation_framework = 'space';
  }

  return config;
}
