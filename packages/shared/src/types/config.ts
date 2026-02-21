export interface LocalConfig {
  milestone_tracking: boolean;
  auto_sync: boolean;
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
  sync_interval_hours: number;
}
