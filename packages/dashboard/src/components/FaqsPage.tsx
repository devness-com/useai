import { ChevronDown, Globe, Lock } from 'lucide-react';

interface FaqItem {
  question: string;
  answer: React.ReactNode;
}

const faqs: FaqItem[] = [
  {
    question: 'Why are there two titles for sessions and milestones?',
    answer: (
      <div className="space-y-2">
        <p>Every session and milestone records two titles to give you control over what you share.</p>
        <div className="space-y-1.5">
          <div className="flex items-start gap-2">
            <Globe className="w-3 h-3 text-amber mt-0.5 shrink-0" />
            <p><span className="text-amber font-medium">Public title</span> — A generic summary with no project names or file paths. Visible to your organization or group members.</p>
          </div>
          <div className="flex items-start gap-2">
            <Lock className="w-3 h-3 text-emerald mt-0.5 shrink-0" />
            <p><span className="text-emerald font-medium">Private title</span> — A detailed description with project specifics. Only visible to you and authorized organization roles.</p>
          </div>
        </div>
        <p>Both titles are controlled by the "Sync titles & milestones" toggle in Settings &gt; Cloud Sync. Neither is synced unless you explicitly enable it.</p>
      </div>
    ),
  },
  {
    question: 'What data is synced to the cloud?',
    answer: (
      <div className="space-y-2">
        <p>Nothing is synced unless you enable Cloud Sync in Settings. When enabled:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><span className="font-medium text-text-secondary">Stats</span> — Hours, languages, task types, streaks, and evaluation scores are always included with sync.</li>
          <li><span className="font-medium text-text-secondary">Titles & milestones</span> — Session titles, project names, evaluation reasons, and milestones are only synced if you enable the "Sync titles & milestones" toggle.</li>
        </ul>
        <p>Prompts and prompt images are <span className="font-medium text-text-secondary">never synced</span> — they stay on your machine.</p>
      </div>
    ),
  },
  {
    question: 'What are evaluation scores and reasons?',
    answer: (
      <div className="space-y-2">
        <p>At the end of each AI session, the AI evaluates the interaction across several dimensions: prompt quality, context provided, independence level, scope quality, and task outcome.</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><span className="font-medium text-text-secondary">Scores</span> (1–5) — Numeric ratings synced with your stats.</li>
          <li><span className="font-medium text-text-secondary">Reasons</span> — Free-text explanations for each score. These may contain project-specific details, so they are only synced when "Sync titles & milestones" is enabled.</li>
        </ul>
      </div>
    ),
  },
  {
    question: 'How does organization visibility work?',
    answer: (
      <div className="space-y-2">
        <p>If you are part of an organization, your synced data visibility depends on your org's settings:</p>
        <ul className="list-disc pl-4 space-y-1">
          <li><span className="font-medium text-text-secondary">Public titles</span> — May be visible to other members in your organization or group.</li>
          <li><span className="font-medium text-text-secondary">Private titles</span> — Only visible to you and authorized organization admins.</li>
          <li><span className="font-medium text-text-secondary">Stats</span> — Visible on leaderboards and your public profile.</li>
        </ul>
      </div>
    ),
  },
];

export function FaqsPage() {
  return (
    <div className="max-w-xl mx-auto pt-2 pb-12">
      <div className="mb-6">
        <h1 className="text-sm font-bold text-text-primary">Frequently Asked Questions</h1>
        <p className="text-[11px] text-text-muted mt-1">Common questions about how UseAI handles your data.</p>
      </div>

      <div className="space-y-2">
        {faqs.map((faq, i) => (
          <details key={i} className="group bg-bg-surface-1 border border-border/50 rounded-xl">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <ChevronDown className="w-3.5 h-3.5 text-text-muted shrink-0 transition-transform -rotate-90 group-open:rotate-0" />
              <span className="text-xs font-medium text-text-primary">{faq.question}</span>
            </summary>
            <div className="px-4 pb-4 pl-[2.125rem] text-[11px] text-text-muted leading-relaxed">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

export default FaqsPage;

