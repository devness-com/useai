export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface SyncPayload {
  date: string;
  total_seconds: number;
  clients: Record<string, number>;
  task_types: Record<string, number>;
  languages: Record<string, number>;
  sessions: import('./chain.js').SessionSeal[];
  sync_signature: string;
}

export interface PublishPayload {
  milestones: {
    id: string;
    title: string;
    private_title?: string;
    category: string;
    complexity: string;
    duration_minutes: number;
    languages: string[];
    client: string;
    chain_hash: string;
  }[];
}
