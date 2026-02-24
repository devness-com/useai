import { Github, Terminal, Star } from 'lucide-react';
import { UseAILogo } from './UseAILogo';

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/50 bg-bg-surface-1 pt-8 sm:pt-12 pb-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
        <div className="flex flex-col items-center sm:items-start gap-2">
          <UseAILogo className="h-4 opacity-50 hover:opacity-100 transition-opacity" />
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-text-muted font-mono tracking-widest">&copy; {new Date().getFullYear()} DEVNESS NETWORK</span>
            <span className="text-[10px] text-text-muted font-mono">·</span>
            <span className="text-[10px] text-accent/70 font-mono tracking-widest">MIT LICENSE</span>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6">
          <a href="https://github.com/AhmedElBanna/useai" target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs font-mono text-text-muted hover:text-accent transition-colors flex items-center gap-1.5 sm:gap-2">
            <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> REPOSITORY
          </a>
          <a href="https://www.npmjs.com/package/@devness/useai" target="_blank" rel="noopener noreferrer" className="text-[10px] sm:text-xs font-mono text-text-muted hover:text-accent transition-colors flex items-center gap-1.5 sm:gap-2">
            <Terminal className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> PACKAGE
          </a>
          <a href="https://github.com/AhmedElBanna/useai" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-accent/30 bg-[var(--accent-alpha)] text-[10px] sm:text-xs font-mono font-bold text-accent hover:bg-accent hover:text-bg-base transition-colors">
            <Star className="w-3 h-3 fill-current" /> STAR ON GITHUB
          </a>
        </div>
      </div>
    </footer>
  );
}
