import { useState, useCallback } from 'react';
import type { LocalConfig } from '../lib/api';
import { postSendOtp, postVerifyOtp, postSync } from '../lib/api';
import { RefreshCw, User, Mail, ShieldCheck } from 'lucide-react';

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

export function SyncFooter({ config, onRefresh }: SyncFooterProps) {
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

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
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center border border-accent/20">
            <User className="w-4 h-4 text-accent" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold text-text-primary">{config.email}</span>
            <span className="text-[10px] text-text-muted font-mono uppercase tracking-tighter">
              Last sync: {formatLastSync(config.last_sync_at)}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {msg && (
            <span className={`text-[10px] font-bold uppercase tracking-widest ${msg === 'Synced!' ? 'text-success' : 'text-error'}`}>
              {msg}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={loading}
            className="group flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-bright text-white text-xs font-bold rounded-lg transition-all duration-300 shadow-lg shadow-accent/20 disabled:opacity-50 cursor-pointer overflow-hidden relative"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
            {loading ? 'Syncing...' : 'Sync Now'}
          </button>
        </div>
      </div>
    );
  }

  // Unauthenticated: inline login
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
              className="px-4 py-2 bg-accent hover:bg-accent-bright text-white text-[10px] font-bold uppercase tracking-wider transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loading ? '...' : 'Verify'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
