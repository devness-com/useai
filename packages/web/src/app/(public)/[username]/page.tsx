import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, Zap, Code2, Trophy } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Profile {
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  total_hours: number;
  total_sessions: number;
  current_streak: number;
  top_tools: { tool: string; hours: number }[];
  top_languages: { language: string; hours: number }[];
  joined_at: string;
}

async function getProfile(username: string): Promise<Profile | null> {
  try {
    const res = await fetch(`${API_BASE}/api/profile/${username}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) return { title: 'Profile Not Found' };

  const name = profile.display_name || profile.username;
  return {
    title: `${name} — UseAI Profile`,
    description: `${name} has coded ${profile.total_hours.toFixed(1)} hours with AI. ${profile.current_streak} day streak.`,
    openGraph: {
      title: `${name} — UseAI Profile`,
      description: `${profile.total_hours.toFixed(1)}h with AI · ${profile.current_streak} day streak`,
      type: 'profile',
    },
  };
}

export const revalidate = 3600;

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const name = profile.display_name || profile.username;

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-12">
        {/* Profile header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-full bg-bg-surface-2 flex items-center justify-center text-xl font-black text-text-muted">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-black text-text-primary">{name}</h1>
            <p className="text-sm text-text-muted">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-text-secondary mt-1">{profile.bio}</p>}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <div className="p-4 rounded-xl border border-border/50 bg-bg-surface-1/50">
            <Clock className="w-4 h-4 text-accent mb-2" />
            <div className="text-xl font-bold text-text-primary">{profile.total_hours.toFixed(1)}</div>
            <div className="text-xs text-text-muted uppercase tracking-wider">Hours</div>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-bg-surface-1/50">
            <Code2 className="w-4 h-4 text-accent mb-2" />
            <div className="text-xl font-bold text-text-primary">{profile.total_sessions}</div>
            <div className="text-xs text-text-muted uppercase tracking-wider">Sessions</div>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-bg-surface-1/50">
            <Zap className="w-4 h-4 text-streak mb-2" />
            <div className="text-xl font-bold text-text-primary">{profile.current_streak}</div>
            <div className="text-xs text-text-muted uppercase tracking-wider">Day Streak</div>
          </div>
          <div className="p-4 rounded-xl border border-border/50 bg-bg-surface-1/50">
            <Trophy className="w-4 h-4 text-success mb-2" />
            <div className="text-xl font-bold text-text-primary">{profile.top_tools.length}</div>
            <div className="text-xs text-text-muted uppercase tracking-wider">Tools</div>
          </div>
        </div>

        {/* Top tools */}
        {profile.top_tools.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-3">Top Tools</h2>
            <div className="space-y-2">
              {profile.top_tools.map((t) => (
                <div key={t.tool} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-text-primary w-24 truncate">{t.tool}</span>
                  <div className="flex-1 h-2 rounded-full bg-bg-surface-2 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent"
                      style={{ width: `${Math.min((t.hours / (profile.top_tools[0]?.hours || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="text-xs text-text-muted font-mono w-12 text-right">{t.hours.toFixed(1)}h</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top languages */}
        {profile.top_languages.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest mb-3">Top Languages</h2>
            <div className="flex flex-wrap gap-2">
              {profile.top_languages.map((l) => (
                <span
                  key={l.language}
                  className="px-3 py-1.5 text-xs font-bold rounded-full border border-border/50 bg-bg-surface-1/50 text-text-secondary"
                >
                  {l.language}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
