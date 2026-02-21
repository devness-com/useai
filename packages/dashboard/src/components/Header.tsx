import { useState } from 'react';
import type { HealthInfo, UpdateInfo } from '../lib/api';
import type { ActiveTab } from '@useai/ui';
import { Activity, ArrowUpCircle, Copy, Check, Search } from 'lucide-react';
import { TabBar } from '@useai/ui';

function UseAILogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 611.54 143.47" className={className}>
      {/* USE */}
      <g fill="var(--text-primary)">
        <path d="M21.4,121.85c-4.57-4.57-6.85-10.02-6.85-16.37V17.23c0-3.1,1.55-4.65,4.64-4.65h25.55c3.1,0,4.65,1.55,4.65,4.65v76.64c0,3.25,1.12,6,3.37,8.25,2.24,2.25,4.99,3.37,8.25,3.37h27.87c3.25,0,6-1.12,8.25-3.37,2.24-2.24,3.37-4.99,3.37-8.25V17.23c0-3.1,1.55-4.65,4.64-4.65h25.55c3.1,0,4.65,1.55,4.65,4.65v88.25c0,6.35-2.29,11.81-6.85,16.37-4.57,4.57-10.03,6.85-16.37,6.85H37.78c-6.35,0-11.81-2.28-16.37-6.85Z"/>
        <path d="M146.93,124.06v-13.93c0-3.1,1.55-4.65,4.64-4.65h69.67c3.25,0,6-1.12,8.25-3.37,2.24-2.24,3.37-4.99,3.37-8.25s-1.12-6-3.37-8.25c-2.25-2.24-4.99-3.37-8.25-3.37h-51.09c-6.35,0-11.81-2.28-16.37-6.85-4.57-4.57-6.85-10.02-6.85-16.37v-23.22c0-6.35,2.28-11.81,6.85-16.37,4.56-4.57,10.02-6.85,16.37-6.85h92.9c3.1,0,4.65,1.55,4.65,4.65v13.94c0,3.1-1.55,4.65-4.65,4.65h-69.67c-3.25,0-6,1.12-8.25,3.37-2.25,2.25-3.37,4.99-3.37,8.25s1.12,6,3.37,8.25c2.24,2.25,4.99,3.37,8.25,3.37h51.09c6.35,0,11.8,2.29,16.37,6.85,4.57,4.57,6.85,10.03,6.85,16.37v23.22c0,6.35-2.29,11.81-6.85,16.37-4.57,4.57-10.03,6.85-16.37,6.85h-92.9c-3.1,0-4.64-1.55-4.64-4.65Z"/>
        <path d="M286.16,121.85c-4.57-4.57-6.85-10.02-6.85-16.37V35.81c0-6.35,2.28-11.81,6.85-16.37,4.56-4.57,10.02-6.85,16.37-6.85h74.32c6.35,0,11.8,2.29,16.37,6.85,4.57,4.57,6.85,10.03,6.85,16.37v23.22c0,6.35-2.29,11.81-6.85,16.37-4.57,4.57-10.03,6.85-16.37,6.85h-62.71v11.61c0,3.25,1.12,6,3.37,8.25,2.24,2.25,4.99,3.37,8.25,3.37h69.67c3.1,0,4.65,1.55,4.65,4.65v13.93c0,3.1-1.55,4.65-4.65,4.65h-92.9c-6.35,0-11.81-2.28-16.37-6.85ZM361.87,55.66c2.24-2.24,3.37-4.99,3.37-8.25s-1.12-6-3.37-8.25c-2.25-2.24-4.99-3.37-8.25-3.37h-27.87c-3.25,0-6,1.12-8.25,3.37-2.25,2.25-3.37,4.99-3.37,8.25v11.61h39.48c3.25,0,6-1.12,8.25-3.37Z"/>
      </g>
      {/* AI */}
      <g fill="var(--accent)">
        <path d="M432.08,126.44c-4.76-4.76-7.14-10.44-7.14-17.06v-24.2c0-6.61,2.38-12.3,7.14-17.06,4.76-4.76,10.44-7.14,17.06-7.14h65.34v-12.1c0-3.39-1.17-6.25-3.51-8.59-2.34-2.34-5.2-3.51-8.59-3.51h-72.6c-3.23,0-4.84-1.61-4.84-4.84v-14.52c0-3.23,1.61-4.84,4.84-4.84h96.8c6.61,0,12.3,2.38,17.06,7.14,4.76,4.76,7.14,10.45,7.14,17.06v72.6c0,6.62-2.38,12.3-7.14,17.06-4.76,4.76-10.45,7.14-17.06,7.14h-77.44c-6.62,0-12.3-2.38-17.06-7.14ZM510.97,105.87c2.34-2.34,3.51-5.2,3.51-8.59v-12.1h-41.14c-3.39,0-6.25,1.17-8.59,3.51-2.34,2.34-3.51,5.2-3.51,8.59s1.17,6.25,3.51,8.59c2.34,2.34,5.2,3.51,8.59,3.51h29.04c3.39,0,6.25-1.17,8.59-3.51Z"/>
        <path d="M562.87,128.74V17.42c0-3.23,1.61-4.84,4.84-4.84h26.62c3.23,0,4.84,1.61,4.84,4.84v111.32c0,3.23-1.61,4.84-4.84,4.84h-26.62c-3.23,0-4.84-1.61-4.84-4.84Z"/>
      </g>
    </svg>
  );
}

const UPDATE_COMMAND = 'npx -y @devness/useai@latest update';

function UpdateBanner({ updateInfo }: { updateInfo: UpdateInfo }) {
  const [showPopover, setShowPopover] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(UPDATE_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowPopover((v) => !v)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 text-xs font-medium text-accent hover:bg-accent/15 transition-colors"
      >
        <ArrowUpCircle className="w-3 h-3" />
        v{updateInfo.latest} available
      </button>

      {showPopover && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg bg-bg-surface-1 border border-border shadow-lg p-3 space-y-2">
          <p className="text-xs text-text-muted">
            Update from <span className="font-mono text-text-secondary">v{updateInfo.current}</span> to <span className="font-mono text-accent">v{updateInfo.latest}</span>
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-[11px] font-mono bg-bg-base px-2 py-1.5 rounded border border-border text-text-secondary truncate">
              {UPDATE_COMMAND}
            </code>
            <button
              onClick={handleCopy}
              className="p-1.5 rounded-md border border-border bg-bg-base text-text-muted hover:text-text-primary hover:border-text-muted/50 transition-colors shrink-0"
              title="Copy command"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface HeaderProps {
  health: HealthInfo | null;
  updateInfo: UpdateInfo | null;
  timeContextLabel: string;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onSearchOpen?: () => void;
}

export function Header({ health, updateInfo, timeContextLabel, activeTab, onTabChange, onSearchOpen }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-bg-base/80 backdrop-blur-md border-b border-border mb-4">
      <div className="max-w-[1000px] mx-auto px-6 py-3 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <UseAILogo className="h-6" />
        </div>
        <div className="absolute left-1/2 -translate-x-1/2">
          <TabBar activeTab={activeTab} onTabChange={onTabChange} />
        </div>

        <div className="flex items-center gap-4">
          {onSearchOpen && (
            <button
              onClick={onSearchOpen}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border/50 bg-bg-surface-1 text-text-muted hover:text-text-primary hover:border-text-muted/50 transition-colors text-xs"
            >
              <Search className="w-3 h-3" />
              <span className="hidden sm:inline">Search</span>
              <kbd className="hidden sm:inline-flex items-center px-1 py-0.5 rounded border border-border bg-bg-base text-[9px] font-mono leading-none">
                ⌘K
              </kbd>
            </button>
          )}
          {updateInfo?.update_available && (
            <UpdateBanner updateInfo={updateInfo} />
          )}
          {health && health.active_sessions > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-success/10 border border-success/20">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-success animate-ping absolute inset-0" />
                <div className="w-2 h-2 rounded-full bg-success relative" />
              </div>
              <span className="text-xs font-medium text-success">
                {health.active_sessions} active session{health.active_sessions !== 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 text-xs text-text-muted font-mono bg-bg-surface-1 px-3 py-1.5 rounded-md border border-border">
            <Activity className="w-3 h-3" />
            {timeContextLabel}
          </div>
        </div>
      </div>
    </header>
  );
}
