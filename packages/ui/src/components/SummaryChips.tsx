import type { ComputedStats } from '../stats';
import { TOOL_COLORS, TOOL_DISPLAY_NAMES } from '../constants';

interface SummaryChipsProps {
  stats: ComputedStats;
}

function formatHours(seconds: number): string {
  const h = seconds / 3600;
  return h < 1 ? `${Math.round(h * 60)}m` : `${h.toFixed(1)}h`;
}

function topN(record: Record<string, number>, n: number): [string, number][] {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n);
}

function ChipGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-text-muted uppercase tracking-widest font-bold whitespace-nowrap">{label}</span>
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {children}
      </div>
    </div>
  );
}

export function SummaryChips({ stats }: SummaryChipsProps) {
  const clients = topN(stats.byClient, 4);
  const languages = topN(stats.byLanguage, 4);

  if (clients.length === 0 && languages.length === 0) return null;

  return (
    <div className="flex flex-col gap-4 mb-8 p-4 rounded-xl bg-bg-surface-1/30 border border-border/50">
      {clients.length > 0 && (
        <ChipGroup label="Top Clients">
          {clients.map(([key, val]) => {
            const color = TOOL_COLORS[key];
            return (
              <span
                key={key}
                className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-bg-surface-1 border border-border hover:border-accent/40 transition-colors shadow-sm whitespace-nowrap group cursor-default"
                style={color ? { borderLeftWidth: '3px', borderLeftColor: color } : undefined}
                title={formatHours(val)}
              >
                {TOOL_DISPLAY_NAMES[key] ?? key}
                <span className="ml-1.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatHours(val)}
                </span>
              </span>
            );
          })}
        </ChipGroup>
      )}

      {languages.length > 0 && (
        <ChipGroup label="Languages">
          {languages.map(([key, val]) => (
            <span
              key={key}
              className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-bg-surface-1 border border-border hover:border-accent/40 transition-colors shadow-sm whitespace-nowrap group cursor-default"
              title={formatHours(val)}
            >
              {key}
              <span className="ml-1.5 text-text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                {formatHours(val)}
              </span>
            </span>
          ))}
        </ChipGroup>
      )}
    </div>
  );
}
