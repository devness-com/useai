import { Github, Terminal } from 'lucide-react';
import { UseAILogo } from './UseAILogo';

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/50 bg-bg-surface-1 pt-12 pb-6">
      <div className="max-w-7xl mx-auto px-6 flex items-center justify-between flex-wrap gap-6">
        <div className="flex flex-col gap-2">
          <UseAILogo className="h-4 opacity-50 hover:opacity-100 transition-opacity" />
          <span className="text-[10px] text-text-muted font-mono tracking-widest">&copy; {new Date().getFullYear()} DEVNESS NETWORK</span>
        </div>

        <div className="flex items-center gap-6">
          <a href="https://github.com/AhmedElBanna/useai" target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-text-muted hover:text-accent transition-colors flex items-center gap-2">
            <Github className="w-4 h-4" /> REPOSITORY
          </a>
          <a href="https://www.npmjs.com/package/@devness/useai" target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-text-muted hover:text-accent transition-colors flex items-center gap-2">
            <Terminal className="w-4 h-4" /> PACKAGE
          </a>
        </div>
      </div>
    </footer>
  );
}
