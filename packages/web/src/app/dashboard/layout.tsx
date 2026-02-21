'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import Link from 'next/link';
import { LayoutDashboard, Settings, LogOut } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token, user, hydrate, logout } = useAuthStore();

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    // Wait for hydration, then check auth
    const timer = setTimeout(() => {
      if (!useAuthStore.getState().token) {
        router.push('/login');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [router]);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <nav className="flex items-center justify-between max-w-[1000px] mx-auto px-6 py-4 border-b border-border/50">
        <Link href="/dashboard" className="text-xl font-black tracking-tight text-text-primary">
          use<span className="text-accent">AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-primary transition-colors"
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            Dashboard
          </Link>
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-text-primary transition-colors"
          >
            <Settings className="w-3.5 h-3.5" />
            Settings
          </Link>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-error transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </nav>
      <div className="max-w-[1000px] mx-auto px-6 py-6">
        {children}
      </div>
    </div>
  );
}
