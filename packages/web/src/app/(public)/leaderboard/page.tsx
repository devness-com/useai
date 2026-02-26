'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Trophy,
  Flame,
  Clock,
  ChevronDown,
  Crown,
  Medal,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import type { LeaderboardEntry } from '@useai/shared';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DIMENSIONS = [
  { value: 'score', label: 'APS Score' },
  { value: 'hours', label: 'Hours' },
  { value: 'streak', label: 'Streak' },
  { value: 'sessions', label: 'Sessions' },
];

const WINDOWS = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: 'all', label: 'All Time' },
];

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
/*  Score label per dimension                                          */
/* ------------------------------------------------------------------ */

function getScoreLabel(dimension: string) {
  switch (dimension) {
    case 'hours':
      return 'Hours';
    case 'streak':
      return 'Streak';
    case 'sessions':
      return 'Sessions';
    default:
      return 'APS';
  }
}

function formatScore(score: number, dimension: string) {
  switch (dimension) {
    case 'hours':
      return `${score}h`;
    case 'streak':
      return `${score}d`;
    default:
      return String(Math.round(score));
  }
}

/* ------------------------------------------------------------------ */
/*  Filter Bar                                                         */
/* ------------------------------------------------------------------ */

function FilterBar({
  dimension,
  setDimension,
  timeWindow,
  setTimeWindow,
}: {
  dimension: string;
  setDimension: (v: string) => void;
  timeWindow: string;
  setTimeWindow: (v: string) => void;
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

      <div className="flex-1" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                   */
/* ------------------------------------------------------------------ */

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          className="grid grid-cols-[2.5rem_1fr_3.5rem_3rem_3.5rem] sm:grid-cols-[3.5rem_1fr_5.5rem_6rem_4.5rem_5.5rem] items-center px-3 sm:px-4 py-3 border-b border-border/20"
        >
          <div className="h-4 w-6 bg-bg-surface-2 rounded animate-pulse" />
          <div className="h-4 w-24 bg-bg-surface-2 rounded animate-pulse" />
          <div className="h-4 w-10 bg-bg-surface-2 rounded animate-pulse ml-auto" />
          <div className="h-4 w-16 bg-bg-surface-2 rounded animate-pulse ml-auto hidden sm:block" />
          <div className="h-4 w-8 bg-bg-surface-2 rounded animate-pulse ml-auto" />
          <div className="h-4 w-10 bg-bg-surface-2 rounded animate-pulse ml-auto" />
        </div>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LeaderboardPage() {
  const [dimension, setDimension] = useState('score');
  const [timeWindow, setTimeWindow] = useState('7d');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiFetch<LeaderboardEntry[]>(
        `/api/leaderboard?dimension=${dimension}&window=${timeWindow}&limit=50`,
      );
      setEntries(data);
    } catch {
      setError('Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  }, [dimension, timeWindow]);

  useEffect(() => {
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-28 pb-16">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <Trophy className="w-6 h-6 sm:w-7 sm:h-7 text-accent drop-shadow-[0_0_10px_rgba(var(--accent-rgb),0.4)] shrink-0" />
          <h1 className="text-2xl sm:text-3xl font-black text-text-primary tracking-tight">
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
        />

        {/* Table */}
        <div className="hud-border rounded-xl bg-bg-surface-1 overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3rem_3.5rem] sm:grid-cols-[3.5rem_1fr_5.5rem_6rem_4.5rem_5.5rem] items-center px-3 sm:px-4 py-3 border-b border-border/50 text-[10px] font-mono text-text-muted tracking-widest uppercase">
            <span>#</span>
            <span>Developer</span>
            <span className="text-right">{getScoreLabel(dimension)}</span>
            <span className="text-right hidden sm:block">Language</span>
            <span className="text-right">
              <Flame className="w-3 h-3 inline" />
            </span>
            <span className="text-right">
              <Clock className="w-3 h-3 inline" /> 7d
            </span>
          </div>

          {/* Loading state */}
          {loading && <SkeletonRows />}

          {/* Error state */}
          {!loading && error && (
            <div className="text-center py-16">
              <p className="text-text-muted text-sm mb-4">{error}</p>
              <button
                onClick={fetchLeaderboard}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-bg-surface-2 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3 h-3" />
                Retry
              </button>
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && entries.length === 0 && (
            <div className="text-center py-16">
              <p className="text-text-muted text-sm">
                No rankings yet. Be the first to sync your sessions.
              </p>
            </div>
          )}

          {/* Rows */}
          {!loading &&
            !error &&
            entries.map((entry) => {
              const decoration = getRankDecoration(entry.rank);
              return (
                <div
                  key={entry.user_id}
                  className={`grid grid-cols-[2.5rem_1fr_3.5rem_3rem_3.5rem] sm:grid-cols-[3.5rem_1fr_5.5rem_6rem_4.5rem_5.5rem] items-center px-3 sm:px-4 py-3 border-b border-border/20 transition-colors hover:bg-bg-surface-2/50 ${decoration.bg} ${decoration.glow}`}
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
                    {entry.has_profile ? (
                      <Link
                        href={`/${entry.username}`}
                        className="text-sm font-bold text-text-primary hover:text-accent transition-colors truncate block"
                      >
                        {entry.display_name || entry.username}
                      </Link>
                    ) : (
                      <span className="text-sm font-bold text-text-primary truncate block">
                        {entry.display_name || entry.username}
                      </span>
                    )}
                    {entry.has_profile && entry.display_name && (
                      <span className="text-[10px] font-mono text-text-muted">
                        @{entry.username}
                      </span>
                    )}
                  </span>

                  {/* Score */}
                  <span
                    className={`text-right font-mono font-bold text-sm ${
                      entry.rank <= 3 ? 'text-accent' : 'text-text-primary'
                    }`}
                  >
                    {formatScore(entry.score, dimension)}
                  </span>

                  {/* Language */}
                  <span className="text-right hidden sm:block">
                    {entry.top_language ? (
                      <span className="inline-flex px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-bg-surface-2 text-text-secondary border border-border/30">
                        {entry.top_language}
                      </span>
                    ) : (
                      <span className="text-[10px] text-text-muted">—</span>
                    )}
                  </span>

                  {/* Streak */}
                  <span className="text-right text-xs font-mono text-streak">
                    {entry.current_streak ?? 0}d
                  </span>

                  {/* 7d Hours */}
                  <span className="text-right text-xs font-mono text-text-secondary">
                    {entry.hours_7d ?? 0}h
                  </span>
                </div>
              );
            })}
        </div>

        {/* Footer note */}
        <div className="mt-6 text-center">
          <p className="text-[10px] font-mono text-text-muted tracking-widest">
            SCORES VERIFIED VIA ED25519 SIGNATURE CHAIN
          </p>
        </div>
      </div>
    </div>
  );
}
