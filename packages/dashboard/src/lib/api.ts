const API = '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { message?: string }).message ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

async function del<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { method: 'DELETE' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ── Data endpoints ───────────────────────────────────────────────────────────

export interface SessionEvaluation {
  prompt_quality: number;
  prompt_quality_reason?: string;
  context_provided: number;
  context_provided_reason?: string;
  task_outcome: 'completed' | 'partial' | 'abandoned' | 'blocked';
  task_outcome_reason?: string;
  iteration_count: number;
  independence_level: number;
  independence_level_reason?: string;
  scope_quality: number;
  scope_quality_reason?: string;
  tools_leveraged: number;
}

export interface ToolOverhead {
  start: { input_tokens_est: number; output_tokens_est: number };
  end: { input_tokens_est: number; output_tokens_est: number };
  total_tokens_est: number;
}

export interface SessionSeal {
  session_id: string;
  conversation_id?: string;
  conversation_index?: number;
  client: string;
  task_type: string;
  languages: string[];
  files_touched: number;
  project?: string;
  title?: string;
  private_title?: string;
  prompt_word_count?: number;
  model?: string;
  evaluation?: SessionEvaluation;
  tool_overhead?: ToolOverhead;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
  heartbeat_count: number;
  record_count: number;
  chain_start_hash: string;
  chain_end_hash: string;
  seal_signature: string;
}

export interface Milestone {
  id: string;
  session_id: string;
  title: string;
  private_title?: string;
  project?: string;
  category: string;
  complexity: string;
  duration_minutes: number;
  languages: string[];
  client: string;
  created_at: string;
  published: boolean;
  published_at: string | null;
  chain_hash: string;
}

export interface LocalConfig {
  authenticated: boolean;
  email: string | null;
  username: string | null;
  last_sync_at: string | null;
  auto_sync: boolean;
}

export function fetchSessions(): Promise<SessionSeal[]> {
  return get('/api/local/sessions');
}

export function fetchMilestones(): Promise<Milestone[]> {
  return get('/api/local/milestones');
}

export function fetchConfig(): Promise<LocalConfig> {
  return get('/api/local/config');
}

// ── Update check ─────────────────────────────────────────────────────────────

export interface UpdateInfo {
  current: string;
  latest: string;
  update_available: boolean;
}

export function fetchUpdateCheck(): Promise<UpdateInfo> {
  return get('/api/local/update-check');
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
  return get('/health');
}

// ── Auth/Sync ────────────────────────────────────────────────────────────────

export function postSendOtp(email: string): Promise<{ message: string }> {
  return post('/api/local/auth/send-otp', { email });
}

export function postVerifyOtp(email: string, code: string): Promise<{ success: boolean; email?: string; username?: string }> {
  return post('/api/local/auth/verify-otp', { email, code });
}

export function postSync(): Promise<{ success: boolean; last_sync_at?: string; error?: string }> {
  return post('/api/local/sync');
}

// ── Delete ────────────────────────────────────────────────────────────────────

export function deleteSession(sessionId: string): Promise<{ deleted: boolean; session_id: string; milestones_removed: number }> {
  return del(`/api/local/sessions/${encodeURIComponent(sessionId)}`);
}

export function deleteConversation(conversationId: string): Promise<{ deleted: boolean; conversation_id: string; sessions_removed: number; milestones_removed: number }> {
  return del(`/api/local/conversations/${encodeURIComponent(conversationId)}`);
}

export function deleteMilestone(milestoneId: string): Promise<{ deleted: boolean; milestone_id: string }> {
  return del(`/api/local/milestones/${encodeURIComponent(milestoneId)}`);
}
