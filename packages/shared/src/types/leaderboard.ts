export type LeaderboardDimension = 'score' | 'hours' | 'streak' | 'sessions';
export type LeaderboardWindow = '7d' | '30d' | 'all';

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name?: string | null;
  avatar_url?: string | null;
  score: number;
  dimension: string;
  scope: string;
  current_streak?: number;
  hours_7d?: number;
  top_language?: string | null;
}
