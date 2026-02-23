'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, ArrowRight, Loader2, Shield, Terminal, KeyRound } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch } from '@/lib/api-client';
import { UseAILogo } from '@/components/UseAILogo';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [step, setStep] = useState<'email' | 'otp'>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/auth/send-otp', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setStep('otp');
    } catch {
      setError('Failed to send code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: any }>('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, code: otp }),
      });
      setAuth(data.token, data.user);
      router.push('/dashboard');
    } catch {
      setError('Invalid code. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-dvh grid place-items-center bg-bg-base px-4 relative overflow-hidden">
      {/* Background effects matching landing page */}
      <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />
      <div className="fixed blur-blob w-[500px] h-[500px] top-[-15%] left-[-10%]" style={{ backgroundImage: 'radial-gradient(circle, rgba(var(--accent-rgb), var(--glow-opacity)) 0%, rgba(var(--accent-rgb), 0) 70%)' }} />
      <div className="fixed blur-blob w-[400px] h-[400px] bottom-[-10%] right-[-10%]" style={{ animationDelay: '-5s', backgroundImage: 'radial-gradient(circle, var(--glow-blue) 0%, rgba(59, 130, 246, 0) 70%)' }} />

      <div className="relative z-10 w-full max-w-sm">
        {/* Logo + header */}
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="block mb-5">
            <UseAILogo className="h-8 drop-shadow-[0_0_12px_rgba(var(--accent-rgb),0.3)]" />
          </Link>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-[var(--accent-alpha)] mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            <span className="text-[10px] font-mono text-text-secondary tracking-widest">
              {step === 'email' ? 'AUTHENTICATE' : 'VERIFY_CODE'}
            </span>
          </div>

          <p className="text-sm text-text-muted">
            {step === 'email'
              ? 'Sign in to access your dashboard'
              : 'Enter the 6-digit code we sent you'}
          </p>
        </div>

        {/* Card */}
        <div className="rounded-xl bg-bg-surface-1/80 backdrop-blur-md p-6 border border-border shadow-[0_0_40px_rgba(var(--accent-rgb),0.05)]">
          {step === 'email' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-11 pr-4 py-3 rounded-lg border border-border bg-bg-surface-2/50 text-sm text-text-primary font-mono placeholder:text-text-muted/40 outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--accent),0_0_15px_rgba(var(--accent-rgb),0.1)] transition-all"
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-error font-mono flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-error" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="cyber-button w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent-bright text-bg-base font-bold font-mono text-xs tracking-widest uppercase rounded-lg transition-all disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                {loading ? 'SENDING...' : 'CONTINUE'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-surface-2/50 border border-border mb-1">
                <Mail className="w-3.5 h-3.5 text-accent shrink-0" />
                <span className="text-xs text-text-secondary font-mono truncate">{email}</span>
              </div>

              <div>
                <label className="block text-[10px] font-mono text-text-muted uppercase tracking-widest mb-2">
                  Verification Code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    maxLength={6}
                    required
                    className="w-full pl-11 pr-4 py-3 text-center text-xl font-mono tracking-[0.4em] rounded-lg border border-border bg-bg-surface-2/50 text-text-primary outline-none focus:border-accent focus:shadow-[0_0_0_1px_var(--accent),0_0_15px_rgba(var(--accent-rgb),0.1)] transition-all"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <p className="text-xs text-error font-mono text-center flex items-center justify-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-error" />
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || otp.length !== 6}
                className="cyber-button w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-accent-bright text-bg-base font-bold font-mono text-xs tracking-widest uppercase rounded-lg transition-all disabled:opacity-50"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'VERIFYING...' : 'VERIFY'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                className="w-full text-[10px] font-mono text-text-muted hover:text-accent transition-colors tracking-widest uppercase"
              >
                &larr; USE DIFFERENT EMAIL
              </button>
            </form>
          )}
        </div>

        {/* Footer security note */}
        <div className="mt-6 flex items-center justify-center gap-2 text-text-muted">
          <Shield className="w-3 h-3" />
          <span className="text-[10px] font-mono tracking-wider">ENCRYPTED &middot; PASSWORDLESS &middot; SECURE</span>
        </div>
      </div>
    </div>
  );
}
