import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  readJson,
  writeJson,
  SESSIONS_FILE,
  MILESTONES_FILE,
  CONFIG_FILE,
  SEALED_DIR,
} from '@useai/shared';
import type { SessionSeal, Milestone, UseaiConfig } from '@useai/shared';

// ── Helpers ─────────────────────────────────────────────────────────────────────

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(body);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

/** Deduplicate sessions by session_id, keeping the longest (latest sealed) entry */
function deduplicateSessions(sessions: SessionSeal[]): SessionSeal[] {
  const map = new Map<string, SessionSeal>();
  for (const s of sessions) {
    const existing = map.get(s.session_id);
    if (!existing || s.duration_seconds > existing.duration_seconds) {
      map.set(s.session_id, s);
    }
  }
  return [...map.values()];
}

function calculateStreak(sessions: SessionSeal[]): number {
  if (sessions.length === 0) return 0;

  const days = new Set<string>();
  for (const s of sessions) {
    days.add(s.started_at.slice(0, 10));
  }

  const sorted = [...days].sort().reverse();
  if (sorted.length === 0) return 0;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (sorted[0] !== today && sorted[0] !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]!);
    const curr = new Date(sorted[i]!);
    const diffDays = (prev.getTime() - curr.getTime()) / 86400000;
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

// ── Sessions ─────────────────────────────────────────────────────────────────────

export function handleLocalSessions(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const sessions = deduplicateSessions(readJson<SessionSeal[]>(SESSIONS_FILE, []));
    json(res, 200, sessions);
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

// ── Stats ───────────────────────────────────────────────────────────────────────

export function handleLocalStats(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const sessions = deduplicateSessions(readJson<SessionSeal[]>(SESSIONS_FILE, []));

    let totalSeconds = 0;
    let filesTouched = 0;
    const byClient: Record<string, number> = {};
    const byLanguage: Record<string, number> = {};
    const byTaskType: Record<string, number> = {};

    for (const s of sessions) {
      totalSeconds += s.duration_seconds;
      filesTouched += s.files_touched;

      byClient[s.client] = (byClient[s.client] ?? 0) + s.duration_seconds;

      for (const lang of s.languages) {
        byLanguage[lang] = (byLanguage[lang] ?? 0) + s.duration_seconds;
      }

      byTaskType[s.task_type] = (byTaskType[s.task_type] ?? 0) + s.duration_seconds;
    }

    json(res, 200, {
      totalHours: totalSeconds / 3600,
      totalSessions: sessions.length,
      currentStreak: calculateStreak(sessions),
      filesTouched,
      byClient,
      byLanguage,
      byTaskType,
    });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

// ── Milestones ──────────────────────────────────────────────────────────────────

export function handleLocalMilestones(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const milestones = readJson<Milestone[]>(MILESTONES_FILE, []);
    json(res, 200, milestones);
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

// ── Config ──────────────────────────────────────────────────────────────────────

export function handleLocalConfig(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const config = readJson<UseaiConfig>(CONFIG_FILE, {
      milestone_tracking: true,
      auto_sync: false,
      sync_interval_hours: 24,
    } as UseaiConfig);

    json(res, 200, {
      authenticated: !!config.auth?.token,
      email: config.auth?.user?.email ?? null,
      username: config.auth?.user?.username ?? null,
      last_sync_at: config.last_sync_at ?? null,
      auto_sync: config.auto_sync,
    });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

// ── Sync ────────────────────────────────────────────────────────────────────────

export async function handleLocalSync(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    // Consume body (even if empty) to prevent connection issues
    await readBody(req);

    const config = readJson<UseaiConfig>(CONFIG_FILE, {
      milestone_tracking: true,
      auto_sync: false,
      sync_interval_hours: 24,
    } as UseaiConfig);

    if (!config.auth?.token) {
      json(res, 401, { success: false, error: 'Not authenticated. Login at useai.dev first.' });
      return;
    }

    const token = config.auth.token;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };

    // Group sessions by date and build per-day sync payloads
    const sessions = deduplicateSessions(readJson<SessionSeal[]>(SESSIONS_FILE, []));
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

      const payload = {
        date,
        total_seconds: totalSeconds,
        clients,
        task_types: taskTypes,
        languages,
        sessions: daySessions,
        sync_signature: '',
      };

      const sessionsRes = await fetch(`${USEAI_API}/api/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!sessionsRes.ok) {
        const errBody = await sessionsRes.text();
        json(res, 502, { success: false, error: `Sessions sync failed (${date}): ${sessionsRes.status} ${errBody}` });
        return;
      }
    }

    // Publish milestones
    const MILESTONE_CHUNK = 50;
    const milestones = readJson<Milestone[]>(MILESTONES_FILE, []);

    for (let i = 0; i < milestones.length; i += MILESTONE_CHUNK) {
      const chunk = milestones.slice(i, i + MILESTONE_CHUNK);
      const milestonesRes = await fetch(`${USEAI_API}/api/publish`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ milestones: chunk }),
      });

      if (!milestonesRes.ok) {
        const errBody = await milestonesRes.text();
        json(res, 502, { success: false, error: `Milestones publish failed (chunk ${Math.floor(i / MILESTONE_CHUNK) + 1}): ${milestonesRes.status} ${errBody}` });
        return;
      }
    }

    // Update last_sync_at
    const now = new Date().toISOString();
    config.last_sync_at = now;
    writeJson(CONFIG_FILE, config);

    json(res, 200, { success: true, last_sync_at: now });
  } catch (err) {
    json(res, 500, { success: false, error: (err as Error).message });
  }
}

// ── Auth (proxy to useai.dev API) ────────────────────────────────────────────

const USEAI_API = process.env.USEAI_API_URL || 'https://api.useai.dev';

export async function handleLocalSendOtp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};

    const apiRes = await fetch(`${USEAI_API}/api/auth/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email }),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      json(res, apiRes.status, data);
      return;
    }

    json(res, 200, data);
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

export async function handleLocalVerifyOtp(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};

    const apiRes = await fetch(`${USEAI_API}/api/auth/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email, code: body.code }),
    });

    const data = await apiRes.json() as { token?: string; user?: { id: string; email: string; username?: string } };

    if (!apiRes.ok) {
      json(res, apiRes.status, data);
      return;
    }

    // Save auth to config
    if (data.token && data.user) {
      const config = readJson<UseaiConfig>(CONFIG_FILE, {
        milestone_tracking: true,
        auto_sync: true,
        sync_interval_hours: 24,
      } as UseaiConfig);

      config.auth = {
        token: data.token,
        user: {
          id: data.user.id,
          email: data.user.email,
          username: data.user.username,
        },
      };

      writeJson(CONFIG_FILE, config);
    }

    json(res, 200, { success: true, email: data.user?.email, username: data.user?.username });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

// ── Save Auth (used by dev dashboard to save token after direct cloud auth) ──

export async function handleLocalSaveAuth(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};

    if (!body.token || !body.user) {
      json(res, 400, { error: 'Missing token or user' });
      return;
    }

    const config = readJson<UseaiConfig>(CONFIG_FILE, {
      milestone_tracking: true,
      auto_sync: true,
      sync_interval_hours: 24,
    } as UseaiConfig);

    config.auth = {
      token: body.token,
      user: {
        id: body.user.id,
        email: body.user.email,
        username: body.user.username,
      },
    };

    writeJson(CONFIG_FILE, config);
    json(res, 200, { success: true });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

// ── Auth Token (returns saved token for dev sync) ────────────────────────────

export function handleLocalAuthToken(_req: IncomingMessage, res: ServerResponse): void {
  try {
    const config = readJson<UseaiConfig>(CONFIG_FILE, {} as UseaiConfig);
    json(res, 200, { token: config.auth?.token ?? null });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

// ── Sync Mark (updates last_sync_at without actually syncing) ────────────────

export async function handleLocalSyncMark(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await readBody(req);
    const config = readJson<UseaiConfig>(CONFIG_FILE, {} as UseaiConfig);
    config.last_sync_at = new Date().toISOString();
    writeJson(CONFIG_FILE, config);
    json(res, 200, { success: true, last_sync_at: config.last_sync_at });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

// ── Logout ───────────────────────────────────────────────────────────────────

export async function handleLocalLogout(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    await readBody(req);

    const config = readJson<UseaiConfig>(CONFIG_FILE, {
      milestone_tracking: true,
      auto_sync: false,
      sync_interval_hours: 24,
    } as UseaiConfig);

    delete config.auth;
    writeJson(CONFIG_FILE, config);

    json(res, 200, { success: true });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

// ── User Profile (proxy to useai.dev API) ────────────────────────────────────

export async function handleLocalCheckUsername(
  _req: IncomingMessage,
  res: ServerResponse,
  username: string,
): Promise<void> {
  try {
    const config = readJson<UseaiConfig>(CONFIG_FILE, {} as UseaiConfig);
    if (!config.auth?.token) {
      json(res, 401, { error: 'Not authenticated' });
      return;
    }

    const apiRes = await fetch(
      `${USEAI_API}/api/users/check-username/${encodeURIComponent(username)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${config.auth.token}` },
      },
    );

    const data = await apiRes.json();
    json(res, apiRes.ok ? 200 : apiRes.status, data);
  } catch (err) {
    const status = (err as Error).message.includes('fetch') ? 502 : 500;
    json(res, status, { error: (err as Error).message });
  }
}

export async function handleLocalUpdateUser(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  try {
    const raw = await readBody(req);
    const body = raw ? JSON.parse(raw) : {};

    const config = readJson<UseaiConfig>(CONFIG_FILE, {} as UseaiConfig);
    if (!config.auth?.token) {
      json(res, 401, { error: 'Not authenticated' });
      return;
    }

    const apiRes = await fetch(`${USEAI_API}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.auth.token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await apiRes.json() as Record<string, unknown>;

    if (apiRes.ok && data['username'] && config.auth.user) {
      config.auth.user.username = data['username'] as string;
      writeJson(CONFIG_FILE, config);
    }

    json(res, apiRes.ok ? 200 : apiRes.status, data);
  } catch (err) {
    const status = (err as Error).message.includes('fetch') ? 502 : 500;
    json(res, status, { error: (err as Error).message });
  }
}

// ── Delete Handlers ──────────────────────────────────────────────────────────

export function handleDeleteSession(req: IncomingMessage, res: ServerResponse, sessionId: string): void {
  try {
    // Remove session from sessions.json
    const sessions = readJson<SessionSeal[]>(SESSIONS_FILE, []);
    const idx = sessions.findIndex(s => s.session_id === sessionId);
    if (idx === -1) {
      json(res, 404, { error: 'Session not found' });
      return;
    }
    sessions.splice(idx, 1);
    writeJson(SESSIONS_FILE, sessions);

    // Remove milestones for this session
    const milestones = readJson<Milestone[]>(MILESTONES_FILE, []);
    const remaining = milestones.filter(m => m.session_id !== sessionId);
    const milestonesRemoved = milestones.length - remaining.length;
    if (milestonesRemoved > 0) writeJson(MILESTONES_FILE, remaining);

    // Delete chain file
    const chainPath = join(SEALED_DIR, `${sessionId}.jsonl`);
    if (existsSync(chainPath)) unlinkSync(chainPath);

    json(res, 200, { deleted: true, session_id: sessionId, milestones_removed: milestonesRemoved });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

export function handleDeleteConversation(req: IncomingMessage, res: ServerResponse, conversationId: string): void {
  try {
    // Find all sessions with this conversation_id
    const sessions = readJson<SessionSeal[]>(SESSIONS_FILE, []);
    const toDelete = sessions.filter(s => s.conversation_id === conversationId);
    if (toDelete.length === 0) {
      json(res, 404, { error: 'Conversation not found' });
      return;
    }

    const sessionIds = new Set(toDelete.map(s => s.session_id));
    const remaining = sessions.filter(s => s.conversation_id !== conversationId);
    writeJson(SESSIONS_FILE, remaining);

    // Remove milestones for all these sessions
    const milestones = readJson<Milestone[]>(MILESTONES_FILE, []);
    const remainingMilestones = milestones.filter(m => !sessionIds.has(m.session_id));
    const milestonesRemoved = milestones.length - remainingMilestones.length;
    if (milestonesRemoved > 0) writeJson(MILESTONES_FILE, remainingMilestones);

    // Delete chain files
    for (const sid of sessionIds) {
      const chainPath = join(SEALED_DIR, `${sid}.jsonl`);
      if (existsSync(chainPath)) unlinkSync(chainPath);
    }

    json(res, 200, { deleted: true, conversation_id: conversationId, sessions_removed: sessionIds.size, milestones_removed: milestonesRemoved });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}

export function handleDeleteMilestone(req: IncomingMessage, res: ServerResponse, milestoneId: string): void {
  try {
    const milestones = readJson<Milestone[]>(MILESTONES_FILE, []);
    const idx = milestones.findIndex(m => m.id === milestoneId);
    if (idx === -1) {
      json(res, 404, { error: 'Milestone not found' });
      return;
    }
    milestones.splice(idx, 1);
    writeJson(MILESTONES_FILE, milestones);

    json(res, 200, { deleted: true, milestone_id: milestoneId });
  } catch (err) {
    json(res, 500, { error: (err as Error).message });
  }
}
