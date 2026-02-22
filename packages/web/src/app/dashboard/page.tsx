'use client';

import { useEffect, useMemo, useState } from 'react';
import { useDashboardStore } from '@/store/dashboard-store';
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
  TabBar,
  SCALE_MS,
} from '@useai/ui';
import type { StatCardType, Filters } from '@useai/ui';
import { computeStats, calculateStreak, filterSessionsByWindow, filterMilestonesByWindow } from '@useai/ui/stats';
import { Filter, Eye, EyeOff } from 'lucide-react';

export default function DashboardPage() {
  const {
    sessions, milestones, loading,
    timeTravelTime, timeScale, filters, activeTab,
    loadAll, setTimeTravelTime, setTimeScale, setFilter, setActiveTab,
  } = useDashboardStore();

  useEffect(() => { loadAll(); }, [loadAll]);

  const [selectedStatCard, setSelectedStatCard] = useState<StatCardType>(null);
  const [globalShowPublic, setGlobalShowPublic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

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
  const stats = useMemo(() => computeStats(filteredSessions, filteredMilestones), [filteredSessions, filteredMilestones]);
  const globalStreak = useMemo(() => calculateStreak(sessions), [sessions]);

  const highlightDate = useMemo(() => {
    if (isLive) return undefined;
    return new Date(effectiveTime).toISOString().slice(0, 10);
  }, [isLive, effectiveTime]);

  const handleDayClick = (date: string) => {
    const endOfDay = new Date(`${date}T23:59:59`).getTime();
    setTimeTravelTime(endOfDay);
    setTimeScale('24h');
  };

  const hasActiveFilter = filters.client !== 'all' || filters.language !== 'all' || filters.project !== 'all';

  if (loading) {
    return <div className="flex items-center justify-center py-20 text-text-muted text-sm">Loading sessions...</div>;
  }

  return (
    <div className="space-y-1">
      <TimeTravelPanel
        value={timeTravelTime}
        onChange={setTimeTravelTime}
        scale={timeScale}
        onScaleChange={setTimeScale}
        sessions={sessions}
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

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {activeTab === 'sessions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">Activity Feed</h2>
              <span className="text-[10px] text-text-muted font-mono bg-bg-surface-2 px-2 py-0.5 rounded">
                {filteredSessions.length} Sessions
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGlobalShowPublic((v) => !v)}
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
            <FilterChips sessions={filteredSessions} filters={filters} onFilterChange={setFilter} />
          )}

          <SessionList
            sessions={filteredSessions}
            milestones={filteredMilestones}
            filters={filters}
            globalShowPublic={globalShowPublic}
            showFullDate={timeScale === '7d' || timeScale === '30d'}
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
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EvaluationSummary sessions={filteredSessions} />
            <SkillRadar sessions={filteredSessions} milestones={filteredMilestones} streak={globalStreak} />
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
