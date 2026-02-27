'use client';

export function TimeToggle({
  mode,
  onChange,
}: {
  mode: 'ai' | 'user';
  onChange: (m: 'ai' | 'user') => void;
}) {
  const base =
    'px-2.5 py-1 text-[10px] font-mono tracking-wider uppercase rounded transition-all duration-150';
  const active = 'text-accent border border-accent/40 bg-accent/10';
  const inactive =
    'text-text-muted border border-transparent hover:text-text-secondary';

  return (
    <div className="flex gap-1">
      <button
        onClick={() => onChange('ai')}
        className={`${base} ${mode === 'ai' ? active : inactive}`}
      >
        AI Time
      </button>
      <button
        onClick={() => onChange('user')}
        className={`${base} ${mode === 'user' ? active : inactive}`}
      >
        User Time
      </button>
    </div>
  );
}
