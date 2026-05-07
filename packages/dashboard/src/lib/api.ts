async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method: "POST" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${path}`, opts);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { message?: string }).message ??
        `${res.status} ${res.statusText}`,
    );
  }
  return res.json() as Promise<T>;
}

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const opts: RequestInit = { method: "PATCH" };
  if (body) {
    opts.headers = { "Content-Type": "application/json" };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(`${path}`, opts);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { message?: string }).message ??
        `${res.status} ${res.statusText}`,
    );
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${path}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error ?? `${res.status} ${res.statusText}`,
    );
  }
  return res.json() as Promise<T>;
}

// ── Data endpoints ───────────────────────────────────────────────────────────

export interface SessionEvaluation {
  promptQuality: number;
  promptQualityReason?: string;
  promptQualityIdeal?: string;
  contextProvided: number;
  contextProvidedReason?: string;
  contextProvidedIdeal?: string;
  taskOutcome: "completed" | "partial" | "abandoned" | "blocked";
  taskOutcomeReason?: string;
  taskOutcomeIdeal?: string;
  iterationCount: number;
  independenceLevel: number;
  independenceLevelReason?: string;
  independenceLevelIdeal?: string;
  scopeQuality: number;
  scopeQualityReason?: string;
  scopeQualityIdeal?: string;
  toolsLeveraged: number;
}

export interface SessionSeal {
  promptId: string;
  connectionId?: string;
  conversationIndex?: number;
  client: string;
  taskType: string;
  languages: string[];
  filesTouched: number;
  project?: string;
  title?: string;
  privateTitle?: string;
  prompt?: string;
  promptImageCount?: number;
  promptImages?: Array<{ type: "image"; description: string }>;
  promptWordCount?: number;
  model?: string;
  evaluation?: SessionEvaluation;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  /** Active time segments as [isoStart, isoEnd] pairs. When present, used for accurate User Time union. */
  activeSegments?: [string, string][];
  heartbeatCount: number;
  recordCount: number;
  chainStartHash: string;
  chainEndHash: string;
  sealSignature: string;
}

export interface Milestone {
  id: string;
  promptId: string;
  title: string;
  privateTitle?: string;
  project?: string;
  category: string;
  complexity: string;
  durationMinutes: number;
  languages: string[];
  client: string;
  createdAt: string;
  published: boolean;
  publishedAt: string | null;
  chainHash: string;
}

export interface LocalConfig {
  mode: "local" | "cloud";
  authenticated: boolean;
  email: string | null;
  username: string | null;
  lastSyncAt: string | null;
  autoSync: boolean;
}

// ── Server-side computed endpoints ────────────────────────────────────────

export interface StreakDetail {
  current: number;
  longest: number;
  freezesUsed: number;
  freezesRemaining: number;
  activeDaysInWindow: number;
  windowDays: number;
}

export interface DashboardResponse {
  window: { start: number; end: number; scale: string };
  streak?: StreakDetail;
  stats: {
    totalHours: number;
    totalSessions: number;
    coveredHours: number;
    aiMultiplier: number;
    peakConcurrency: number;
    currentStreak: number;
    filesTouched: number;
    featuresShipped: number;
    bugsFixed: number;
    complexSolved: number;
    totalMilestones: number;
    completionRate: number;
    activeProjects: number;
    byToolClockTime: Record<string, number>;
    byLanguageClockTime: Record<string, number>;
    byTaskTypeClockTime: Record<string, number>;
    byProjectAiTime: Record<string, number>;
    byProjectClock: Record<string, number>;
    byAiToolDuration: Record<string, number>;
    byLanguageAiTime: Record<string, number>;
    byTaskTypeAiTime: Record<string, number>;
  };
  evaluation: {
    sessionCount: number;
    promptQuality: number;
    contextProvided: number;
    scopeQuality: number;
    independenceLevel: number;
  } | null;
  sessionCount: number;
  milestoneCount: number;
  complexity: { simple: number; medium: number; complex: number };
  sessions: SessionSeal[];
  milestones: Milestone[];
  activity: {
    hourlyClockTime: Array<{ hour: number; minutes: number }>;
    hourlyAiTime: Array<{ hour: number; minutes: number }>;
    dailyClockTime: Array<{ date: string; hours: number }>;
    dailyAiTime: Array<{ date: string; hours: number }>;
    weeklyClockTime: Array<{ label: string; hours: number }>;
    weeklyAiTime: Array<{ label: string; hours: number }>;
    monthlyClockTime: Array<{ label: string; hours: number }>;
    monthlyAiTime: Array<{ label: string; hours: number }>;
    effectiveDate: string;
  };
}

export interface FeedConversation {
  connectionId: string;
  prompts: Array<{
    prompt: SessionSeal;
    milestones: Milestone[];
  }>;
  aggregateEval: {
    promptQuality: number;
    contextProvided: number;
    independenceLevel: number;
    scopeQuality: number;
    toolsLeveraged: number;
    promptCount: number;
  } | null;
  aiTime: number;
  totalMilestones: number;
  startedAt: string;
  endedAt: string;
  lastSessionAt: string;
}

export interface FeedResponse {
  total: number;
  conversations: FeedConversation[];
  hasMore: boolean;
}

export function fetchAggregations(
  start: string,
  end: string,
): Promise<DashboardResponse> {
  const params = new URLSearchParams({ start, end });
  return get(`/api/local/aggregations?${params}`);
}

export function fetchPrompts(params: {
  start: string;
  end: string;
  offset?: number | undefined;
  limit?: number | undefined;
  tool?: string | undefined;
  language?: string | undefined;
  project?: string | undefined;
  search?: string | undefined;
}): Promise<FeedResponse> {
  const qs = new URLSearchParams({ start: params.start, end: params.end });
  if (params.offset != null) qs.set("offset", String(params.offset));
  if (params.limit != null) qs.set("limit", String(params.limit));
  if (params.tool) qs.set("tool", params.tool);
  if (params.language) qs.set("language", params.language);
  if (params.project) qs.set("project", params.project);
  if (params.search) qs.set("search", params.search);
  return get(`/api/local/prompts?${qs}`);
}

export function fetchConfig(): Promise<LocalConfig> {
  return get("/api/local/config");
}

// ── Update check ─────────────────────────────────────────────────────────────

// Re-export the canonical UpdateInfo shape from the shared types package so
// the dashboard and the daemon route can never drift apart again. Historically
// this file declared its own UpdateInfo with different field names, which is
// why the "new version available" banner never rendered.
export type { UpdateInfo } from "@devness/useai-types";
import type { UpdateInfo } from "@devness/useai-types";

export function fetchUpdateCheck(): Promise<UpdateInfo> {
  return get("/api/local/update-check");
}

// ── Health ────────────────────────────────────────────────────────────────────

export interface HealthInfo {
  status: string;
  version: string;
  active_sessions: number;
  mcp_connections: number;
  uptime_seconds: number;
}

export function fetchHealth(): Promise<HealthInfo> {
  return get("/health");
}

// ── Auth/Sync ────────────────────────────────────────────────────────────────

export function postSendOtp(email: string): Promise<{ message: string }> {
  return post("/api/local/auth/send-otp", { email });
}

export async function postVerifyOtp(
  email: string,
  code: string,
): Promise<{ success: boolean; email?: string; username?: string }> {
  return post("/api/local/auth/verify-otp", { email, code });
}

export async function postSync(): Promise<{
  success: boolean;
  lastSyncAt?: string;
  error?: string;
}> {
  return post("/api/local/sync");
}

export function postLogout(): Promise<{ success: boolean }> {
  return post("/api/local/auth/logout");
}

// ── Username ──────────────────────────────────────────────────────────────────

export function checkUsername(
  username: string,
): Promise<{ available: boolean; reason?: string }> {
  return get(`/api/local/users/check-username/${encodeURIComponent(username)}`);
}

export function updateUsername(
  username: string,
): Promise<{ username: string }> {
  return patch("/api/local/users/me", { username });
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function deleteSession(sessionId: string): Promise<{
  deleted: boolean;
  session_id: string;
  milestones_removed: number;
}> {
  return del(`/api/local/sessions/${encodeURIComponent(sessionId)}`);
}

export function deleteConversation(connectionId: string): Promise<{
  deleted: boolean;
  conversation_id: string;
  sessions_removed: number;
  milestones_removed: number;
}> {
  return del(`/api/local/conversations/${encodeURIComponent(connectionId)}`);
}

export function deleteMilestone(
  milestoneId: string,
): Promise<{ deleted: boolean; milestone_id: string }> {
  return del(`/api/local/milestones/${encodeURIComponent(milestoneId)}`);
}

// ── Config (full) ─────────────────────────────────────────────────────────────

export interface FullConfig {
  mode: "local" | "cloud";
  capture: {
    prompt: boolean;
    promptImages: boolean;
  };
  sync: {
    leaderboardStats: boolean;
    evaluationReasons: "none" | "belowPerfect" | "all";
    autoSync: boolean;
    intervalHours: number;
  };
  authenticated: boolean;
  email: string | null;
}

// ── Organizations ─────────────────────────────────────────────────────────

export interface UserOrg {
  org: { id: string; name: string; slug: string };
  role: string;
}

export function fetchMyOrgs(): Promise<UserOrg[]> {
  return get("/api/local/orgs");
}

// ── Sync Logs ─────────────────────────────────────────────────────────────

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  event: "sync" | "auto_sync" | "login" | "logout" | "cloud_pull";
  status: "success" | "error" | "info";
  message: string;
  details?: {
    sessions_synced?: number;
    milestones_published?: number;
    dates_synced?: number;
    error?: string;
    [key: string]: unknown;
  };
  payload?: {
    method: string;
    endpoint: string;
    body: unknown;
  };
}

export function fetchLogs(): Promise<SyncLogEntry[]> {
  return get("/api/local/logs");
}

export function fetchFullConfig(): Promise<FullConfig> {
  return get("/api/local/config/full");
}

export function patchConfig(
  updates: Record<string, unknown>,
): Promise<FullConfig & { instructionsUpdated?: string[] }> {
  return patch("/api/local/config", updates);
}
