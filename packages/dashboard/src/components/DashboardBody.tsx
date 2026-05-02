import { useState } from "react";
import { Filter, Eye, EyeOff, Info } from "lucide-react";
import type { ActiveTab } from "../lib/types";
import { useDashboardData } from "../hooks/useDashboardData";
import type {
  AggregationsFetcher,
  PromptsFetcher,
  UseStore,
} from "../hooks/useDashboardData";
import { StatsBar } from "./stats/StatsBar";
import { StatDetailPanel } from "./stats/StatDetailPanel";
import type { StatCardType } from "./stats/StatDetailPanel";
import { TimeDetailPanel } from "./stats/TimeDetailPanel";
import { FilterChips } from "./sessions/FilterChips";
import { SessionList } from "./sessions/SessionList";
import { TimeTravelPanel } from "./time-travel/TimeTravelPanel";
import { ComplexityDistribution } from "./insights/ComplexityDistribution";
import { TaskTypeBreakdown } from "./insights/TaskTypeBreakdown";
import { ProjectAllocation } from "./insights/ProjectAllocation";
import { ActivityStrip } from "./insights/ActivityStrip";
import { RecentMilestones } from "./insights/RecentMilestones";
import { SummaryChips } from "./insights/SummaryChips";

export type { AggregationsFetcher, PromptsFetcher, UseStore };

export interface DashboardBodyProps {
  useStore: UseStore;
  onDeleteSession?: (id: string) => void;
  onDeleteConversation?: (id: string) => void;
  onDeleteMilestone?: (id: string) => void;
  activeTab: ActiveTab;
  onActiveTabChange: (tab: ActiveTab) => void;
  aggregationsFetcher?: AggregationsFetcher | undefined;
  promptsFetcher?: PromptsFetcher | undefined;
}

type ChipColor = "default" | "blue" | "amber" | "purple" | "green";

const CHIP_STYLES: Record<
  ChipColor,
  { chip: string; value: string; dot: string }
> = {
  default: {
    chip: "bg-bg-surface-2 border-border/40",
    value: "text-text-muted",
    dot: "bg-text-muted/40",
  },
  blue: {
    chip: "bg-accent/10 border-accent/30",
    value: "text-accent",
    dot: "bg-accent",
  },
  amber: {
    chip: "bg-amber-500/10 border-amber-500/30",
    value: "text-amber-400",
    dot: "bg-amber-400",
  },
  purple: {
    chip: "bg-violet-500/10 border-violet-500/30",
    value: "text-violet-400",
    dot: "bg-violet-400",
  },
  green: {
    chip: "bg-success/10 border-success/30",
    value: "text-success",
    dot: "bg-success",
  },
};

function MetricChip({
  value,
  label,
  title,
  description,
  color = "default",
}: {
  value: string;
  label: string;
  title: string;
  description: string;
  color?: ChipColor;
}) {
  const s = CHIP_STYLES[color];
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[10px] font-mono border px-2 py-0.5 rounded ${s.chip}`}
    >
      <span className={`w-1 h-1 rounded-full shrink-0 ${s.dot}`} />
      <span className={`font-semibold ${s.value}`}>{value}</span>
      <span className="text-text-muted">{label}</span>
      <span className="relative group flex items-center">
        <Info className="w-2.5 h-2.5 text-text-muted/60 hover:text-text-muted transition-colors cursor-default" />
        <span
          className={`pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg border-2 px-3 py-2.5 font-sans opacity-0 group-hover:opacity-100 transition-opacity duration-0 z-[9999] shadow-2xl space-y-1 ${s.chip}`}
          style={{ backgroundColor: "var(--color-bg-base, #0f0f0f)" }}
        >
          <p className={`text-[11px] font-bold tracking-wide ${s.value}`}>
            {title}
          </p>
          <p className="text-[10px] text-text-secondary leading-relaxed">
            {description}
          </p>
        </span>
      </span>
    </span>
  );
}

export function DashboardBody({
  useStore,
  onDeleteSession,
  onDeleteConversation,
  onDeleteMilestone,
  activeTab,
  onActiveTabChange: _onActiveTabChange,
  aggregationsFetcher,
  promptsFetcher,
}: DashboardBodyProps) {
  const data = useDashboardData({
    useStore,
    aggregationsFetcher,
    promptsFetcher,
    onDeleteSession,
    onDeleteConversation,
    onDeleteMilestone,
  });

  // ── Local UI state ─────────────────────────────────────────────────────
  const [selectedStatCard, setSelectedStatCard] = useState<StatCardType>(null);
  const [globalShowPublic, setGlobalShowPublic] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [timeMode, setTimeMode] = useState<"user" | "ai">("user");

  const hasActiveFilter =
    data.filters.tool !== "all" ||
    data.filters.language !== "all" ||
    data.filters.project !== "all";

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      <TimeTravelPanel
        value={data.timeTravelTime}
        onChange={data.setTimeTravelTime}
        scale={data.timeScale}
        onScaleChange={data.setTimeScale}
        sessions={data.allSessionsForStrip}
        milestones={data.filteredMilestones}
        showPublic={globalShowPublic}
      />

      <StatsBar
        totalHours={data.stats.totalHours}
        totalSessions={data.stats.totalSessions}
        coveredHours={data.stats.coveredHours}
        aiMultiplier={data.stats.aiMultiplier}
        peakConcurrency={data.stats.peakConcurrency}
        currentStreak={data.stats.currentStreak}
        streakDetail={data.streak}
        filesTouched={data.stats.filesTouched}
        featuresShipped={data.stats.featuresShipped}
        bugsFixed={data.stats.bugsFixed}
        complexSolved={data.stats.complexSolved}
        totalMilestones={data.stats.totalMilestones}
        completionRate={data.stats.completionRate}
        activeProjects={data.stats.activeProjects}
        selectedCard={selectedStatCard}
        onCardClick={setSelectedStatCard}
        loading={!data.hasStats}
      />

      <StatDetailPanel
        type={selectedStatCard}
        milestones={data.filteredMilestones}
        showPublic={globalShowPublic}
        onClose={() => setSelectedStatCard(null)}
      />

      <TimeDetailPanel
        type={selectedStatCard}
        sessions={data.filteredSessions}
        allSessions={data.allSessionsForStrip}
        currentStreak={data.stats.currentStreak}
        streakDetail={data.streak}
        stats={{
          totalHours: data.stats.totalHours,
          coveredHours: data.stats.coveredHours,
          aiMultiplier: data.stats.aiMultiplier,
          peakConcurrency: data.stats.peakConcurrency,
        }}
        showPublic={globalShowPublic}
        onClose={() => setSelectedStatCard(null)}
      />

      {activeTab === "prompts" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1 pt-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
                Activity Feed
              </h2>
              <MetricChip
                value={`${data.displaySessionCount}`}
                label="Sessions"
                title="Sessions"
                description="Your direct messages to the AI plus any subagent calls it spawned — each one counts as a session."
              />
              {data.feedMetrics && (
                <>
                  <MetricChip
                    value={data.feedMetrics.promptQuality.toFixed(1)}
                    label="Prompt_Quality"
                    title="Prompt Quality"
                    description="How well-crafted were your prompts?"
                  />
                  <MetricChip
                    value={data.feedMetrics.context.toFixed(1)}
                    label="Context"
                    title="Context"
                    description="Did you give the AI enough detail?"
                  />
                  <MetricChip
                    value={data.feedMetrics.scope.toFixed(1)}
                    label="Scope"
                    title="Scope"
                    description="Did the AI know what to work on?"
                  />
                  <MetricChip
                    value={data.feedMetrics.independence.toFixed(1)}
                    label="Independence"
                    title="Independence"
                    description="How much did the AI handle on its own?"
                  />
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setGlobalShowPublic((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all duration-200 ${
                  globalShowPublic
                    ? "bg-success/10 border-success/30 text-success"
                    : "bg-bg-surface-1 border-border/50 text-text-muted hover:text-text-primary hover:border-text-muted/50"
                }`}
                title={
                  globalShowPublic
                    ? "Showing public titles"
                    : "Showing private titles"
                }
              >
                {globalShowPublic ? (
                  <Eye className="w-3.5 h-3.5" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline text-xs font-medium">
                  {globalShowPublic ? "Public" : "Private"}
                </span>
              </button>
              <button
                onClick={() => setShowFilters((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border transition-all duration-200 ${
                  showFilters || hasActiveFilter
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-bg-surface-1 border-border/50 text-text-muted hover:text-text-primary hover:border-text-muted/50"
                }`}
              >
                <Filter className="w-3.5 h-3.5" />
                <span className="hidden sm:inline text-xs font-medium">
                  Filters
                </span>
              </button>
            </div>
          </div>

          {showFilters && (
            <FilterChips
              sessions={data.filteredSessions}
              filters={data.filters}
              onFilterChange={data.setFilter}
            />
          )}

          <SessionList
            preGrouped={
              data.feedConversations as unknown as import("../lib/stats").ConversationGroup[]
            }
            filters={data.filters}
            globalShowPublic={globalShowPublic}
            showFullDate
            outsideWindowCounts={data.outsideWindowCounts}
            onNavigateNewer={data.handleNavigateNewer}
            onNavigateOlder={data.handleNavigateOlder}
            onDeleteSession={undefined}
            onDeleteConversation={undefined}
            onDeleteMilestone={undefined}
            onLoadMore={data.handleLoadMore}
            hasMore={data.feedHasMore}
            loading={data.feedLoading}
          />
        </div>
      )}

      {activeTab === "insights" && (
        <div className="space-y-4 pt-2">
          <div className="flex justify-end">
            <div className="flex items-center bg-bg-surface-2/50 border border-border/50 rounded-xl p-1">
              <button
                onClick={() => setTimeMode("user")}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  timeMode === "user"
                    ? "bg-text-primary/10 text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary hover:bg-bg-surface-2"
                }`}
              >
                Clock Time
              </button>
              <button
                onClick={() => setTimeMode("ai")}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg transition-all ${
                  timeMode === "ai"
                    ? "bg-text-primary/10 text-text-primary shadow-sm"
                    : "text-text-muted hover:text-text-primary hover:bg-bg-surface-2"
                }`}
              >
                AI Time
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ProjectAllocation
              byProjectClock={data.stats.byProjectClock}
              byProjectAiTime={data.stats.byProjectAiTime}
              byProjectRawClock={(data.stats as any).byProjectRawClock}
              timeMode={timeMode}
            />
            <ComplexityDistribution
              data={data.complexityData}
              milestones={data.filteredMilestones}
              showPublic={globalShowPublic}
            />
            <SummaryChips stats={data.stats} timeMode={timeMode} />
          </div>

          <TaskTypeBreakdown
            byTaskTypeClockTime={data.stats.byTaskTypeClockTime}
            byTaskTypeAiTime={data.stats.byTaskTypeAiTime}
            byTaskTypeRawClock={(data.stats as any).byTaskTypeRawClock}
            sessions={data.filteredSessions}
            milestones={data.filteredMilestones}
            showPublic={globalShowPublic}
            timeMode={timeMode}
          />

          <ActivityStrip
            activity={data.activity}
            timeScale={data.timeScale}
            effectiveTime={data.effectiveTime}
            timeMode={timeMode}
          />

          <RecentMilestones
            milestones={data.filteredMilestones}
            showPublic={globalShowPublic}
          />
        </div>
      )}
    </div>
  );
}
