import { Trophy } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface LeaderboardEntry {
  rank: number;
  username: string;
  display_name?: string;
  avatar_url?: string;
  value: number;
  label: string;
}

async function getLeaderboard(dimension = 'hours'): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/api/leaderboard?dimension=${dimension}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export const revalidate = 3600;

export default async function LeaderboardPage() {
  const entries = await getLeaderboard('hours');

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-12">
        <div className="flex items-center gap-3 mb-8">
          <Trophy className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-black text-text-primary">Leaderboard</h1>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-20 text-text-muted">
            No leaderboard data yet. Be the first to sync!
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map((entry, i) => (
              <div
                key={entry.username}
                className="flex items-center gap-4 px-4 py-3 rounded-xl border border-border/50 bg-bg-surface-1/50 hover:border-accent/30 transition-colors"
              >
                <span className={`text-lg font-black w-8 text-center ${i < 3 ? 'text-accent' : 'text-text-muted'}`}>
                  {entry.rank}
                </span>
                <div className="w-8 h-8 rounded-full bg-bg-surface-2 flex items-center justify-center text-xs font-bold text-text-muted">
                  {(entry.display_name || entry.username).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <a href={`/${entry.username}`} className="text-sm font-bold text-text-primary hover:text-accent transition-colors">
                    {entry.display_name || entry.username}
                  </a>
                  <span className="text-xs text-text-muted ml-2">@{entry.username}</span>
                </div>
                <span className="text-sm font-bold font-mono text-accent">
                  {entry.label}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
