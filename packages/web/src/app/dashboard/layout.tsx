'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { useDashboardStore } from '@/store/dashboard-store';
import Link from 'next/link';
import { Search, Sparkles } from 'lucide-react';
import { UseAILogo, TabBar, SearchOverlay } from '@useai/ui';
import type { ExternalNavLink } from '@useai/ui';
import { ProfileDropdown } from '@/components/ProfileDropdown';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, user, hydrate, logout } = useAuthStore();
  const { sessions, milestones, activeTab, setActiveTab } = useDashboardStore();
  const isDashboardRoot = pathname === '/dashboard';
  const [searchOpen, setSearchOpen] = useState(false);

  const webLinks = useMemo<ExternalNavLink[] | undefined>(() => {
    if (!user?.username) return undefined;
    return [
      { label: 'Leaderboard', href: '/leaderboard' },
      { label: 'Profile', href: `/${user.username}` },
    ];
  }, [user?.username]);

  const showClaimHint = !user?.username;

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

  // Cmd+K / Ctrl+K to toggle search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-base">
        <div className="text-text-muted text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-base">
      <header className="sticky top-0 z-50 bg-bg-base/80 backdrop-blur-md border-b border-border mb-6">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between relative">
          <Link href="/dashboard" className="flex items-center gap-3">
            <UseAILogo className="h-6" />
          </Link>

          {isDashboardRoot && (
            <div className="absolute left-1/2 -translate-x-1/2">
              <TabBar activeTab={activeTab} onTabChange={setActiveTab} externalLinks={webLinks} />
            </div>
          )}

          <div className="flex items-center gap-4">
            {showClaimHint && (
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/25 text-[11px] font-medium text-accent hover:bg-accent/15 transition-colors"
              >
                <Sparkles className="w-3 h-3" />
                Claim your username
              </Link>
            )}
            <button
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/50 bg-bg-surface-1 text-text-muted hover:text-text-primary hover:border-text-muted/50 transition-colors text-xs"
            >
              <Search className="w-3 h-3" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-flex items-center px-1 py-0.5 rounded border border-border bg-bg-base text-[9px] font-mono leading-none">
                ⌘K
              </kbd>
            </button>
            <ProfileDropdown
              email={user?.email}
              username={user?.username}
              onLogout={logout}
            />
          </div>
        </div>
      </header>
      <SearchOverlay
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        sessions={sessions}
        milestones={milestones}
      />
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pb-6">
        {children}
      </div>
    </div>
  );
}
