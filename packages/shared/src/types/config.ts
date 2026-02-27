export type EvaluationReasonsLevel = 'all' | 'below_perfect' | 'none';

export interface CaptureConfig {
  prompt: boolean;                    // default: true
  prompt_images: boolean;             // default: true (descriptions only)
  evaluation: boolean;                // default: true
  evaluation_reasons: EvaluationReasonsLevel; // default: 'all'
  milestones: boolean;                // default: true
}

export interface SyncIncludeConfig {
  sessions: boolean;                  // default: true
  evaluations: boolean;               // default: true
  milestones: boolean;                // default: true
  prompts: boolean;                   // default: false (NEVER default true)
  private_titles: boolean;            // default: false
  projects: boolean;                  // default: false
  model: boolean;                     // default: true
  languages: boolean;                 // default: true
}

export interface SyncConfig {
  enabled: boolean;                   // default: false
  interval_hours: number;             // default: 24
  include: SyncIncludeConfig;
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
