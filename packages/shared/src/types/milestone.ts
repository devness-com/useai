export interface Milestone {
  id: string;
  session_id: string;
  title: string;
  private_title?: string;
  project?: string;
  category: string;
  complexity: string;
  duration_minutes: number;
  languages: string[];
  client: string;
  created_at: string;
  published: boolean;
  published_at: string | null;
  chain_hash: string;
}
