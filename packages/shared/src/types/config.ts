export type EvaluationReasonsLevel = 'all' | 'below_perfect' | 'none';

export interface CaptureConfig {
  prompt: boolean;                    // default: false
  prompt_images: boolean;             // default: false (descriptions only)
  evaluation: boolean;                // default: true
  evaluation_reasons: EvaluationReasonsLevel; // default: 'all'
  milestones: boolean;                // default: true
}

export interface SyncConfig {
  enabled: boolean;                   // default: false
  interval_hours: number;             // default: 1
  include_stats: boolean;             // default: true — aggregate stats (public profile)
  include_details: boolean;           // default: true — titles & milestones (private)
}

export interface LocalConfig {
  capture: CaptureConfig;
  sync: SyncConfig;
  evaluation_framework?: string;    // 'raw' | 'space'; default 'space'
  // Legacy fields kept optional for migration detection
  milestone_tracking?: boolean;
  auto_sync?: boolean;
  sync_interval_hours?: number;
}

export interface UseaiConfig extends LocalConfig {
  auth?: {
    token: string;
    user: {
      id: string;
      email: string;
      username?: string;
    };
  };
  last_sync_at?: string;
}

export type UserMode = 'local' | 'cloud';

export function getUserMode(config: UseaiConfig): UserMode {
  return config.auth?.token ? 'cloud' : 'local';
}
