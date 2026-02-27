import {
  Shield,
  Eye,
  Fingerprint,
  Globe,
  Code2,
  Zap,
  Heart,
  Github,
  Users,
  Lock,
  Target,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const PRINCIPLES = [
  {
    icon: Shield,
    title: 'PRIVACY BY ARCHITECTURE',
    description:
      'Zero network calls during coding. Your code, prompts, and AI responses never leave your machine. Only aggregate metrics are synced — and only when you choose.',
  },
  {
    icon: Fingerprint,
    title: 'CRYPTOGRAPHIC PROOF',
    description:
      'Every session is sealed with an Ed25519 digital signature and linked in a SHA-256 hash chain. Your proficiency is verified, not self-reported.',
  },
  {
    icon: Eye,
    title: 'FULL TRANSPARENCY',
    description:
      'The MCP server, CLI, and all client-side code are open source under the AGPL-3.0 license. Audit every line that runs on your machine.',
  },
  {
    icon: Lock,
    title: 'YOU OWN YOUR DATA',
    description:
      'Sessions are stored as plain JSONL files in ~/.useai on your machine. Export, inspect, or delete at any time. No vendor lock-in.',
  },
];

const TIMELINE = [
  {
    phase: 'THE PROBLEM',
    description:
      'Every developer "uses AI" now. But there\'s no standard way to measure, verify, or demonstrate how effectively you wield these tools. Resumes say "proficient with AI" — but what does that actually mean?',
  },
  {
    phase: 'THE INSIGHT',
    description:
      'GitHub shows your commits. LinkedIn shows your experience. But nothing shows how you work with AI — the tools you use, the complexity you handle, the quality of your prompts, or the consistency of your output.',
  },
  {
    phase: 'THE SOLUTION',
    description:
      'UseAI captures your AI-assisted development workflow silently and locally, scores sessions using research-backed frameworks, and creates a verified, shareable profile of your AI proficiency.',
  },
];

const STATS = [
  { label: 'AI tools supported', value: '30+' },
  { label: 'License', value: 'AGPL-3.0' },
  { label: 'Network calls during coding', value: '0' },
  { label: 'Code ever transmitted', value: 'None' },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12">

        {/* Page Header */}
        <div className="mb-16 max-w-3xl">
          <div className="text-[10px] font-mono tracking-widest text-accent mb-3 border-l-2 border-accent pl-2">ABOUT</div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-text-primary mb-4">
            Built for the <span className="gradient-text-accent">AI era</span>
          </h1>
          <p className="text-sm sm:text-base text-text-muted leading-relaxed">
            UseAI is a privacy-first MCP server that tracks how you use AI coding tools — session duration,
            languages, task types, and streaks — without ever seeing your code.
            Think of it as WakaTime for AI coding.
          </p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-24">
          {STATS.map((stat) => (
            <div key={stat.label} className="hud-border rounded-xl p-5 bg-bg-surface-1/80 text-center">
              <div className="text-2xl sm:text-3xl font-black text-accent mb-1">{stat.value}</div>
              <div className="text-[10px] font-mono tracking-widest text-text-muted uppercase">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  OUR STORY                                                  */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">STORY</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Why UseAI Exists</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="space-y-6">
            {TIMELINE.map((item, idx) => (
              <div key={item.phase} className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-mono font-bold text-accent bg-[var(--accent-alpha)] px-2 py-0.5 rounded-md border border-accent/20">
                    0{idx + 1}
                  </span>
                  <h3 className="text-base font-bold text-text-primary">{item.phase}</h3>
                </div>
                <p className="text-sm text-text-muted leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  WHAT USEAI IS                                              */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">PRODUCT</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">What UseAI Does</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-8">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              UseAI runs as an{' '}
              <a
                href="https://modelcontextprotocol.io/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-bright border-b border-accent/30"
              >
                MCP (Model Context Protocol)
              </a>{' '}
              server that integrates directly with your AI coding tools. When you start a conversation with Claude Code, Cursor,
              Windsurf, or any other supported tool, UseAI silently records session metadata — duration, languages, task type,
              and complexity — without ever accessing your code or prompts.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              Sessions are evaluated using the{' '}
              <a
                href="https://queue.acm.org/detail.cfm?id=3454124"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-bright border-b border-accent/30"
              >
                SPACE framework
              </a>{' '}
              (from GitHub and Microsoft Research) and sealed with an Ed25519 cryptographic signature.
              Your AI proficiency becomes a verified, portable credential — not a self-reported claim.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: Zap,
                title: 'Session Tracking',
                description: 'Automatically records AI tool usage — duration, task type, languages, files touched, and milestones completed.',
              },
              {
                icon: Target,
                title: 'SPACE Evaluation',
                description: 'Each session is scored across prompt quality, context, independence, and scope using research-backed rubrics.',
              },
              {
                icon: Sparkles,
                title: 'AI Proficiency Score',
                description: 'A composite 0–1000 APS score aggregates output, efficiency, prompt quality, consistency, and breadth.',
              },
              {
                icon: Globe,
                title: 'Public Profile',
                description: 'Opt-in shareable profile at useai.dev showing your tools, languages, output, and complexity distribution.',
              },
              {
                icon: Users,
                title: 'Global Leaderboard',
                description: 'See where you stand among developers worldwide. Ranked by APS, hours, streaks, and sessions completed.',
              },
              {
                icon: Code2,
                title: '30+ AI Tools',
                description: 'Works with Claude Code, Cursor, Windsurf, VS Code, GitHub Copilot, Gemini CLI, Aider, and many more.',
              },
            ].map((feature) => (
              <div key={feature.title} className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 mb-3">
                  <feature.icon className="w-5 h-5 text-accent" />
                </div>
                <h4 className="text-sm font-bold text-text-primary mb-2">{feature.title}</h4>
                <p className="text-xs text-text-muted leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  PRINCIPLES                                                 */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">PRINCIPLES</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">What We Believe</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {PRINCIPLES.map((principle) => (
              <div key={principle.title} className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 shrink-0">
                    <principle.icon className="w-5 h-5 text-accent" />
                  </div>
                  <h4 className="font-mono font-bold text-sm text-text-primary">{principle.title}</h4>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{principle.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  DEVNESS NETWORK                                            */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">COMPANY</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Devness Network</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              UseAI is built by{' '}
              <span className="text-text-primary font-bold">Devness Network</span> — a developer tools company
              focused on making AI-assisted development measurable, verifiable, and transparent.
            </p>
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              We believe the future of software development is AI-augmented, and developers need tools
              to understand, improve, and prove how effectively they work with AI. UseAI is the
              first step toward that vision.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              The project is open source under the{' '}
              <a
                href="https://github.com/devness-com/useai/blob/main/LICENSE"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-bright border-b border-accent/30"
              >
                AGPL-3.0 license
              </a>
              . We welcome contributions, feedback, and collaboration from the developer community.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  OPEN SOURCE                                                */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">OPEN_SOURCE</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Built in the Open</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              UseAI&apos;s MCP server, CLI, dashboard, and website are fully open source. The cloud API
              is closed source, but we publish comprehensive documentation of every field synced, every
              endpoint called, and every piece of data stored. See our{' '}
              <Link href="/privacy" className="text-accent hover:text-accent-bright border-b border-accent/30">
                Privacy Policy
              </Link>{' '}
              for complete details.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              {
                icon: Github,
                title: 'REPOSITORY',
                description: 'Full source code, issues, discussions, and contribution guidelines.',
                href: 'https://github.com/devness-com/useai',
                cta: 'View on GitHub',
              },
              {
                icon: Code2,
                title: 'NPM PACKAGE',
                description: 'Install the MCP server directly from npm. Works with npx.',
                href: 'https://www.npmjs.com/package/@devness/useai',
                cta: 'View on npm',
              },
              {
                icon: Heart,
                title: 'CONTRIBUTE',
                description: 'Bug reports, feature requests, and pull requests are welcome.',
                href: 'https://github.com/devness-com/useai/blob/main/CONTRIBUTING.md',
                cta: 'Contributing Guide',
              },
            ].map((card) => (
              <a
                key={card.title}
                href={card.href}
                target="_blank"
                rel="noopener noreferrer"
                className="hud-border rounded-xl p-5 bg-bg-surface-1/80 block group hover:border-accent/30 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 mb-3">
                  <card.icon className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-mono font-bold text-sm text-text-primary mb-2 group-hover:text-accent transition-colors">{card.title}</h4>
                <p className="text-xs text-text-muted leading-relaxed mb-3">{card.description}</p>
                <span className="text-xs font-mono text-accent">{card.cta} &rarr;</span>
              </a>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="text-center pb-8">
          <h3 className="text-lg font-bold text-text-primary mb-3">Ready to track your AI proficiency?</h3>
          <p className="text-sm text-text-muted mb-6">Get started in under a minute. No API key needed.</p>
          <div className="flex items-center justify-center gap-4">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-bg-base font-bold rounded-xl hover:bg-accent-bright transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-6 py-3 border border-border hover:border-accent/30 text-text-secondary hover:text-text-primary font-bold rounded-xl transition-colors"
            >
              Learn More
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
