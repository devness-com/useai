import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync } from 'node:fs';
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
      'and a detailed "private_title" (can include specifics).',
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
        .describe('Pass the conversation_id from the previous useai_start response to group sessions in the same conversation. Omit for a new conversation.'),
    },
    async ({ task_type, title, private_title, project, model, conversation_id }) => {
      // Save previous conversation ID before reset (reset preserves it + increments index)
      const prevConvId = session.conversationId;

      // Seal the previous session before resetting (prevents orphaned sessions)
      if (session.sessionRecordCount > 0 && opts?.sealBeforeReset) {
        opts.sealBeforeReset();
      }
      session.reset();
      session.autoSealedSessionId = null; // New session — clear previous auto-seal tracking
      resolveClient(server, session);

      // Conversation ID logic:
      // - If conversation_id is provided and matches the previous: keep (reset already incremented index)
      // - If conversation_id is provided but different: use it as a new conversation
      // - If not provided: generate a fresh conversation ID (each useai_start = new conversation by default)
      if (conversation_id) {
        if (conversation_id !== prevConvId) {
          session.conversationId = conversation_id;
          session.conversationIndex = 0;
        }
        // else: matches previous → reset() already preserved it and incremented index
      } else {
        // No conversation_id → new conversation (fixes long-lived MCP connections
        // like Antigravity where multiple user conversations share one transport)
        session.conversationId = generateSessionId();
        session.conversationIndex = 0;
      }
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

      const record = session.appendToChain('session_start', chainData);

      // Mark session as in-progress (prevents seal-active from sealing mid-response)
      session.inProgress = true;
      session.inProgressSince = Date.now();

      // Persist MCP→UseAI mapping for daemon restart recovery
      writeMcpMapping(session.mcpSessionId, session.sessionId);

      const responseText = `useai session started — ${session.sessionTaskType} on ${session.clientName} · ${session.sessionId.slice(0, 8)} · conv ${session.conversationId.slice(0, 8)}#${session.conversationIndex} · ${session.signingAvailable ? 'signed' : 'unsigned'}`;

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
      'Each milestone needs TWO titles: (1) a generic public "title" safe for public display ' +
      '(NEVER include project names, file names, class names, or any identifying details), ' +
      'and (2) an optional detailed "private_title" for the user\'s own records that CAN include ' +
      'project names, file names, and specific details. ' +
      'GOOD title: "Implemented user authentication". ' +
      'GOOD private_title: "Added JWT auth to UseAI API server". ' +
      'BAD title: "Fixed bug in Acme auth service". ' +
      'Also provide an `evaluation` object assessing the session: prompt_quality (1-5), context_provided (1-5), ' +
      'task_outcome (completed/partial/abandoned/blocked), iteration_count, independence_level (1-5), ' +
      'scope_quality (1-5), and tools_leveraged count. Score honestly based on the actual interaction. ' +
      'For any scored metric < 5 or non-completed outcome, you MUST provide a *_reason field explaining ' +
      'what was lacking and a concrete tip for the user to improve next time. Only skip *_reason for a perfect 5.',
    {
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
        title: z.string().describe("PRIVACY-CRITICAL: Generic description of what was accomplished. NEVER include project names, repo names, product names, package names, file names, file paths, class names, API endpoints, database names, company names, or ANY identifier that could reveal which codebase this work was done in. Write as if describing the work to a stranger. GOOD: 'Implemented user authentication', 'Fixed race condition in background worker', 'Added unit tests for data validation', 'Refactored state management layer'. BAD: 'Fixed bug in Acme auth', 'Investigated ProjectX pipeline', 'Updated UserService.ts in src/services/', 'Added tests for coverit MCP tool'"),
        private_title: z.string().optional().describe("Detailed description for the user's private records. CAN include project names, file names, and specific details. Example: 'Added private/public milestone support to UseAI MCP server'"),
        category: milestoneCategorySchema.describe('Type of work completed'),
        complexity: complexitySchema.optional().describe('How complex was this task?'),
      }))).optional().describe('What was accomplished this session? List each distinct piece of work completed. Provide both a generic public title and an optional detailed private_title.'),
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
    async ({ task_type, languages, files_touched_count, milestones: milestonesInput, evaluation }) => {
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

      // Create session seal
      const sealData = JSON.stringify({
        session_id: session.sessionId,
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

      // Keep MCP→UseAI mapping intentionally: if the daemon restarts and the
      // MCP client reuses its stale session ID, recovery can read the sealed
      // chain file to inherit the client name. The mapping is cleaned up by
      // recoverStartSession (which overwrites it) or the orphan sweep.

      return {
        content: [
          {
            type: 'text' as const,
            text: responseText,
          },
        ],
      };
    },
  );
}
