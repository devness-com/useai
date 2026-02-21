export type LeaderboardDimension = 'hours' | 'streak' | 'tools' | 'builds';

export type LeaderboardScope = 'global' | `lang:${string}` | `tool:${string}`;

export interface LeaderboardEntry {
  rank: number;
  user_id: string;
  username: string;
  display_name?: string;
  avatar_url?: string;
  score: number;
  dimension: LeaderboardDimension;
  scope: LeaderboardScope;
  verified: boolean;
}
