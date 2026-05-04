function fmtDuration(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins > 0) return `${mins}min`;
  const secs = Math.round(ms / 1000);
  return `${secs}s`;
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { buildSessionRecord } from "@devness/useai-crypto";
import {
  appendSession,
  getOrCreateKeystore,
  getConfig,
} from "@devness/useai-storage";
import {
  TaskTypeSchema,
  MilestoneCategorySchema,
  ComplexitySchema,
} from "@devness/useai-types";
import type {
  SessionEvaluation,
  Milestone,
  Session,
} from "@devness/useai-types";
import type { PromptContext } from "../core/prompt-context.js";
import {
  touchActivity,
  getActiveDurationMs,
  finalizeActiveSegments,
  resolveSession,
  removeChildSession,
  globalSessionRegistry,
  ChainLockTimeoutError,
} from "../core/prompt-context.js";
import { coerceJsonString } from "../core/coerce.js";
import { unregisterActiveSession } from "../daemon/core/active-sessions.js";

let privateKey: Buffer | null = null;
async function getPrivateKey(): Promise<Buffer> {
  if (!privateKey) {
    const ks = await getOrCreateKeystore();
    privateKey = ks.privateKey;
  }
  return privateKey;
}

const SEAL_API_FALLBACK = "https://useai.dev/api/seal";

/**
 * Fire-and-forget cloud seal verification.
 * Posts the sealed session to the cloud; if it returns a signature,
 * patches the local JSONL file to store it as `sealVerification`.
 */
async function verifySeal(sessionId: string, timestamp: string): Promise<string | null> {
  try {
    const config = await getConfig();
    const apiUrl =
      process.env["USEAI_API_URL"]
        ? `${process.env["USEAI_API_URL"]}/api/seal`
        : SEAL_API_FALLBACK;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.auth.token) {
      headers["Authorization"] = `Bearer ${config.auth.token}`;
    }

    const res = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({ sessionId, timestamp }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const json = (await res.json()) as { signature?: string };
    return json.signature ?? null;
  } catch {
    return null;
  }
}

export function registerEndTool(server: McpServer, ctx: PromptContext): void {
  server.registerTool(
    "useai_end",
    {
      description: "End the current AI coding session and record milestones and evaluation.",
      inputSchema: {
        prompt_id: z
          .string()
          .describe(
            "Target a specific session by its promptId (returned by useai_start). " +
              "Required for concurrent/parallel sessions. If omitted, targets the most recent session.",
          ),
        task_type: TaskTypeSchema.optional().describe(
          "What kind of task was the developer working on?",
        ),
        languages: coerceJsonString(z.array(z.string()))
          .optional()
          .describe(
            'Programming languages used (e.g. ["typescript", "python"])',
          ),
        files_touched_count: coerceJsonString(z.number())
          .optional()
          .describe("Approximate number of files created or modified"),
        milestones: coerceJsonString(
          z.array(
            z.object({
              title: z
                .string()
                .describe(
                  "Generic description — no project names, file paths, or identifying details.",
                ),
              private_title: z
                .string()
                .optional()
                .describe("Detailed description for private records."),
              category: MilestoneCategorySchema.describe(
                "Type of work: feature, bugfix, refactor, etc.",
              ),
              complexity: ComplexitySchema.optional().describe(
                "simple, medium, or complex. Defaults to medium.",
              ),
            }),
          ),
        )
          .optional()
          .describe("Array of milestones accomplished in this session."),
        prompt_images: coerceJsonString(
          z.array(
            z.object({
              type: z.literal("image"),
              description: z
                .string()
                .describe("AI-generated description of the image"),
            }),
          ),
        )
          .optional()
          .describe(
            "Metadata for images attached to the prompt (description only, no binary data).",
          ),
        evaluation: coerceJsonString(
          z.object({
            prompt_quality: z.number().min(1).max(5),
            prompt_quality_reason: z.string().optional(),
            prompt_quality_ideal: z
              .string()
              .optional()
              .describe(
                "What would make prompt quality 5/5? (calibrated framework)",
              ),
            context_provided: z.number().min(1).max(5),
            context_provided_reason: z.string().optional(),
            context_provided_ideal: z
              .string()
              .optional()
              .describe("What would make context 5/5? (calibrated framework)"),
            task_outcome: z.enum([
              "completed",
              "partial",
              "abandoned",
              "blocked",
            ]),
            task_outcome_reason: z.string().optional(),
            task_outcome_ideal: z
              .string()
              .optional()
              .describe(
                "What would have made the outcome better? (calibrated framework)",
              ),
            iteration_count: z.number().min(1),
            independence_level: z.number().min(1).max(5),
            independence_level_reason: z.string().optional(),
            independence_level_ideal: z
              .string()
              .optional()
              .describe(
                "What would make independence 5/5? (calibrated framework)",
              ),
            scope_quality: z.number().min(1).max(5),
            scope_quality_reason: z.string().optional(),
            scope_quality_ideal: z
              .string()
              .optional()
              .describe(
                "What would make scope quality 5/5? (calibrated framework)",
              ),
            tools_leveraged: z.number().min(0),
          }),
        )
          .optional()
          .describe("AI-assessed evaluation of this session."),
      },
    },
    async ({
      prompt_id,
      task_type,
      languages,
      files_touched_count,
      milestones: milestonesInput,
      prompt_images,
      evaluation,
    }) => {
      const targetCtx = resolveSession(ctx, prompt_id);

      if (!targetCtx || !targetCtx.startedAt) {
        return {
          content: [
            {
              type: "text" as const,
              text: prompt_id
                ? `No active session found for prompt_id "${prompt_id}". Call useai_start first.`
                : "No active session. Call useai_start first.",
            },
          ],
        };
      }

      const startedAt = targetCtx.startedAt;
      const endedAt = new Date();

      touchActivity(targetCtx, endedAt.getTime());

      const durationMs = getActiveDurationMs(
        startedAt,
        targetCtx.lastActivityTime,
        targetCtx.idleMs,
        targetCtx.childPausedMs,
      );

      const sessionEval = evaluation as SessionEvaluation | undefined;

      const milestones: Milestone[] = (milestonesInput ?? []).map((m) => ({
        id: `mil_${randomUUID()}`,
        title: m.title,
        category: m.category,
        ...(m.private_title && { privateTitle: m.private_title }),
        ...(m.complexity && { complexity: m.complexity }),
      }));

      const activeSegments = finalizeActiveSegments(targetCtx);

      // Prepare everything that doesn't depend on prevHash before acquiring the lock
      const sessionDataBase = {
        promptId: targetCtx.promptId,
        connectionId: targetCtx.connectionId,
        client: targetCtx.client,
        taskType: task_type ?? targetCtx.taskType,
        title: targetCtx.title ?? "",
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        durationMs,
        ...(activeSegments.length > 0 && { activeSegments }),
        milestones,
        languages: languages ?? [],
        ...(targetCtx.privateTitle && { privateTitle: targetCtx.privateTitle }),
        ...(targetCtx.project && { project: targetCtx.project }),
        ...(targetCtx.model && { model: targetCtx.model }),
        ...(targetCtx.prompt && { prompt: targetCtx.prompt }),
        ...(() => {
          const startImages = targetCtx.promptImages ?? [];
          const endImages = prompt_images ?? [];
          const allImages = [...startImages, ...endImages];
          if (allImages.length === 0) return {};
          return {
            promptImages: allImages,
            promptImageCount: allImages.length,
          };
        })(),
        ...(files_touched_count !== undefined && {
          filesTouchedCount: files_touched_count,
        }),
        ...(sessionEval && { evaluation: sessionEval }),
      };

      const key = await getPrivateKey();

      // Acquire the chain lock — serializes prevHash read/compute/write across
      // concurrent useai_end calls. Times out after 10s to prevent deadlocks.
      let fullSession: Session;
      try {
        await ctx.chainLock.acquire();
      } catch (err) {
        if (err instanceof ChainLockTimeoutError) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Session seal timed out — another session is taking too long to finalize. Please retry.`,
              },
            ],
          };
        }
        throw err;
      }
      try {
        // Get cloud seal verification before sealing (best-effort)
        const sealVerification = await verifySeal(sessionDataBase.promptId, sessionDataBase.endedAt);
        const sessionData: Omit<Session, "hash" | "signature"> = {
          ...sessionDataBase,
          prevHash: ctx.prevHash,
          ...(sealVerification && { sealVerification }),
        };
        const { hash, signature } = buildSessionRecord(sessionData, key);
        ctx.prevHash = hash;
        fullSession = { ...sessionData, hash, signature };
        await appendSession(fullSession);
        // Only null root's startedAt when sealing the root session itself.
        // Child sessions must not touch the root's startedAt.
        if (targetCtx === ctx) ctx.startedAt = null;
      } finally {
        ctx.chainLock.release();
      }

      // Session sealed successfully — release the auto-updater's idle gate.
      // Do this after the chain lock so a failed seal (which throws above)
      // doesn't drop the entry early.
      unregisterActiveSession(targetCtx.promptId);

      // A child session is any targetCtx that is not the root ctx itself.
      // This covers both sessions still in concurrentChildren and orphaned sessions
      // found via the global registry (e.g. parent was reset by a new root useai_start).
      const isChild = targetCtx !== ctx;

      if (isChild) {
        globalSessionRegistry.delete(targetCtx.promptId);
        // Remove from parent's map if it's still there (normal case)
        if (ctx.concurrentChildren.has(targetCtx.promptId)) {
          removeChildSession(ctx, targetCtx.promptId, durationMs);
          return {
            content: [
              {
                type: "text" as const,
                text: `Session ${fullSession.promptId} sealed. Duration: ${fmtDuration(durationMs)}. Resumed parent session (depth ${ctx.sessionDepth}).`,
              },
            ],
          };
        }
        // Orphaned child: parent already reset, just seal and return
        return {
          content: [
            {
              type: "text" as const,
              text: `Session ${fullSession.promptId} sealed. Duration: ${fmtDuration(durationMs)}.`,
            },
          ],
        };
      }

      // Root session: chain head already advanced above.
      return {
        content: [
          {
            type: "text" as const,
            text: `Session ${fullSession.promptId} sealed. Duration: ${fmtDuration(durationMs)}.`,
          },
        ],
      };
    },
  );
}
