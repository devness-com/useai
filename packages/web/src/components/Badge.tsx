interface BadgeProps {
  name: string;
  category: 'milestone' | 'streak' | 'proficiency' | 'special';
  earned: boolean;
  earnedAt?: string;
}

const CATEGORY_CONFIG: Record<
  BadgeProps['category'],
  { icon: string; bgColor: string; borderColor: string; textColor: string }
> = {
  milestone: {
    icon: '\u{1F3AF}',
    bgColor: 'bg-blue/10',
    borderColor: 'border-blue/30',
    textColor: 'text-blue',
  },
  streak: {
    icon: '\u{1F525}',
    bgColor: 'bg-streak-bg',
    borderColor: 'border-streak-border',
    textColor: 'text-streak',
  },
  proficiency: {
    icon: '\u{1F48E}',
    bgColor: 'bg-purple/10',
    borderColor: 'border-purple/30',
    textColor: 'text-purple',
  },
  special: {
    icon: '\u{2B50}',
    bgColor: 'bg-streak-bg',
    borderColor: 'border-streak-border',
    textColor: 'text-streak',
  },
};

export function Badge({ name, category, earned, earnedAt }: BadgeProps) {
  const config = CATEGORY_CONFIG[category];

  return (
    <div
      className={`inline-flex items-center gap-2.5 px-3.5 py-2 rounded-xl border transition-all ${
        earned
          ? `${config.bgColor} ${config.borderColor}`
          : 'bg-bg-surface-2/50 border-border/30 grayscale opacity-50'
      }`}
    >
      <span className="text-base leading-none" role="img" aria-hidden="true">
        {config.icon}
      </span>
      <div className="flex flex-col min-w-0">
        <span
          className={`text-xs font-bold truncate ${
            earned ? config.textColor : 'text-text-muted'
          }`}
        >
          {name}
        </span>
        {earned && earnedAt && (
          <span className="text-[10px] text-text-muted font-mono">{earnedAt}</span>
        )}
      </div>
    </div>
  );
}
