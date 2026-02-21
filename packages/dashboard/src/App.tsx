import { useEffect, useMemo, useState } from 'react';
import { useDashboardStore, SCALE_MS } from './store';
import { computeStats, calculateStreak, filterSessionsByWindow, filterMilestonesByWindow, getTimeContextLabel } from '@useai/ui/stats';
import { Header } from './components/Header';
import {
  StatsBar,
  StatDetailPanel,
  SummaryChips,
  TaskTypeBreakdown,
  FilterChips,
  SessionList,
  ActivityStrip,
  TimeTravelPanel,
  DailyRecap,
  EvaluationSummary,
  SkillRadar,
  RecentMilestones,
} from '@useai/ui';
import type { StatCardType, Filters } from '@useai/ui';
import { SearchOverlay } from './components/SearchOverlay';
import { SyncFooter } from './components/SyncFooter';
import { Filter, Eye, EyeOff } from 'lucide-react';
import type { SessionSeal, Milestone } from './lib/api';

function SessionsTab({
  filteredSessions,
  filteredMilestones,
  filters,
  onFilterChange,
  onDeleteSession,
  onDeleteConversation,
  onDeleteMilestone,
  globalShowPublic,
  onToggleShowPublic,
}: {
  filteredSessions: SessionSeal[];
  filteredMilestones: Milestone[];
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
  onDeleteSession: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onDeleteMilestone: (id: string) => void;
  globalShowPublic: boolean;
  onToggleShowPublic: () => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const hasActiveFilter = filters.client !== 'all' || filters.language !== 'all' || filters.project !== 'all';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
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
            onClick={onToggleShowPublic}
            className={`p-1.5 rounded-md border transition-all duration-200 ${
              globalShowPublic
                ? 'bg-success/10 border-success/30 text-success'
                : 'bg-bg-surface-1 border-border/50 text-text-muted hover:text-text-primary hover:border-text-muted/50'
            }`}
            title={globalShowPublic ? 'Showing public titles' : 'Showing private titles'}
          >
            {globalShowPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`p-1.5 rounded-md border transition-all duration-200 ${
              showFilters || hasActiveFilter
                ? 'bg-accent/10 border-accent/30 text-accent'
                : 'bg-bg-surface-1 border-border/50 text-text-muted hover:text-text-primary hover:border-text-muted/50'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {showFilters && (
        <FilterChips
          sessions={filteredSessions}
          filters={filters}
          onFilterChange={onFilterChange}
        />
      )}

      <SessionList
        sessions={filteredSessions}
        milestones={filteredMilestones}
        filters={filters}
        globalShowPublic={globalShowPublic}
        onDeleteSession={onDeleteSession}
        onDeleteConversation={onDeleteConversation}
        onDeleteMilestone={onDeleteMilestone}
      />
    </div>
  );
}

export function App() {
  const {
    sessions,
    milestones,
    config,
    health,
    updateInfo,
    loading,
    timeTravelTime,
    timeScale,
    filters,
    activeTab,
    loadAll,
    loadHealth,
    loadUpdateCheck,
    setTimeTravelTime,
    setTimeScale,
    setFilter,
    setActiveTab,
    deleteSession,
    deleteConversation,
    deleteMilestone,
  } = useDashboardStore();

  // Load data on mount
  useEffect(() => {
    loadAll();
    loadHealth();
    loadUpdateCheck();
  }, [loadAll, loadHealth, loadUpdateCheck]);

  // Auto-refresh every 30s when live; health polling every 30s always
  useEffect(() => {
    const healthInterval = setInterval(loadHealth, 30000);
    if (timeTravelTime !== null) return () => clearInterval(healthInterval);
    const dataInterval = setInterval(loadAll, 30000);
    return () => {
      clearInterval(healthInterval);
      clearInterval(dataInterval);
    };
  }, [timeTravelTime, loadAll, loadHealth]);

  const [selectedStatCard, setSelectedStatCard] = useState<StatCardType>(null);
  const [globalShowPublic, setGlobalShowPublic] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Cmd+K / Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const isLive = timeTravelTime === null;

  // Compute visible window — right-edge anchored (effectiveTime = right edge)
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

  // Compute stats from filtered data
  const stats = useMemo(() => computeStats(filteredSessions, filteredMilestones), [filteredSessions, filteredMilestones]);

  // Streak is always computed from ALL sessions, not the time window
  const globalStreak = useMemo(() => calculateStreak(sessions), [sessions]);

  // Time context label for header
  const timeContextLabel = useMemo(
    () => getTimeContextLabel(windowStart, windowEnd, isLive),
    [windowStart, windowEnd, isLive],
  );

  // Highlight date for activity strip
  const highlightDate = useMemo(() => {
    if (isLive) return undefined;
    return new Date(effectiveTime).toISOString().slice(0, 10);
  }, [isLive, effectiveTime]);

  const handleDayClick = (date: string) => {
    // Right-edge anchored: set to end of day so the full day is visible
    const endOfDay = new Date(`${date}T23:59:59`).getTime();
    setTimeTravelTime(endOfDay);
    setTimeScale('24h');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base selection:bg-accent/30 selection:text-text-primary">
      <Header health={health} updateInfo={updateInfo} timeContextLabel={timeContextLabel} activeTab={activeTab} onTabChange={setActiveTab} onSearchOpen={() => setSearchOpen(true)} />
      <div className="max-w-[1000px] mx-auto px-6 pb-6">
        <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} sessions={sessions} milestones={milestones} deleteSession={deleteSession} deleteConversation={deleteConversation} deleteMilestone={deleteMilestone} />

        <div className="space-y-1">
          {/* Persistent top section */}
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

          {/* Tab content */}
          {activeTab === 'sessions' && (
            <SessionsTab
              filteredSessions={filteredSessions}
              filteredMilestones={filteredMilestones}
              filters={filters}
              onFilterChange={setFilter}
              onDeleteSession={deleteSession}
              onDeleteConversation={deleteConversation}
              onDeleteMilestone={deleteMilestone}
              globalShowPublic={globalShowPublic}
              onToggleShowPublic={() => setGlobalShowPublic((v) => !v)}
            />
          )}

          {activeTab === 'insights' && (
            <div className="space-y-4 pt-2">
              <DailyRecap
                sessions={filteredSessions}
                milestones={filteredMilestones}
                isLive={isLive}
                windowStart={windowStart}
                windowEnd={windowEnd}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <EvaluationSummary sessions={filteredSessions} />
                <SkillRadar
                  sessions={filteredSessions}
                  milestones={filteredMilestones}
                  streak={globalStreak}
                />
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

          <SyncFooter config={config} onRefresh={loadAll} />
        </div>
      </div>
    </div>
  );
}
