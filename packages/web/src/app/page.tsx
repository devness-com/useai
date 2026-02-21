'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Terminal,
  BarChart3,
  Users,
  Shield,
  Globe,
  Clipboard,
  Check,
  Brain,
  Clock,
  Target,
  Gauge,
  Sparkles,
  TrendingUp,
  Lock,
  Database,
  Fingerprint,
  Trophy,
  ChevronRight,
  Zap,
  Github,
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  UseAI SVG Logo (matches dashboard)                                 */
/* ------------------------------------------------------------------ */

function UseAILogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 611.54 143.47" className={className}>
      {/* USE */}
      <g fill="var(--text-primary)">
        <path d="M21.4,121.85c-4.57-4.57-6.85-10.02-6.85-16.37V17.23c0-3.1,1.55-4.65,4.64-4.65h25.55c3.1,0,4.65,1.55,4.65,4.65v76.64c0,3.25,1.12,6,3.37,8.25,2.24,2.25,4.99,3.37,8.25,3.37h27.87c3.25,0,6-1.12,8.25-3.37,2.24-2.24,3.37-4.99,3.37-8.25V17.23c0-3.1,1.55-4.65,4.64-4.65h25.55c3.1,0,4.65,1.55,4.65,4.65v88.25c0,6.35-2.29,11.81-6.85,16.37-4.57,4.57-10.03,6.85-16.37,6.85H37.78c-6.35,0-11.81-2.28-16.37-6.85Z"/>
        <path d="M146.93,124.06v-13.93c0-3.1,1.55-4.65,4.64-4.65h69.67c3.25,0,6-1.12,8.25-3.37,2.24-2.24,3.37-4.99,3.37-8.25s-1.12-6-3.37-8.25c-2.25-2.24-4.99-3.37-8.25-3.37h-51.09c-6.35,0-11.81-2.28-16.37-6.85-4.57-4.57-6.85-10.02-6.85-16.37v-23.22c0-6.35,2.28-11.81,6.85-16.37,4.56-4.57,10.02-6.85,16.37-6.85h92.9c3.1,0,4.65,1.55,4.65,4.65v13.94c0,3.1-1.55,4.65-4.65,4.65h-69.67c-3.25,0-6,1.12-8.25,3.37-2.25,2.25-3.37,4.99-3.37,8.25s1.12,6,3.37,8.25c2.24,2.25,4.99,3.37,8.25,3.37h51.09c6.35,0,11.8,2.29,16.37,6.85,4.57,4.57,6.85,10.03,6.85,16.37v23.22c0,6.35-2.29,11.81-6.85,16.37-4.57,4.57-10.03,6.85-16.37,6.85h-92.9c-3.1,0-4.64-1.55-4.64-4.65Z"/>
        <path d="M286.16,121.85c-4.57-4.57-6.85-10.02-6.85-16.37V35.81c0-6.35,2.28-11.81,6.85-16.37,4.56-4.57,10.02-6.85,16.37-6.85h74.32c6.35,0,11.8,2.29,16.37,6.85,4.57,4.57,6.85,10.03,6.85,16.37v23.22c0,6.35-2.29,11.81-6.85,16.37-4.57,4.57-10.03,6.85-16.37,6.85h-62.71v11.61c0,3.25,1.12,6,3.37,8.25,2.24,2.25,4.99,3.37,8.25,3.37h69.67c3.1,0,4.65,1.55,4.65,4.65v13.93c0,3.1-1.55,4.65-4.65,4.65h-92.9c-6.35,0-11.81-2.28-16.37-6.85ZM361.87,55.66c2.24-2.24,3.37-4.99,3.37-8.25s-1.12-6-3.37-8.25c-2.25-2.24-4.99-3.37-8.25-3.37h-27.87c-3.25,0-6,1.12-8.25,3.37-2.25,2.25-3.37,4.99-3.37,8.25v11.61h39.48c3.25,0,6-1.12,8.25-3.37Z"/>
      </g>
      {/* AI */}
      <g fill="var(--accent)">
        <path d="M432.08,126.44c-4.76-4.76-7.14-10.44-7.14-17.06v-24.2c0-6.61,2.38-12.3,7.14-17.06,4.76-4.76,10.44-7.14,17.06-7.14h65.34v-12.1c0-3.39-1.17-6.25-3.51-8.59-2.34-2.34-5.2-3.51-8.59-3.51h-72.6c-3.23,0-4.84-1.61-4.84-4.84v-14.52c0-3.23,1.61-4.84,4.84-4.84h96.8c6.61,0,12.3,2.38,17.06,7.14,4.76,4.76,7.14,10.45,7.14,17.06v72.6c0,6.62-2.38,12.3-7.14,17.06-4.76,4.76-10.45,7.14-17.06,7.14h-77.44c-6.62,0-12.3-2.38-17.06-7.14ZM510.97,105.87c2.34-2.34,3.51-5.2,3.51-8.59v-12.1h-41.14c-3.39,0-6.25,1.17-8.59,3.51-2.34,2.34-3.51,5.2-3.51,8.59s1.17,6.25,3.51,8.59c2.34,2.34,5.2,3.51,8.59,3.51h29.04c3.39,0,6.25-1.17,8.59-3.51Z"/>
        <path d="M562.87,128.74V17.42c0-3.23,1.61-4.84,4.84-4.84h26.62c3.23,0,4.84,1.61,4.84,4.84v111.32c0,3.23-1.61,4.84-4.84,4.84h-26.62c-3.23,0-4.84-1.61-4.84-4.84Z"/>
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const AI_TOOLS = [
  { name: 'Claude Code', color: '#d4a27a' },
  { name: 'Cursor', color: '#7c6af6' },
  { name: 'GitHub Copilot', color: '#79c0ff' },
  { name: 'Windsurf', color: '#00c2a8' },
  { name: 'Gemini CLI', color: '#4285f4' },
  { name: 'Aider', color: '#4ade80' },
  { name: 'Amazon Q', color: '#ff9900' },
  { name: 'Codex CLI', color: '#10a37f' },
  { name: 'Augment', color: '#e879f9' },
  { name: 'Amp', color: '#f87171' },
];

const METRICS = [
  {
    icon: Brain,
    title: 'Session Intelligence',
    description: 'Every session captured: duration, model, tool, milestones, and AI-evaluated quality scores.',
    accent: 'var(--accent)',
  },
  {
    icon: Target,
    title: 'Task Distribution',
    description: 'See how your time splits across coding, debugging, testing, planning, and reviewing.',
    accent: '#3b82f6',
  },
  {
    icon: Sparkles,
    title: 'Prompt Quality',
    description: 'AI-assessed prompt clarity, context quality, and scope precision — averaged over time.',
    accent: '#8b5cf6',
  },
  {
    icon: Gauge,
    title: 'Output Velocity',
    description: 'Files touched, milestones hit, and tools leveraged per session. Track your throughput.',
    accent: 'var(--accent)',
  },
  {
    icon: Clock,
    title: 'Time Patterns',
    description: 'Heatmaps of your most productive hours and days. Find your flow state.',
    accent: '#f59e0b',
  },
  {
    icon: TrendingUp,
    title: 'AI Independence',
    description: 'How self-directed are you? Track the ratio of clear specs to back-and-forth clarifications.',
    accent: '#34d399',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Install',
    description: 'One command adds UseAI to your MCP config. Works with any MCP-compatible AI tool.',
    command: 'npx @devness/useai setup',
  },
  {
    step: '02',
    title: 'Code',
    description: 'Use your AI tools as usual. Sessions are tracked automatically in the background.',
    command: '# just code — tracking is automatic',
  },
  {
    step: '03',
    title: 'Grow',
    description: 'Review your stats, identify patterns, and watch your AI proficiency improve over time.',
    command: 'npx @devness/useai stats',
  },
];

const RADAR_DIMENSIONS = [
  { label: 'Prompt Quality', value: 0.82, description: 'Clarity, specificity, and completeness of your prompts' },
  { label: 'Context', value: 0.68, description: 'How well you provide relevant files, errors, and constraints' },
  { label: 'Scope', value: 0.74, description: 'Task sizing — precise and achievable, not vague or sprawling' },
  { label: 'Independence', value: 0.91, description: 'Self-directed execution vs. constant clarification' },
  { label: 'Tooling', value: 0.57, description: 'Breadth of AI capabilities leveraged per session' },
];

const PRIVACY_CARDS = [
  {
    icon: Database,
    title: 'Zero Capture',
    description: 'We never see your code, prompts, or file paths. Session data stays on your machine.',
  },
  {
    icon: Lock,
    title: 'Local-First',
    description: 'All tracking runs via a local daemon. Your data is stored in ~/.useai — you own it.',
  },
  {
    icon: Fingerprint,
    title: 'Cryptographic Proof',
    description: 'Every session is HMAC-signed. Milestones are verifiable without exposing private details.',
  },
];

const APS_COMPONENTS = [
  { name: 'Prompt Quality', weight: '25%' },
  { name: 'Context Provided', weight: '20%' },
  { name: 'Scope Quality', weight: '20%' },
  { name: 'Independence Level', weight: '20%' },
  { name: 'Task Completion', weight: '15%' },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.08 } },
};

/* ------------------------------------------------------------------ */
/*  Skill Radar SVG                                                    */
/* ------------------------------------------------------------------ */

function SkillRadar() {
  const cx = 150,
    cy = 150,
    maxR = 110;
  const values = RADAR_DIMENSIONS.map((d) => d.value);
  const n = values.length;
  const angleStep = (2 * Math.PI) / n;

  const pointAt = (i: number, r: number) => {
    const angle = -Math.PI / 2 + i * angleStep;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const dataPoints = values.map((v, i) => pointAt(i, v * maxR));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';

  return (
    <svg viewBox="0 0 300 300" className="w-full max-w-[300px]">
      {/* Grid rings */}
      {gridLevels.map((level) => {
        const pts = Array.from({ length: n }, (_, i) => pointAt(i, level * maxR));
        const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
        return <path key={level} d={path} fill="none" stroke="var(--bg-surface-3)" strokeWidth="1" opacity="0.6" />;
      })}
      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = pointAt(i, maxR);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--bg-surface-3)" strokeWidth="1" opacity="0.4" />;
      })}
      {/* Data polygon */}
      <path d={dataPath} fill="rgba(var(--accent-rgb), 0.2)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="var(--accent-bright)" />
      ))}
      {/* Labels */}
      {RADAR_DIMENSIONS.map((dim, i) => {
        const [x, y] = pointAt(i, maxR + 24);
        return (
          <text
            key={dim.label}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-text-secondary text-[10px]"
          >
            {dim.label}
          </text>
        );
      })}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Copy-to-clipboard button                                           */
/* ------------------------------------------------------------------ */

function CopyCommand({ command, className = '' }: { command: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className={`group inline-flex items-center gap-3 px-5 py-3 rounded-xl border border-border bg-bg-surface-1 font-mono text-sm text-text-secondary hover:border-accent/40 hover:text-text-primary transition-colors cursor-pointer ${className}`}
    >
      <span className="text-text-muted select-none">$</span>
      <span>{command}</span>
      {copied ? (
        <Check className="w-4 h-4 text-accent shrink-0" />
      ) : (
        <Clipboard className="w-4 h-4 text-text-muted group-hover:text-accent shrink-0 transition-colors" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base overflow-x-hidden">
      {/* ── Nav ── */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-bg-base/80 border-b border-border/30">
        <div className="flex items-center justify-between max-w-6xl mx-auto px-6 py-4">
          <UseAILogo className="h-5" />
          <div className="flex items-center gap-6">
            <a href="#features" className="hidden sm:block text-sm text-text-muted hover:text-text-primary transition-colors">
              Features
            </a>
            <Link href="/leaderboard" className="hidden sm:block text-sm text-text-muted hover:text-text-primary transition-colors">
              Leaderboard
            </Link>
            <a
              href="https://github.com/AhmedElBanna/useai"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:block text-sm text-text-muted hover:text-text-primary transition-colors"
            >
              GitHub
            </a>
            <Link
              href="/login"
              className="text-sm font-bold text-accent hover:text-accent-bright transition-colors"
            >
              Log in
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative">
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="absolute inset-0 dot-pattern pointer-events-none opacity-40" />
        <div className="relative max-w-4xl mx-auto px-6 pt-28 pb-20 text-center">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={stagger}
            className="flex flex-col items-center"
          >
            <motion.div
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-bold uppercase tracking-widest mb-8"
            >
              <Zap className="w-3 h-3" />
              Not a time tracker. A proficiency tracker.
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight text-text-primary leading-[1.08] mb-6"
            >
              Know how you code{' '}
              <span className="gradient-text">with AI</span>
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-10 leading-relaxed"
            >
              UseAI tracks every AI coding session — across every tool — and turns raw activity
              into a proficiency profile you can measure, share, and prove.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-accent hover:bg-accent-bright text-black font-bold rounded-xl transition-colors"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <CopyCommand command="npx @devness/useai setup" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Tool Strip ── */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          {AI_TOOLS.map((tool) => (
            <motion.span
              key={tool.name}
              variants={fadeUp}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 bg-bg-surface-1/50 text-xs font-medium text-text-secondary"
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: tool.color }} />
              {tool.name}
            </motion.span>
          ))}
        </motion.div>
      </section>

      <div className="section-divider max-w-xl mx-auto" />

      {/* ── The Gap ── */}
      <section className="max-w-3xl mx-auto px-6 py-24 text-center">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
        >
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-widest text-accent mb-4">
            The problem
          </motion.p>
          <motion.h2
            variants={fadeUp}
            className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary leading-tight mb-6"
          >
            You can&apos;t improve what you don&apos;t measure
          </motion.h2>
          <motion.p variants={fadeUp} className="text-text-secondary text-lg leading-relaxed max-w-xl mx-auto">
            You use AI tools every day but have no idea which sessions are productive, which prompts
            work best, or how your skills are actually evolving. UseAI makes the invisible visible.
          </motion.p>
        </motion.div>
      </section>

      <div className="section-divider max-w-xl mx-auto" />

      {/* ── What Gets Measured ── */}
      <section id="features" className="max-w-6xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-widest text-accent mb-4">
            What gets measured
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
            One dashboard for every AI tool
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {METRICS.map((m) => (
            <motion.div
              key={m.title}
              variants={fadeUp}
              className="group p-6 rounded-xl border border-border/50 bg-bg-surface-1 hover:border-accent/30 transition-colors"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                style={{ background: `color-mix(in srgb, ${m.accent} 10%, transparent)` }}
              >
                <m.icon className="w-5 h-5" style={{ color: m.accent }} />
              </div>
              <h3 className="text-base font-bold text-text-primary mb-2">{m.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{m.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <div className="section-divider max-w-xl mx-auto" />

      {/* ── How It Works ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-widest text-accent mb-4">
            Three steps. Thirty seconds.
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
            How it works
          </motion.h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Steps */}
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
            className="space-y-8"
          >
            {STEPS.map((s) => (
              <motion.div key={s.step} variants={fadeUp} className="flex gap-5">
                <div className="text-2xl font-extrabold text-accent/30 shrink-0 w-10 pt-0.5">{s.step}</div>
                <div>
                  <h3 className="text-lg font-bold text-text-primary mb-1">{s.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed mb-2">{s.description}</p>
                  <code className="text-xs font-mono text-accent/70">{s.command}</code>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Terminal mockup */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-xl border border-border bg-bg-surface-1 overflow-hidden shadow-2xl"
          >
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-bg-surface-2/50">
              <div className="w-3 h-3 rounded-full bg-error/60" />
              <div className="w-3 h-3 rounded-full bg-streak/60" />
              <div className="w-3 h-3 rounded-full bg-accent/60" />
              <span className="text-xs text-text-muted font-mono ml-2">Terminal</span>
            </div>
            <div className="p-5 font-mono text-xs sm:text-sm leading-relaxed space-y-4">
              {/* Setup */}
              <div>
                <div className="text-text-muted">$ npx @devness/useai setup</div>
                <div className="text-accent mt-1.5">&#10003; MCP server configured for Claude Code</div>
                <div className="text-accent">&#10003; Daemon started on port 19200</div>
                <div className="text-text-muted mt-1">Ready — sessions will be tracked automatically.</div>
              </div>

              {/* Stats */}
              <div className="border-t border-border/50 pt-4">
                <div className="text-text-muted">$ npx @devness/useai stats</div>
                <div className="mt-1.5 text-text-secondary">
                  <div className="text-accent font-bold mb-1">AI Proficiency Score: 78 / 100</div>
                  <div>Sessions today: <span className="text-text-primary">4</span> &nbsp;|&nbsp; Week: <span className="text-text-primary">23</span></div>
                  <div>Prompt quality: <span className="text-accent">4.1</span> / 5</div>
                  <div>Top tool: <span className="text-text-primary">Claude Code</span> (68%)</div>
                  <div>Completion rate: <span className="text-accent">92%</span></div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      <div className="section-divider max-w-xl mx-auto" />

      {/* ── Skill Profile ── */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-widest text-accent mb-4">
            Skill profile
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
            Five dimensions of AI proficiency
          </motion.h2>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5 }}
            className="flex justify-center"
          >
            <SkillRadar />
          </motion.div>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-40px' }}
            variants={stagger}
            className="space-y-5"
          >
            {RADAR_DIMENSIONS.map((dim) => (
              <motion.div key={dim.label} variants={fadeUp} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-accent">{Math.round(dim.value * 100)}</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">{dim.label}</h3>
                  <p className="text-xs text-text-muted leading-relaxed">{dim.description}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <div className="section-divider max-w-xl mx-auto" />

      {/* ── Privacy ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-widest text-accent mb-4">
            Privacy
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
            Privacy by architecture, not policy
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          className="grid md:grid-cols-3 gap-4"
        >
          {PRIVACY_CARDS.map((card) => (
            <motion.div
              key={card.title}
              variants={fadeUp}
              className="glass-card rounded-xl p-6"
            >
              <card.icon className="w-6 h-6 text-accent mb-4" />
              <h3 className="text-base font-bold text-text-primary mb-2">{card.title}</h3>
              <p className="text-sm text-text-muted leading-relaxed">{card.description}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <div className="section-divider max-w-xl mx-auto" />

      {/* ── Supported Tools ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-widest text-accent mb-4">
            Universal
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary">
            Every AI tool, one profile
          </motion.h2>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-40px' }}
          variants={stagger}
          className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3"
        >
          {AI_TOOLS.map((tool) => (
            <motion.div
              key={tool.name}
              variants={fadeUp}
              className="flex items-center gap-2.5 p-3 rounded-xl border border-border/50 bg-bg-surface-1"
            >
              <span className="w-3 h-3 rounded-full shrink-0" style={{ background: tool.color }} />
              <span className="text-sm font-medium text-text-secondary truncate">{tool.name}</span>
            </motion.div>
          ))}
        </motion.div>
      </section>

      <div className="section-divider max-w-xl mx-auto" />

      {/* ── Community / Leaderboard ── */}
      <section className="max-w-5xl mx-auto px-6 py-24">
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-60px' }}
          variants={stagger}
          className="text-center mb-14"
        >
          <motion.p variants={fadeUp} className="text-sm font-bold uppercase tracking-widest text-accent mb-4">
            Community
          </motion.p>
          <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-extrabold tracking-tight text-text-primary mb-4">
            Opt in. Rise up.
          </motion.h2>
          <motion.p variants={fadeUp} className="text-text-secondary text-lg max-w-xl mx-auto leading-relaxed">
            Your proficiency is measured by the AI Proficiency Score (APS) — a weighted composite
            of the five dimensions every AI evaluates per session.
          </motion.p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* APS breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-border/50 bg-bg-surface-1 p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Trophy className="w-5 h-5 text-accent" />
              <h3 className="text-base font-bold text-text-primary">APS Components</h3>
            </div>
            <div className="space-y-3">
              {APS_COMPONENTS.map((c) => (
                <div key={c.name} className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">{c.name}</span>
                  <span className="text-sm font-mono font-bold text-accent">{c.weight}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Leaderboard preview */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-xl border border-border/50 bg-bg-surface-1 p-6"
          >
            <div className="flex items-center gap-2 mb-5">
              <Users className="w-5 h-5 text-accent" />
              <h3 className="text-base font-bold text-text-primary">Leaderboard</h3>
            </div>
            <div className="space-y-3">
              {['Developer profiles with verified APS', 'Rankings by score, sessions, and streaks', 'Public milestones — cryptographically signed', 'Opt-in only — private by default'].map((item) => (
                <div key={item} className="flex items-start gap-2.5">
                  <ChevronRight className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                  <span className="text-sm text-text-secondary leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-accent hover:text-accent-bright transition-colors mt-5"
            >
              View leaderboard
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        </div>
      </section>

      <div className="section-divider max-w-xl mx-auto" />

      {/* ── Final CTA ── */}
      <section className="relative">
        <div className="absolute inset-0 hero-glow pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 py-28 text-center">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={stagger}
            className="flex flex-col items-center"
          >
            <motion.h2
              variants={fadeUp}
              className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-text-primary mb-4"
            >
              Start tracking in 30 seconds
            </motion.h2>
            <motion.p variants={fadeUp} className="text-text-secondary text-lg mb-10 max-w-lg mx-auto leading-relaxed">
              One command. Zero config. Works with every MCP-compatible AI tool.
            </motion.p>
            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-7 py-3.5 bg-accent hover:bg-accent-bright text-black font-bold rounded-xl transition-colors"
              >
                Get Started
                <ArrowRight className="w-4 h-4" />
              </Link>
              <CopyCommand command="npx @devness/useai setup" />
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border/50 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
          <UseAILogo className="h-3.5" />
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/AhmedElBanna/useai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              GitHub
            </a>
            <a
              href="https://www.npmjs.com/package/@devness/useai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-text-muted hover:text-text-primary transition-colors"
            >
              npm
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
