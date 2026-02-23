import { useState, useCallback, useRef, useEffect } from 'react';
import type { LocalConfig } from '../lib/api';
import { postSendOtp, postVerifyOtp, postSync, postLogout, checkUsername, updateUsername } from '../lib/api';
import { RefreshCw, User, Mail, ShieldCheck, LogOut, Link, Pencil, Loader2, Check, X } from 'lucide-react';

interface SyncFooterProps {
  config: LocalConfig | null;
  onRefresh: () => void;
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

function UsernameRow({ config, onRefresh }: { config: LocalConfig; onRefresh: () => void }) {
  const hasUsername = !!config.username;
  const [editing, setEditing] = useState(!hasUsername);
  const [input, setInput] = useState(config.username ?? '');
  const [status, setStatus] = useState<UsernameStatus>('idle');
  const [reason, setReason] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const abortRef = useRef<AbortController>(undefined);

  // Reset state when config changes (e.g. after save)
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

    // Same as current username — no need to check server
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

  // Display mode
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

  // Edit/claim mode
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

export function SyncFooter({ config, onRefresh }: SyncFooterProps) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [email, otp, onRefresh]);

  if (!config) return null;

  // Authenticated view
  if (config.authenticated) {
    const handleSync = async () => {
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
    };

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mt-12 bg-bg-surface-1/50 rounded-2xl border border-border/50 backdrop-blur-sm">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20 shrink-0">
            <User className="w-4 h-4 text-accent" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-text-primary">{config.email}</span>
            <span className="text-[10px] text-text-muted font-mono uppercase tracking-tighter">
              Last sync: {formatLastSync(config.last_sync_at)}
            </span>
          </div>
          <div className="w-px h-6 bg-border/50 mx-1 hidden sm:block" />
          <UsernameRow config={config} onRefresh={onRefresh} />
        </div>

        <div className="flex items-center gap-2">
          {msg && (
            <span className={`text-[10px] font-bold uppercase tracking-widest ${msg === 'Synced!' ? 'text-success' : 'text-error'} mr-2`}>
              {msg}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={loading}
            className="group flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-bright text-bg-base text-xs font-bold rounded-lg transition-all duration-300 shadow-lg shadow-accent/20 disabled:opacity-50 cursor-pointer overflow-hidden relative"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            {loading ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            onClick={async () => {
              await postLogout();
              onRefresh();
            }}
            title="Sign out"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border/50 hover:border-error/50 hover:bg-error/10 text-text-muted hover:text-error transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 mt-12 bg-bg-surface-1/50 rounded-2xl border border-border/50 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-bg-surface-2 flex items-center justify-center border border-border">
          <ShieldCheck className="w-4 h-4 text-text-muted" />
        </div>
        <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Sign in to sync</span>
      </div>

      <div className="flex items-center gap-2">
        {msg && <span className="text-[10px] font-bold text-error uppercase tracking-widest mr-2">{msg}</span>}
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
              className="px-3 py-2 text-xs bg-transparent text-text-primary outline-none w-40 placeholder:text-text-muted/50"
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
              className="px-4 py-2 text-xs bg-transparent text-text-primary text-center font-mono tracking-widest outline-none w-32 placeholder:text-text-muted/50"
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
    </div>
  );
}
