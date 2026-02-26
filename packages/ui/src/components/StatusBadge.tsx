import type { ReactNode } from 'react';

const COLOR_STYLES = {
  accent: {
    border: 'border-accent/20',
    bg: 'bg-[var(--accent-alpha)]',
    dot: 'bg-accent',
  },
  success: {
    border: 'border-success/20',
    bg: 'bg-success/10',
    dot: 'bg-success',
  },
  muted: {
    border: 'border-border',
    bg: 'bg-bg-surface-2/50',
    dot: 'bg-text-muted',
  },
} as const;

interface StatusBadgeProps {
  label: string;
  color?: 'accent' | 'success' | 'muted';
  dot?: boolean;
  icon?: ReactNode;
  glow?: boolean;
  className?: string;
  'data-testid'?: string;
}

export function StatusBadge({
  label,
  color = 'accent',
  dot = false,
  icon,
  glow = false,
  className = '',
  'data-testid': dataTestId,
}: StatusBadgeProps) {
  const styles = COLOR_STYLES[color];

  return (
    <div
      data-testid={dataTestId}
      className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${styles.border} ${styles.bg} ${className}`}
      style={glow ? { boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.1)' } : undefined}
    >
      {dot && <span className={`w-1.5 h-1.5 rounded-full ${styles.dot} animate-pulse`} />}
      {icon}
      <span className="text-[10px] font-mono text-text-secondary tracking-widest uppercase">
        {label}
      </span>
    </div>
  );
}
