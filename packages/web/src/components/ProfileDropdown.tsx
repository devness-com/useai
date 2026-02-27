'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Settings, User, ChevronDown, ExternalLink } from 'lucide-react';

interface ProfileDropdownProps {
  email?: string;
  username?: string;
  onLogout: () => void;
}

export function ProfileDropdown({ email, username, onLogout }: ProfileDropdownProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Click-outside to close
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Escape to close
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleLogout = useCallback(() => {
    setOpen(false);
    onLogout();
    router.push('/login');
  }, [onLogout, router]);

  const initial = (email?.[0] ?? '?').toUpperCase();

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 rounded-full transition-colors cursor-pointer hover:opacity-80"
      >
        <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
          <span className="text-xs font-bold text-accent leading-none">
            {initial}
          </span>
        </div>
        <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg bg-bg-surface-1 border border-border shadow-lg">
          {/* User info */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
                <span className="text-sm font-bold text-accent">{initial}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-text-primary truncate">{email}</span>
                {username && (
                  <a
                    href={`/${username}`}
                    className="text-[11px] text-accent hover:text-accent-bright transition-colors flex items-center gap-1"
                    onClick={() => setOpen(false)}
                  >
                    useai.dev/{username}
                    <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Settings */}
          <div className="px-4 py-2 border-t border-border/50">
            <Link
              href="/dashboard/settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-text-primary hover:bg-bg-surface-2 transition-colors"
            >
              <Settings className="w-3.5 h-3.5" />
              Settings
            </Link>
          </div>

          {/* Sign out */}
          <div className="px-4 py-2 border-t border-border/50">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
