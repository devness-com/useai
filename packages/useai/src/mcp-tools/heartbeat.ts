import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { PromptContext } from "../core/prompt-context.js";
import { touchActivity, resolveSession } from "../core/prompt-context.js";
import { touchActiveSession } from "../daemon/core/active-sessions.js";

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
      touchActiveSession(target.promptId, now);

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
