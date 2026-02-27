import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Clock, Zap, Code2, Cpu, Layers, Calendar, Shield, Flame, CheckCircle2 } from 'lucide-react';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { Badge } from '@/components/Badge';
import { StatusBadge } from '@/components/StatusBadge';
import { InfoTip } from '@/components/InfoTip';
import { ProfileBreakdowns } from '@/components/ProfileBreakdowns';

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
  top_clients: { name: string; hours: number; user_hours: number }[];
  top_languages: { name: string; hours: number; user_hours: number }[];
  task_types: { name: string; hours: number; user_hours: number }[];
  verification_rate: number;
  member_since: string;
  total_milestones: number;
  active_days: number;
  avg_session_minutes: number;
  badges: { badge: string; category: string; awarded_at: string }[];
  activity: { date: string; hours: number }[];
  covered_hours: number;
  ai_multiplier: number;
  proficiency: {
    prompt_quality: number;
    context: number;
    independence: number;
    scope: number;
    completion_rate: number;
    evaluated_sessions: number;
    avg_iterations: number;
  } | null;
  complexity_distribution: {
    simple: number;
    medium: number;
    complex: number;
  };
  skill_radar: {
    output: number;
    efficiency: number;
    prompts: number | null;
    consistency: number;
    breadth: number;
  };
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

/* ── Pentagon helpers for Skill Radar ── */

function pentagonPoint(axisIndex: number, radius: number, cx: number, cy: number, r: number): [number, number] {
  const angle = (Math.PI * 2 * axisIndex) / 5 - Math.PI / 2;
  return [cx + r * radius * Math.cos(angle), cy + r * radius * Math.sin(angle)];
}

function pentagonPath(scale: number, cx: number, cy: number, r: number): string {
  return Array.from({ length: 5 }, (_, i) => {
    const [x, y] = pentagonPoint(i, scale, cx, cy, r);
    return `${x},${y}`;
  }).join(' ');
}

function proficiencyBarColor(score: number): string {
  if (score >= 4.0) return 'bg-emerald-500';
  if (score >= 3.0) return 'bg-amber-500';
  return 'bg-red-400';
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const profile = await getProfile(username);
  if (!profile) notFound();

  const name = profile.display_name || profile.username;
  const initials = name.slice(0, 2).toUpperCase();
  const topClients = profile.top_clients ?? [];
  const topLanguages = profile.top_languages ?? [];
  const taskTypes = profile.task_types ?? [];
  const badges = profile.badges ?? [];
  const activity = profile.activity ?? [];
  const isVerified = (profile.verification_rate ?? 0) > 0.8;

  /* Skill radar data */
  const radar = profile.skill_radar;
  const radarValues = [
    radar.output,
    radar.efficiency,
    radar.prompts ?? 0,
    radar.consistency,
    radar.breadth,
  ];
  const radarLabels = ['Output', 'Efficiency', 'Prompts', 'Consistency', 'Breadth'];
  const cx = 100;
  const cy = 100;
  const r = 70;

  /* Label positions for the pentagon (manually offset for readability) */
  const labelPositions: { x: number; y: number; anchor: 'middle' | 'start' | 'end' }[] = [
    { x: cx, y: cy - r - 12, anchor: 'middle' },         // 0: Output (top)
    { x: cx + r + 10, y: cy - r * 0.3, anchor: 'start' },  // 1: Efficiency (upper-right)
    { x: cx + r * 0.62 + 10, y: cy + r * 0.8 + 4, anchor: 'start' },  // 2: Prompts (lower-right)
    { x: cx - r * 0.62 - 10, y: cy + r * 0.8 + 4, anchor: 'end' },    // 3: Consistency (lower-left)
    { x: cx - r - 10, y: cy - r * 0.3, anchor: 'end' },    // 4: Breadth (upper-left)
  ];

  /* Complexity distribution */
  const complexity = profile.complexity_distribution ?? { simple: 0, medium: 0, complex: 0 };
  const complexityMax = Math.max(complexity.simple, complexity.medium, complexity.complex, 1);
  const complexityTotal = complexity.simple + complexity.medium + complexity.complex;

  return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-16">
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
                  <StatusBadge label="VERIFIED" color="accent" icon={<Shield className="w-3 h-3" />} />
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
            {/* User Time */}
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <div className="flex justify-between items-start mb-3">
                <Clock className="w-5 h-5 text-accent" />
                <InfoTip text="Wall-clock hours you spent with at least one AI session active." />
              </div>
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {(profile.covered_hours ?? 0).toFixed(1)}
                <span className="text-base font-medium text-text-muted ml-1">hrs</span>
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                User Time
              </div>
            </div>

            {/* AI Time */}
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <div className="flex justify-between items-start mb-3">
                <Cpu className="w-5 h-5 text-blue" />
                <InfoTip text="Total cumulative hours across all AI sessions, including overlapping ones." />
              </div>
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {(profile.total_hours ?? 0).toFixed(1)}
                <span className="text-base font-medium text-text-muted ml-1">hrs</span>
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                AI Time
              </div>
            </div>

            {/* Multiplier (hero card) */}
            <div className="rounded-xl p-5 bg-accent/10 border border-accent/20">
              <div className="flex justify-between items-start mb-3">
                <Layers className="w-5 h-5 text-accent" />
                <InfoTip text="AI Time ÷ User Time — how much parallel AI work happens per hour." />
              </div>
              <div className="text-3xl font-black text-accent leading-none mb-1">
                {(profile.ai_multiplier ?? 0).toFixed(1)}x
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Multiplier
              </div>
            </div>

            {/* Sessions */}
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <div className="flex justify-between items-start mb-3">
                <Code2 className="w-5 h-5 text-blue" />
                <InfoTip text="Total number of AI-assisted coding sessions tracked." />
              </div>
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {profile.total_sessions ?? 0}
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Sessions
              </div>
            </div>

            {/* Streak */}
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <div className="flex justify-between items-start mb-3">
                <Zap className="w-5 h-5 text-streak" />
                <InfoTip text="Current consecutive days with AI activity, and the longest streak achieved." />
              </div>
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

            {/* Completion */}
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <div className="flex justify-between items-start mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald" />
                <InfoTip text="Percentage of evaluated sessions where the task was fully completed." />
              </div>
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {(profile.proficiency?.completion_rate ?? 0).toFixed(0)}
                <span className="text-base font-medium text-text-muted ml-0.5">%</span>
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Completion
              </div>
            </div>
          </section>

          {/* ── Activity Heatmap ── */}
          <section className="hud-border rounded-xl p-4 sm:p-6 bg-bg-surface-1 mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                ACTIVITY_HEATMAP
              </div>
              <InfoTip text="Daily AI coding activity over the past year. Darker cells mean more hours." />
            </div>
            <ActivityHeatmap data={activity} />
          </section>

          {/* ── AI Proficiency + Skill Radar ── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Left: AI Proficiency */}
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                  AI_PROFICIENCY
                </div>
                <InfoTip text="Average scores across evaluated sessions. Each metric is rated 1–5 by the AI after each session." />
              </div>

              {profile.proficiency ? (
                <>
                  <div className="space-y-4">
                    {([
                      { label: 'Prompt Quality', value: profile.proficiency.prompt_quality },
                      { label: 'Context', value: profile.proficiency.context },
                      { label: 'Independence', value: profile.proficiency.independence },
                      { label: 'Scope', value: profile.proficiency.scope },
                    ] as const).map((metric) => (
                      <div key={metric.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-text-secondary">{metric.label}</span>
                          <span className="text-xs font-mono text-text-muted">{metric.value.toFixed(1)} / 5</span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-bg-surface-3/50 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${proficiencyBarColor(metric.value)}`}
                            style={{ width: `${(metric.value / 5) * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/30">
                    <span className="text-xs font-mono text-text-muted">
                      {profile.proficiency.evaluated_sessions} evaluated · {profile.proficiency.completion_rate.toFixed(0)}% completed · {profile.proficiency.avg_iterations.toFixed(1)} avg iterations
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center py-12">
                  <span className="text-sm text-text-muted">No evaluation data yet</span>
                </div>
              )}
            </div>

            {/* Right: Skill Radar */}
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1">
              <div className="flex items-center gap-2 mb-4">
                <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                  SKILL_RADAR
                </div>
                <InfoTip text="Five-axis profile based on output volume, coding efficiency, prompt quality, streak consistency, and language breadth." />
              </div>

              <svg viewBox="0 0 200 200" className="w-full max-w-[280px] mx-auto">
                {/* Grid rings */}
                {[0.33, 0.66, 1.0].map((scale) => (
                  <polygon
                    key={scale}
                    points={pentagonPath(scale, cx, cy, r)}
                    fill="none"
                    stroke="var(--color-border)"
                    strokeWidth={0.5}
                    opacity={0.4}
                  />
                ))}

                {/* Axis lines */}
                {Array.from({ length: 5 }, (_, i) => {
                  const [x, y] = pentagonPoint(i, 1, cx, cy, r);
                  return (
                    <line
                      key={i}
                      x1={cx}
                      y1={cy}
                      x2={x}
                      y2={y}
                      stroke="var(--color-border)"
                      strokeWidth={0.5}
                      opacity={0.3}
                    />
                  );
                })}

                {/* Data polygon */}
                <polygon
                  points={radarValues
                    .map((v, i) => {
                      const [x, y] = pentagonPoint(i, Math.max(v, 0.02), cx, cy, r);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="var(--color-accent)"
                  fillOpacity={0.15}
                  stroke="var(--color-accent)"
                  strokeWidth={1.5}
                />

                {/* Data points */}
                {radarValues.map((v, i) => {
                  const [x, y] = pentagonPoint(i, Math.max(v, 0.02), cx, cy, r);
                  const isPromptsNull = i === 2 && radar.prompts === null;
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={2.5}
                      fill={isPromptsNull ? 'var(--color-text-muted)' : 'var(--color-accent)'}
                      opacity={isPromptsNull ? 0.4 : 1}
                    />
                  );
                })}

                {/* Labels */}
                {radarLabels.map((label, i) => {
                  const pos = labelPositions[i];
                  const isPromptsNull = i === 2 && radar.prompts === null;
                  return (
                    <text
                      key={label}
                      x={pos.x}
                      y={pos.y}
                      textAnchor={pos.anchor}
                      fontSize={9}
                      fill={isPromptsNull ? 'var(--color-text-muted)' : 'var(--color-text-secondary)'}
                      opacity={isPromptsNull ? 0.5 : 1}
                    >
                      {label}
                    </text>
                  );
                })}
              </svg>

              {/* Score summary row */}
              <div className="flex justify-center gap-4 mt-4">
                {radarLabels.map((label, i) => (
                  <div key={label} className="text-center">
                    <div className="text-[10px] font-mono text-text-muted">
                      {i === 2 && radar.prompts === null
                        ? '—'
                        : `${(radarValues[i] * 100).toFixed(0)}%`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Complexity Distribution ── */}
          <section className="hud-border rounded-xl p-6 bg-bg-surface-1 mb-10">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                COMPLEXITY_DISTRIBUTION
              </div>
              <InfoTip text="Breakdown of milestones by difficulty level — from simple fixes to complex features." />
            </div>

            <div className="space-y-3">
              {([
                { label: 'Simple', count: complexity.simple, color: 'bg-emerald-500' },
                { label: 'Medium', count: complexity.medium, color: 'bg-amber-500' },
                { label: 'Complex', count: complexity.complex, color: 'bg-red-400' },
              ] as const).map((item) => (
                <div key={item.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-text-secondary">
                      {item.label} · {item.count}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-bg-surface-3/50 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${item.color}`}
                      style={{ width: `${(item.count / complexityMax) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Stacked summary bar */}
            {complexityTotal > 0 && (
              <div className="mt-4 w-full h-2 rounded-full bg-bg-surface-3/50 overflow-hidden flex">
                <div
                  className="h-full bg-emerald-500"
                  style={{ width: `${(complexity.simple / complexityTotal) * 100}%` }}
                />
                <div
                  className="h-full bg-amber-500"
                  style={{ width: `${(complexity.medium / complexityTotal) * 100}%` }}
                />
                <div
                  className="h-full bg-red-400"
                  style={{ width: `${(complexity.complex / complexityTotal) * 100}%` }}
                />
              </div>
            )}
          </section>

          {/* ── Languages + AI Tools + Task Types (bar charts) ── */}
          <section className="mb-10">
            <ProfileBreakdowns
              topLanguages={topLanguages}
              topClients={topClients}
              taskTypes={taskTypes}
            />
          </section>

          {/* ── Badges ── */}
          {badges.length > 0 && (
            <section className="hud-border rounded-xl p-6 bg-bg-surface-1 mb-10">
              <div className="flex items-center gap-2 mb-4">
                <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                  BADGES
                </div>
                <InfoTip text="Achievements earned based on milestones, streaks, and proficiency." />
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
      </div>
  );
}
