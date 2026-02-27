'use client';

import { useState } from 'react';
import {
  TOOL_DISPLAY_NAMES,
  TOOL_ICONS,
  TOOL_COLORS,
  resolveClient,
} from '@useai/shared/constants/tools';
import { TimeToggle } from './TimeToggle';
import { InfoTip } from './InfoTip';

interface BreakdownItem {
  name: string;
  hours: number;
  user_hours: number;
}

interface ProfileBreakdownsProps {
  topLanguages: BreakdownItem[];
  topClients: BreakdownItem[];
  taskTypes: BreakdownItem[];
}

function ToolIcon({ clientKey, name }: { clientKey: string; name: string }) {
  const iconSrc = TOOL_ICONS[clientKey];
  if (!iconSrc) {
    return (
      <span className="text-[8px] font-black text-text-muted">
        {name.slice(0, 2).toUpperCase()}
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={`${name} icon`}
      className="w-3.5 h-3.5 block"
      style={{
        WebkitMaskImage: `url("${iconSrc}")`,
        maskImage: `url("${iconSrc}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        backgroundColor: 'currentColor',
      }}
    />
  );
}

function BarChart({
  items,
  mode,
  color,
  renderLabel,
}: {
  items: BreakdownItem[];
  mode: 'ai' | 'user';
  color: string | ((item: BreakdownItem) => string);
  renderLabel?: (item: BreakdownItem) => React.ReactNode;
}) {
  const getHours = (item: BreakdownItem) =>
    mode === 'ai' ? item.hours : item.user_hours;
  const maxHours = Math.max(...items.map(getHours), 0.1);

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const h = getHours(item);
        const barColor = typeof color === 'function' ? color(item) : color;
        return (
          <div key={item.name} className="flex items-center gap-3">
            <span className="text-xs font-medium text-text-secondary w-20 shrink-0 truncate flex items-center gap-1.5">
              {renderLabel ? renderLabel(item) : item.name}
            </span>
            <div className="flex-1 h-2 rounded-full bg-bg-surface-3/50 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${(h / maxHours) * 100}%`,
                  backgroundColor: barColor,
                }}
              />
            </div>
            <span className="text-[10px] font-mono text-text-muted w-12 text-right shrink-0">
              {h}h
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ProfileBreakdowns({
  topLanguages,
  topClients,
  taskTypes,
}: ProfileBreakdownsProps) {
  const [mode, setMode] = useState<'ai' | 'user'>('ai');

  return (
    <>
      {/* Toggle */}
      <div className="flex items-center justify-end mb-4">
        <TimeToggle mode={mode} onChange={setMode} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Languages */}
        {topLanguages.length > 0 && (
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                LANGUAGES
              </div>
              <InfoTip text="Programming languages used during AI sessions, ranked by total hours." />
            </div>
            <BarChart
              items={topLanguages}
              mode={mode}
              color="var(--color-accent)"
            />
          </div>
        )}

        {/* AI Tools */}
        {topClients.length > 0 && (
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                AI_TOOLS
              </div>
              <InfoTip text="AI coding tools used, ranked by total hours." />
            </div>
            <BarChart
              items={topClients}
              mode={mode}
              color={(item) => {
                const key = resolveClient(item.name);
                return TOOL_COLORS[key] ?? '#6b7280';
              }}
              renderLabel={(item) => {
                const key = resolveClient(item.name);
                const displayName = TOOL_DISPLAY_NAMES[key] ?? item.name;
                return (
                  <>
                    <ToolIcon clientKey={key} name={displayName} />
                    <span className="truncate">{displayName}</span>
                  </>
                );
              }}
            />
          </div>
        )}

        {/* Task Types */}
        {taskTypes.length > 0 && (
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1">
            <div className="flex items-center gap-2 mb-4">
              <div className="text-[10px] font-mono text-text-muted tracking-widest border-l-2 border-accent pl-2">
                TASK_TYPES
              </div>
              <InfoTip text="Categories of work performed during AI sessions, ranked by total hours." />
            </div>
            <BarChart
              items={taskTypes}
              mode={mode}
              color="var(--color-text-muted)"
            />
          </div>
        )}
      </div>
    </>
  );
}
