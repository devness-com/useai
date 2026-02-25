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
    return '1h' as TimeScale;
  })(),
  filters: { category: 'all', client: 'all', project: 'all', language: 'all' },
  activeTab: (() => {
    try {
      const saved = localStorage.getItem('useai-active-tab');
      if (saved === 'sessions' || saved === 'insights') return saved;
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
      set({ sessions, milestones, config, loading: false });
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
    const prev = { sessions: get().sessions, milestones: get().milestones };
    set({
      sessions: prev.sessions.filter(s => s.session_id !== sessionId),
      milestones: prev.milestones.filter(m => m.session_id !== sessionId),
    });
    try {
      await apiDeleteSession(sessionId);
    } catch {
      set(prev);
    }
  },

  deleteConversation: async (conversationId) => {
    const prev = { sessions: get().sessions, milestones: get().milestones };
    const sessionIds = new Set(prev.sessions.filter(s => s.conversation_id === conversationId).map(s => s.session_id));
    set({
      sessions: prev.sessions.filter(s => s.conversation_id !== conversationId),
      milestones: prev.milestones.filter(m => !sessionIds.has(m.session_id)),
    });
    try {
      await apiDeleteConversation(conversationId);
    } catch {
      set(prev);
    }
  },

  deleteMilestone: async (milestoneId) => {
    const prev = { milestones: get().milestones };
    set({ milestones: prev.milestones.filter(m => m.id !== milestoneId) });
    try {
      await apiDeleteMilestone(milestoneId);
    } catch {
      set(prev);
    }
  },
}));
