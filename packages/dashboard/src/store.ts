import { create } from 'zustand';
import type { SessionSeal, Milestone, LocalConfig, HealthInfo, UpdateInfo } from './lib/api';
import { fetchSessions, fetchMilestones, fetchConfig, fetchHealth, fetchUpdateCheck, deleteSession as apiDeleteSession, deleteConversation as apiDeleteConversation, deleteMilestone as apiDeleteMilestone } from './lib/api';
import type { TimeScale, Filters, ActiveTab } from '@useai/ui';
import { SCALE_MS, ALL_SCALES } from '@useai/ui';

export type { TimeScale, Filters, ActiveTab };
export { SCALE_MS };

export interface DashboardState {
  sessions: SessionSeal[];
  milestones: Milestone[];
  config: LocalConfig | null;
  health: HealthInfo | null;
  updateInfo: UpdateInfo | null;
  loading: boolean;
  timeTravelTime: number | null; // null = live
  timeScale: TimeScale;
  filters: Filters;
  activeTab: ActiveTab;

  loadAll: () => Promise<void>;
  loadHealth: () => Promise<void>;
  loadUpdateCheck: () => Promise<void>;
  setTimeTravelTime: (t: number | null) => void;
  setTimeScale: (s: TimeScale) => void;
  setFilter: (key: keyof Filters, value: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
  deleteSession: (sessionId: string) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  deleteMilestone: (milestoneId: string) => Promise<void>;
}

// Track IDs with in-flight delete operations so loadAll doesn't resurrect them
let pendingDeletes = new Set<string>();

export const useDashboardStore = create<DashboardState>((set, get) => ({
  sessions: [],
  milestones: [],
  config: null,
  health: null,
  updateInfo: null,
  loading: true,
  timeTravelTime: null,
  timeScale: (() => {
    try {
      const saved = localStorage.getItem('useai-time-scale');
      const valid: TimeScale[] = [...ALL_SCALES];
      if (saved && valid.includes(saved as TimeScale)) return saved as TimeScale;
    } catch { /* ignore */ }
    return 'day' as TimeScale;
  })(),
  filters: { category: 'all', client: 'all', project: 'all', language: 'all' },
  activeTab: (() => {
    try {
      const saved = localStorage.getItem('useai-active-tab');
      if (saved === 'sessions' || saved === 'insights' || saved === 'settings') return saved;
    } catch { /* ignore */ }
    return 'sessions' as ActiveTab;
  })(),
  loadAll: async () => {
    try {
      const [sessions, milestones, config] = await Promise.all([
        fetchSessions(),
        fetchMilestones(),
        fetchConfig(),
      ]);
      // Filter out sessions/milestones with in-flight deletes so auto-refresh doesn't resurrect them
      set({
        sessions: pendingDeletes.size > 0 ? sessions.filter(s => !pendingDeletes.has(s.session_id)) : sessions,
        milestones: pendingDeletes.size > 0 ? milestones.filter(m => !pendingDeletes.has(m.session_id)) : milestones,
        config,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  loadHealth: async () => {
    try {
      const health = await fetchHealth();
      set({ health });
    } catch { /* ignore */ }
  },

  loadUpdateCheck: async () => {
    try {
      const updateInfo = await fetchUpdateCheck();
      set({ updateInfo });
    } catch { /* ignore */ }
  },

  setTimeTravelTime: (t) => set({ timeTravelTime: t }),

  setTimeScale: (s) => {
    try { localStorage.setItem('useai-time-scale', s); } catch { /* ignore */ }
    set({ timeScale: s });
  },

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  setActiveTab: (tab) => {
    try { localStorage.setItem('useai-active-tab', tab); } catch { /* ignore */ }
    set({ activeTab: tab });
  },

  deleteSession: async (sessionId) => {
    pendingDeletes.add(sessionId);
    set({
      sessions: get().sessions.filter(s => s.session_id !== sessionId),
      milestones: get().milestones.filter(m => m.session_id !== sessionId),
    });
    try {
      await apiDeleteSession(sessionId);
    } catch (err) {
      console.error('Failed to delete session:', sessionId, err);
      // Re-fetch to get the actual server state instead of blindly reverting
      get().loadAll();
    } finally {
      pendingDeletes.delete(sessionId);
    }
  },

  deleteConversation: async (conversationId) => {
    const sessionIds = new Set(get().sessions.filter(s => s.conversation_id === conversationId).map(s => s.session_id));
    for (const id of sessionIds) pendingDeletes.add(id);
    set({
      sessions: get().sessions.filter(s => s.conversation_id !== conversationId),
      milestones: get().milestones.filter(m => !sessionIds.has(m.session_id)),
    });
    try {
      await apiDeleteConversation(conversationId);
    } catch (err) {
      console.error('Failed to delete conversation:', conversationId, err);
      get().loadAll();
    } finally {
      for (const id of sessionIds) pendingDeletes.delete(id);
    }
  },

  deleteMilestone: async (milestoneId) => {
    set({ milestones: get().milestones.filter(m => m.id !== milestoneId) });
    try {
      await apiDeleteMilestone(milestoneId);
    } catch (err) {
      console.error('Failed to delete milestone:', milestoneId, err);
      get().loadAll();
    }
  },
}));
