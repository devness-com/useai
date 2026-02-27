import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  VERSION,
  ACTIVE_DIR,
  SEALED_DIR,
  CONFIG_FILE,
  SESSIONS_FILE,
  MILESTONES_FILE,
  readJson,
  writeJson,
  formatDuration,
  detectClient,
  normalizeMcpClientName,
  signHash,
  taskTypeSchema,
  milestoneCategorySchema,
  complexitySchema,
  generateSessionId,
} from '@useai/shared';
import type { SessionSeal, SessionEvaluation, ToolOverhead, Milestone, LocalConfig } from '@useai/shared';
import { getFramework } from '@useai/shared';
import type { SessionState } from './session-state.js';
import { writeMcpMapping } from './mcp-map.js';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Some MCP clients (e.g. Claude) serialize complex parameters as JSON strings
 * instead of native JSON types. This helper wraps a Zod schema to transparently
 * parse a JSON string into the expected type before validation.
 */
function coerceJsonString<T extends z.ZodTypeAny>(schema: T): z.ZodType<z.infer<T>> {
  return z.preprocess((val) => {
    if (typeof val === 'string') {
      try { return JSON.parse(val); } catch { return val; }
    }
    return val;
  }, schema) as z.ZodType<z.infer<T>>;
}

function getConfig(): LocalConfig {
  return readJson<LocalConfig>(CONFIG_FILE, {
    milestone_tracking: true,
    auto_sync: true,
  });
}

function getSessions(): SessionSeal[] {
  return readJson<SessionSeal[]>(SESSIONS_FILE, []);
}

function getMilestones(): Milestone[] {
  return readJson<Milestone[]>(MILESTONES_FILE, []);
}

/**
 * Resolve the client name for this session.
 * In daemon mode, getClientVersion() is available by the time a tool runs
 * (the initialize handshake has completed). In stdio mode, fall back to
 * environment variable detection.
 */
function resolveClient(server: McpServer, session: SessionState): void {
  if (session.clientName !== 'unknown') return;

  // Daemon mode: MCP clientInfo from initialize handshake
  const clientInfo = server.server.getClientVersion();
  if (clientInfo?.name) {
    session.setClient(normalizeMcpClientName(clientInfo.name));
    return;
  }

  // Stdio mode: environment variable detection
  session.setClient(detectClient());
}

// ── Auto-seal enrichment ────────────────────────────────────────────────────────

interface ChainStartData {
  client?: string;
  task_type?: string;
  title?: string;
  private_title?: string;
  project?: string;
  conversation_id?: string;
  conversation_index?: number;
  model?: string;
}

/**
 * When a session was auto-sealed by the seal-active hook (another conversation
 * ended and triggered seal-all), the useai_end call finds sessionRecordCount=0.
 * Instead of failing, this enriches the existing auto-seal with milestones,
 * evaluation, and other data the AI provides at end-of-session.
 */
function enrichAutoSealedSession(
  sealedSessionId: string,
  session: SessionState,
  args: {
    task_type?: string;
    languages?: string[];
    files_touched_count?: number;
    milestones?: Array<{ title: string; private_title?: string; category: string; complexity?: string }>;
    evaluation?: SessionEvaluation;
  },
): string {
  // Read chain metadata from the sealed file
  const sealedPath = join(SEALED_DIR, `${sealedSessionId}.jsonl`);
  const activePath = join(ACTIVE_DIR, `${sealedSessionId}.jsonl`);
  const chainPath = existsSync(sealedPath) ? sealedPath : existsSync(activePath) ? activePath : null;

  if (!chainPath) {
    return 'No active session to end (already sealed or never started).';
  }

  let startData: ChainStartData = {};
  let duration = 0;
  let endedAt = new Date().toISOString();
  let startedAt = endedAt;

  try {
    const content = readFileSync(chainPath, 'utf-8').trim();
    const lines = content.split('\n').filter(Boolean);
    if (lines.length > 0) {
      const firstRecord = JSON.parse(lines[0]!) as { data: ChainStartData; timestamp: string };
      startData = firstRecord.data;
      startedAt = firstRecord.timestamp;
      const lastRecord = JSON.parse(lines[lines.length - 1]!) as { data: Record<string, unknown>; timestamp: string; type: string };
      // Use seal's ended_at if available, otherwise last record timestamp
      if (lastRecord.type === 'session_seal' && lastRecord.data['seal']) {
        try {
          const sealObj = JSON.parse(lastRecord.data['seal'] as string) as { duration_seconds?: number; ended_at?: string };
          duration = sealObj.duration_seconds ?? Math.round((new Date(lastRecord.timestamp).getTime() - new Date(startedAt).getTime()) / 1000);
          endedAt = sealObj.ended_at ?? lastRecord.timestamp;
        } catch {
          duration = Math.round((new Date(lastRecord.timestamp).getTime() - new Date(startedAt).getTime()) / 1000);
          endedAt = lastRecord.timestamp;
        }
      } else {
        duration = Math.round((new Date(lastRecord.timestamp).getTime() - new Date(startedAt).getTime()) / 1000);
        endedAt = lastRecord.timestamp;
      }
    }
  } catch {
    return 'No active session to end (chain file unreadable).';
  }

  const taskType = args.task_type ?? startData.task_type ?? 'coding';
  const languages = args.languages ?? [];
  const filesTouched = args.files_touched_count ?? 0;

  // Save milestones
  let milestoneCount = 0;
  if (args.milestones && args.milestones.length > 0) {
    const config = getConfig();
    if (config.milestone_tracking) {
      const durationMinutes = Math.round(duration / 60);
      const allMilestones = getMilestones();
      for (const m of args.milestones) {
        allMilestones.push({
          id: `m_${randomUUID().slice(0, 8)}`,
          session_id: sealedSessionId,
          title: m.title,
          private_title: m.private_title,
          project: startData.project ?? session.project ?? undefined,
          category: m.category as Milestone['category'],
          complexity: (m.complexity ?? 'medium') as Milestone['complexity'],
          duration_minutes: durationMinutes,
          languages,
          client: startData.client ?? session.clientName,
          created_at: new Date().toISOString(),
          published: false,
          published_at: null,
          chain_hash: '',
        });
        milestoneCount++;
      }
      writeJson(MILESTONES_FILE, allMilestones);
    }
  }

  // Compute score
  let sessionScore: number | undefined;
  let frameworkId: string | undefined;
  if (args.evaluation) {
    const config = getConfig();
    const framework = getFramework(config.evaluation_framework);
    sessionScore = Math.round(framework.computeSessionScore(args.evaluation));
    frameworkId = framework.id;
  }

  // Upsert sessions.json with enriched data
  const richSeal: SessionSeal = {
    session_id: sealedSessionId,
    conversation_id: startData.conversation_id,
    conversation_index: startData.conversation_index,
    client: startData.client ?? session.clientName,
    task_type: taskType,
    languages,
    files_touched: filesTouched,
    project: startData.project ?? session.project ?? undefined,
    title: startData.title ?? undefined,
    private_title: startData.private_title ?? undefined,
    model: startData.model ?? session.modelId ?? undefined,
    evaluation: args.evaluation ?? undefined,
    session_score: sessionScore,
    evaluation_framework: frameworkId,
    started_at: startedAt,
    ended_at: endedAt,
    duration_seconds: duration,
    heartbeat_count: 0,
    record_count: 0,
    chain_start_hash: '',
    chain_end_hash: '',
    seal_signature: '',
  };

  // Upsert: merge with existing seal to preserve fields we don't have (record_count, chain hashes, etc.)
  const allSessions = getSessions();
  const existingIdx = allSessions.findIndex(s => s.session_id === sealedSessionId);
  if (existingIdx >= 0) {
    const existing = allSessions[existingIdx]!;
    allSessions[existingIdx] = {
      ...existing,
      // Enrich with data from useai_end call
      task_type: taskType,
      languages,
      files_touched: filesTouched,
      evaluation: args.evaluation ?? existing.evaluation,
      session_score: sessionScore ?? existing.session_score,
      evaluation_framework: frameworkId ?? existing.evaluation_framework,
    };
  } else {
    allSessions.push(richSeal);
  }
  writeJson(SESSIONS_FILE, allSessions);

  const durationStr = formatDuration(duration);
  const langStr = languages.length > 0 ? ` using ${languages.join(', ')}` : '';
  const milestoneStr = milestoneCount > 0 ? ` · ${milestoneCount} milestone${milestoneCount > 1 ? 's' : ''} recorded` : '';
  const evalStr = args.evaluation ? ` · eval: ${args.evaluation.task_outcome} (prompt: ${args.evaluation.prompt_quality}/5)` : '';
  const scoreStr = sessionScore !== undefined ? ` · score: ${sessionScore}/100 (${frameworkId})` : '';
  return `Session ended (enriched auto-seal): ${durationStr} ${taskType}${langStr}${milestoneStr}${evalStr}${scoreStr}`;
}

// ── Tool Registration ──────────────────────────────────────────────────────────

export interface RegisterToolsOpts {
  /** Called before session.reset() to seal the current active session (if any). */
  sealBeforeReset?: () => void;
}

export function registerTools(server: McpServer, session: SessionState, opts?: RegisterToolsOpts): void {
  // ── Tool 1: Session Start ────────────────────────────────────────────────

  server.tool(
    'useai_start',
    'Start tracking an AI coding session. Call this at the beginning of every response. ' +
      'Generate a session title from the user\'s prompt: a generic public "title" (no project/file names) ' +
      'and a detailed "private_title" (can include specifics). ' +
      'task_type must be one of: coding, debugging, testing, planning, reviewing, documenting, learning, ' +
      'deployment, devops, research, migration, design, data, security, configuration, code_review, ' +
      'code-review, investigation, infrastructure, analysis, ops, setup, refactoring, other.',
    {
      task_type: taskTypeSchema
        .optional()
        .describe('What kind of task is the developer working on?'),
      title: z
        .string()
        .optional()
        .describe('Short public session title derived from the user\'s prompt. No project names, file paths, or identifying details. Example: "Fix authentication bug"'),
      private_title: z
        .string()
        .optional()
        .describe('Detailed session title for private records. Can include project names and specifics. Example: "Fix JWT refresh in UseAI login flow"'),
      project: z
        .string()
        .optional()
        .describe('Project name for this session. Typically the root directory name of the codebase being worked on. Example: "goodpass", "useai"'),
      model: z
        .string()
        .optional()
        .describe('The AI model ID running this session. Example: "claude-opus-4-6", "claude-sonnet-4-6"'),
      conversation_id: z
        .string()
        .optional()
        .describe('Pass the conversation_id value from the previous useai_start response to group multiple prompts in the same conversation. The value is returned as "conversation_id=<uuid>" in the response. Omit for a new conversation.'),
    },
    async ({ task_type, title, private_title, project, model, conversation_id }) => {
      // Save previous conversation ID before reset (reset preserves it + increments index)
      const prevConvId = session.conversationId;

      // Detect child (subagent) session: if a session is actively in-progress,
      // save its state instead of sealing it. The parent will be restored when
      // the child ends via useai_end.
      const isChildSession = session.inProgress && session.sessionRecordCount > 0;
      const parentSessionId = isChildSession ? session.sessionId : null;

      if (isChildSession) {
        // Save parent state — do NOT seal the parent session
        session.saveParentState();
      } else {
        // Normal flow: seal any previous session before resetting (prevents orphaned sessions)
        if (session.sessionRecordCount > 0 && opts?.sealBeforeReset) {
          opts.sealBeforeReset();
        }
      }
      session.reset();
      session.autoSealedSessionId = null; // New session — clear previous auto-seal tracking
      resolveClient(server, session);

      // Conversation ID logic:
      // - If conversation_id is provided and matches the previous: keep (reset already incremented index)
      // - If conversation_id is provided but different: use it as a new conversation
      // - If not provided and this is a child session: inherit parent's conversation_id
      //   (reset() already preserved it and incremented index)
      // - If not provided and not a child: generate a fresh conversation ID
      //
      // Models often copy the response format verbatim (e.g. "edb8fb48#0" instead of the
      // full UUID), so we normalize: strip any "#N" suffix and match by prefix if the input
      // looks like a truncated ID (≤8 chars).
      if (conversation_id) {
        const normalized = conversation_id.replace(/#\d+$/, '');
        const matches =
          normalized === prevConvId ||
          (normalized.length <= 8 && prevConvId.startsWith(normalized));
        if (!matches) {
          session.conversationId = normalized.length <= 8 ? generateSessionId() : normalized;
          session.conversationIndex = 0;
        }
        // else: matches previous → reset() already preserved it and incremented index
      } else if (!isChildSession) {
        // No conversation_id and not a child → new conversation (fixes long-lived MCP connections
        // like Antigravity where multiple user conversations share one transport)
        session.conversationId = generateSessionId();
        session.conversationIndex = 0;
      }
      // else: child session without explicit conversation_id → inherits parent's
      // (reset() already preserved conversationId and incremented conversationIndex)

      if (project) session.setProject(project);
      if (model) session.setModel(model);
      session.setTaskType(task_type ?? 'coding');
      session.setTitle(title ?? null);
      session.setPrivateTitle(private_title ?? null);

      const chainData: Record<string, unknown> = {
        client: session.clientName,
        task_type: session.sessionTaskType,
        project: session.project,
        conversation_id: session.conversationId,
        conversation_index: session.conversationIndex,
        version: VERSION,
      };

      if (title) chainData.title = title;
      if (private_title) chainData.private_title = private_title;
      if (model) chainData.model = model;
      if (parentSessionId) chainData.parent_session_id = parentSessionId;

      const record = session.appendToChain('session_start', chainData);

      // Mark session as in-progress (prevents seal-active from sealing mid-response)
      session.inProgress = true;
      session.inProgressSince = Date.now();

      // Persist MCP→UseAI mapping for daemon restart recovery
      writeMcpMapping(session.mcpSessionId, session.sessionId);

      const childSuffix = parentSessionId ? ` · child of ${parentSessionId.slice(0, 8)}` : '';
      const responseText = `useai session started — ${session.sessionTaskType} on ${session.clientName} · ${session.sessionId.slice(0, 8)} · conv ${session.conversationId.slice(0, 8)}#${session.conversationIndex}${childSuffix} · ${session.signingAvailable ? 'signed' : 'unsigned'}`;

      // Estimate token overhead for this tool call
      const paramsJson = JSON.stringify({ task_type, title, private_title, project, model });
      session.startCallTokensEst = {
        output: Math.ceil(paramsJson.length / 4),
        input: Math.ceil(responseText.length / 4),
      };

      return {
        content: [
          {
            type: 'text' as const,
            text: responseText,
          },
          {
            type: 'text' as const,
            text: `conversation_id=${session.conversationId}`,
          },
        ],
      };
    },
  );

  // ── Tool 2: Heartbeat ────────────────────────────────────────────────────

  server.tool(
    'useai_heartbeat',
    'Record a heartbeat for the current AI coding session. ' +
      'Call this periodically during long conversations (every 10-15 minutes).',
    {},
    async () => {
      session.incrementHeartbeat();

      session.appendToChain('heartbeat', {
        heartbeat_number: session.heartbeatCount,
        cumulative_seconds: session.getSessionDuration(),
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: `Heartbeat recorded. Session active for ${formatDuration(session.getSessionDuration())}.`,
          },
        ],
      };
    },
  );

  // ── Tool 3: Session End ──────────────────────────────────────────────────

  server.tool(
    'useai_end',
    'End the current AI coding session and record milestones. ' +
      'Each milestone is an object with required "title" (generic, no project/file names) and "category", ' +
      'plus optional "private_title" (detailed, can include project names and specifics) and "complexity" (simple/medium/complex). ' +
      'milestone category must be one of: feature, bugfix, refactor, test, docs, setup, deployment, fix, bug_fix, ' +
      'testing, documentation, config, configuration, analysis, research, investigation, performance, cleanup, ' +
      'chore, security, migration, design, devops, other. ' +
      'task_type must be one of: coding, debugging, testing, planning, reviewing, documenting, learning, ' +
      'deployment, devops, research, migration, design, data, security, configuration, code_review, ' +
      'code-review, investigation, infrastructure, analysis, ops, setup, refactoring, other. ' +
      'Example milestones: [{"title": "Implemented auth flow", "private_title": "Added OAuth2 to UserService in acme-api", "category": "feature"}, {"title": "Fixed race condition", "category": "bugfix"}]. ' +
      'Also provide an `evaluation` object assessing the session: prompt_quality (1-5), context_provided (1-5), ' +
      'task_outcome (completed/partial/abandoned/blocked), iteration_count, independence_level (1-5), ' +
      'scope_quality (1-5), and tools_leveraged count. Score honestly based on the actual interaction. ' +
      'For any scored metric < 5 or non-completed outcome, you MUST provide a *_reason field explaining ' +
      'what was lacking and a concrete tip for the user to improve next time. Only skip *_reason for a perfect 5.',
    {
      session_id: z
        .string()
        .optional()
        .describe('Session ID to end. If omitted, ends the current active session. Pass the session_id from your useai_start response to explicitly target your own session (important when subagents may have started their own sessions on the same connection).'),
      task_type: taskTypeSchema
        .optional()
        .describe('What kind of task was the developer working on?'),
      languages: coerceJsonString(z
        .array(z.string()))
        .optional()
        .describe("Programming languages used (e.g. ['typescript', 'python'])"),
      files_touched_count: coerceJsonString(z
        .number())
        .optional()
        .describe('Approximate number of files created or modified (count only, no names)'),
      milestones: coerceJsonString(z.array(z.object({
        title: z.string().describe("PRIVACY-CRITICAL: Generic description of what was accomplished. NEVER include project names, file paths, class names, or identifying details. GOOD: 'Implemented user authentication'. BAD: 'Fixed bug in Acme auth'."),
        private_title: z.string().optional().describe("Detailed description for the user's private records. CAN include project names and specifics."),
        category: milestoneCategorySchema.describe('Required. Type of work: feature, bugfix, refactor, test, docs, investigation, analysis, research, setup, deployment, performance, cleanup, chore, security, migration, design, devops, config, other'),
        complexity: complexitySchema.optional().describe('Optional. simple, medium, or complex. Defaults to medium.'),
      }))).optional().describe('Array of milestone objects. Each MUST have "title" (generic, no project names) and "category". Optional: "private_title" (detailed, can include project names). Example: [{"title": "Implemented auth flow", "private_title": "Added OAuth2 to UserService in acme-api", "category": "feature"}]'),
      evaluation: coerceJsonString(z.object({
        prompt_quality: z.number().min(1).max(5).describe('How clear, specific, and complete was the initial prompt? 1=vague/ambiguous, 5=crystal clear with acceptance criteria'),
        prompt_quality_reason: z.string().optional().describe('Required if prompt_quality < 5. Explain what was vague/missing and how the user could phrase it better next time.'),
        context_provided: z.number().min(1).max(5).describe('Did the user provide relevant context (files, errors, constraints)? 1=no context, 5=comprehensive context'),
        context_provided_reason: z.string().optional().describe('Required if context_provided < 5. What context was missing (files, error logs, constraints) that would have helped?'),
        task_outcome: z.enum(['completed', 'partial', 'abandoned', 'blocked']).describe('Was the primary task achieved?'),
        task_outcome_reason: z.string().optional().describe('Required if task_outcome is not "completed". Explain why the task was not fully completed and what blocked progress.'),
        iteration_count: z.number().min(1).describe('Number of user-to-AI turns in this session'),
        independence_level: z.number().min(1).max(5).describe('How self-directed was the user? 1=needed constant guidance, 5=gave clear spec and let AI execute'),
        independence_level_reason: z.string().optional().describe('Required if independence_level < 5. What decisions needed constant back-and-forth that could have been specified upfront?'),
        scope_quality: z.number().min(1).max(5).describe('Was the task well-scoped? 1=vague or impossibly broad, 5=precise and achievable'),
        scope_quality_reason: z.string().optional().describe('Required if scope_quality < 5. How was the scope too broad/vague and how could it be better defined?'),
        tools_leveraged: z.number().min(0).describe('Count of distinct AI capabilities used (code gen, debugging, refactoring, testing, docs, etc.)'),
      })).optional().describe('AI-assessed evaluation of this session. Score honestly based on the actual interaction.'),
    },
    async ({ session_id: targetSessionId, task_type, languages, files_touched_count, milestones: milestonesInput, evaluation }) => {
      // If session_id targets the saved parent session, auto-seal the current child
      // and restore the parent before ending it with the provided milestones/evaluation.
      if (targetSessionId && session.parentState &&
          session.parentState.sessionId.startsWith(targetSessionId)) {
        // Auto-seal the current child session without milestones
        if (session.sessionRecordCount > 0) {
          const childDuration = session.getSessionDuration();
          const childNow = new Date().toISOString();
          const childEndRecord = session.appendToChain('session_end', {
            duration_seconds: childDuration,
            task_type: session.sessionTaskType,
            languages: [],
            files_touched: 0,
            heartbeat_count: session.heartbeatCount,
            auto_sealed: true,
            parent_ended: true,
          });
          const childSealData = JSON.stringify({
            session_id: session.sessionId,
            parent_session_id: session.parentState.sessionId,
            conversation_id: session.conversationId,
            conversation_index: session.conversationIndex,
            client: session.clientName,
            task_type: session.sessionTaskType,
            languages: [],
            files_touched: 0,
            project: session.project ?? undefined,
            title: session.sessionTitle ?? undefined,
            private_title: session.sessionPrivateTitle ?? undefined,
            model: session.modelId ?? undefined,
            started_at: new Date(session.sessionStartTime).toISOString(),
            ended_at: childNow,
            duration_seconds: childDuration,
            heartbeat_count: session.heartbeatCount,
            record_count: session.sessionRecordCount,
            chain_end_hash: childEndRecord.hash,
          });
          const childSealSig = signHash(
            createHash('sha256').update(childSealData).digest('hex'),
            session.signingKey,
          );
          session.appendToChain('session_seal', { seal: childSealData, seal_signature: childSealSig });

          // Move child chain file to sealed/
          const childActivePath = join(ACTIVE_DIR, `${session.sessionId}.jsonl`);
          const childSealedPath = join(SEALED_DIR, `${session.sessionId}.jsonl`);
          try {
            if (existsSync(childActivePath)) renameSync(childActivePath, childSealedPath);
          } catch { /* ignore */ }

          // Write child seal to sessions index
          const childSeal: SessionSeal = {
            session_id: session.sessionId,
            parent_session_id: session.parentState.sessionId,
            conversation_id: session.conversationId,
            conversation_index: session.conversationIndex,
            client: session.clientName,
            task_type: session.sessionTaskType,
            languages: [],
            files_touched: 0,
            project: session.project ?? undefined,
            title: session.sessionTitle ?? undefined,
            private_title: session.sessionPrivateTitle ?? undefined,
            model: session.modelId ?? undefined,
            started_at: new Date(session.sessionStartTime).toISOString(),
            ended_at: childNow,
            duration_seconds: childDuration,
            heartbeat_count: session.heartbeatCount,
            record_count: session.sessionRecordCount,
            chain_start_hash: 'GENESIS',
            chain_end_hash: childEndRecord.hash,
            seal_signature: childSealSig,
          };
          const childSessions = getSessions().filter(s => s.session_id !== childSeal.session_id);
          childSessions.push(childSeal);
          writeJson(SESSIONS_FILE, childSessions);
        }

        // Restore parent state
        session.restoreParentState();
        // Fall through to end the parent session normally below
      }

      // Guard: skip if session was never started (e.g. born from reset after seal-active hook)
      if (session.sessionRecordCount === 0) {
        // Fallback: if the session was auto-sealed by seal-active hook, enrich the
        // existing seal with milestones/evaluation rather than failing silently.
        if (session.autoSealedSessionId) {
          const enrichResult = enrichAutoSealedSession(
            session.autoSealedSessionId, session,
            { task_type, languages, files_touched_count, milestones: milestonesInput, evaluation },
          );
          session.autoSealedSessionId = null;
          session.inProgress = false;
          session.inProgressSince = null;
          return { content: [{ type: 'text' as const, text: enrichResult }] };
        }
        return {
          content: [{ type: 'text' as const, text: 'No active session to end (already sealed or never started).' }],
        };
      }

      const duration = session.getSessionDuration();
      const now = new Date().toISOString();
      const finalTaskType = task_type ?? session.sessionTaskType;
      const chainStartHash = session.chainTipHash === 'GENESIS' ? 'GENESIS' : session.chainTipHash;

      // Process milestones BEFORE sealing (must be in chain before file is moved to sealed/)
      let milestoneCount = 0;
      if (milestonesInput && milestonesInput.length > 0) {
        const config = getConfig();
        if (config.milestone_tracking) {
          const durationMinutes = Math.round(duration / 60);
          const allMilestones = getMilestones();

          for (const m of milestonesInput) {
            const mRecord = session.appendToChain('milestone', {
              title: m.title,
              private_title: m.private_title,
              category: m.category,
              complexity: m.complexity ?? 'medium',
              duration_minutes: durationMinutes,
              languages: languages ?? [],
            });

            const milestone: Milestone = {
              id: `m_${randomUUID().slice(0, 8)}`,
              session_id: session.sessionId,
              title: m.title,
              private_title: m.private_title,
              project: session.project ?? undefined,
              category: m.category,
              complexity: m.complexity ?? 'medium',
              duration_minutes: durationMinutes,
              languages: languages ?? [],
              client: session.clientName,
              created_at: new Date().toISOString(),
              published: false,
              published_at: null,
              chain_hash: mRecord.hash,
            };

            allMilestones.push(milestone);
            milestoneCount++;
          }

          writeJson(MILESTONES_FILE, allMilestones);
        }
      }

      // Compute session score from evaluation using configured framework
      let sessionScore: number | undefined;
      let frameworkId: string | undefined;
      if (evaluation) {
        const config = getConfig();
        const framework = getFramework(config.evaluation_framework);
        sessionScore = Math.round(framework.computeSessionScore(evaluation));
        frameworkId = framework.id;
      }

      // Estimate token overhead for useai_end call
      const endParamsJson = JSON.stringify({ task_type, languages, files_touched_count, milestones: milestonesInput, evaluation });
      const endOutputTokensEst = Math.ceil(endParamsJson.length / 4);

      // Write session_end to chain
      const endRecord = session.appendToChain('session_end', {
        duration_seconds: duration,
        task_type: finalTaskType,
        languages: languages ?? [],
        files_touched: files_touched_count ?? 0,
        heartbeat_count: session.heartbeatCount,
        ...(evaluation ? { evaluation } : {}),
        ...(sessionScore !== undefined ? { session_score: sessionScore } : {}),
        ...(frameworkId ? { evaluation_framework: frameworkId } : {}),
        ...(session.modelId ? { model: session.modelId } : {}),
      });

      // Build tool_overhead from start + end estimates
      // End input estimate will be computed after building response text (below)
      const startEst = session.startCallTokensEst ?? { input: 0, output: 0 };

      // Track parent relationship for child sessions
      const parentId = session.parentState?.sessionId;

      // Create session seal
      const sealData = JSON.stringify({
        session_id: session.sessionId,
        ...(parentId ? { parent_session_id: parentId } : {}),
        conversation_id: session.conversationId,
        conversation_index: session.conversationIndex,
        client: session.clientName,
        task_type: finalTaskType,
        languages: languages ?? [],
        files_touched: files_touched_count ?? 0,
        project: session.project,
        title: session.sessionTitle ?? undefined,
        private_title: session.sessionPrivateTitle ?? undefined,
        prompt_word_count: session.sessionPromptWordCount ?? undefined,
        model: session.modelId ?? undefined,
        evaluation: evaluation ?? undefined,
        session_score: sessionScore,
        evaluation_framework: frameworkId,
        started_at: new Date(session.sessionStartTime).toISOString(),
        ended_at: now,
        duration_seconds: duration,
        heartbeat_count: session.heartbeatCount,
        record_count: session.sessionRecordCount,
        chain_end_hash: endRecord.hash,
      });

      const sealSignature = signHash(
        createHash('sha256').update(sealData).digest('hex'),
        session.signingKey,
      );

      // Write seal to chain
      session.appendToChain('session_seal', {
        seal: sealData,
        seal_signature: sealSignature,
      });

      // Move chain file from active/ to sealed/
      const activePath = join(ACTIVE_DIR, `${session.sessionId}.jsonl`);
      const sealedPath = join(SEALED_DIR, `${session.sessionId}.jsonl`);
      try {
        if (existsSync(activePath)) {
          renameSync(activePath, sealedPath);
        }
      } catch {
        // If rename fails (cross-device, permissions), file stays in active/
      }

      // Build response text (needed for end-call input token estimate)
      const durationStr = formatDuration(duration);
      const langStr = languages && languages.length > 0 ? ` using ${languages.join(', ')}` : '';
      const milestoneStr = milestoneCount > 0 ? ` · ${milestoneCount} milestone${milestoneCount > 1 ? 's' : ''} recorded` : '';
      const evalStr = evaluation ? ` · eval: ${evaluation.task_outcome} (prompt: ${evaluation.prompt_quality}/5)` : '';
      const scoreStr = sessionScore !== undefined ? ` · score: ${sessionScore}/100 (${frameworkId})` : '';
      const responseText = `Session ended: ${durationStr} ${finalTaskType}${langStr}${milestoneStr}${evalStr}${scoreStr}`;

      // Finalize tool_overhead
      const endInputTokensEst = Math.ceil(responseText.length / 4);
      const toolOverhead: ToolOverhead = {
        start: { input_tokens_est: startEst.input, output_tokens_est: startEst.output },
        end: { input_tokens_est: endInputTokensEst, output_tokens_est: endOutputTokensEst },
        total_tokens_est: startEst.input + startEst.output + endInputTokensEst + endOutputTokensEst,
      };

      // Append seal to sessions index
      const seal: SessionSeal = {
        session_id: session.sessionId,
        ...(parentId ? { parent_session_id: parentId } : {}),
        conversation_id: session.conversationId,
        conversation_index: session.conversationIndex,
        client: session.clientName,
        task_type: finalTaskType,
        languages: languages ?? [],
        files_touched: files_touched_count ?? 0,
        project: session.project ?? undefined,
        title: session.sessionTitle ?? undefined,
        private_title: session.sessionPrivateTitle ?? undefined,
        prompt_word_count: session.sessionPromptWordCount ?? undefined,
        model: session.modelId ?? undefined,
        evaluation: evaluation ?? undefined,
        session_score: sessionScore,
        evaluation_framework: frameworkId,
        tool_overhead: toolOverhead,
        started_at: new Date(session.sessionStartTime).toISOString(),
        ended_at: now,
        duration_seconds: duration,
        heartbeat_count: session.heartbeatCount,
        record_count: session.sessionRecordCount,
        chain_start_hash: chainStartHash,
        chain_end_hash: endRecord.hash,
        seal_signature: sealSignature,
      };

      // Upsert: replace any existing entry for this session (e.g. from auto-seal)
      const sessions = getSessions().filter(s => s.session_id !== seal.session_id);
      sessions.push(seal);
      writeJson(SESSIONS_FILE, sessions);

      // Mark session as no longer in-progress
      session.inProgress = false;
      session.inProgressSince = null;

      // If this was a child session, restore the parent session state
      // so the parent can continue (and eventually call useai_end itself).
      const restoredParent = session.restoreParentState();
      const parentRestoredStr = restoredParent ? ` · parent ${session.sessionId.slice(0, 8)} restored` : '';

      // Keep MCP→UseAI mapping intentionally: if the daemon restarts and the
      // MCP client reuses its stale session ID, recovery can read the sealed
      // chain file to inherit the client name. The mapping is cleaned up by
      // recoverStartSession (which overwrites it) or the orphan sweep.

      return {
        content: [
          {
            type: 'text' as const,
            text: responseText + parentRestoredStr,
          },
        ],
      };
    },
  );

  // ── Tool 4: Backup ──────────────────────────────────────────────────────

  server.tool(
    'useai_backup',
    'Export UseAI session data (sealed sessions, milestones) as a JSON backup. ' +
      'Does NOT include auth tokens or encryption keys for security.',
    {},
    async () => {
      try {
        const sessions = getSessions();
        const milestones = getMilestones();

        // Collect all sealed chain files (JSONL session logs)
        const sealedChains: Record<string, string> = {};
        if (existsSync(SEALED_DIR)) {
          const files = readdirSync(SEALED_DIR).filter(f => f.endsWith('.jsonl'));
          for (const file of files) {
            sealedChains[file] = readFileSync(join(SEALED_DIR, file), 'utf-8');
          }
        }

        const backup = {
          version: 1,
          exported_at: new Date().toISOString(),
          sessions,
          milestones,
          sealed_chains: sealedChains,
        };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(backup) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
        };
      }
    },
  );

  // ── Tool 5: Restore ─────────────────────────────────────────────────────

  server.tool(
    'useai_restore',
    'Import UseAI session data from a JSON backup. ' +
      'Merges sessions and milestones (deduplicates by ID). Writes sealed chain files that do not already exist.',
    {
      backup_json: z.string().describe('JSON string from a previous useai_backup export'),
    },
    async ({ backup_json }) => {
      try {
        const backup = JSON.parse(backup_json) as {
          version?: number;
          sessions?: SessionSeal[];
          milestones?: Milestone[];
          sealed_chains?: Record<string, string>;
        };

        let restored = 0;

        // Merge sessions (deduplicate by session_id)
        if (backup.sessions && backup.sessions.length > 0) {
          const existing = getSessions();
          const existingIds = new Set(existing.map(s => s.session_id));
          const newSessions = backup.sessions.filter(s => !existingIds.has(s.session_id));
          if (newSessions.length > 0) {
            writeJson(SESSIONS_FILE, [...existing, ...newSessions]);
            restored += newSessions.length;
          }
        }

        // Merge milestones (deduplicate by id)
        if (backup.milestones && backup.milestones.length > 0) {
          const existing = getMilestones();
          const existingIds = new Set(existing.map(m => m.id));
          const newMilestones = backup.milestones.filter(m => !existingIds.has(m.id));
          if (newMilestones.length > 0) {
            writeJson(MILESTONES_FILE, [...existing, ...newMilestones]);
            restored += newMilestones.length;
          }
        }

        // Write sealed chain files (skip existing to avoid overwriting)
        if (backup.sealed_chains) {
          mkdirSync(SEALED_DIR, { recursive: true });
          for (const [filename, content] of Object.entries(backup.sealed_chains)) {
            const filePath = join(SEALED_DIR, filename);
            if (!existsSync(filePath)) {
              writeFileSync(filePath, content, 'utf-8');
              restored++;
            }
          }
        }

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: true, restored }) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ success: false, error: message }) }],
        };
      }
    },
  );
}
