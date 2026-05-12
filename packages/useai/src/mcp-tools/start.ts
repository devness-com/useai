import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { TaskTypeSchema } from "@devness/useai-types";
import type { PromptContext } from "../core/prompt-context.js";
import {
  createChildContext,
  globalSessionRegistry,
} from "../core/prompt-context.js";
import { coerceJsonString } from "../core/coerce.js";
import { registerActiveSession } from "../daemon/core/active-sessions.js";
import { recordActivity } from "../daemon/core/connection-store.js";

export function registerStartTool(server: McpServer, ctx: PromptContext): void {
  server.registerTool(
    "useai_start",
    {
      description: "Start tracking an AI coding session.",
      inputSchema: {
        client: z
          .string()
          .describe(
            "Name of the AI tool being used (e.g. claude-code, cursor, windsurf)",
          ),
        task_type: TaskTypeSchema.optional().describe(
          "What kind of task is the developer working on?",
        ),
        title: z
          .string()
          .optional()
          .describe(
            'Short public session title. No project names or file paths. Example: "Fix authentication bug"',
          ),
        private_title: z
          .string()
          .optional()
          .describe(
            "Detailed session title for private records. Can include project names and specifics.",
          ),
        project: z
          .string()
          .optional()
          .describe(
            'Project name — typically the root directory name of the codebase. Example: "useai", "goodpass"',
          ),
        prompt: z
          .string()
          .describe(
            "The user's full verbatim prompt text. Stored locally for self-review.",
          ),
        model: z
          .string()
          .optional()
          .describe(
            'The AI model ID running this session. Example: "claude-sonnet-4-6"',
          ),
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
      },
    },
    async ({
      client,
      task_type,
      title,
      private_title,
      project,
      prompt,
      model,
      prompt_images,
    }) => {
      recordActivity(ctx.connectionId);
      // Prefer the host name the IDE reported during MCP initialize over
      // whatever the LLM passed in — the agent has no reliable way to know
      // which tool it's running inside, and frequently hallucinates the
      // `client` value (e.g. Claude-in-Windsurf reports "claude-code").
      if (ctx.mcpClientName) client = ctx.mcpClientName;
      const framework = "calibrated";

      const isNested = ctx.startedAt !== null;

      if (isNested) {
        // ---- Nested session: create a concurrent child context ----
        const child = createChildContext(ctx, {
          client,
          taskType: task_type,
          title: title ?? null,
          privateTitle: private_title ?? null,
          project,
          model,
          prompt: prompt ?? null,
          promptImages: prompt_images ?? null,
        });

        ctx.concurrentChildren.set(child.promptId, child);
        globalSessionRegistry.set(child.promptId, child);

        // Register the concurrent child so it shows on /health.active_sessions
        // and gates the auto-updater's restart. We don't want to restart the
        // daemon while any session is in flight, regardless of nesting depth.
        registerActiveSession({
          promptId: child.promptId,
          connectionId: child.connectionId,
          client: child.client,
          project: child.project,
          title: child.title,
          startedAt: child.startedAt!.getTime(),
          parentPromptId: ctx.promptId,
          sessionDepth: child.sessionDepth,
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Session ${child.promptId} started (depth ${child.sessionDepth}), framework: ${framework}. Call useai_end when done.${framework === "calibrated" ? " Provide *_ideal fields in evaluation for gap analysis." : ""}`,
            },
          ],
        };
      }

      ctx.promptId = `prompt_${crypto.randomUUID()}`;
      ctx.prevHash = ctx.prevHash ? ctx.prevHash : "0".repeat(64);
      ctx.startedAt = new Date();
      ctx.lastActivityTime = null;
      ctx.idleMs = 0;
      ctx.activeSegments = [[ctx.startedAt.getTime(), 0]];
      ctx.childPausedMs = 0;
      ctx.sessionDepth = 0;
      ctx.concurrentChildren = new Map();
      ctx.client = client ?? "unknown";
      ctx.taskType = task_type ?? "other";
      ctx.title = title ?? null;
      ctx.privateTitle = private_title ?? null;
      ctx.project = project ?? null;
      ctx.model = model ?? null;
      ctx.prompt = prompt ?? null;
      ctx.promptImages = prompt_images ?? null;

      // Root session is now active — register so it shows on /health and the
      // auto-updater's idle gate fires so the daemon won't try to self-restart
      // while work is in progress.
      registerActiveSession({
        promptId: ctx.promptId,
        connectionId: ctx.connectionId,
        client: ctx.client,
        project: ctx.project,
        title: ctx.title,
        startedAt: ctx.startedAt.getTime(),
        parentPromptId: null,
        sessionDepth: 0,
      });

      return {
        content: [
          {
            type: "text" as const,
            text: `useai_start call successful, tracking started for ${ctx.promptId}, framework: ${framework}.${framework === "calibrated" ? " Provide *_ideal fields in evaluation for gap analysis." : ""}`,
          },
        ],
      };
    },
  );
}
