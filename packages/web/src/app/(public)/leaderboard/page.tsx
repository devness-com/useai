'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Flame,
  Clock,
  ChevronDown,
  Search,
  Crown,
  Medal,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Mock data                                                          */
/* ------------------------------------------------------------------ */

const mockLeaderboard = Array.from({ length: 20 }, (_, i) => ({
  rank: i + 1,
  username: `dev-${i + 1}`,
  aps: 950 - i * 15,
  topLanguage: ['TypeScript', 'Python', 'Rust', 'Go', 'Java'][i % 5],
  streak: Math.max(1, 30 - i),
  hours7d: Math.round((40 - i * 1.5) * 10) / 10,
}));

const DIMENSIONS = [
  { value: 'aps', label: 'APS Score' },
  { value: 'hours', label: 'Hours Coded' },
  { value: 'streak', label: 'Streak' },
];

const WINDOWS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];

const LANGUAGES = ['All', 'TypeScript', 'Python', 'Rust', 'Go', 'Java'];

/* ------------------------------------------------------------------ */
/*  Rank styling                                                       */
/* ------------------------------------------------------------------ */

function getRankDecoration(rank: number) {
  if (rank === 1)
    return {
      icon: <Crown className="w-4 h-4 text-yellow-400" />,
      border: 'border-yellow-400/40',
      bg: 'bg-yellow-400/5',
      glow: 'shadow-[0_0_20px_rgba(250,204,21,0.1)]',
      text: 'text-yellow-400',
    };
  if (rank === 2)
    return {
      icon: <Medal className="w-4 h-4 text-gray-300" />,
      border: 'border-gray-300/30',
      bg: 'bg-gray-300/5',
      glow: '',
      text: 'text-gray-300',
    };
  if (rank === 3)
    return {
      icon: <Medal className="w-4 h-4 text-amber-600" />,
      border: 'border-amber-600/30',
      bg: 'bg-amber-600/5',
      glow: '',
      text: 'text-amber-600',
    };
  return {
    icon: null,
    border: 'border-border/30',
    bg: '',
    glow: '',
    text: 'text-text-muted',
  };
}

/* ------------------------------------------------------------------ */
/*  Filter Bar                                                         */
/* ------------------------------------------------------------------ */

function FilterBar({
  dimension,
  setDimension,
  timeWindow,
  setTimeWindow,
  language,
  setLanguage,
}: {
  dimension: string;
  setDimension: (v: string) => void;
  timeWindow: string;
  setTimeWindow: (v: string) => void;
  language: string;
  setLanguage: (v: string) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-8">
      {/* Dimension */}
      <div className="relative">
        <select
          value={dimension}
          onChange={(e) => setDimension(e.target.value)}
          className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-border bg-bg-surface-1 text-xs font-mono text-text-primary cursor-pointer focus:outline-none focus:border-accent/50"
          aria-label="Sort by dimension"
        >
          {DIMENSIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Time Window */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        {WINDOWS.map((w) => (
          <button
            key={w.value}
            onClick={() => setTimeWindow(w.value)}
            className={`px-3 py-2 text-xs font-mono cursor-pointer transition-colors ${
              timeWindow === w.value
                ? 'bg-accent/10 text-accent border-accent/20'
                : 'text-text-muted hover:text-text-secondary hover:bg-bg-surface-2'
            }`}
          >
            {w.label}
          </button>
        ))}
      </div>

      {/* Language filter */}
      <div className="relative">
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="appearance-none pl-3 pr-8 py-2 rounded-lg border border-border bg-bg-surface-1 text-xs font-mono text-text-primary cursor-pointer focus:outline-none focus:border-accent/50"
          aria-label="Filter by language"
        >
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>
        <ChevronDown className="w-3 h-3 text-text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {/* Spacer + search hint */}
      <div className="flex-1" />
      <div className="flex items-center gap-2 text-[10px] font-mono text-text-muted">
        <Search className="w-3 h-3" />
        <span className="hidden sm:inline">Search coming soon</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LeaderboardPage() {
  const [dimension, setDimension] = useState('aps');
  const [timeWindow, setTimeWindow] = useState('7d');
  const [language, setLanguage] = useState('All');

  const filteredData = useMemo(() => {
    let data = [...mockLeaderboard];
    if (language !== 'All') {
      data = data.filter((d) => d.topLanguage === language);
    }
    // Re-sort based on dimension
    if (dimension === 'hours') {
      data.sort((a, b) => b.hours7d - a.hours7d);
    } else if (dimension === 'streak') {
      data.sort((a, b) => b.streak - a.streak);
    } else {
      data.sort((a, b) => b.aps - a.aps);
    }
    // Re-rank after filtering
    return data.map((d, i) => ({ ...d, rank: i + 1 }));
  }, [dimension, language]);

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-5xl mx-auto px-6 pt-28 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-7 h-7 text-accent drop-shadow-[0_0_10px_rgba(var(--accent-rgb),0.4)]" />
          <h1 className="text-3xl font-black text-text-primary tracking-tight">
            Global AI Proficiency Leaderboard
          </h1>
        </div>
        <p className="text-sm text-text-muted mb-8">
          Ranked by cryptographically verified AI Proficiency Scores across all
          supported tools.
        </p>

        {/* Filters */}
        <FilterBar
          dimension={dimension}
          setDimension={setDimension}
          timeWindow={timeWindow}
          setTimeWindow={setTimeWindow}
          language={language}
          setLanguage={setLanguage}
        />

        {/* Table */}
        <div className="hud-border rounded-xl bg-bg-surface-1 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[3rem_1fr_5rem_5.5rem_4rem_5rem] sm:grid-cols-[3.5rem_1fr_5.5rem_6rem_4.5rem_5.5rem] items-center px-4 py-3 border-b border-border/50 text-[10px] font-mono text-text-muted tracking-widest uppercase">
            <span>#</span>
            <span>Developer</span>
            <span className="text-right">APS</span>
            <span className="text-right hidden sm:block">Language</span>
            <span className="text-right">
              <Flame className="w-3 h-3 inline" />
            </span>
            <span className="text-right">7d Hours</span>
          </div>

          {/* Rows */}
          {filteredData.length === 0 ? (
            <div className="text-center py-16 text-text-muted text-sm">
              No results match your filters.
            </div>
          ) : (
            filteredData.map((entry) => {
              const decoration = getRankDecoration(entry.rank);
              return (
                <div
                  key={entry.username}
                  className={`grid grid-cols-[3rem_1fr_5rem_5.5rem_4rem_5rem] sm:grid-cols-[3.5rem_1fr_5.5rem_6rem_4.5rem_5.5rem] items-center px-4 py-3 border-b border-border/20 transition-colors hover:bg-bg-surface-2/50 ${decoration.bg} ${decoration.glow}`}
                >
                  {/* Rank */}
                  <span
                    className={`font-mono font-black text-sm ${decoration.text}`}
                  >
                    <span className="flex items-center gap-1.5">
                      {decoration.icon}
                      {entry.rank}
                    </span>
                  </span>

                  {/* Username */}
                  <span className="min-w-0">
                    <Link
                      href={`/u/${entry.username}`}
                      className="text-sm font-bold text-text-primary hover:text-accent transition-colors truncate block"
                    >
                      {entry.username}
                    </Link>
                  </span>

                  {/* APS */}
                  <span
                    className={`text-right font-mono font-bold text-sm ${
                      entry.rank <= 3 ? 'text-accent' : 'text-text-primary'
                    }`}
                  >
                    {entry.aps}
                  </span>

                  {/* Language */}
                  <span className="text-right hidden sm:block">
                    <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-bg-surface-2 text-text-secondary border border-border/30">
                      {entry.topLanguage}
                    </span>
                  </span>

                  {/* Streak */}
                  <span className="text-right text-xs font-mono text-streak">
                    {entry.streak}d
                  </span>

                  {/* 7d Hours */}
                  <span className="text-right text-xs font-mono text-text-secondary">
                    {entry.hours7d}h
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Footer note */}
        <div className="mt-6 text-center">
          <p className="text-[10px] font-mono text-text-muted tracking-widest">
            SCORES VERIFIED VIA ED25519 SIGNATURE CHAIN -- UPDATED HOURLY
          </p>
        </div>
      </div>
    </div>
  );
}
