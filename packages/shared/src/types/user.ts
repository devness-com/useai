export interface User {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  role: 'user' | 'admin';
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  username: string;
  display_name?: string;
  avatar_url?: string;
  bio?: string;
  total_hours: number;
  current_streak: number;
  longest_streak: number;
  top_tools: { tool: string; hours: number }[];
  top_languages: { language: string; hours: number }[];
  verification_rate: number;
  member_since: string;
}
