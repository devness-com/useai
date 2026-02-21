import { create } from 'zustand';
import type { SessionSeal, Milestone } from '@useai/shared/types';
import type { Filters, ActiveTab, TimeScale } from '@useai/ui';
import { SCALE_MS } from '@useai/ui';
import { apiFetch } from '../lib/api-client';

interface DashboardState {
  sessions: SessionSeal[];
  milestones: Milestone[];
  loading: boolean;
  timeTravelTime: number | null;
  timeScale: TimeScale;
  filters: Filters;
  activeTab: ActiveTab;

  loadAll: () => Promise<void>;
  setTimeTravelTime: (t: number | null) => void;
  setTimeScale: (s: TimeScale) => void;
  setFilter: (key: keyof Filters, value: string) => void;
  setActiveTab: (tab: ActiveTab) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  sessions: [],
  milestones: [],
  loading: true,
  timeTravelTime: null,
  timeScale: (() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('useai-time-scale') : null;
      const valid: TimeScale[] = ['15m', '30m', '1h', '12h', '24h', '7d', '30d'];
      if (saved && valid.includes(saved as TimeScale)) return saved as TimeScale;
    } catch { /* ignore */ }
    return '7d' as TimeScale;
  })(),
  filters: { category: 'all', client: 'all', project: 'all', language: 'all' },
  activeTab: 'sessions',

  loadAll: async () => {
    try {
      const [sessions, milestones] = await Promise.all([
        apiFetch<SessionSeal[]>('/api/sync/sessions'),
        apiFetch<Milestone[]>('/api/milestones'),
      ]);
      set({ sessions, milestones, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  setTimeTravelTime: (t) => set({ timeTravelTime: t }),

  setTimeScale: (s) => {
    try { localStorage.setItem('useai-time-scale', s); } catch { /* ignore */ }
    set({ timeScale: s });
  },

  setFilter: (key, value) =>
    set((state) => ({ filters: { ...state.filters, [key]: value } })),

  setActiveTab: (tab) => set({ activeTab: tab }),
}));
