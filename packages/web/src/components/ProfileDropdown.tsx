'use client';

import { useState, useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Settings, ChevronDown, ExternalLink, Link as LinkIcon, Pencil, Loader2, Check, X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth-store';

const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

function sanitizeUsername(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, '');
}

function clientValidateUsername(value: string): { valid: boolean; reason?: string } {
  if (value.length === 0) return { valid: false };
  if (value.length < 3) return { valid: false, reason: 'At least 3 characters' };
  if (value.length > 32) return { valid: false, reason: 'At most 32 characters' };
  if (!USERNAME_REGEX.test(value)) return { valid: false, reason: 'No leading/trailing hyphens' };
  return { valid: true };
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function UsernameRow({ username, onSaved }: { username?: string; onSaved: () => void }) {
  const hasUsername = !!username;
  const [editing, setEditing] = useState(!hasUsername);
  const [input, setInput] = useState(username ?? '');
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [reason, setReason] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (username) {
      setEditing(false);
      setInput(username);
    }
  }, [username]);

  const handleChange = useCallback((raw: string) => {
    const value = sanitizeUsername(raw);
    setInput(value);
    setReason(undefined);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!value) {
      setStatus('idle');
      return;
    }

    const local = clientValidateUsername(value);
    if (!local.valid) {
      setStatus('invalid');
      setReason(local.reason);
      return;
    }

    if (value === username) {
      setStatus('idle');
      return;
    }

    setStatus('checking');
    debounceRef.current = setTimeout(async () => {
      try {
        const result = await apiFetch<{ available: boolean; reason?: string }>(`/api/users/check-username/${value}`);
        if (result.available) {
          setStatus('available');
          setReason(undefined);
        } else {
          setStatus('taken');
          setReason(result.reason);
        }
      } catch {
        setStatus('invalid');
        setReason('Check failed');
      }
    }, 400);
  }, [username]);

  const handleSave = useCallback(async () => {
    if (status !== 'available') return;
    setSaving(true);
    try {
      const updated = await apiFetch<any>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ username: input }),
      });
      const token = useAuthStore.getState().token;
      if (token) useAuthStore.getState().setAuth(token, updated);
      onSaved();
    } catch (err) {
      setStatus('invalid');
      setReason((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [input, status, onSaved]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setInput(username ?? '');
    setStatus('idle');
    setReason(undefined);
  }, [username]);

  const handleStartEdit = useCallback(() => {
    setEditing(true);
    setInput(username ?? '');
    setStatus('idle');
    setReason(undefined);
  }, [username]);

  if (!editing && hasUsername) {
    return (
      <div className="flex items-center gap-2">
        <LinkIcon className="w-3.5 h-3.5 text-text-muted" />
        <a
          href={`/${username}`}
          className="text-xs font-bold text-accent hover:text-accent-bright transition-colors"
        >
          useai.dev/{username}
        </a>
        <button
          onClick={handleStartEdit}
          className="p-1 rounded hover:bg-bg-surface-2 text-text-muted hover:text-text-primary transition-colors cursor-pointer"
          title="Edit username"
        >
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-text-muted whitespace-nowrap">useai.dev/</span>
      <div className="flex items-center bg-bg-base border border-border rounded-lg overflow-hidden focus-within:border-accent/50 transition-all">
        <input
          type="text"
          placeholder="username"
          value={input}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          autoFocus={editing}
          maxLength={32}
          className="px-2 py-1.5 text-xs bg-transparent text-text-primary outline-none w-28 placeholder:text-text-muted/50"
        />
      </div>
      <div className="w-4 h-4 flex items-center justify-center">
        {status === 'checking' && <Loader2 className="w-3.5 h-3.5 text-text-muted animate-spin" />}
        {status === 'available' && <Check className="w-3.5 h-3.5 text-success" />}
        {(status === 'taken' || status === 'invalid') && input.length > 0 && <X className="w-3.5 h-3.5 text-error" />}
      </div>
      <button
        onClick={handleSave}
        disabled={status !== 'available' || saving}
        className="px-3 py-1.5 bg-accent hover:bg-accent-bright text-bg-base text-[10px] font-bold uppercase tracking-wider rounded-lg transition-colors disabled:opacity-30 cursor-pointer"
      >
        {saving ? '...' : hasUsername ? 'Save' : 'Claim'}
      </button>
      {hasUsername && (
        <button
          onClick={handleCancel}
          className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted hover:text-text-primary transition-colors cursor-pointer"
        >
          Cancel
        </button>
      )}
      {reason && (
        <span className="text-[10px] text-error/80 truncate max-w-[140px]" title={reason}>{reason}</span>
      )}
    </div>
  );
}

export interface ProfileDropdownHandle {
  open: () => void;
}

interface ProfileDropdownProps {
  email?: string;
  username?: string;
  onLogout: () => void;
}

export const ProfileDropdown = forwardRef<ProfileDropdownHandle, ProfileDropdownProps>(function ProfileDropdown({ email, username, onLogout }, ref) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }));

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

  const handleUsernameSaved = useCallback(() => {
    // Username updated via UsernameRow — store already updated there
  }, []);

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
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg bg-bg-surface-1 border border-border shadow-lg">
          {/* Email */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
                <span className="text-sm font-bold text-accent">{initial}</span>
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold text-text-primary truncate">{email}</span>
              </div>
            </div>
          </div>

          {/* Username */}
          <div className="px-4 py-2 border-t border-border/50">
            <UsernameRow username={username} onSaved={handleUsernameSaved} />
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
});
