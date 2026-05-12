import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PromptContext } from "../core/prompt-context.js";
import { touchActivity, resolveSession } from "../core/prompt-context.js";
import {
  hasActiveSession,
  registerActiveSession,
  touchActiveSession,
} from "../daemon/core/active-sessions.js";
import { recordActivity } from "../daemon/core/connection-store.js";

export function registerHeartbeatTool(
  server: McpServer,
  ctx: PromptContext,
): void {
  server.registerTool(
    "useai_heartbeat",
    {
      description: "Keep-alive signal for active sessions.",
      inputSchema: {
        prompt_id: z
          .string()
          .describe(
            "Target a specific session by its promptId (returned by useai_start). " +
              "Required for concurrent/parallel sessions. If omitted, targets the most recent session.",
          ),
      },
    },
    async ({ prompt_id }) => {
      recordActivity(ctx.connectionId);
      const target = resolveSession(ctx, prompt_id);

      if (!target || !target.startedAt) {
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

      const now = Date.now();
      touchActivity(target, now);

      // If the sweeper already evicted this session (long gap between
      // heartbeats, or interrupted-then-resumed flow per CLAUDE.md), the
      // PromptContext is still alive in the MCP server but the dashboard
      // store has dropped it. Re-register so /health.active_sessions
      // reflects the resumed session immediately.
      if (hasActiveSession(target.promptId)) {
        touchActiveSession(target.promptId, now);
      } else {
        registerActiveSession({
          promptId: target.promptId,
          connectionId: target.connectionId,
          client: target.client,
          project: target.project,
          title: target.title,
          startedAt: target.startedAt.getTime(),
          parentPromptId: target === ctx ? null : ctx.promptId,
          sessionDepth: target.sessionDepth,
        });
      }

      const activeDurationMs = Math.max(
        0,
        now - target.startedAt.getTime() - target.idleMs - target.childPausedMs,
      );
      const activeDurationMin = Math.round(activeDurationMs / 60000);
      const depthInfo =
        target.sessionDepth > 0 ? ` (depth ${target.sessionDepth})` : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `Heartbeat recorded${depthInfo}. Active Duration: ${activeDurationMin}min.`,
          },
        ],
      };
    },
  );
}
