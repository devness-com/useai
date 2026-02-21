/**
 * Highlights matching search words within text.
 * Words are matched case-insensitively as substrings.
 */
export function HighlightText({ text, words }: { text: string; words?: string[] }) {
  if (!words?.length || !text) return <>{text}</>;

  const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <mark key={i} className="bg-accent/30 text-inherit rounded-sm px-px">{part}</mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
