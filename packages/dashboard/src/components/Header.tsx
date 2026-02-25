import { useState } from 'react';
import type { HealthInfo, UpdateInfo, LocalConfig } from '../lib/api';
import { ArrowUpCircle, Copy, Check, Search } from 'lucide-react';
import { UseAILogo, TabBar, StatusBadge } from '@useai/ui';
import type { ActiveTab } from '@useai/ui';
import { ProfileDropdown } from './ProfileDropdown';

const UPDATE_COMMAND = 'npx -y @devness/useai update';

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
  onSearchOpen?: () => void;
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  config: LocalConfig | null;
  onRefresh: () => void;
}

export function Header({ health, updateInfo, onSearchOpen, activeTab, onTabChange, config, onRefresh }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-bg-base/80 backdrop-blur-md border-b border-border mb-6">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between relative">
        <div className="flex items-center gap-3">
          <UseAILogo className="h-6" />
          {health && health.active_sessions > 0 && (
            <StatusBadge
              label={`${health.active_sessions} active session${health.active_sessions !== 1 ? 's' : ''}`}
              color="success"
              dot
            />
          )}
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
          <ProfileDropdown config={config} onRefresh={onRefresh} />
        </div>
      </div>
    </header>
  );
}
