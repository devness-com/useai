'use client';

import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

export function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className={`inline-flex items-center justify-center rounded-full p-0.5 transition-colors cursor-pointer ${
          open
            ? 'text-accent'
            : 'text-text-muted/40 hover:text-text-muted'
        }`}
        aria-label="What is this?"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      {open && (
        <p className="text-xs text-text-muted mt-2 leading-relaxed animate-in fade-in duration-150">
          {text}
        </p>
      )}
    </>
  );
}
