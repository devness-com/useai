import { Hono } from "hono";
import type { Session } from "@devness/useai-types";
import {
  parseTimeRange,
  getFilteredSessions,
  toCamelEvaluation,
  toEnrichedMilestones,
  type EnrichedMilestone,
} from "../lib/sessions.js";
import {
  groupPromptsWithMilestones,
  groupIntoConversations,
} from "../lib/stats.js";

export const promptsRoutes = new Hono();

function matchesSearch(session: Session, term: string): boolean {
  const lower = term.toLowerCase();
  if (session.promptId?.toLowerCase().includes(lower)) return true;
  if (session.connectionId?.toLowerCase().includes(lower)) return true;
  if (session.title?.toLowerCase().includes(lower)) return true;
  if (session.privateTitle?.toLowerCase().includes(lower)) return true;
  if (session.taskType?.toLowerCase().includes(lower)) return true;
  if (session.languages?.some((l: string) => l.toLowerCase().includes(lower)))
    return true;
  if (session.project?.toLowerCase().includes(lower)) return true;
  if (session.client?.toLowerCase().includes(lower)) return true;
  if (session.milestones?.some((m) => m.id?.toLowerCase().includes(lower)))
    return true;
  return false;
}

promptsRoutes.get("/", async (c) => {
  const range = parseTimeRange(c.req.query("start"), c.req.query("end"));
  if (!range) {
    return c.json(
      { error: "start and end query params required (ISO string)" },
      400,
    );
  }

  const offset = Math.max(0, Number(c.req.query("offset") ?? 0));
  const limit = Math.min(50, Math.max(50, Number(c.req.query("limit") ?? 50)));
  const toolFilter = c.req.query("tool") ?? null;
  const languageFilter = c.req.query("language") ?? null;
  const projectFilter = c.req.query("project") ?? null;
  const searchTerm = c.req.query("search") ?? null;

  const windowFiltered = await getFilteredSessions(range.start, range.end);

  // Apply filters
  let filtered = windowFiltered;

  if (toolFilter) {
    filtered = filtered.filter(
      (s) => s.client?.toLowerCase() === toolFilter.toLowerCase(),
    );
  }

  if (languageFilter) {
    const lang = languageFilter.toLowerCase();
    filtered = filtered.filter((s) =>
      s.languages?.some((l: string) => l.toLowerCase() === lang),
    );
  }

  if (projectFilter) {
    filtered = filtered.filter(
      (s) => s.project?.toLowerCase() === projectFilter.toLowerCase(),
    );
  }

  if (searchTerm) {
    filtered = filtered.filter((s) => matchesSearch(s, searchTerm));
  }

  // Convert evaluation to camelCase for API response
  const camelFiltered = filtered.map((s) => ({
    ...s,
    evaluation: s.evaluation ? toCamelEvaluation(s.evaluation) : undefined,
  })) as unknown as Session[];

  // Enrich milestones with parent session metadata
  const enrichedMilestones: EnrichedMilestone[] = camelFiltered.flatMap(toEnrichedMilestones);

  // Group into {prompt, milestones} as expected by the dashboard
  const promptsWithMilestones = groupPromptsWithMilestones(
    camelFiltered,
    enrichedMilestones,
  );

  const conversations = groupIntoConversations(promptsWithMilestones);

  // Paginate
  const total = conversations.length;
  const paginated = conversations.slice(offset, offset + limit);

  return c.json({
    total,
    conversations: paginated,
    hasMore: offset + limit < total,
  });
});
