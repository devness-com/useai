import { ExternalLink, Settings } from 'lucide-react';
import type { ActiveTab } from '../types';

export interface ExternalNavLink {
  label: string;
  href: string;
}

interface TabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  externalLinks?: ExternalNavLink[];
}

const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'insights', label: 'Insights' },
];

export function TabBar({ activeTab, onTabChange, externalLinks }: TabBarProps) {
  return (
    <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-bg-surface-1 border border-border/40">
      {tabs.map(({ id, label }) => {
        const isActive = activeTab === id;
        return (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={`
              px-3 py-1 rounded-md text-xs font-medium transition-all duration-150
              ${isActive
                ? 'bg-bg-surface-2 text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
              }
            `}
          >
            {label}
          </button>
        );
      })}
      <div className="w-px h-4 bg-border/60 mx-1" />
      <button
        onClick={() => onTabChange('settings')}
        className={`
          flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150
          ${activeTab === 'settings'
            ? 'bg-bg-surface-2 text-text-primary shadow-sm'
            : 'text-text-muted hover:text-text-primary'
          }
        `}
      >
        <Settings className="w-3 h-3" />
        Settings
      </button>
      {externalLinks && externalLinks.length > 0 && (
        <>
          <div className="w-px h-4 bg-border/60 mx-1" />
          {externalLinks.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono tracking-wide text-text-muted hover:text-accent transition-colors duration-150"
            >
              {label}
              <ExternalLink className="w-2.5 h-2.5 opacity-50" />
            </a>
          ))}
        </>
      )}
    </div>
  );
}
