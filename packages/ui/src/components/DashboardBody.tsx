import { useCallback, useMemo, useState } from 'react';
import { Filter, Eye, EyeOff } from 'lucide-react';
import type { SessionSeal, Milestone } from '@useai/shared/types';
import type { StatCardType } from './StatDetailPanel';
import type { Filters, ActiveTab } from '../types';
import type { TimeScale } from './TimeTravel/types';
import { SCALE_MS, SCALE_LABELS } from './TimeTravel/types';
import { computeStats, calculateStreak, filterSessionsByWindow, filterMilestonesByWindow, countSessionsOutsideWindow } from '../stats';
import { StatsBar } from './StatsBar';
import { StatDetailPanel } from './StatDetailPanel';
import { TabBar } from './TabBar';
import { FilterChips } from './FilterChips';
import { SessionList } from './SessionList';
import { TimeTravelPanel } from './TimeTravel/TimeTravelPanel';
import { DailyRecap } from './DailyRecap';
import { EvaluationSummary } from './EvaluationSummary';
import { SkillRadar } from './SkillRadar';
import { ComplexityDistribution } from './ComplexityDistribution';
import { ImprovementTips } from './ImprovementTips';
import { TaskTypeBreakdown } from './TaskTypeBreakdown';
import { ActivityStrip } from './ActivityStrip';
import { RecentMilestones } from './RecentMilestones';
import { SummaryChips } from './SummaryChips';

export interface DashboardBodyProps {
  sessions: SessionSeal[];
  milestones: Milestone[];
  onDeleteSession?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onDeleteMilestone?: (id: string) => void;
  defaultTimeScale?: TimeScale;
  /** Controlled tab mode — when provided, DashboardBody won't render its own TabBar */
  activeTab?: ActiveTab;
  onActiveTabChange?: (tab: ActiveTab) => void;
}

function readLocalStorage<T extends string>(key: string, valid: T[], fallback: T): T {
  try {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    if (saved && (valid as string[]).includes(saved)) return saved as T;
  } catch { /* ignore */ }
  return fallback;
}

function writeLocalStorage(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}

export function DashboardBody({
  sessions,
  milestones,
  onDeleteSession,
  onDeleteConversation,
  onDeleteMilestone,
  defaultTimeScale = '1h',
  activeTab: controlledTab,
  onActiveTabChange,
}: DashboardBodyProps) {
  // ── UI state ────────────────────────────────────────────────────────────
  const [timeTravelTime, setTimeTravelTime] = useState<number | null>(null);
  const [timeScale, setTimeScaleRaw] = useState<TimeScale>(() =>
    readLocalStorage('useai-time-scale', ['15m', '30m', '1h', '12h', '24h', '7d', '30d'], defaultTimeScale),
  );
  const [filters, setFilters] = useState<Filters>({ category: 'all', client: 'all', project: 'all', language: 'all' });
  const [internalTab, setInternalTabRaw] = useState<ActiveTab>(() =>
    readLocalStorage('useai-active-tab', ['sessions', 'insights'], 'sessions'),
  );
  const [selectedStatCard, setSelectedStatCard] = useState<StatCardType>(null);
  const [globalShowPublic, setGlobalShowPublic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Controlled vs uncontrolled tab
  const isControlledTab = controlledTab !== undefined;
  const activeTab = controlledTab ?? internalTab;
  const setActiveTab = useCallback((tab: ActiveTab) => {
    if (onActiveTabChange) {
      onActiveTabChange(tab);
    } else {
      writeLocalStorage('useai-active-tab', tab);
      setInternalTabRaw(tab);
    }
  }, [onActiveTabChange]);

  const setTimeScale = useCallback((s: TimeScale) => {
    writeLocalStorage('useai-time-scale', s);
    setTimeScaleRaw(s);
  }, []);

  const setFilter = useCallback((key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  // ── Derived values ──────────────────────────────────────────────────────
  const isLive = timeTravelTime === null;
  const effectiveTime = timeTravelTime ?? Date.now();
  const windowStart = effectiveTime - SCALE_MS[timeScale];
  const windowEnd = effectiveTime;

  const filteredSessions = useMemo(
    () => filterSessionsByWindow(sessions, windowStart, windowEnd),
    [sessions, windowStart, windowEnd],
  );

  const filteredMilestones = useMemo(
    () => filterMilestonesByWindow(milestones, windowStart, windowEnd),
    [milestones, windowStart, windowEnd],
  );

  const stats = useMemo(
    () => computeStats(filteredSessions, filteredMilestones),
    [filteredSessions, filteredMilestones],
  );

  const globalStreak = useMemo(() => calculateStreak(sessions), [sessions]);

  const outsideWindowCounts = useMemo(() => {
    const counts = countSessionsOutsideWindow(sessions, windowStart, windowEnd);
    if (isLive && counts.before === 0) return undefined;
    const step = SCALE_MS[timeScale];
    const scaleLabel = SCALE_LABELS[timeScale];
    const fmt = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
    const fmtDate = (ts: number) => {
      const d = new Date(ts);
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${fmt(ts)}`;
    };
    const isMultiDay = step >= 86400000;
    const label = isMultiDay ? fmtDate : fmt;
    const olderStart = windowStart - step;
    const olderLabel = `View prev ${scaleLabel} · ${label(olderStart)} – ${label(windowStart)}`;
    if (isLive) {
      return { before: counts.before, after: 0, olderLabel };
    }
    const newerEnd = windowEnd + step;
    return {
      ...counts,
      newerLabel: `View next ${scaleLabel} · ${label(windowEnd)} – ${label(newerEnd)}`,
      olderLabel,
    };
  }, [sessions, windowStart, windowEnd, isLive, timeScale]);

  const handleNavigateNewer = useCallback(() => {
    const step = SCALE_MS[timeScale];
    const next = effectiveTime + step;
    if (next >= Date.now() - 60_000) {
      setTimeTravelTime(null);
    } else {
      setTimeTravelTime(next);
    }
  }, [effectiveTime, timeScale]);

  const handleNavigateOlder = useCallback(() => {
    const step = SCALE_MS[timeScale];
    setTimeTravelTime(effectiveTime - step);
  }, [effectiveTime, timeScale]);

  const highlightDate = useMemo(() => {
    if (isLive) return undefined;
    return new Date(effectiveTime).toISOString().slice(0, 10);
  }, [isLive, effectiveTime]);

  const evalAverages = useMemo(() => {
    const evaluated = filteredSessions.filter((s) => s.evaluation != null);
    if (evaluated.length === 0) return null;

    let pq = 0, cp = 0, sq = 0, il = 0;
    for (const s of evaluated) {
      const ev = s.evaluation!;
      pq += ev.prompt_quality;
      cp += ev.context_provided;
      sq += ev.scope_quality;
      il += ev.independence_level;
    }
    const n = evaluated.length;
    return {
      prompt_quality: Math.round((pq / n) * 10) / 10,
      context_provided: Math.round((cp / n) * 10) / 10,
      scope_quality: Math.round((sq / n) * 10) / 10,
      independence_level: Math.round((il / n) * 10) / 10,
    };
  }, [filteredSessions]);

  const complexityData = useMemo(() => {
    let simple = 0, medium = 0, complex = 0;
    for (const m of filteredMilestones) {
      if (m.complexity === 'simple') simple++;
      else if (m.complexity === 'medium') medium++;
      else if (m.complexity === 'complex') complex++;
    }
    return { simple, medium, complex };
  }, [filteredMilestones]);

  const handleDayClick = useCallback((date: string) => {
    const endOfDay = new Date(`${date}T23:59:59`).getTime();
    setTimeTravelTime(endOfDay);
    setTimeScale('24h');
  }, [setTimeScale]);

  const hasActiveFilter = filters.client !== 'all' || filters.language !== 'all' || filters.project !== 'all';

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <TimeTravelPanel
        value={timeTravelTime}
        onChange={setTimeTravelTime}
        scale={timeScale}
        onScaleChange={setTimeScale}
        sessions={sessions}
        milestones={milestones}
        showPublic={globalShowPublic}
      />

      <StatsBar
        totalHours={stats.totalHours}
        totalSessions={stats.totalSessions}
        currentStreak={globalStreak}
        filesTouched={stats.filesTouched}
        featuresShipped={stats.featuresShipped}
        bugsFixed={stats.bugsFixed}
        complexSolved={stats.complexSolved}
        selectedCard={selectedStatCard}
        onCardClick={setSelectedStatCard}
      />

      <StatDetailPanel
        type={selectedStatCard}
        milestones={filteredMilestones}
        showPublic={globalShowPublic}
        onClose={() => setSelectedStatCard(null)}
      />

      {!isControlledTab && <TabBar activeTab={activeTab} onTabChange={setActiveTab} />}

      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 pt-0.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
                Activity Feed
              </h2>
              <span className="text-[10px] text-text-muted font-mono bg-bg-surface-2 px-2 py-0.5 rounded">
                {filteredSessions.length} Sessions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGlobalShowPublic((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all duration-200 ${
                  globalShowPublic
                    ? 'bg-success/10 border-success/30 text-success'
                    : 'bg-bg-surface-1 border-border/50 text-text-muted hover:text-text-primary hover:border-text-muted/50'
                }`}
                title={globalShowPublic ? 'Showing public titles' : 'Showing private titles'}
                aria-label={globalShowPublic ? 'Switch to private titles' : 'Switch to public titles'}
              >
                {globalShowPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline text-xs font-medium">
                  {globalShowPublic ? 'Public' : 'Private'}
                </span>
              </button>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all duration-200 ${
                  showFilters || hasActiveFilter
                    ? 'bg-accent/10 border-accent/30 text-accent'
                    : 'bg-bg-surface-1 border-border/50 text-text-muted hover:text-text-primary hover:border-text-muted/50'
                }`}
                title={showFilters ? 'Hide filters' : 'Show filters'}
                aria-label={showFilters ? 'Hide filters' : 'Show filters'}
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs font-medium">Filters</span>
              </button>
            </div>
          </div>

          {showFilters && (
            <FilterChips sessions={filteredSessions} filters={filters} onFilterChange={setFilter} />
          )}

          <SessionList
            sessions={filteredSessions}
            milestones={filteredMilestones}
            filters={filters}
            globalShowPublic={globalShowPublic}
            showFullDate={timeScale === '7d' || timeScale === '30d'}
            outsideWindowCounts={outsideWindowCounts}
            onNavigateNewer={handleNavigateNewer}
            onNavigateOlder={handleNavigateOlder}
            onDeleteSession={onDeleteSession}
            onDeleteConversation={onDeleteConversation}
            onDeleteMilestone={onDeleteMilestone}
          />
        </div>
      )}

      {activeTab === 'insights' && (
        <div className="space-y-4 pt-2">
          <DailyRecap
            sessions={filteredSessions}
            milestones={filteredMilestones}
            isLive={isLive}
            windowStart={windowStart}
            windowEnd={windowEnd}
            allSessions={sessions}
            allMilestones={milestones}
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EvaluationSummary sessions={filteredSessions} />
            <SkillRadar
              sessions={filteredSessions}
              milestones={filteredMilestones}
              streak={globalStreak}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ComplexityDistribution data={complexityData} />
            {evalAverages && <ImprovementTips evaluation={evalAverages} />}
          </div>

          <TaskTypeBreakdown byTaskType={stats.byTaskType} />

          <ActivityStrip
            sessions={sessions}
            timeScale={timeScale}
            effectiveTime={effectiveTime}
            isLive={isLive}
            onDayClick={handleDayClick}
            highlightDate={highlightDate}
          />

          <RecentMilestones milestones={filteredMilestones} showPublic={globalShowPublic} />

          <SummaryChips stats={stats} />
        </div>
      )}
    </div>
  );
}
