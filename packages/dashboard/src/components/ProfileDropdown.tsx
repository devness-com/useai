import { useState, useCallback, useRef, useEffect } from 'react';
import type { LocalConfig } from '../lib/api';
import { postSendOtp, postVerifyOtp, postSync, postLogout, checkUsername, updateUsername } from '../lib/api';
import { RefreshCw, User, Mail, LogOut, Link, Pencil, Loader2, Check, X, ChevronDown } from 'lucide-react';

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

function formatLastSync(iso: string | null): string {
  if (!iso) return 'Never synced';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

function UsernameRow({ config, onRefresh }: { config: LocalConfig; onRefresh: () => void }) {
  const hasUsername = !!config.username;
  const [editing, setEditing] = useState(!hasUsername);
  const [input, setInput] = useState(config.username ?? '');
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [reason, setReason] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  useEffect(() => {
    if (config.username) {
      setEditing(false);
      setInput(config.username);
    }
  }, [config.username]);

  const handleChange = useCallback((raw: string) => {
    const value = sanitizeUsername(raw);
    setInput(value);
    setReason(undefined);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

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

    if (value === config.username) {
      setStatus('idle');
      return;
    }

    setStatus('checking');
    debounceRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();
      try {
        const result = await checkUsername(value);
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
  }, [config.username]);

  const handleSave = useCallback(async () => {
    if (status !== 'available') return;
    setSaving(true);
    try {
      await updateUsername(input);
      onRefresh();
    } catch (err) {
      setStatus('invalid');
      setReason((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [input, status, onRefresh]);

  const handleCancel = useCallback(() => {
    setEditing(false);
    setInput(config.username ?? '');
    setStatus('idle');
    setReason(undefined);
  }, [config.username]);

  const handleStartEdit = useCallback(() => {
    setEditing(true);
    setInput(config.username ?? '');
    setStatus('idle');
    setReason(undefined);
  }, [config.username]);

  if (!editing && hasUsername) {
    return (
      <div className="flex items-center gap-2">
        <Link className="w-3.5 h-3.5 text-text-muted" />
        <a
          href={`https://useai.dev/${config.username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-bold text-accent hover:text-accent-bright transition-colors"
        >
          useai.dev/{config.username}
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

interface ProfileDropdownProps {
  config: LocalConfig | null;
  onRefresh: () => void;
}

export function ProfileDropdown({ config, onRefresh }: ProfileDropdownProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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

  const handleSendOtp = useCallback(async () => {
    if (!email.includes('@')) return;
    setLoading(true);
    setMsg(null);
    try {
      await postSendOtp(email);
      setStep('otp');
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [email]);

  const handleVerifyOtp = useCallback(async () => {
    if (!/^\d{6}$/.test(otp)) return;
    setLoading(true);
    setMsg(null);
    try {
      await postVerifyOtp(email, otp);
      onRefresh();
      setOpen(false);
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [email, otp, onRefresh]);

  const handleSync = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const data = await postSync();
      if (data.success) {
        setMsg('Synced!');
        onRefresh();
        setTimeout(() => setMsg(null), 3000);
      } else {
        setMsg(data.error ?? 'Sync failed');
      }
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [onRefresh]);

  const handleSignOut = useCallback(async () => {
    await postLogout();
    onRefresh();
    setOpen(false);
  }, [onRefresh]);

  if (!config) return null;

  const isAuth = config.authenticated;

  return (
    <div className="relative" ref={containerRef}>
      {/* Trigger button */}
      {isAuth ? (
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 rounded-full transition-colors cursor-pointer hover:opacity-80"
        >
          <div className="relative w-7 h-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center">
            <span className="text-xs font-bold text-accent leading-none">
              {(config.email?.[0] ?? '?').toUpperCase()}
            </span>
            {/* Sync status dot */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-bg-base ${config.last_sync_at ? 'bg-success' : 'bg-warning'}`} />
          </div>
          <ChevronDown className={`w-3 h-3 text-text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      ) : (
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border/50 bg-bg-surface-1 text-text-muted hover:text-text-primary hover:border-text-muted/50 transition-colors text-xs cursor-pointer"
        >
          <User className="w-3 h-3" />
          Sign in
        </button>
      )}

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-80 rounded-lg bg-bg-surface-1 border border-border shadow-lg">
          {isAuth ? (
            <div>
              {/* Email */}
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
                    <span className="text-sm font-bold text-accent">
                      {(config.email?.[0] ?? '?').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-bold text-text-primary truncate">{config.email}</span>
                  </div>
                </div>
              </div>

              {/* Username */}
              <div className="px-4 py-2 border-t border-border/50">
                <UsernameRow config={config} onRefresh={onRefresh} />
              </div>

              {/* Sync row */}
              <div className="px-4 py-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-text-muted font-mono uppercase tracking-tighter">
                    Last sync: {formatLastSync(config.last_sync_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    {msg && (
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${msg === 'Synced!' ? 'text-success' : 'text-error'}`}>
                        {msg}
                      </span>
                    )}
                    <button
                      onClick={handleSync}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-accent hover:bg-accent-bright text-bg-base text-[10px] font-bold uppercase tracking-wider rounded-md transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                      {loading ? '...' : 'Sync'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Sign out */}
              <div className="px-4 py-2 border-t border-border/50">
                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 w-full px-2 py-1.5 rounded-md text-xs text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs font-bold text-text-secondary uppercase tracking-widest mb-3">Sign in to sync</p>
              {msg && <p className="text-[10px] font-bold text-error uppercase tracking-widest mb-2">{msg}</p>}
              {step === 'email' ? (
                <div className="flex items-center bg-bg-base border border-border rounded-lg overflow-hidden focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/50 transition-all">
                  <div className="pl-3 py-2">
                    <Mail className="w-3.5 h-3.5 text-text-muted" />
                  </div>
                  <input
                    type="email"
                    placeholder="you@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendOtp()}
                    autoFocus
                    className="px-3 py-2 text-xs bg-transparent text-text-primary outline-none flex-1 placeholder:text-text-muted/50"
                  />
                  <button
                    onClick={handleSendOtp}
                    disabled={loading || !email.includes('@')}
                    className="px-4 py-2 bg-bg-surface-2 hover:bg-bg-surface-3 text-text-primary text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer border-l border-border"
                  >
                    {loading ? '...' : 'Send'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center bg-bg-base border border-border rounded-lg overflow-hidden focus-within:border-accent/50 focus-within:ring-1 focus-within:ring-accent/50 transition-all">
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="000000"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleVerifyOtp()}
                    autoFocus
                    className="px-4 py-2 text-xs bg-transparent text-text-primary text-center font-mono tracking-widest outline-none flex-1 placeholder:text-text-muted/50"
                  />
                  <button
                    onClick={handleVerifyOtp}
                    disabled={loading || otp.length !== 6}
                    className="px-4 py-2 bg-accent hover:bg-accent-bright text-bg-base text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {loading ? '...' : 'Verify'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
