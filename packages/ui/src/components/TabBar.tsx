import type { ActiveTab } from '../types';

interface TabBarProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

const tabs: { id: ActiveTab; label: string }[] = [
  { id: 'sessions', label: 'Sessions' },
  { id: 'insights', label: 'Insights' },
];

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <div className="flex gap-0.5 p-0.5 rounded-lg bg-bg-surface-1 border border-border/40">
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
    </div>
  );
}
