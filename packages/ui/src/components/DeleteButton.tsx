import { useState, useEffect, useRef } from 'react';
import { Trash2, Check, X } from 'lucide-react';

interface DeleteButtonProps {
  onDelete: () => void;
  size?: 'sm' | 'md';
  className?: string;
}

export function DeleteButton({ onDelete, size = 'md', className = '' }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const handleTrashClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(true);
    timerRef.current = setTimeout(() => setConfirming(false), 5000);
  };

  const handleConfirm = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
    onDelete();
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
    setConfirming(false);
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  const padding = size === 'sm' ? 'p-1' : 'p-1.5';

  if (confirming) {
    return (
      <span className={`inline-flex items-center gap-0.5 ${className}`} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={handleConfirm}
          className={`${padding} rounded-lg transition-all bg-error/15 text-error hover:bg-error/25`}
          title="Confirm delete"
        >
          <Check className={iconSize} />
        </button>
        <button
          onClick={handleCancel}
          className={`${padding} rounded-lg transition-all text-text-muted hover:bg-bg-surface-2`}
          title="Cancel"
        >
          <X className={iconSize} />
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={handleTrashClick}
      className={`${padding} rounded-lg transition-all text-text-muted hover:text-error/70 hover:bg-error/5 ${className}`}
      title="Delete"
    >
      <Trash2 className={iconSize} />
    </button>
  );
}
