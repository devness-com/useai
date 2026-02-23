import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, Zap, Code2, Trophy, Calendar, Timer, Shield, Flame, CheckCircle2 } from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { Footer } from '@/components/Footer';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { Badge } from '@/components/Badge';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

interface Profile {
  username: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
  total_hours: number;
  total_sessions: number;
  current_streak: number;
  longest_streak: number;
  top_clients: { name: string; hours: number }[];
  top_languages: { name: string; hours: number }[];
  task_types: { name: string; hours: number }[];
  verification_rate: number;
  member_since: string;
  milestones: { title: string; category: string; complexity: string; createdAt: string }[];
  total_milestones: number;
  active_days: number;
  avg_session_minutes: number;
  badges: { badge: string; category: string; awarded_at: string }[];
  activity: { date: string; hours: number }[];
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
  const hours = (profile.total_hours ?? 0).toFixed(1);
  const streak = profile.current_streak ?? 0;
  return {
    title: `${name} — UseAI Profile`,
    description: `${name} has coded ${hours} hours with AI. ${streak} day streak.`,
    openGraph: {
      title: `${name} — UseAI Profile`,
      description: `${hours}h with AI · ${streak} day streak`,
      type: 'profile',
    },
  };
}

export const revalidate = 3600;

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  feature: { bg: 'bg-accent/10', text: 'text-accent', label: 'Feature' },
  bugfix: { bg: 'bg-error/10', text: 'text-error', label: 'Bugfix' },
  bug_fix: { bg: 'bg-error/10', text: 'text-error', label: 'Bugfix' },
  fix: { bg: 'bg-error/10', text: 'text-error', label: 'Fix' },
  test: { bg: 'bg-blue/10', text: 'text-blue', label: 'Test' },
  testing: { bg: 'bg-blue/10', text: 'text-blue', label: 'Test' },
  refactor: { bg: 'bg-purple/10', text: 'text-purple', label: 'Refactor' },
  docs: { bg: 'bg-emerald/10', text: 'text-emerald', label: 'Docs' },
  documentation: { bg: 'bg-emerald/10', text: 'text-emerald', label: 'Docs' },
  setup: { bg: 'bg-bg-surface-3/50', text: 'text-text-muted', label: 'Setup' },
  deployment: { bg: 'bg-bg-surface-3/50', text: 'text-text-muted', label: 'Deploy' },
  chore: { bg: 'bg-bg-surface-3/50', text: 'text-text-muted', label: 'Chore' },
};

const COMPLEXITY_COLORS: Record<string, { bg: string; text: string }> = {
  simple: { bg: 'bg-bg-surface-3/50', text: 'text-text-muted' },
  trivial: { bg: 'bg-bg-surface-3/50', text: 'text-text-muted' },
  easy: { bg: 'bg-bg-surface-3/50', text: 'text-text-muted' },
  low: { bg: 'bg-bg-surface-3/50', text: 'text-text-muted' },
  medium: { bg: 'bg-streak-bg', text: 'text-streak' },
  moderate: { bg: 'bg-streak-bg', text: 'text-streak' },
  complex: { bg: 'bg-error/10', text: 'text-error' },
  hard: { bg: 'bg-error/10', text: 'text-error' },
  difficult: { bg: 'bg-error/10', text: 'text-error' },
  high: { bg: 'bg-error/10', text: 'text-error' },
};

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const name = profile.display_name || profile.username;
  const initials = name.slice(0, 2).toUpperCase();
  const topClients = profile.top_clients ?? [];
  const topLanguages = profile.top_languages ?? [];
  const taskTypes = profile.task_types ?? [];
  const milestones = profile.milestones ?? [];
  const badges = profile.badges ?? [];
  const activity = profile.activity ?? [];
  const isVerified = (profile.verification_rate ?? 0) > 0.8;

  return (
    <>
      <TopNav />
      <div className="min-h-screen bg-bg-base">
        <div className="max-w-5xl mx-auto px-6 pt-28 pb-16">
          {/* ── Header ── */}
          <section className="flex flex-col md:flex-row md:items-start gap-6 mb-10">
            {/* Avatar */}
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={name}
                className="shrink-0 w-20 h-20 rounded-2xl border border-border object-cover"
              />
            ) : (
              <div className="shrink-0 w-20 h-20 rounded-2xl bg-bg-surface-2 border border-border flex items-center justify-center text-2xl font-black text-text-muted">
                {initials}
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-black text-text-primary tracking-tight">{name}</h1>
                {isVerified && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-accent/10 text-accent border border-accent/20"
                    title="Cryptographically verified profile"
                  >
                    <Shield className="w-3 h-3" />
                    VERIFIED
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted mt-0.5">@{profile.username}</p>
              {profile.bio && <p className="text-sm text-text-secondary mt-2">{profile.bio}</p>}

              <div className="flex items-center gap-6 flex-wrap text-xs text-text-muted font-mono mt-3">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Member since{' '}
                  {new Date(profile.member_since).toLocaleDateString('en', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                {(profile.current_streak ?? 0) > 0 && (
                  <span className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-streak" />
                    {profile.current_streak} day streak
                  </span>
                )}
              </div>
            </div>
          </section>

          {/* ── Stat Cards ── */}
          <section className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <Clock className="w-5 h-5 text-accent mb-3" />
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {(profile.total_hours ?? 0).toFixed(1)}
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Total Hours
              </div>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <Code2 className="w-5 h-5 text-blue mb-3" />
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {profile.total_sessions ?? 0}
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Sessions
              </div>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <Zap className="w-5 h-5 text-streak mb-3" />
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {profile.current_streak ?? 0}
                <span className="text-base font-medium text-text-muted ml-1">
                  / {profile.longest_streak ?? 0}
                </span>
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Streak / Longest
              </div>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <Calendar className="w-5 h-5 text-emerald mb-3" />
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {profile.active_days ?? 0}
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Active Days
              </div>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <Timer className="w-5 h-5 text-purple mb-3" />
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {(profile.avg_session_minutes ?? 0).toFixed(0)}
                <span className="text-base font-medium text-text-muted ml-1">min</span>
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Avg Session
              </div>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <Trophy className="w-5 h-5 text-streak mb-3" />
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {profile.total_milestones ?? 0}
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Milestones
              </div>
            </div>
          </section>

          {/* ── Activity Heatmap ── */}
          <section className="hud-border rounded-xl p-6 bg-bg-surface-1 mb-10">
            <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 border-l-2 border-accent pl-2">
              ACTIVITY_HEATMAP
            </div>
            <ActivityHeatmap data={activity.length > 0 ? activity : undefined} />
          </section>

          {/* ── Languages + AI Tools + Task Types ── */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
            {/* Languages */}
            {topLanguages.length > 0 && (
              <div className="hud-border rounded-xl p-6 bg-bg-surface-1">
                <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 border-l-2 border-accent pl-2">
                  LANGUAGES
                </div>
                <div className="flex flex-wrap gap-2">
                  {topLanguages.map((l) => (
                    <span
                      key={l.name}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border bg-bg-surface-2 text-text-secondary"
                    >
                      {l.name}
                      <span className="ml-1.5 text-text-muted font-mono font-normal">{l.hours}h</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* AI Tools */}
            {topClients.length > 0 && (
              <div className="hud-border rounded-xl p-6 bg-bg-surface-1">
                <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 border-l-2 border-accent pl-2">
                  AI_TOOLS
                </div>
                <div className="flex flex-wrap gap-2">
                  {topClients.map((t) => (
                    <span
                      key={t.name}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-accent/20 bg-accent/5 text-accent"
                    >
                      {t.name}
                      <span className="ml-1.5 font-mono font-normal opacity-70">{t.hours}h</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Task Types */}
            {taskTypes.length > 0 && (
              <div className="hud-border rounded-xl p-6 bg-bg-surface-1">
                <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 border-l-2 border-accent pl-2">
                  TASK_TYPES
                </div>
                <div className="flex flex-wrap gap-2">
                  {taskTypes.map((t) => (
                    <span
                      key={t.name}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border/50 bg-bg-surface-2/50 text-text-muted"
                    >
                      {t.name}
                      <span className="ml-1.5 font-mono font-normal">{t.hours}h</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* ── Badges ── */}
          {badges.length > 0 && (
            <section className="hud-border rounded-xl p-6 bg-bg-surface-1 mb-10">
              <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 border-l-2 border-accent pl-2">
                BADGES
              </div>
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => (
                  <Badge
                    key={b.badge}
                    name={b.badge}
                    category={b.category as 'milestone' | 'streak' | 'proficiency' | 'special'}
                    earned={true}
                    earnedAt={new Date(b.awarded_at).toLocaleDateString('en', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Recent Milestones ── */}
          {milestones.length > 0 && (
            <section className="hud-border rounded-xl p-6 bg-bg-surface-1">
              <div className="flex items-center justify-between mb-6">
                <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                  RECENT_MILESTONES
                </div>
                <span className="text-xs font-mono text-text-muted">
                  {milestones.length} entries
                </span>
              </div>

              <div className="space-y-3">
                {milestones.map((m, i) => {
                  const cat = CATEGORY_COLORS[m.category] ?? {
                    bg: 'bg-bg-surface-3/50',
                    text: 'text-text-muted',
                    label: m.category,
                  };
                  const comp = COMPLEXITY_COLORS[m.complexity] ?? {
                    bg: 'bg-bg-surface-3/50',
                    text: 'text-text-muted',
                  };

                  return (
                    <div
                      key={i}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-xl bg-bg-surface-2/50 border border-border/30 hover:border-border transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <CheckCircle2 className="w-4 h-4 text-accent shrink-0" />
                        <span className="text-sm font-medium text-text-primary truncate">
                          {m.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${cat.bg} ${cat.text}`}
                        >
                          {cat.label}
                        </span>
                        {m.complexity && (
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${comp.bg} ${comp.text}`}
                          >
                            {m.complexity}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-text-muted">
                          {new Date(m.createdAt).toLocaleDateString('en', {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
      <Footer />
    </>
  );
}
