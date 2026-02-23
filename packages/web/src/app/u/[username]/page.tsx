import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Clock,
  Rocket,
  Brain,
  Flame,
  Calendar,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { TopNav } from '@/components/TopNav';
import { Footer } from '@/components/Footer';
import { RadarChart } from '@/components/RadarChart';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { Badge } from '@/components/Badge';

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockProfile = {
  username: 'demo-developer',
  avatar: null,
  bio: 'Full-stack developer',
  aps: 847,
  percentile: 12,
  memberSince: '2026-01',
  stats: { hours: 142, featuresShipped: 89, complexSolved: 23 },
  radar: {
    output: 78,
    efficiency: 85,
    promptQuality: 72,
    consistency: 90,
    breadth: 65,
  },
  languages: ['TypeScript', 'Python', 'Rust', 'Go'],
  tools: ['Claude Code', 'Cursor', 'Copilot'],
  streak: 14,
  verified: true,
  milestones: [
    {
      title: 'Implemented user authentication',
      category: 'feature' as const,
      complexity: 'complex' as const,
      duration: '1h 23m',
      tool: 'Claude Code',
      date: '2026-02-22',
    },
    {
      title: 'Fixed race condition in background worker',
      category: 'bugfix' as const,
      complexity: 'complex' as const,
      duration: '47m',
      tool: 'Cursor',
      date: '2026-02-21',
    },
    {
      title: 'Added integration test suite',
      category: 'test' as const,
      complexity: 'medium' as const,
      duration: '35m',
      tool: 'Claude Code',
      date: '2026-02-20',
    },
  ],
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  feature: { bg: 'bg-accent/10', text: 'text-accent', label: 'Feature' },
  bugfix: { bg: 'bg-error/10', text: 'text-error', label: 'Bugfix' },
  test: { bg: 'bg-blue/10', text: 'text-blue', label: 'Test' },
  refactor: { bg: 'bg-purple/10', text: 'text-purple', label: 'Refactor' },
  docs: { bg: 'bg-emerald/10', text: 'text-emerald', label: 'Docs' },
};

const COMPLEXITY_COLORS: Record<string, { bg: string; text: string }> = {
  simple: { bg: 'bg-bg-surface-3/50', text: 'text-text-muted' },
  medium: { bg: 'bg-streak-bg', text: 'text-streak' },
  complex: { bg: 'bg-error/10', text: 'text-error' },
};

/* ------------------------------------------------------------------ */
/*  Metadata                                                           */
/* ------------------------------------------------------------------ */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  // In production, fetch from API. For now, use mock.
  const profile = mockProfile;
  const name = profile.username === 'demo-developer' ? username : profile.username;

  return {
    title: `${name} -- UseAI Developer Profile`,
    description: `${name} has an AI Proficiency Score of ${profile.aps} (top ${profile.percentile}%). ${profile.stats.hours}h with AI, ${profile.streak} day streak.`,
    openGraph: {
      title: `${name} -- UseAI Developer Profile`,
      description: `APS ${profile.aps} -- Top ${profile.percentile}% -- ${profile.stats.hours}h with AI`,
      type: 'profile',
    },
  };
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  // In production, fetch from API and call notFound() if missing
  const profile = mockProfile;
  const displayName = username;
  const initials = displayName.slice(0, 2).toUpperCase();

  return (
    <>
      <TopNav />
      <div className="min-h-screen bg-bg-base">
        <div className="max-w-5xl mx-auto px-6 pt-28 pb-16">
          {/* ── Header ── */}
          <section className="flex flex-col md:flex-row md:items-start gap-6 mb-10">
            {/* Avatar */}
            <div className="shrink-0 w-20 h-20 rounded-2xl bg-bg-surface-2 border border-border flex items-center justify-center text-2xl font-black text-text-muted">
              {initials}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-black text-text-primary tracking-tight">
                  {displayName}
                </h1>
                {profile.verified && (
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-accent/10 text-accent border border-accent/20"
                    title="Cryptographically verified profile"
                  >
                    <Shield className="w-3 h-3" />
                    VERIFIED
                  </span>
                )}
              </div>
              <p className="text-sm text-text-muted mt-1 mb-3">{profile.bio}</p>

              <div className="flex items-center gap-6 flex-wrap text-xs text-text-muted font-mono">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5" />
                  Member since{' '}
                  {new Date(profile.memberSince + '-01').toLocaleDateString('en', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-streak" />
                  {profile.streak} day streak
                </span>
              </div>
            </div>

            {/* APS Score */}
            <div className="shrink-0 hud-border rounded-xl p-5 bg-bg-surface-1 text-center min-w-[160px]">
              <div className="text-[10px] font-mono text-text-muted tracking-widest mb-2">
                AI PROFICIENCY
              </div>
              <div className="text-5xl font-black text-accent leading-none mb-1 drop-shadow-[0_0_15px_rgba(var(--accent-rgb),0.4)]">
                {profile.aps}
              </div>
              <div className="text-xs font-mono text-text-secondary">
                Top{' '}
                <span className="text-accent font-bold">{profile.percentile}%</span>
              </div>
            </div>
          </section>

          {/* ── Stat Cards ── */}
          <section className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <Clock className="w-5 h-5 text-accent mb-3" />
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {profile.stats.hours}
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Hours with AI
              </div>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <Rocket className="w-5 h-5 text-blue mb-3" />
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {profile.stats.featuresShipped}
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Features Shipped
              </div>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1">
              <Brain className="w-5 h-5 text-purple mb-3" />
              <div className="text-3xl font-black text-text-primary leading-none mb-1">
                {profile.stats.complexSolved}
              </div>
              <div className="text-xs text-text-muted font-mono tracking-wider uppercase">
                Complex Tasks Solved
              </div>
            </div>
          </section>

          {/* ── Radar + Languages/Tools ── */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-10">
            {/* Radar Chart */}
            <div className="hud-border rounded-xl p-6 bg-bg-surface-1 flex flex-col items-center">
              <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 self-start border-l-2 border-accent pl-2">
                PROFICIENCY_RADAR
              </div>
              <RadarChart data={profile.radar} />
            </div>

            {/* Languages + Tools */}
            <div className="flex flex-col gap-6">
              {/* Languages */}
              <div className="hud-border rounded-xl p-6 bg-bg-surface-1 flex-1">
                <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 border-l-2 border-accent pl-2">
                  LANGUAGES
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.languages.map((lang) => (
                    <span
                      key={lang}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-border bg-bg-surface-2 text-text-secondary"
                    >
                      {lang}
                    </span>
                  ))}
                </div>
              </div>

              {/* Tools */}
              <div className="hud-border rounded-xl p-6 bg-bg-surface-1 flex-1">
                <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 border-l-2 border-accent pl-2">
                  AI_TOOLS
                </div>
                <div className="flex flex-wrap gap-2">
                  {profile.tools.map((tool) => (
                    <span
                      key={tool}
                      className="px-3 py-1.5 text-xs font-bold rounded-lg border border-accent/20 bg-accent/5 text-accent"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>

              {/* Badges */}
              <div className="hud-border rounded-xl p-6 bg-bg-surface-1">
                <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 border-l-2 border-accent pl-2">
                  BADGES
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    name="7-Day Streak"
                    category="streak"
                    earned={true}
                    earnedAt="2026-02-15"
                  />
                  <Badge
                    name="14-Day Streak"
                    category="streak"
                    earned={true}
                    earnedAt="2026-02-22"
                  />
                  <Badge
                    name="AI Architect"
                    category="proficiency"
                    earned={true}
                    earnedAt="2026-02-10"
                  />
                  <Badge name="30-Day Streak" category="streak" earned={false} />
                  <Badge name="Polyglot" category="special" earned={false} />
                </div>
              </div>
            </div>
          </section>

          {/* ── Activity Heatmap ── */}
          <section className="hud-border rounded-xl p-6 bg-bg-surface-1 mb-10">
            <div className="text-[10px] font-mono text-text-muted tracking-widest mb-4 border-l-2 border-accent pl-2">
              ACTIVITY_HEATMAP
            </div>
            <ActivityHeatmap />
          </section>

          {/* ── Milestones ── */}
          <section className="hud-border rounded-xl p-6 bg-bg-surface-1">
            <div className="flex items-center justify-between mb-6">
              <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                RECENT_MILESTONES
              </div>
              <span className="text-xs font-mono text-text-muted">
                {profile.milestones.length} entries
              </span>
            </div>

            <div className="space-y-3">
              {profile.milestones.map((m, i) => {
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
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold ${comp.bg} ${comp.text}`}
                      >
                        {m.complexity}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">
                        {m.duration}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">
                        {m.tool}
                      </span>
                      <span className="text-[10px] font-mono text-text-muted">
                        {m.date}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>
      <Footer />
    </>
  );
}
