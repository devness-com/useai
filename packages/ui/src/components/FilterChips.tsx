import type { SessionSeal } from '@useai/shared/types';
import type { Filters } from '../types';
import { useMemo } from 'react';
import { TOOL_DISPLAY_NAMES } from '../constants';

interface FilterChipsProps {
  sessions: SessionSeal[];
  filters: Filters;
  onFilterChange: (key: keyof Filters, value: string) => void;
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full transition-all duration-200 cursor-pointer border ${
        active
          ? 'bg-accent text-white border-accent scale-105'
          : 'bg-bg-surface-1 border-border text-text-muted hover:text-text-primary hover:border-text-muted/50'
      }`}
      style={active ? { boxShadow: '0 2px 10px rgba(var(--accent-rgb), 0.4)' } : undefined}
    >
      {label}
    </button>
  );
}

export function FilterChips({ sessions, filters, onFilterChange }: FilterChipsProps) {
  const clients = useMemo(
    () => [...new Set(sessions.map((s) => s.client))].sort(),
    [sessions],
  );
  const languages = useMemo(
    () => [...new Set(sessions.flatMap((s) => s.languages))].sort(),
    [sessions],
  );
  const projects = useMemo(
    () => [...new Set(sessions.map((s) => s.project).filter(p => {
      if (!p) return false;
      const lp = p.trim().toLowerCase();
      const UNTITLED_PROJECTS = ['untitled', 'mcp', 'unknown', 'default', 'none'];
      return !UNTITLED_PROJECTS.includes(lp);
    }) as string[])].sort(),
    [sessions],
  );

  const hasFilters = clients.length > 0 || languages.length > 0 || projects.length > 0;
  if (!hasFilters) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 px-1">
        <Chip
          label="All"
          active={filters.client === 'all' && filters.language === 'all' && filters.project === 'all'}
          onClick={() => {
            onFilterChange('client', 'all');
            onFilterChange('language', 'all');
            onFilterChange('project', 'all');
          }}
        />

        {clients.map((c) => (
          <Chip
            key={c}
            label={TOOL_DISPLAY_NAMES[c] ?? c}
            active={filters.client === c}
            onClick={() => onFilterChange('client', filters.client === c ? 'all' : c)}
          />
        ))}

        {languages.map((l) => (
          <Chip
            key={l}
            label={l}
            active={filters.language === l}
            onClick={() => onFilterChange('language', filters.language === l ? 'all' : l)}
          />
        ))}

        {projects.map((p) => (
          <Chip
            key={p}
            label={p}
            active={filters.project === p}
            onClick={() => onFilterChange('project', filters.project === p ? 'all' : p)}
          />
        ))}
    </div>
  );
}
