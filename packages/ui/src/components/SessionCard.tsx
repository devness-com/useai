import { memo, useState } from 'react';
import { ChevronDown, Clock, Lock, Shield, Eye, EyeOff, Flag, MessageSquare, FileText, Target, Compass, RefreshCw, Wrench, FolderKanban, Cpu, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { SessionSeal, Milestone, SessionEvaluation } from '@useai/shared/types';
import { TOOL_COLORS, TOOL_INITIALS, TOOL_ICONS, CATEGORY_COLORS, TOOL_DISPLAY_NAMES, resolveClient } from '../constants';
import { DeleteButton } from './DeleteButton';
import { HighlightText } from './HighlightText';

function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
  };
  return `${fmt(startIso)} — ${fmt(endIso)}`;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function fmtMinutes(mins: number): string {
  if (!mins || mins <= 0) return '';
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const BADGE_CLASSES: Record<string, string> = {
  feature: 'bg-success/15 text-success border-success/30',
  bugfix: 'bg-error/15 text-error border-error/30',
  refactor: 'bg-purple/15 text-purple border-purple/30',
  test: 'bg-blue/15 text-blue border-blue/30',
  docs: 'bg-accent/15 text-accent border-accent/30',
  setup: 'bg-text-muted/15 text-text-muted border-text-muted/20',
  deployment: 'bg-emerald/15 text-emerald border-emerald/30',
};

function CategoryBadge({ category }: { category: string }) {
  const cls = BADGE_CLASSES[category] ?? 'bg-bg-surface-2 text-text-secondary border-border';
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${cls}`}>
      {category}
    </span>
  );
}

function computeAvgScore(ev: SessionEvaluation): number {
  return (ev.prompt_quality + ev.context_provided + ev.scope_quality + ev.independence_level) / 4;
}

function ScoreNum({ score, decimal }: { score: number; decimal?: boolean }) {
  const isPerfect = score >= 5;
  const colorClass = isPerfect ? 'text-text-secondary' : score >= 4 ? 'text-amber-500' : score >= 3 ? 'text-orange-500' : 'text-error';
  const raw = decimal ? score.toFixed(1) : String(Math.round(score));
  const display = raw.endsWith('.0') ? raw.slice(0, -2) : raw;
  return (
    <span className={`text-[10px] font-mono ${isPerfect ? '' : 'font-bold'}`} title={`${score.toFixed(1)}/5`}>
      <span className={colorClass}>{display}</span>
      <span className="text-text-muted/50">/5</span>
    </span>
  );
}

function SessionMetaRow({ model, toolOverhead }: { model?: string; toolOverhead?: SessionSeal['tool_overhead'] }) {
  if (!model && !toolOverhead) return null;
  return (
    <div className="flex flex-wrap items-center gap-4">
      {model && (
        <div className="flex items-center gap-1.5 text-[10px] whitespace-nowrap">
          <Cpu className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
          <span className="text-text-secondary">Model</span>
          <span className="text-text-secondary font-mono font-bold ml-0.5">{model}</span>
        </div>
      )}
      {toolOverhead && (
        <div className="flex items-center gap-1.5 text-[10px] whitespace-nowrap">
          <Activity className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
          <span className="text-text-secondary">Tracking overhead</span>
          <span className="text-text-secondary font-mono font-bold ml-0.5">~{toolOverhead.total_tokens_est} tokens</span>
        </div>
      )}
    </div>
  );
}

function EvaluationDetail({
  evaluation,
  showPublic = false,
  model,
  toolOverhead,
}: {
  evaluation: SessionEvaluation;
  showPublic?: boolean;
  model?: string;
  toolOverhead?: SessionSeal['tool_overhead'];
}) {
  const hasMeta = !!model || !!toolOverhead;
  const metrics = [
    { label: 'Prompt', value: evaluation.prompt_quality, reason: evaluation.prompt_quality_reason, Icon: MessageSquare },
    { label: 'Context', value: evaluation.context_provided, reason: evaluation.context_provided_reason, Icon: FileText },
    { label: 'Scope', value: evaluation.scope_quality, reason: evaluation.scope_quality_reason, Icon: Target },
    { label: 'Independence', value: evaluation.independence_level, reason: evaluation.independence_level_reason, Icon: Compass },
  ];

  const hasReasons = metrics.some(m => m.reason) || evaluation.task_outcome_reason;

  return (
    <div className="px-2.5 py-2 bg-bg-surface-2/30 rounded-md mb-2">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {metrics.map(({ label, value, Icon }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px] whitespace-nowrap">
            <Icon className="w-3 h-3 text-text-muted/60 flex-shrink-0" />
            <span className="text-text-secondary whitespace-nowrap">{label}</span>
            <ScoreNum score={value} />
          </div>
        ))}
        {hasMeta && (
          <>
            <div className="hidden md:block h-3.5 w-px bg-border/30" />
            <SessionMetaRow model={model} toolOverhead={toolOverhead} />
          </>
        )}
        <div className="hidden md:block h-3.5 w-px bg-border/30" />
        <div className="flex items-center gap-1.5 text-[10px] whitespace-nowrap">
          <RefreshCw className="w-3 h-3 text-text-muted/50" />
          <span className="text-text-muted">Iterations</span>
          <span className="text-text-secondary font-mono font-bold ml-0.5">{evaluation.iteration_count}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] whitespace-nowrap">
          <Wrench className="w-3 h-3 text-text-muted/50" />
          <span className="text-text-muted">Tools</span>
          <span className="text-text-secondary font-mono font-bold ml-0.5">{evaluation.tools_leveraged}</span>
        </div>
      </div>

      {!showPublic && hasReasons && (
        <div className="mt-2 pt-2 border-t border-border/15">
          <div className="grid grid-cols-[86px_minmax(0,1fr)] gap-x-2 gap-y-1 text-[10px]">
            {evaluation.task_outcome_reason && (
              <>
                <span className="text-error font-bold text-right">Outcome:</span>
                <span className="text-text-secondary leading-relaxed">{evaluation.task_outcome_reason}</span>
              </>
            )}
            {metrics.filter(m => m.reason).map(({ label, reason }) => (
              <div key={label} className="contents">
                <span className="text-accent font-bold text-right">{label}:</span>
                <span className="text-text-secondary leading-relaxed">{reason}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface SessionCardProps {
  session: SessionSeal;
  milestones: Milestone[];
  defaultExpanded?: boolean;
  externalShowPublic?: boolean;
  contextLabel?: string;
  hideClientAvatar?: boolean;
  hideProject?: boolean;
  showFullDate?: boolean;
  highlightWords?: string[];
  onDeleteSession?: (sessionId: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
}

export const SessionCard = memo(function SessionCard({ session, milestones, defaultExpanded = false, externalShowPublic, contextLabel, hideClientAvatar = false, hideProject = false, showFullDate = false, highlightWords, onDeleteSession, onDeleteMilestone }: SessionCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [internalShowPublic, setInternalShowPublic] = useState(false);
  const showPublic = externalShowPublic ?? internalShowPublic;
  const setShowPublic = setInternalShowPublic;
  const client = resolveClient(session.client);
  const color = TOOL_COLORS[client] ?? '#91919a';
  const isCursor = client === 'cursor';
  const iconColor = isCursor ? 'var(--text-primary)' : color;
  const avatarStyle = isCursor
    ? { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
    : { backgroundColor: `${color}15`, color, border: `1px solid ${color}30` };
  const initials = TOOL_INITIALS[client] ?? client.slice(0, 2).toUpperCase();
  const iconPath = TOOL_ICONS[client];
  const hasMilestones = milestones.length > 0;
  const hasDetails = hasMilestones || !!session.evaluation || !!session.model || !!session.tool_overhead;

  // Determine titles
  const UNTITLED_PROJECTS = ['untitled', 'mcp', 'unknown', 'default', 'none', 'null', 'undefined'];
  const rawProject = session.project?.trim() || '';
  const isUntitled = !rawProject || UNTITLED_PROJECTS.includes(rawProject.toLowerCase());

  const firstMilestone = milestones[0];

  const milestoneFallback = isUntitled && firstMilestone ? firstMilestone.title : rawProject;
  const privateMilestoneFallback = isUntitled && firstMilestone
    ? (firstMilestone.private_title || firstMilestone.title)
    : rawProject;

  let privateTitle = session.private_title || session.title || privateMilestoneFallback || 'Untitled Session';
  let publicTitle = session.title || milestoneFallback || 'Untitled Session';

  const hasPrivacyDifference = privateTitle !== publicTitle;
  const canTogglePrivacy = hasPrivacyDifference && externalShowPublic === undefined;
  const showActionStrip = !!onDeleteSession || hasDetails || canTogglePrivacy;
  const contextLabelCompact = contextLabel?.replace(/^\s*prompt\s*/i, '').trim();

  return (
    <div className={`group/card mb-2 rounded-xl border transition-all duration-200 ${
      expanded ? 'bg-bg-surface-1 border-accent/35 shadow-md' : 'bg-bg-surface-1/35 border-border/50 hover:border-accent/30'
    }`}>
      <div className="flex items-center">
        <button
          className="flex-1 flex items-center gap-3 px-3.5 py-2.5 text-left min-w-0"
          onClick={() => hasDetails && setExpanded(!expanded)}
          style={{ cursor: hasDetails ? 'pointer' : 'default' }}
        >
          {/* Client avatar — hidden when nested inside a conversation group */}
          {!hideClientAvatar && (
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-black font-mono flex-shrink-0 shadow-sm"
              style={avatarStyle}
              title={TOOL_DISPLAY_NAMES[client] ?? client}
            >
              {iconPath ? (
                <div
                  className="w-4 h-4"
                  style={{
                    backgroundColor: iconColor,
                    maskImage: `url(${iconPath})`,
                    maskSize: 'contain',
                    maskRepeat: 'no-repeat',
                    maskPosition: 'center',
                    WebkitMaskImage: `url(${iconPath})`,
                    WebkitMaskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                  }}
                />
              ) : (
                initials
              )}
            </div>
          )}

          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2">
              {contextLabel && (
                <span className="inline-flex items-center rounded-md border border-accent/20 bg-accent/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-accent/90">
                  {contextLabelCompact || contextLabel}
                </span>
              )}
              <div className="flex items-center gap-1.5 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={showPublic ? 'public' : 'private'}
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 5 }}
                    transition={{ duration: 0.1 }}
                    className="flex items-center gap-1.5 min-w-0"
                  >
                    {showPublic ? (
                      <Shield className="w-3 h-3 text-success/70 flex-shrink-0" />
                    ) : (
                      <Lock className="w-3 h-3 text-accent/70 flex-shrink-0" />
                    )}
                    <span className="text-[15px] font-semibold truncate text-text-primary tracking-tight leading-tight">
                      <HighlightText text={showPublic ? publicTitle : privateTitle} words={highlightWords} />
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>

            <div className="flex items-center gap-3.5 text-[11px] text-text-secondary font-medium">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3 h-3 opacity-75" />
                {formatDuration(session.duration_seconds)}
              </span>


              <span className="text-text-secondary/80 font-mono tracking-tight">
                {showFullDate && `${new Date(session.started_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · `}
                {formatTimeRange(session.started_at, session.ended_at).split(' — ')[0]}
              </span>

              {!showPublic && !isUntitled && !hideProject && (
                <span className="flex items-center gap-1 text-text-secondary/85" title={`Project: ${rawProject}`}>
                  <FolderKanban className="w-2.5 h-2.5 opacity-70" />
                  <span className="max-w-[130px] truncate">{rawProject}</span>
                </span>
              )}

              {milestones.length > 0 && (
                <span className="flex items-center gap-1 text-text-secondary/85" title={`${milestones.length} milestone${milestones.length !== 1 ? 's' : ''}`}>
                  <Flag className="w-2.5 h-2.5 opacity-70" />
                  {milestones.length}
                </span>
              )}

              {session.evaluation && (
                <ScoreNum score={computeAvgScore(session.evaluation)} decimal />
              )}
            </div>
          </div>
        </button>

        {showActionStrip && (
          <div className="flex items-center px-2.5 gap-1.5 border-l border-border/30 h-9 self-center">
            {onDeleteSession && (
              <DeleteButton
                onDelete={() => onDeleteSession(session.session_id)}
                className="opacity-0 group-hover/card:opacity-100 focus-within:opacity-100"
              />
            )}
            {canTogglePrivacy && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPublic(!showPublic);
                }}
                className={`p-1.5 rounded-lg transition-all ${
                  showPublic ? 'bg-success/10 text-success' : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-2'
                }`}
                title={showPublic ? 'Public title shown' : 'Private title shown'}
                aria-label={showPublic ? 'Show private title' : 'Show public title'}
              >
                {showPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            )}

            {hasDetails && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`p-1.5 rounded-lg transition-all ${
                  expanded ? 'text-accent bg-accent/8' : 'text-text-secondary hover:text-text-primary hover:bg-bg-surface-2'
                }`}
                title={expanded ? 'Collapse details' : 'Expand details'}
                aria-label={expanded ? 'Collapse details' : 'Expand details'}
              >
                <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && hasDetails && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5 pt-1.5 space-y-2">
              <div className="h-px bg-border/20 mb-2 mx-1" />

              {session.evaluation && (
                <EvaluationDetail
                  evaluation={session.evaluation}
                  showPublic={showPublic}
                  model={session.model}
                  toolOverhead={session.tool_overhead}
                />
              )}
              {!session.evaluation && <SessionMetaRow model={session.model} toolOverhead={session.tool_overhead} />}

              {milestones.length > 0 && <div className="space-y-0.5">
                {milestones.map((m) => {
                  const displayTitle = (showPublic ? m.title : (m.private_title || m.title));
                  const dur = fmtMinutes(m.duration_minutes);

                  return (
                    <div
                      key={m.id}
                      className="group flex items-center gap-2 p-1.5 rounded-md hover:bg-bg-surface-2/40 transition-colors"
                    >
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: CATEGORY_COLORS[m.category] ?? '#9c9588' }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-text-secondary group-hover:text-text-primary truncate">
                            <HighlightText text={displayTitle} words={highlightWords} />
                          </span>
                          <CategoryBadge category={m.category} />
                        </div>
                      </div>
                      {dur && (
                        <span className="text-[10px] text-text-muted font-mono">{dur}</span>
                      )}
                      {onDeleteMilestone && (
                        <DeleteButton
                          onDelete={() => onDeleteMilestone(m.id)}
                          size="sm"
                          className="opacity-0 group-hover:opacity-100"
                        />
                      )}
                    </div>
                  );
                })}
              </div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
