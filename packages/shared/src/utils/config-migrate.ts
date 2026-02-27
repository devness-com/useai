import type { UseaiConfig, CaptureConfig, SyncConfig, SyncIncludeConfig } from '../types/config.js';
import { DEFAULT_CAPTURE_CONFIG, DEFAULT_SYNC_CONFIG, DEFAULT_SYNC_INCLUDE_CONFIG } from '../constants/defaults.js';

/**
 * Migrate a raw config (possibly old flat format) to the current nested structure.
 * - Detects legacy flat fields (milestone_tracking, auto_sync, sync_interval_hours)
 * - Maps them to the new nested capture/sync structure
 * - Fills missing nested fields with defaults
 */
export function migrateConfig(raw: Record<string, unknown>): UseaiConfig {
  const config = { ...raw } as UseaiConfig;

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
    config.sync = { ...DEFAULT_SYNC_CONFIG, include: { ...DEFAULT_SYNC_INCLUDE_CONFIG } };

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
    const include = (s.include ?? {}) as Partial<SyncIncludeConfig>;

    config.sync = {
      enabled: s.enabled ?? DEFAULT_SYNC_CONFIG.enabled,
      interval_hours: s.interval_hours ?? DEFAULT_SYNC_CONFIG.interval_hours,
      include: {
        sessions: include.sessions ?? DEFAULT_SYNC_INCLUDE_CONFIG.sessions,
        evaluations: include.evaluations ?? DEFAULT_SYNC_INCLUDE_CONFIG.evaluations,
        evaluation_reasons: include.evaluation_reasons ?? DEFAULT_SYNC_INCLUDE_CONFIG.evaluation_reasons,
        milestones: include.milestones ?? DEFAULT_SYNC_INCLUDE_CONFIG.milestones,
        prompts: include.prompts ?? DEFAULT_SYNC_INCLUDE_CONFIG.prompts,
        private_titles: include.private_titles ?? DEFAULT_SYNC_INCLUDE_CONFIG.private_titles,
        projects: include.projects ?? DEFAULT_SYNC_INCLUDE_CONFIG.projects,
        model: include.model ?? DEFAULT_SYNC_INCLUDE_CONFIG.model,
        languages: include.languages ?? DEFAULT_SYNC_INCLUDE_CONFIG.languages,
      },
    };
  }

  // Default evaluation_framework
  if (!config.evaluation_framework) {
    config.evaluation_framework = 'space';
  }

  return config;
}
