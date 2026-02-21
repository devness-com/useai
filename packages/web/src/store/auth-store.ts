import { create } from 'zustand';

interface User {
  id: string;
  email: string;
  username?: string;
  display_name?: string;
  bio?: string;
  avatar_url?: string;
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  hydrate: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('useai_token', token);
    localStorage.setItem('useai_user', JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    localStorage.removeItem('useai_token');
    localStorage.removeItem('useai_user');
    set({ token: null, user: null });
  },
  hydrate: () => {
    try {
      const token = localStorage.getItem('useai_token');
      const userStr = localStorage.getItem('useai_user');
      if (token && userStr) {
        set({ token, user: JSON.parse(userStr) });
      }
    } catch { /* ignore */ }
  },
}));
