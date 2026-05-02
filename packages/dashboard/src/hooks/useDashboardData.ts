import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  DashboardResponse,
  FeedConversation,
  StreakDetail,
} from "../lib/api";
import { fetchAggregations, fetchPrompts } from "../lib/api";
import type { Filters } from "../lib/types";
import type { TimeScale } from "../components/time-travel/types";
import {
  SCALE_LABELS,
  SCRUB_CALENDAR_MAP,
  isCalendarScale,
  getTimeWindow,
  jumpScale,
  shouldSnapToLive,
} from "../components/time-travel/types";

export type AggregationsFetcher = typeof fetchAggregations;
export type PromptsFetcher = typeof fetchPrompts;

/** Minimal store interface that useDashboardData reads from. */
export interface DashboardDataStore {
  timeTravelTime: number | null;
  timeScale: TimeScale;
  filters: Filters;
  setTimeTravelTime: (t: number | null) => void;
  setTimeScale: (s: TimeScale) => void;
  setFilter: (key: keyof Filters, value: string) => void;
}

/** Hook to select state from a Zustand-compatible store. */
export type UseStore = <T>(selector: (s: DashboardDataStore) => T) => T;

const EMPTY_STREAK: StreakDetail = {
  current: 0,
  longest: 0,
  freezesUsed: 0,
  freezesRemaining: 2,
  activeDaysInWindow: 0,
  windowDays: 30,
};

const EMPTY_STATS: DashboardResponse["stats"] = {
  totalHours: 0,
  totalSessions: 0,
  coveredHours: 0,
  aiMultiplier: 0,
  peakConcurrency: 0,
  currentStreak: 0,
  filesTouched: 0,
  featuresShipped: 0,
  bugsFixed: 0,
  complexSolved: 0,
  totalMilestones: 0,
  completionRate: 0,
  activeProjects: 0,
  byToolClockTime: {},
  byLanguageClockTime: {},
  byTaskTypeClockTime: {},
  byProjectAiTime: {},
  byProjectClock: {},
  byAiToolDuration: {},
  byLanguageAiTime: {},
  byTaskTypeAiTime: {},
};

export interface UseDashboardDataOptions {
  useStore: UseStore;
  aggregationsFetcher?: AggregationsFetcher | undefined;
  promptsFetcher?: PromptsFetcher | undefined;
  onDeleteSession?: ((id: string) => void) | undefined;
  onDeleteConversation?: ((id: string) => void) | undefined;
  onDeleteMilestone?: ((id: string) => void) | undefined;
}

export function useDashboardData({
  useStore,
  aggregationsFetcher: fetchAggregations_ = fetchAggregations,
  promptsFetcher: fetchPrompts_ = fetchPrompts,
  onDeleteSession,
  onDeleteConversation,
  onDeleteMilestone,
}: UseDashboardDataOptions) {
  //For time scrubbber
  const timeTravelTime = useStore((s) => s.timeTravelTime);
  const setTimeTravelTime = useStore((s) => s.setTimeTravelTime);

  //For 1h, 3h, day, etc selector.
  const timeScale = useStore((s) => s.timeScale);
  const setTimeScale = useStore((s) => s.setTimeScale);

  const filters = useStore((s) => s.filters);
  const setFilter = useStore((s) => s.setFilter);

  // Restore calendar scale when returning to live
  useEffect(() => {
    if (timeTravelTime === null) {
      const calendarScale = SCRUB_CALENDAR_MAP[timeScale];
      if (calendarScale) setTimeScale(calendarScale);
    }
  }, [timeTravelTime, timeScale, setTimeScale]);

  // ── Compute window ─────────────────────────────────────────────────────
  // For rolling scales, the window depends on Date.now(). To avoid
  // recomputing the window (and re-firing the fetch effect) on every render,
  // pin "now" to a tick that updates every 30s while live.
  const [nowTick, setNowTick] = useState(() => Date.now());
  useEffect(() => {
    if (timeTravelTime !== null) return;
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, [timeTravelTime]);

  const effectiveTime = timeTravelTime ?? nowTick;
  const { start: windowStart, end: windowEnd } = getTimeWindow(
    timeScale,
    effectiveTime,
  );
  const isLive = timeTravelTime === null;
  // ── Server data ────────────────────────────────────────────────────────
  const [serverData, setServerData] = useState<DashboardResponse | null>(null);
  const [feedConversations, setFeedConversations] = useState<
    FeedConversation[]
  >([]);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);

  // Fetch dashboard stats
  useEffect(() => {
    fetchAggregations_(windowStart, windowEnd)
      .then(setServerData)
      .catch(() => setServerData(null));
  }, [windowStart, windowEnd, dataVersion]);

  // Fetch feed
  useEffect(() => {
    setFeedConversations([]);
    setFeedLoading(true);
    fetchPrompts_({
      start: windowStart,
      end: windowEnd,
      offset: 0,
      limit: 50,
      tool: filters.tool !== "all" ? filters.tool : undefined,
      language: filters.language !== "all" ? filters.language : undefined,
      project: filters.project !== "all" ? filters.project : undefined,
    })
      .then((data) => {
        setFeedConversations(data.conversations);
        setFeedHasMore(data.hasMore);
        setFeedLoading(false);
      })
      .catch(() => setFeedLoading(false));
  }, [windowStart, windowEnd, filters, dataVersion]);

  const handleLoadMore = useCallback(() => {
    if (feedLoading || !feedHasMore) return;
    setFeedLoading(true);
    fetchPrompts_({
      start: windowStart,
      end: windowEnd,
      offset: feedConversations.length,
      limit: 50,
      tool: filters.tool !== "all" ? filters.tool : undefined,
      language: filters.language !== "all" ? filters.language : undefined,
      project: filters.project !== "all" ? filters.project : undefined,
    })
      .then((data) => {
        setFeedConversations((prev) => [...prev, ...data.conversations]);
        setFeedHasMore(data.hasMore);
        setFeedLoading(false);
      })
      .catch(() => setFeedLoading(false));
  }, [
    timeScale,
    timeTravelTime,
    filters,
    feedConversations.length,
    feedLoading,
    feedHasMore,
  ]);

  // ── Delete handlers (re-fetch after delete) ────────────────────────────
  const handleDeleteSession = useCallback(
    async (id: string) => {
      await onDeleteSession?.(id);
      setDataVersion((v) => v + 1);
    },
    [onDeleteSession],
  );

  const handleDeleteConversation = useCallback(
    async (id: string) => {
      await onDeleteConversation?.(id);
      setDataVersion((v) => v + 1);
    },
    [onDeleteConversation],
  );

  const handleDeleteMilestone = useCallback(
    async (id: string) => {
      await onDeleteMilestone?.(id);
      setDataVersion((v) => v + 1);
    },
    [onDeleteMilestone],
  );

  // ── Destructure server data ────────────────────────────────────────────
  const stats = serverData?.stats ?? EMPTY_STATS;
  // Server-computed streak with freeze + weekend forgiveness. Falls back to a
  // synthesized object built from stats.currentStreak when an older daemon
  // doesn't ship the richer payload yet.
  const streak: StreakDetail = serverData?.streak ?? {
    ...EMPTY_STREAK,
    current: stats.currentStreak,
    longest: stats.currentStreak,
  };
  const evaluation = serverData?.evaluation ?? null;
  const complexityData = serverData?.complexity ?? {
    simple: 0,
    medium: 0,
    complex: 0,
  };
  const displaySessionCount = serverData?.sessionCount ?? 0;
  const filteredSessions = serverData?.sessions ?? [];
  const filteredMilestones = serverData?.milestones ?? [];
  const allSessionsForStrip = filteredSessions;
  const activity = serverData?.activity ?? {
    hourlyClockTime: [],
    hourlyAiTime: [],
    dailyClockTime: [],
    dailyAiTime: [],
    weeklyClockTime: [],
    weeklyAiTime: [],
    monthlyClockTime: [],
    monthlyAiTime: [],
    effectiveDate: "",
  };

  // ── Navigation ─────────────────────────────────────────────────────────
  const outsideWindowCounts = useMemo(() => {
    if (isLive) return undefined;
    const scaleLabel = SCALE_LABELS[timeScale];
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    const fmtDate = (iso: string) => {
      const d = new Date(iso);
      return `${d.toLocaleDateString([], { month: "short", day: "numeric" })} ${fmt(iso)}`;
    };
    const isMultiDay =
      isCalendarScale(timeScale) ||
      windowStart.slice(0, 10) !== windowEnd.slice(0, 10);
    const label = isMultiDay ? fmtDate : fmt;

    const olderRef = jumpScale(timeScale, effectiveTime, -1);
    const olderWindow = getTimeWindow(timeScale, olderRef);
    const olderLabel = `View prev ${scaleLabel} · ${label(olderWindow.start)} – ${label(olderWindow.end)}`;
    const newerRef = jumpScale(timeScale, effectiveTime, 1);
    const newerWindow = getTimeWindow(timeScale, newerRef);
    return {
      before: 1,
      after: 1,
      newerLabel: `View next ${scaleLabel} · ${label(newerWindow.start)} – ${label(newerWindow.end)}`,
      olderLabel,
    };
  }, [effectiveTime, isLive, timeScale, windowStart, windowEnd]);

  const handleNavigateNewer = useCallback(() => {
    const next = jumpScale(timeScale, effectiveTime, 1);
    if (shouldSnapToLive(timeScale, next)) {
      setTimeTravelTime(null);
    } else {
      setTimeTravelTime(next);
    }
  }, [effectiveTime, timeScale]);

  const handleNavigateOlder = useCallback(() => {
    const prev = jumpScale(timeScale, effectiveTime, -1);
    setTimeTravelTime(prev);
  }, [effectiveTime, timeScale]);

  const highlightDate = useMemo(() => {
    if (isLive) return undefined;
    const d = new Date(effectiveTime);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, [isLive, effectiveTime]);

  const handleDayClick = useCallback(
    (date: string) => {
      const midday = new Date(`${date}T12:00:00`).getTime();
      setTimeTravelTime(midday);
      setTimeScale("day");
    },
    [setTimeScale],
  );

  const feedMetrics = useMemo(() => {
    if (!evaluation || evaluation.sessionCount === 0) return null;
    return {
      promptQuality: evaluation.promptQuality,
      scope: evaluation.scopeQuality,
      context: evaluation.contextProvided,
      independence: evaluation.independenceLevel,
    };
  }, [evaluation]);

  return {
    // Time travel
    timeTravelTime,
    setTimeTravelTime,
    timeScale,
    setTimeScale,
    effectiveTime,
    isLive,
    windowStart,
    windowEnd,

    // Filters
    filters,
    setFilter,

    // Server data
    stats,
    streak,
    evaluation,
    complexityData,
    displaySessionCount,
    filteredSessions,
    filteredMilestones,
    allSessionsForStrip,
    activity,
    hasStats: serverData !== null,

    // Feed
    feedConversations,
    feedHasMore,
    feedLoading,
    handleLoadMore,

    // Navigation
    outsideWindowCounts,
    handleNavigateNewer,
    handleNavigateOlder,
    highlightDate,
    handleDayClick,

    // Delete
    handleDeleteSession,
    handleDeleteConversation,
    handleDeleteMilestone,

    // Metrics
    feedMetrics,
  };
}
