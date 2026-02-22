'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Terminal } from 'lucide-react';
import { UseAILogo } from './UseAILogo';

export function TopNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 border-b transform-gpu ${
      scrolled
        ? 'bg-bg-base/80 backdrop-blur-md border-border shadow-sm'
        : 'bg-transparent border-transparent shadow-none'
    }`}>
      <div className="flex items-center justify-between max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <Link href="/">
            <UseAILogo className="h-5 drop-shadow-[0_0_8px_rgba(var(--accent-rgb),0.2)]" />
          </Link>
          <div className="hidden md:flex items-center px-2 py-0.5 rounded-md border border-accent/20 bg-[var(--accent-alpha)] text-[10px] text-accent font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1.5" />
            SYSTEM_ONLINE
          </div>
        </div>

        <div className="flex items-center gap-8">
          <Link href="/#features" className="hidden md:block text-xs font-mono tracking-widest text-text-muted hover:text-accent transition-colors">
            // FEATURES
          </Link>
          <Link href="/leaderboard" className="hidden md:block text-xs font-mono tracking-widest text-text-muted hover:text-accent transition-colors">
            // LEADERBOARD
          </Link>
          <Link href="/login" className="cyber-button px-5 py-2 rounded-lg text-xs font-bold font-mono tracking-widest bg-accent text-white border border-accent flex items-center gap-2">
            ACCESS_TERM <Terminal className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
