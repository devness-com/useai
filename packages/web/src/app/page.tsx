import Link from 'next/link';
import { ArrowRight, Terminal, BarChart3, Users, Zap, Shield, Globe } from 'lucide-react';

const FEATURES = [
  { icon: Terminal, title: 'Automatic Tracking', description: 'Works with Claude Code, Cursor, Copilot, and more. Zero config.' },
  { icon: BarChart3, title: 'Rich Analytics', description: 'Time travel, skill radar, evaluation scores, and daily recaps.' },
  { icon: Shield, title: 'Privacy First', description: 'Private titles stay private. You control what the world sees.' },
  { icon: Users, title: 'Developer Profiles', description: 'Share your AI coding journey with a public profile.' },
  { icon: Zap, title: 'Real-time Dashboard', description: 'Watch your sessions live with sub-minute granularity.' },
  { icon: Globe, title: 'Leaderboard', description: 'See how you stack up against other AI-powered developers.' },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base">
      {/* Nav */}
      <nav className="flex items-center justify-between max-w-6xl mx-auto px-6 py-4">
        <div className="text-xl font-black tracking-tight text-text-primary">
          use<span className="text-accent">AI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/leaderboard" className="text-sm text-text-muted hover:text-text-primary transition-colors">
            Leaderboard
          </Link>
          <Link href="/explore" className="text-sm text-text-muted hover:text-text-primary transition-colors">
            Explore
          </Link>
          <Link href="/login" className="text-sm font-bold text-accent hover:text-accent-bright transition-colors">
            Log in
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-bold uppercase tracking-widest mb-8">
          <Zap className="w-3 h-3" />
          Now tracking 10+ AI tools
        </div>
        <h1 className="text-5xl md:text-6xl font-black tracking-tight text-text-primary leading-[1.1] mb-6">
          See how you code<br />
          <span className="text-accent">with AI</span>
        </h1>
        <p className="text-lg text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed">
          UseAI automatically tracks your AI coding sessions across every tool. Get insights into your productivity, share your journey, and join the leaderboard.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-accent hover:bg-accent-bright text-black font-bold rounded-xl transition-colors"
          >
            Get Started
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="https://www.npmjs.com/package/@devness/useai"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 border border-border hover:border-text-muted/50 text-text-secondary hover:text-text-primary font-bold rounded-xl transition-colors"
          >
            <Terminal className="w-4 h-4" />
            npm install
          </a>
        </div>
      </section>

      {/* Terminal mockup */}
      <section className="max-w-3xl mx-auto px-6 pb-20">
        <div className="rounded-xl border border-border bg-bg-surface-1 overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-surface-2/50">
            <div className="w-3 h-3 rounded-full bg-error/60" />
            <div className="w-3 h-3 rounded-full bg-streak/60" />
            <div className="w-3 h-3 rounded-full bg-success/60" />
            <span className="text-xs text-text-muted font-mono ml-2">Terminal</span>
          </div>
          <div className="p-6 font-mono text-sm leading-relaxed">
            <div className="text-text-muted">$ npx @devness/useai setup</div>
            <div className="text-success mt-2">&#10003; MCP server configured</div>
            <div className="text-success">&#10003; Daemon started on port 19200</div>
            <div className="text-text-muted mt-3">$ # Start coding with any AI tool — sessions are tracked automatically</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-black text-center text-text-primary mb-12">
          Everything you need
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="p-5 rounded-xl border border-border/50 bg-bg-surface-1/50 hover:border-accent/30 transition-colors">
              <f.icon className="w-5 h-5 text-accent mb-3" />
              <h3 className="text-sm font-bold text-text-primary mb-1">{f.title}</h3>
              <p className="text-xs text-text-muted leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <span className="text-xs text-text-muted">useai.dev</span>
          <div className="flex items-center gap-4">
            <a href="https://github.com/AhmedElBanna/useai" target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-text-primary transition-colors">
              GitHub
            </a>
            <a href="https://www.npmjs.com/package/@devness/useai" target="_blank" rel="noopener noreferrer" className="text-xs text-text-muted hover:text-text-primary transition-colors">
              npm
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
