import { useMemo, useState } from 'react';
import { ChevronDown, Clock, Lock, Shield, Eye, EyeOff, Flag, FolderKanban } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { SessionSeal, Milestone } from '@useai/shared/types';
import type { Filters } from '../types';
import { groupSessionsWithMilestones, groupIntoConversations } from '../stats';
import type { ConversationGroup } from '../stats';
import { SessionCard } from './SessionCard';
import { DeleteButton } from './DeleteButton';
import { TOOL_COLORS, TOOL_INITIALS, TOOL_ICONS, TOOL_DISPLAY_NAMES, resolveClient } from '../constants';
import { HighlightText } from './HighlightText';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true });
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

function ConversationCard({ group, defaultExpanded, globalShowPublic, showFullDate, highlightWords, onDeleteSession, onDeleteMilestone, onDeleteConversation }: { group: ConversationGroup; defaultExpanded: boolean; globalShowPublic?: boolean; showFullDate?: boolean; highlightWords?: string[]; onDeleteSession?: (id: string) => void; onDeleteMilestone?: (id: string) => void; onDeleteConversation?: (id: string) => void }) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [localShowPublic, setLocalShowPublic] = useState(false);
  const showPublic = globalShowPublic || localShowPublic;
  const isSingle = group.sessions.length === 1;

  // For single-session conversations, just render the session card directly
  if (isSingle) {
    const sg = group.sessions[0]!;
    return (
      <SessionCard
        session={sg.session}
        milestones={sg.milestones}
        defaultExpanded={defaultExpanded && sg.milestones.length > 0}
        externalShowPublic={globalShowPublic || undefined}
        showFullDate={showFullDate}
        highlightWords={highlightWords}
        onDeleteSession={onDeleteSession}
        onDeleteMilestone={onDeleteMilestone}
      />
    );
  }

  // Multi-session conversation — show a wrapper
  const client = resolveClient(group.sessions[0]!.session.client);
  const color = TOOL_COLORS[client] ?? '#91919a';
  const isCursor = client === 'cursor';
  const iconColor = isCursor ? 'var(--text-primary)' : color;
  const avatarStyle = isCursor
    ? { backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)' }
    : { backgroundColor: `${color}15`, color, border: `1px solid ${color}30` };
  const initials = TOOL_INITIALS[client] ?? client.slice(0, 2).toUpperCase();
  const iconPath = TOOL_ICONS[client];
  const agg = group.aggregateEval;
  const avgScore = agg ? (agg.prompt_quality + agg.context_provided + agg.scope_quality + agg.independence_level) / 4 : 0;

  // Determine conversation titles from first session
  const firstSession = group.sessions[0]!.session;
  const privateConvTitle = firstSession.private_title || firstSession.title || firstSession.project || 'Conversation';
  const publicConvTitle = firstSession.title || firstSession.project || 'Conversation';
  const hasPrivacyDifference = privateConvTitle !== publicConvTitle;

  // Derive project from conversation sessions
  const UNTITLED_PROJECTS = ['untitled', 'mcp', 'unknown', 'default', 'none', 'null', 'undefined'];
  const convProject = firstSession.project?.trim() || '';
  const hasProject = !!convProject && !UNTITLED_PROJECTS.includes(convProject.toLowerCase());

  return (
    <div className={`group/conv mb-1 rounded-lg border transition-all duration-200 ${
      expanded ? 'bg-bg-surface-1 border-accent/30 shadow-md' : 'bg-bg-surface-1/30 border-border/50 hover:border-accent/30'
    }`}>
      {/* Conversation header */}
      <div className="flex items-center">
        <button
          className="flex-1 flex items-center gap-3 px-3 py-2 text-left min-w-0"
          onClick={() => setExpanded(!expanded)}
        >
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
                      <HighlightText text={showPublic ? publicConvTitle : privateConvTitle} words={highlightWords} />
                    </span>
                  </motion.div>
                </AnimatePresence>
              </div>

              <span className="text-[10px] font-bold text-accent/80 bg-accent/5 px-1.5 py-0.5 rounded border border-accent/10 flex-shrink-0">
                {group.sessions.length} prompts
              </span>

            </div>

            <div className="flex items-center gap-3 text-[11px] text-text-muted font-semibold">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 opacity-60" />
                {formatDuration(group.totalDuration)}
              </span>

              <span className="opacity-50 font-mono tracking-tight">
                {showFullDate && `${new Date(group.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })} · `}
                {formatTime(group.startedAt)}
              </span>

              {!showPublic && hasProject && (
                <span className="flex items-center gap-0.5 text-text-muted/70" title={`Project: ${convProject}`}>
                  <FolderKanban className="w-2.5 h-2.5 opacity-60" />
                  <span className="max-w-[100px] truncate">{convProject}</span>
                </span>
              )}

              {group.totalMilestones > 0 && (
                <span className="flex items-center gap-0.5" title={`${group.totalMilestones} milestone${group.totalMilestones !== 1 ? 's' : ''}`}>
                  <Flag className="w-2.5 h-2.5 opacity-60" />
                  {group.totalMilestones}
                </span>
              )}

              {agg && <ScoreBar score={avgScore} />}
            </div>
          </div>
        </button>

        {/* Action strip */}
        <div className="flex items-center px-2 gap-1.5 border-l border-border/30 h-8 self-center">
          {onDeleteConversation && group.conversationId && (
            <DeleteButton onDelete={() => onDeleteConversation(group.conversationId!)} className="opacity-0 group-hover/conv:opacity-100" />
          )}
          {hasPrivacyDifference && !globalShowPublic && (
            <button
              onClick={() => setLocalShowPublic(!localShowPublic)}
              className={`p-1.5 rounded-lg transition-all ${
                showPublic ? 'bg-success/10 text-success' : 'text-text-muted hover:bg-bg-surface-2'
              }`}
              title={showPublic ? "Public Mode" : "Private Mode"}
            >
              {showPublic ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className={`p-1.5 rounded-lg transition-all ${
              expanded ? 'text-accent bg-accent/5' : 'text-text-muted hover:bg-bg-surface-2'
            }`}
          >
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Expanded: show individual sessions with a thread line */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 relative">
              {/* Thread connector line */}
              <div
                className="absolute left-[1.75rem] top-0 bottom-2 w-px"
                style={{ backgroundColor: `${color}25` }}
              />
              <div className="space-y-1 pl-10">
                {group.sessions.map((sg) => (
                  <div key={sg.session.session_id} className="relative">
                    {/* Dot on thread line */}
                    <div
                      className="absolute -left-7 top-5 w-2 h-2 rounded-full border-2"
                      style={{ backgroundColor: color, borderColor: `${color}40` }}
                    />
                    <SessionCard
                      session={sg.session}
                      milestones={sg.milestones}
                      defaultExpanded={false}
                      externalShowPublic={showPublic || undefined}
                      hideClientAvatar
                      hideProject
                      showFullDate={showFullDate}
                      highlightWords={highlightWords}
                      onDeleteSession={onDeleteSession}
                      onDeleteMilestone={onDeleteMilestone}
                    />
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface SessionListProps {
  sessions: SessionSeal[];
  milestones: Milestone[];
  filters: Filters;
  globalShowPublic?: boolean;
  showFullDate?: boolean;
  highlightWords?: string[];
  onDeleteSession?: (sessionId: string) => void;
  onDeleteConversation?: (conversationId: string) => void;
  onDeleteMilestone?: (milestoneId: string) => void;
}

export function SessionList({ sessions, milestones, filters, globalShowPublic, showFullDate, highlightWords, onDeleteSession, onDeleteConversation, onDeleteMilestone }: SessionListProps) {
  // Filter sessions by client, language, project
  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filters.client !== 'all' && s.client !== filters.client) return false;
      if (filters.language !== 'all' && !s.languages.includes(filters.language)) return false;
      if (filters.project !== 'all' && (s.project ?? '') !== filters.project) return false;
      return true;
    });
  }, [sessions, filters]);

  // Filter milestones by category
  const filteredMilestones = useMemo(() => {
    if (filters.category === 'all') return milestones;
    return milestones.filter((m) => m.category === filters.category);
  }, [milestones, filters.category]);

  // Group sessions with milestones, then group into conversations
  const conversations = useMemo(() => {
    const groups = groupSessionsWithMilestones(filtered, filteredMilestones);
    return groupIntoConversations(groups);
  }, [filtered, filteredMilestones]);

  if (conversations.length === 0) {
    return (
      <div className="text-center text-text-muted py-8 text-sm mb-4">
        No sessions in this window
      </div>
    );
  }

  return (
    <div className="space-y-1.5 mb-4">
      {conversations.map((conv) => (
        <ConversationCard
          key={conv.conversationId ?? conv.sessions[0]!.session.session_id}
          group={conv}
          defaultExpanded={false}
          globalShowPublic={globalShowPublic}
          showFullDate={showFullDate}
          highlightWords={highlightWords}
          onDeleteSession={onDeleteSession}
          onDeleteMilestone={onDeleteMilestone}
          onDeleteConversation={onDeleteConversation}
        />
      ))}
    </div>
  );
}
