'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRight, Github, Star } from 'lucide-react';
import { UseAILogo } from './UseAILogo';
import { StatusBadge } from '@/components/StatusBadge';
import { usePresence } from '@/hooks/usePresence';

const GITHUB_URL = 'https://github.com/AhmedElBanna/useai';

export function TopNav() {
  const [scrolled, setScrolled] = useState(false);
  const [stars, setStars] = useState<number | null>(null);
  const { count } = usePresence();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    handleScroll();

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    fetch('https://api.github.com/repos/AhmedElBanna/useai')
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.stargazers_count != null) setStars(data.stargazers_count); })
      .catch(() => {});
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 border-b transform-gpu ${
      scrolled
        ? 'bg-bg-base/80 backdrop-blur-md border-border shadow-sm'
        : 'bg-transparent border-transparent shadow-none'
    }`}>
      <div className="flex items-center justify-between max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
        <div className="flex items-center gap-3">
          <Link href="/">
            <UseAILogo className="h-4 sm:h-5 drop-shadow-[0_0_8px_rgba(var(--accent-rgb),0.2)]" />
          </Link>
          <StatusBadge
            label={count !== null ? `${count} ONLINE` : 'CONNECTING'}
            color="success"
            dot
            className="hidden md:inline-flex"
          />
        </div>

        <div className="flex items-center gap-3 sm:gap-6">
          <Link href="/#features" className="hidden md:block text-xs font-mono tracking-widest text-text-muted hover:text-accent transition-colors">
            // FEATURES
          </Link>
          <Link href="/explore" className="hidden md:block text-xs font-mono tracking-widest text-text-muted hover:text-accent transition-colors">
            // EXPLORE
          </Link>
          <Link href="/leaderboard" className="hidden md:block text-xs font-mono tracking-widest text-text-muted hover:text-accent transition-colors">
            // LEADERBOARD
          </Link>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-accent bg-bg-surface-1/60 text-xs font-mono text-text-muted hover:text-accent hover:border-accent/40 transition-colors"
          >
            <Github className="w-4 h-4" />
            {stars !== null && (
              <span className="flex items-center gap-0.5 text-[10px] text-accent font-bold">
                <Star className="w-3 h-3 fill-accent" />
                {stars}
              </span>
            )}
          </a>
          <Link href="/login" className="cyber-button px-3 sm:px-5 py-1.5 sm:py-2 rounded-lg text-[10px] sm:text-xs font-bold font-mono tracking-widest bg-accent text-bg-base border border-accent flex items-center gap-1.5 sm:gap-2">
            DASHBOARD <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </nav>
  );
}
