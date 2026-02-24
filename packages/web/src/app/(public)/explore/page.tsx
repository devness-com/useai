import {
  Sparkles,
  BarChart3,
  Target,
  Clock,
  PieChart,
  Globe,
  Trophy,
  Users,
  Fingerprint,
  Link2,
  Shield,
  Database,
  Lock,
  Eye,
} from 'lucide-react';
import {
  SUPPORTED_AI_TOOLS,
  TOOL_COLORS,
  TOOL_ICONS,
  spaceFramework,
  CATEGORY_COLORS,
} from '@useai/shared';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const APS_COMPONENTS = [
  { name: 'Output', weight: 25, description: 'Complexity-weighted milestones completed per window' },
  { name: 'Efficiency', weight: 25, description: 'Files touched per hour of active AI session time' },
  { name: 'Prompt Quality', weight: 20, description: 'Average session evaluation score using SPACE weights' },
  { name: 'Consistency', weight: 15, description: 'Active coding days streak, capped at 14 days' },
  { name: 'Breadth', weight: 15, description: 'Unique programming languages used across sessions' },
];

const LIFECYCLE_STEPS = [
  {
    step: 'Start',
    mono: 'useai_start',
    description: 'Session begins when your AI tool sends the first message. Tool, task type, and project are recorded automatically.',
  },
  {
    step: 'Track',
    mono: 'useai_heartbeat',
    description: 'Heartbeats fire during long sessions. Duration, languages, files touched, and milestones accumulate in real time.',
  },
  {
    step: 'Seal',
    mono: 'useai_end',
    description: 'Session closes with a full evaluation, Ed25519 signature, and hash chain entry. Immutable from this point forward.',
  },
];

const MILESTONE_CATEGORIES = [
  { key: 'feature', label: 'Feature', description: 'New functionality shipped' },
  { key: 'bugfix', label: 'Bug Fix', description: 'Defect identified and resolved' },
  { key: 'refactor', label: 'Refactor', description: 'Structural improvement, same behavior' },
  { key: 'test', label: 'Test', description: 'Test coverage added or improved' },
  { key: 'docs', label: 'Docs', description: 'Documentation written or updated' },
  { key: 'setup', label: 'Setup', description: 'Project scaffolding or tooling' },
  { key: 'deployment', label: 'Deployment', description: 'Released to production' },
  { key: 'other', label: 'Other', description: 'Miscellaneous development work' },
];

const TASK_TYPES = [
  { type: 'coding', description: 'Building new features and writing implementation code' },
  { type: 'debugging', description: 'Investigating and fixing bugs, tracing error paths' },
  { type: 'testing', description: 'Writing and running tests, verifying behavior' },
  { type: 'planning', description: 'Architecture decisions, task breakdown, scoping' },
  { type: 'reviewing', description: 'Code review, PR feedback, quality checks' },
  { type: 'documenting', description: 'Writing docs, READMEs, inline comments' },
  { type: 'learning', description: 'Exploring new tools, libraries, or concepts' },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-12">

        {/* Page Header */}
        <div className="mb-16 max-w-3xl">
          <div className="text-[10px] font-mono tracking-widest text-accent mb-3 border-l-2 border-accent pl-2">DEEP_DIVE</div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-text-primary mb-4">
            How UseAI <span className="gradient-text-accent">Works</span>
          </h1>
          <p className="text-sm sm:text-base text-text-muted leading-relaxed">
            What gets captured, how it&apos;s measured, and what it means for your career.
            This is the complete guide to every metric, score, and signal UseAI produces.
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  ACT 1: WHAT USEAI CAPTURES                                */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">ACT_01</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">What UseAI Captures</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        {/* ── Section 1: Session Lifecycle ── */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-black text-text-primary">Every Session, Captured Automatically</h3>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">SESSION_LIFECYCLE</div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              Every time you work with an AI tool, UseAI silently records the full session lifecycle &mdash;
              from the first message to the final evaluation. No manual logging, no forms to fill out,
              no context switching. The background daemon captures everything.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              Each session records: <span className="text-text-primary">tool used</span>,{' '}
              <span className="text-text-primary">task type</span>,{' '}
              <span className="text-text-primary">duration</span>,{' '}
              <span className="text-text-primary">languages</span>,{' '}
              <span className="text-text-primary">milestones</span>,{' '}
              <span className="text-text-primary">complexity</span>,{' '}
              and <span className="text-text-primary">files touched</span>.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {LIFECYCLE_STEPS.map((step, idx) => (
              <div key={step.step} className="hud-border rounded-xl p-5 bg-bg-surface-1/80 relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-mono font-bold text-accent bg-[var(--accent-alpha)] px-2 py-0.5 rounded-md border border-accent/20">
                    0{idx + 1}
                  </span>
                  <h4 className="text-base font-bold text-text-primary">{step.step}</h4>
                </div>
                <code className="block text-[10px] font-mono text-accent/70 mb-3">{step.mono}</code>
                <p className="text-xs text-text-muted leading-relaxed">{step.description}</p>
                {idx < LIFECYCLE_STEPS.length - 1 && (
                  <div className="hidden sm:block absolute top-1/2 -right-2.5 text-accent/40 text-lg">&rarr;</div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 2: Output Breakdown ── */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-black text-text-primary">Not All Output Is Equal</h3>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">OUTPUT_BREAKDOWN</div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              Features shipped. Bugs fixed. Refactors completed. Tests written. Every milestone you complete
              is categorized by type and weighted by complexity &mdash; because a complex architecture overhaul
              is not the same as a quick typo fix.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              Complexity weights:{' '}
              <span className="text-text-primary font-mono">simple &times;1</span> &middot;{' '}
              <span className="text-text-primary font-mono">medium &times;2</span> &middot;{' '}
              <span className="text-text-primary font-mono">complex &times;4</span>.
              Your output fingerprint shows what kind of developer you really are.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {MILESTONE_CATEGORIES.map((cat) => {
              const color = CATEGORY_COLORS[cat.key] ?? '#91919a';
              return (
                <div
                  key={cat.key}
                  className="hud-border rounded-xl p-4 bg-bg-surface-1/80"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: color }}
                    />
                    <h4 className="text-sm font-bold text-text-primary">{cat.label}</h4>
                  </div>
                  <p className="text-xs text-text-muted">{cat.description}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── Section 3: Time Intelligence ── */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-4">
            <PieChart className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-black text-text-primary">Where Your AI Hours Go</h3>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">TIME_INTELLIGENCE</div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              Are you mostly debugging or mostly building? UseAI breaks down your AI time by task type,
              giving you real numbers for how AI fits into your workflow &mdash; daily, weekly, and monthly.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              Active session time is measured via heartbeats, not wall clock. If you step away for coffee,
              that gap isn&apos;t counted. You see <span className="text-text-primary">real time spent with AI</span>, not calendar time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {TASK_TYPES.map((task) => (
              <div key={task.type} className="hud-border rounded-xl p-4 bg-bg-surface-1/80 flex items-start gap-3">
                <span className="text-[10px] font-mono font-bold text-accent bg-[var(--accent-alpha)] px-2 py-0.5 rounded-md border border-accent/20 shrink-0 mt-0.5">
                  {task.type}
                </span>
                <p className="text-xs text-text-muted leading-relaxed">{task.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  ACT 2: HOW USEAI MEASURES                                 */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">ACT_02</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">How UseAI Measures</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        {/* ── Section 4: SPACE Framework ── */}
        <section id="metrics" className="scroll-mt-24 mb-24">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-black text-text-primary">Measuring How You Wield AI</h3>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">SPACE_FRAMEWORK</div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-8">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              UseAI evaluates AI coding sessions using an adaptation of the{' '}
              <a
                href="https://queue.acm.org/detail.cfm?id=3454124"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-bright border-b border-accent/30"
              >
                SPACE framework
              </a>{' '}
              (Satisfaction, Performance, Activity, Communication, Efficiency) developed by GitHub and Microsoft Research
              for measuring developer productivity.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              Rather than measuring raw output, UseAI focuses on how effectively you orchestrate AI tools &mdash; scoring
              prompt clarity, context quality, autonomy, and task scoping across four weighted dimensions.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-16">
            {spaceFramework.rubrics.map((rubric) => (
              <div
                key={rubric.dimension}
                className="hud-border rounded-xl p-6 bg-bg-surface-1/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h4 className="text-base font-bold text-text-primary">{rubric.label}</h4>
                    <span className="text-xs font-mono text-accent">{rubric.spaceMapping}</span>
                  </div>
                  <span className="text-xs font-mono text-text-muted bg-bg-surface-2 px-2 py-1 rounded">
                    {Math.round(rubric.weight * 100)}% weight
                  </span>
                </div>
                <div className="space-y-2">
                  {([1, 2, 3, 4, 5] as const).map((level) => (
                    <div key={level} className="flex gap-3 text-xs">
                      <span className={`font-mono font-bold shrink-0 w-4 text-right ${level >= 4 ? 'text-accent' : 'text-text-muted'}`}>
                        {level}
                      </span>
                      <span className="text-text-secondary">{rubric.levels[level]}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 5: Session Score ── */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-black text-text-primary">Your Session Score</h3>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">SESSION_SCORE</div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              Each session receives a <span className="text-text-primary font-bold">0&ndash;100</span> score computed from the four
              SPACE dimensions using their assigned weights:
            </p>
            <div className="font-mono text-sm text-text-secondary bg-bg-surface-2 rounded-lg p-4">
              score = (prompt_quality / 5 &times; 0.30) + (context_provided / 5 &times; 0.25) + (independence_level / 5 &times; 0.25) + (scope_quality / 5 &times; 0.20) &times; 100
            </div>
            <p className="text-xs text-text-muted mt-3 mb-4">
              A perfect score of 100 requires a 5 in every dimension. The weighting ensures prompt quality has the
              largest impact &mdash; because clear communication drives productive AI sessions more than anything else.
            </p>
            <p className="text-xs text-text-muted">
              For any dimension scored below 5, the AI provides a concrete, actionable tip explaining what was missing
              and how to improve next time. Scores aren&apos;t just numbers &mdash; they&apos;re a feedback loop.
            </p>
          </div>
        </section>

        {/* ── Section 6: AI Proficiency Score ── */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-black text-text-primary">AI Proficiency Score (APS)</h3>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">AI_PROFICIENCY_SCORE</div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-4">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              The APS is a composite <span className="text-text-primary font-bold">0&ndash;1000</span> score
              that aggregates your performance across multiple sessions. It combines five components, each
              normalized to 0&ndash;1 and weighted to produce a holistic measure of AI-assisted development proficiency.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              Unlike the per-session score, APS captures your entire body of work &mdash; rewarding consistency,
              breadth of skills, and sustained output over time.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {APS_COMPONENTS.map((component) => (
              <div
                key={component.name}
                className="hud-border rounded-xl p-5 bg-bg-surface-1/80"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="text-sm font-bold text-text-primary">{component.name}</h4>
                  <span className="text-xs font-mono text-accent">{component.weight}%</span>
                </div>
                <p className="text-xs text-text-muted">{component.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  ACT 3: WHAT IT MEANS FOR YOU                              */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">ACT_03</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">What It Means For You</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        {/* ── Section 7: Developer Identity ── */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-4">
            <Globe className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-black text-text-primary">Your AI Developer Identity</h3>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">DEVELOPER_IDENTITY</div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              GitHub shows your commits. UseAI shows what you built with AI and how effectively you wield it.
              A public, shareable profile displaying your tools, languages, output volume, complexity distribution,
              and SPACE scores &mdash; your AI development resume.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              In a world where every developer &ldquo;uses AI,&rdquo; prove you don&apos;t just use it &mdash; you&apos;re <span className="text-text-primary font-bold">proficient</span> with it.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Globe,
                title: 'PUBLIC PROFILE',
                description: 'A shareable page showing your AI activity — tools used, languages, output volume, complexity distribution, and SPACE scores. Only generic titles are shown publicly — no project names, file paths, or company details.',
              },
              {
                icon: Trophy,
                title: 'LEADERBOARD RANKING',
                description: 'See where you stand globally. APS ranks developers by output, efficiency, prompt quality, consistency, and breadth.',
              },
              {
                icon: Users,
                title: 'PROFESSIONAL SIGNAL',
                description: 'Visible to recruiters, teams, and the community. Demonstrate AI proficiency with verified data, not self-reported claims.',
              },
            ].map((card) => (
              <div key={card.title} className="hud-border rounded-xl p-5 bg-bg-surface-1/80 text-center">
                <div className="w-12 h-12 rounded-xl bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 mx-auto mb-4">
                  <card.icon className="w-6 h-6 text-accent" />
                </div>
                <h4 className="font-mono font-bold text-sm text-text-primary mb-2">{card.title}</h4>
                <p className="text-xs text-text-muted leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 8: Verification ── */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-4">
            <Fingerprint className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-black text-text-primary">Verified, Not Self-Reported</h3>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">VERIFICATION</div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed">
              Every milestone and session is cryptographically signed. Not timestamps you could edit. Not stats you could inflate.
              Provable proof of what you shipped, when you shipped it, and the evaluation scores you earned.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: Fingerprint,
                title: 'SIGNED MILESTONES',
                description: 'Every completed session is sealed with an Ed25519 digital signature. The signing key lives on your machine — only your daemon can produce valid signatures.',
              },
              {
                icon: Link2,
                title: 'HASH CHAIN INTEGRITY',
                description: 'Sessions are linked in a SHA-256 hash chain. Each entry references the previous one. Tampering with any record breaks the chain and is immediately detectable.',
              },
            ].map((card) => (
              <div key={card.title} className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 shrink-0">
                    <card.icon className="w-5 h-5 text-accent" />
                  </div>
                  <h4 className="font-mono font-bold text-sm text-text-primary">{card.title}</h4>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Section 9: Privacy ── */}
        <section className="mb-24">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-accent" />
            <h3 className="text-xl font-black text-text-primary">Your Data, Your Machine</h3>
          </div>
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">PRIVACY</div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              UseAI is privacy-first by architecture, not by policy. No source code, file paths, or prompt contents
              are ever transmitted. The daemon processes everything locally in <code className="text-accent font-mono text-xs">~/.useai</code>.
              You own your raw data &mdash; always.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              The entire project is{' '}
              <a href="https://github.com/AhmedElBanna/useai" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-bright border-b border-accent/30">
                open source under the MIT license
              </a>
              . You can audit every line of code that runs on your machine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              {
                icon: Eye,
                title: 'ZERO PAYLOAD',
                description: 'No source code, file paths, class names, or prompt contents leave your machine. Only aggregate metrics and milestones are synced — if you choose to sync at all.',
              },
              {
                icon: Shield,
                title: 'PUBLIC TITLES ONLY',
                description: 'Milestones use generic descriptions like "Fixed authentication bug" — no project names, file paths, company names, or identifying details ever appear on your public profile or the leaderboard.',
              },
              {
                icon: Database,
                title: 'LOCAL PROCESSING',
                description: 'The UseAI daemon runs on your machine, stores data in ~/.useai, and processes everything locally. No cloud dependency for core functionality.',
              },
              {
                icon: Lock,
                title: 'DATA OWNERSHIP',
                description: 'Your session history is stored as plain JSONL files you can read, export, or delete at any time. No vendor lock-in. Your data belongs to you.',
              },
            ].map((card) => (
              <div key={card.title} className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 shrink-0">
                    <card.icon className="w-5 h-5 text-accent" />
                  </div>
                  <h4 className="font-mono font-bold text-sm text-text-primary">{card.title}</h4>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{card.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  REFERENCE: SUPPORTED TOOLS                                */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">REFERENCE</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Supported Tools</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        {/* ── Section 10: Supported Tools ── */}
        <section>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-accent" />
              <h3 className="text-xl font-black text-text-primary">Works With Your Stack</h3>
            </div>
            <span className="text-xs font-mono text-text-muted uppercase tracking-wider">
              {SUPPORTED_AI_TOOLS.length} tools listed
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {SUPPORTED_AI_TOOLS.map((tool) => {
              const color = TOOL_COLORS[tool.key] ?? '#91919a';
              const iconSrc = TOOL_ICONS[tool.key];
              const iconMaskStyle = iconSrc
                ? {
                    WebkitMaskImage: `url("${iconSrc}")`,
                    maskImage: `url("${iconSrc}")`,
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    backgroundColor: 'currentColor',
                  }
                : undefined;

              return (
                <div
                  key={tool.id}
                  className="p-5 rounded-xl border border-border/50 bg-bg-surface-1/50 hover:border-accent/30 transition-colors group"
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center mb-3"
                    style={{ backgroundColor: `${color}15` }}
                  >
                    {iconSrc ? (
                      <span
                        role="img"
                        aria-label={`${tool.name} icon`}
                        className="w-5 h-5 block text-text-primary"
                        style={iconMaskStyle}
                      />
                    ) : (
                      <span className="text-xs font-black text-text-primary">{tool.name.slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <h4 className="text-sm font-bold text-text-primary mb-1 group-hover:text-accent transition-colors">
                    {tool.name}
                  </h4>
                  <p className="text-xs text-text-muted">{tool.description}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-16 text-center">
            <h3 className="text-lg font-bold text-text-primary mb-3">Want to add your tool?</h3>
            <p className="text-sm text-text-muted mb-6">UseAI works with any MCP-compatible AI tool.</p>
            <a
              href="https://github.com/AhmedElBanna/useai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 border border-border hover:border-accent/30 text-text-secondary hover:text-text-primary font-bold rounded-xl transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </section>

      </div>
    </div>
  );
}
