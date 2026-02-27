const API = '';

// In dev mode (Vite on :5174), cloud API calls go through /cloud-api proxy → localhost:3010
// In production (embedded in daemon on :19200), they go through the daemon's /api/local/* handlers
const isDev = import.meta.env.DEV;

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

async function patch<T>(path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (isDev) {
    const token = localStorage.getItem('useai_dev_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: Object.keys(headers).length > 0 ? headers : undefined,
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
  prompt?: string;
  prompt_image_count?: number;
  prompt_images?: Array<{ type: 'image'; description: string }>;
  prompt_word_count?: number;
  model?: string;
  evaluation?: SessionEvaluation;
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

export async function fetchConfig(): Promise<LocalConfig> {
  const config = await get<LocalConfig>('/api/local/config');
  // In dev mode, auth goes directly to cloud API and state is in localStorage
  if (isDev && localStorage.getItem('useai_dev_token')) {
    config.authenticated = true;
    config.email = localStorage.getItem('useai_dev_email') ?? config.email;
    config.username = localStorage.getItem('useai_dev_username') || config.username;
  }
  return config;
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
// Dev:  /cloud-api/api/auth/* → Vite proxy → localhost:3010/api/auth/*
// Prod: /api/local/auth/*     → daemon     → api.useai.dev/api/auth/*

export function postSendOtp(email: string): Promise<{ message: string }> {
  if (isDev) return post('/cloud-api/api/auth/send-otp', { email });
  return post('/api/local/auth/send-otp', { email });
}

export async function postVerifyOtp(email: string, code: string): Promise<{ success: boolean; email?: string; username?: string }> {
  if (isDev) {
    // Call cloud API directly, store token locally for dev sync
    const data = await post<{ token: string; user: { id: string; email: string; username?: string } }>(
      '/cloud-api/api/auth/verify-otp',
      { email, code },
    );
    localStorage.setItem('useai_dev_token', data.token);
    localStorage.setItem('useai_dev_email', data.user.email);
    localStorage.setItem('useai_dev_username', data.user.username ?? '');
    return { success: true, email: data.user.email, username: data.user.username };
  }
  return post('/api/local/auth/verify-otp', { email, code });
}

export async function postSync(): Promise<{ success: boolean; last_sync_at?: string; error?: string }> {
  if (isDev) {
    // In dev: fetch data from daemon, sync directly to local cloud API
    const token = localStorage.getItem('useai_dev_token');
    if (!token) throw new Error('Not authenticated');

    const [sessions, milestones] = await Promise.all([fetchSessions(), fetchMilestones()]);
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

    // Group sessions by date
    const byDate = new Map<string, SessionSeal[]>();
    for (const s of sessions) {
      const date = s.started_at.slice(0, 10);
      const arr = byDate.get(date);
      if (arr) arr.push(s);
      else byDate.set(date, [s]);
    }

    for (const [date, daySessions] of byDate) {
      let totalSeconds = 0;
      const clients: Record<string, number> = {};
      const taskTypes: Record<string, number> = {};
      const languages: Record<string, number> = {};

      for (const s of daySessions) {
        totalSeconds += s.duration_seconds;
        clients[s.client] = (clients[s.client] ?? 0) + s.duration_seconds;
        taskTypes[s.task_type] = (taskTypes[s.task_type] ?? 0) + s.duration_seconds;
        for (const lang of s.languages) {
          languages[lang] = (languages[lang] ?? 0) + s.duration_seconds;
        }
      }

      const res = await fetch('/cloud-api/api/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ date, total_seconds: totalSeconds, clients, task_types: taskTypes, languages, sessions: daySessions, sync_signature: '' }),
      });
      if (!res.ok) throw new Error(`Sync failed (${date}): ${res.status}`);
    }

    // Publish milestones
    if (milestones.length > 0) {
      const res = await fetch('/cloud-api/api/publish', {
        method: 'POST',
        headers,
        body: JSON.stringify({ milestones }),
      });
      if (!res.ok) throw new Error(`Milestones publish failed: ${res.status}`);
    }

    return { success: true, last_sync_at: new Date().toISOString() };
  }
  return post('/api/local/sync');
}

export async function postLogout(): Promise<{ success: boolean }> {
  if (isDev) {
    localStorage.removeItem('useai_dev_token');
    localStorage.removeItem('useai_dev_email');
    localStorage.removeItem('useai_dev_username');
  }
  return post('/api/local/auth/logout');
}

// ── Username ──────────────────────────────────────────────────────────────────

export async function checkUsername(username: string): Promise<{ available: boolean; reason?: string }> {
  const encoded = encodeURIComponent(username);
  if (isDev) {
    const token = localStorage.getItem('useai_dev_token');
    const res = await fetch(`${API}/cloud-api/api/users/check-username/${encoded}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json() as Promise<{ available: boolean; reason?: string }>;
  }
  return get(`/api/local/users/check-username/${encoded}`);
}

export async function updateUsername(username: string): Promise<{ username: string }> {
  if (isDev) {
    const token = localStorage.getItem('useai_dev_token');
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(`${API}/cloud-api/api/users/me`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data as { message?: string }).message ?? `${res.status} ${res.statusText}`);
    }
    const data = await res.json() as { username: string };
    localStorage.setItem('useai_dev_username', data.username);
    return data;
  }
  return patch('/api/local/users/me', { username });
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

// ── Config (full) ─────────────────────────────────────────────────────────────

export interface FullConfig {
  capture: {
    prompt: boolean;
    prompt_images: boolean;
    evaluation: boolean;
    evaluation_reasons: 'all' | 'below_perfect' | 'none';
    milestones: boolean;
  };
  sync: {
    enabled: boolean;
    interval_hours: number;
    include: {
      sessions: boolean;
      evaluations: boolean;
      milestones: boolean;
      prompts: boolean;
      private_titles: boolean;
      projects: boolean;
      model: boolean;
      languages: boolean;
    };
  };
  evaluation_framework: string;
  authenticated: boolean;
  email: string | null;
}

export function fetchFullConfig(): Promise<FullConfig> {
  return get('/api/local/config/full');
}

export function patchConfig(updates: Record<string, unknown>): Promise<FullConfig & { instructions_updated?: string[] }> {
  return patch('/api/local/config', updates);
}
