import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { configRoutes } from "../routes/config.js";
import { healthRoutes } from "../routes/health.js";
import { mcpRoutes } from "../routes/mcp.js";
import { authRoutes } from "../routes/auth.js";
import { syncRouteRoutes } from "../routes/sync-route.js";
import { updateRoutes } from "../routes/update.js";
import { orgsRoutes } from "../routes/orgs.js";
import { usersRoutes } from "../routes/users.js";
import { aggregationsRoutes } from "../routes/aggregations.js";
import { promptsRoutes } from "../routes/prompts.js";
import { logsRoutes } from "../routes/logs.js";
import { activeSessionsRoutes } from "../routes/active-sessions.js";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function resolveDashboardDir(): string {
  // Production: dashboard dist is copied next to the bundled cli.js
  // (publish.mjs copies packages/dashboard/dist/** into packages/useai/dist/dashboard/)
  const bundled = resolve(__dirname, "dashboard");
  if (existsSync(bundled)) return bundled;
  // Dev: monorepo layout — daemon dist is at packages/daemon/dist/core/router.js
  return resolve(__dirname, "../../../dashboard/dist");
}

export function createApp(): Hono {
  const app = new Hono();

  app.use("/*", cors({ origin: "*" }));

  app.route("/mcp", mcpRoutes);
  app.route("/api/local/aggregations", aggregationsRoutes);
  app.route("/api/local/prompts", promptsRoutes);
  app.route("/api/local/config", configRoutes);
  app.route("/api/local/auth", authRoutes);
  app.route("/api/local/sync", syncRouteRoutes);
  app.route("/api/local/orgs", orgsRoutes);
  app.route("/api/local/users", usersRoutes);
  app.route("/api/local/logs", logsRoutes);
  app.route("/api/local/active-sessions", activeSessionsRoutes);
  app.route("/api/local/update-check", updateRoutes);
  app.route("/", healthRoutes);

  // DELETE /api/local/conversations/:id — deletes all sessions sharing a conversation_id
  // In v3, conversation_id is not stored, so we just return success (optimistic delete handles UI)
  app.delete("/api/local/conversations/:id", async (c) => {
    const conversationId = c.req.param("id");
    // v3 sessions don't have conversation_id — no-op, optimistic delete already updated the UI
    return c.json({
      deleted: true,
      conversation_id: conversationId,
      sessions_removed: 0,
      milestones_removed: 0,
    });
  });

  // Serve dashboard SPA from the built dist directory
  app.use("/*", serveStatic({ root: resolveDashboardDir() }));

  return app;
}
