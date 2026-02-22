import { memo, useState } from 'react';
import { ChevronDown, Clock, Lock, Zap, Shield, Eye, EyeOff, Flag, MessageSquare, FileText, Target, Compass, RefreshCw, Wrench, FolderKanban, Cpu, Activity } from 'lucide-react';
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

function ScoreBar({ score }: { score: number }) {
  const pct = (score / 5) * 100;
  const colorClass = score >= 4 ? 'bg-success' : score >= 3 ? 'bg-accent' : 'bg-error';
  const trackClass = score >= 4 ? 'bg-success/15' : score >= 3 ? 'bg-accent/15' : 'bg-error/15';

  return (
    <span className={`w-7 h-[4px] rounded-full ${trackClass} flex-shrink-0 overflow-hidden`} title={`Quality: ${score.toFixed(1)}/5`}>
      <span className={`block h-full rounded-full ${colorClass}`} style={{ width: `${pct}%` }} />
    </span>
  );
}

function EvaluationDetail({ evaluation, showPublic = false }: { evaluation: SessionEvaluation; showPublic?: boolean }) {
  const metrics = [
    { label: 'Prompt', value: evaluation.prompt_quality, reason: evaluation.prompt_quality_reason, Icon: MessageSquare },
    { label: 'Context', value: evaluation.context_provided, reason: evaluation.context_provided_reason, Icon: FileText },
    { label: 'Scope', value: evaluation.scope_quality, reason: evaluation.scope_quality_reason, Icon: Target },
    { label: 'Independence', value: evaluation.independence_level, reason: evaluation.independence_level_reason, Icon: Compass },
  ];

  const hasReasons = metrics.some(m => m.reason) || evaluation.task_outcome_reason;

  return (
    <div className="px-2 py-1.5 bg-bg-surface-2/30 rounded-md mb-2">
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {metrics.map(({ label, value, Icon }) => (
          <div key={label} className="flex items-center gap-1.5 text-[10px]">
            <Icon className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
            <span className="text-text-muted min-w-[58px]">{label}</span>
            <ScoreBar score={value} />
          </div>
        ))}
      </div>

      {!showPublic && hasReasons && (
        <div className="mt-1.5 pt-1.5 border-t border-border/15 space-y-1">
          {evaluation.task_outcome_reason && (
            <div className="flex items-start gap-1.5 text-[10px]">
              <span className="text-error font-bold flex-shrink-0">Outcome:</span>
              <span className="text-text-muted leading-tight">{evaluation.task_outcome_reason}</span>
            </div>
          )}
          {metrics.filter(m => m.reason).map(({ label, reason }) => (
            <div key={label} className="flex items-start gap-1.5 text-[10px]">
              <span className="text-accent font-bold flex-shrink-0">{label}:</span>
              <span className="text-text-muted leading-tight">{reason}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 mt-1.5 pt-1.5 border-t border-border/15">
        <div className="flex items-center gap-1.5 text-[10px]">
          <RefreshCw className="w-3 h-3 text-text-muted/50" />
          <span className="text-text-muted">Iterations</span>
          <span className="text-text-secondary font-mono font-bold ml-0.5">{evaluation.iteration_count}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          <Wrench className="w-3 h-3 text-text-muted/50" />
          <span className="text-text-muted">Tools</span>
          <span className="text-text-secondary font-mono font-bold ml-0.5">{evaluation.tools_leveraged}</span>
        </div>
      </div>
    </div>
  );
}

interface SessionCardProps {
  session: SessionSeal;
  milestones: Milestone[];
  defaultExpanded?: boolean;
  externalShowPublic?: boolean;
  hideClientAvatar?: boolean;
  hideProject?: boolean;
  showFullDate?: boolean;
  highlightWords?: string[];
  onDeleteSession?: (sessionId: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
}

export const SessionCard = memo(function SessionCard({ session, milestones, defaultExpanded = false, externalShowPublic, hideClientAvatar = false, hideProject = false, showFullDate = false, highlightWords, onDeleteSession, onDeleteMilestone }: SessionCardProps) {
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

  return (
    <div className={`group/card mb-1 rounded-lg border transition-all duration-200 ${
      expanded ? 'bg-bg-surface-1 border-accent/30 shadow-md' : 'bg-bg-surface-1/30 border-border/50 hover:border-accent/30'
    }`}>
      <div className="flex items-center">
        <button
          className="flex-1 flex items-center gap-3 px-3 py-2 text-left min-w-0"
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

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
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
                      <Shield className="w-3 h-3 text-success/60 flex-shrink-0" />
                    ) : (
                      <Lock className="w-3 h-3 text-accent/60 flex-shrink-0" />
                    )}
                    <span className="text-sm font-bold truncate text-text-primary tracking-tight">
                      <HighlightText text={showPublic ? publicTitle : privateTitle} words={highlightWords} />
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>

            </div>

            <div className="flex items-center gap-3 text-[11px] text-text-muted font-semibold">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 opacity-60" />
                {formatDuration(session.duration_seconds)}
              </span>

              {session.duration_seconds >= 900 && (() => {
                const expected = Math.floor(session.duration_seconds / 900);
                const focus = expected > 0 ? Math.min(session.heartbeat_count / expected, 1) : 0;
                const focusColor = focus >= 0.8 ? 'text-success' : focus >= 0.5 ? 'text-accent' : 'text-text-muted';
                return (
                  <span className={`flex items-center gap-0.5 font-mono ${focusColor}`} title={`Focus: ${Math.round(focus * 100)}%`}>
                    <Zap className="w-2.5 h-2.5 fill-current opacity-70" />
                    {Math.round(focus * 100)}%
                  </span>
                );
              })()}

              <span className="opacity-50 font-mono tracking-tight">
                {showFullDate && `${new Date(session.started_at).toLocaleDateString([], { month: 'short', day: 'numeric' })} · `}
                {formatTimeRange(session.started_at, session.ended_at).split(' — ')[0]}
              </span>

              {!showPublic && !isUntitled && !hideProject && (
                <span className="flex items-center gap-0.5 text-text-muted/70" title={`Project: ${rawProject}`}>
                  <FolderKanban className="w-2.5 h-2.5 opacity-60" />
                  <span className="max-w-[100px] truncate">{rawProject}</span>
                </span>
              )}

              {milestones.length > 0 && (
                <span className="flex items-center gap-0.5" title={`${milestones.length} milestone${milestones.length !== 1 ? 's' : ''}`}>
                  <Flag className="w-2.5 h-2.5 opacity-60" />
                  {milestones.length}
                </span>
              )}

              {session.evaluation && (
                <ScoreBar score={computeAvgScore(session.evaluation)} />
              )}
            </div>
          </div>
        </button>

        {/* Action strip */}
        <div className="flex items-center px-2 gap-1.5 border-l border-border/30 h-8 self-center">
          {onDeleteSession && (
            <DeleteButton onDelete={() => onDeleteSession(session.session_id)} className="opacity-0 group-hover/card:opacity-100" />
          )}
          {hasPrivacyDifference && externalShowPublic === undefined && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowPublic(!showPublic);
              }}
              className={`p-1.5 rounded-lg transition-all ${
                showPublic ? 'bg-success/10 text-success' : 'text-text-muted hover:bg-bg-surface-2'
              }`}
              title={showPublic ? "Public Mode" : "Private Mode"}
            >
              {showPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}

          {hasDetails && (
            <button
              onClick={() => setExpanded(!expanded)}
              className={`p-1.5 rounded-lg transition-all ${
                expanded ? 'text-accent bg-accent/5' : 'text-text-muted hover:bg-bg-surface-2'
              }`}
            >
              <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </div>
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
            <div className="px-3 pb-3 pt-1 space-y-1">
              <div className="h-px bg-border/20 mb-2 mx-1" />

              {/* Model & tool overhead metadata */}
              {(session.model || session.tool_overhead) && (
                <div className="flex items-center gap-4 px-2 py-1.5 bg-bg-surface-2/30 rounded-md mb-2">
                  {session.model && (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <Cpu className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
                      <span className="text-text-muted">Model</span>
                      <span className="text-text-secondary font-mono font-bold ml-0.5">{session.model}</span>
                    </div>
                  )}
                  {session.tool_overhead && (
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <Activity className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
                      <span className="text-text-muted">Tracking overhead</span>
                      <span className="text-text-secondary font-mono font-bold ml-0.5">~{session.tool_overhead.total_tokens_est} tokens</span>
                    </div>
                  )}
                </div>
              )}

              {session.evaluation && (
                <EvaluationDetail evaluation={session.evaluation} showPublic={showPublic} />
              )}

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
