'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import HeroHeading from '@/components/HeroHeading';
import {
  ArrowRight,
  BarChart3,
  Users,
  Shield,
  Globe,
  Clipboard,
  Check,
  Clock,
  Target,
  Gauge,
  TrendingUp,
  Lock,
  Database,
  Fingerprint,
  Trophy,
  Activity,
  Github,
  Eye,
  Code2,
  ShieldCheck
} from 'lucide-react';
import { SUPPORTED_AI_TOOLS, TOOL_ICONS, TOOL_COLORS } from '@useai/shared/constants/tools';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const AI_TOOLS = [
  { name: 'Claude Code', color: '#d4a27a', glow: 'rgba(212, 162, 122, 0.4)' },
  { name: 'Cursor', color: '#7c6af6', glow: 'rgba(124, 106, 246, 0.4)' },
  { name: 'GitHub Copilot', color: '#79c0ff', glow: 'rgba(121, 192, 255, 0.4)' },
  { name: 'Windsurf', color: '#00c2a8', glow: 'rgba(0, 194, 168, 0.4)' },
  { name: 'Gemini CLI', color: '#4285f4', glow: 'rgba(66, 133, 244, 0.4)' },
  { name: 'Aider', color: '#4ade80', glow: 'rgba(74, 222, 128, 0.4)' },
  { name: 'Amazon Q', color: '#ff9900', glow: 'rgba(255, 153, 0, 0.4)' },
  { name: 'Codex CLI', color: '#10a37f', glow: 'rgba(16, 163, 127, 0.4)' },
  { name: 'Augment', color: '#e879f9', glow: 'rgba(232, 121, 249, 0.4)' },
  { name: 'Amp', color: '#f87171', glow: 'rgba(248, 113, 113, 0.4)' },
];

const FEATURES = [
  {
    icon: Clock,
    title: 'Session Log',
    description: 'Every AI session recorded — what you worked on, how long it took, which tool you used, and the milestones you hit. Your searchable development history.',
    accent: 'var(--accent)',
  },
  {
    icon: Target,
    title: 'Output Breakdown',
    description: 'Features shipped. Bugs fixed. Refactors completed. Reviews done. See your real output — categorized by type and complexity, not just lines of code.',
    accent: '#3b82f6',
  },
  {
    icon: BarChart3,
    title: 'Time Allocation',
    description: 'Are you mostly debugging or mostly building? See exactly where your AI hours go — by task type, by day, by week, by month.',
    accent: '#8b5cf6',
  },
  {
    icon: Gauge,
    title: 'Complexity Profile',
    description: 'Not all work is equal. Track whether you\'re tackling complex architecture or quick fixes. Understand your output fingerprint.',
    accent: 'var(--accent)',
  },
  {
    icon: TrendingUp,
    title: 'Skill Growth',
    description: 'Sessions scored with the SPACE framework — prompt quality, context, independence, and scope. Watch your scores improve over weeks and months.',
    accent: '#f59e0b',
  },
  {
    icon: Activity,
    title: 'Time Investment',
    description: 'How many hours did you spend with AI this week? This month? Finally have a real number for how AI fits into your workflow.',
    accent: '#34d399',
  },
];

const STEPS = [
  {
    step: '01',
    title: 'Install',
    description: 'One command sets up the MCP server. Works with Claude Code, Cursor, Copilot, Windsurf, and 10+ AI tools.',
    command: 'npx @devness/useai',
  },
  {
    step: '02',
    title: 'Work',
    description: 'Just code. UseAI runs as a silent background daemon — no extra tabs, no context switching, no manual logging.',
    command: 'Daemon running silently...',
  },
  {
    step: '03',
    title: 'Discover',
    description: 'Open your dashboard. See what you\'ve built, where your time went, and how your skills are trending.',
    command: 'npx @devness/useai stats',
  },
];

const RADAR_DIMENSIONS = [
  { label: 'Prompt Quality', value: 0.82, description: 'Clarity, specificity, completeness' },
  { label: 'Context', value: 0.68, description: 'Provision of files, errors, constraints' },
  { label: 'Scope', value: 0.74, description: 'Task sizing and precision' },
  { label: 'Independence', value: 0.91, description: 'Self-directed execution capability' },
  { label: 'Tooling', value: 0.57, description: 'Breadth of AI capabilities leveraged' },
];

/* ------------------------------------------------------------------ */
/*  Animation variants                                                 */
/* ------------------------------------------------------------------ */

import type { Variants } from 'motion/react';

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', damping: 20, stiffness: 100 } },
};

const stagger: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1 } },
};


/* ------------------------------------------------------------------ */
/*  Cyber Elements                                                     */
/* ------------------------------------------------------------------ */

function SkillRadar() {
  const cx = 150, cy = 150, maxR = 100;
  const values = RADAR_DIMENSIONS.map((d) => d.value);
  const n = values.length;
  const angleStep = (2 * Math.PI) / n;

  const pointAt = (i: number, r: number) => {
    const angle = -Math.PI / 2 + i * angleStep;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const dataPoints = values.map((v, i) => pointAt(i, v * maxR));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';

  return (
    <div className="relative w-full max-w-[260px] sm:max-w-[320px] aspect-square flex items-center justify-center mx-auto">
      <div className="absolute inset-0 bg-[var(--accent-alpha)] rounded-full blur-3xl animate-pulse" />
      <div className="pulse-ring w-full h-full" />
      
      <svg viewBox="0 0 300 300" className="relative z-10 w-full drop-shadow-[0_0_15px_rgba(var(--accent-rgb),0.3)]">
        {/* Hexagonal/pentagonal grids */}
        {[0.25, 0.5, 0.75, 1.0].map((level) => {
          const pts = Array.from({ length: n }, (_, i) => pointAt(i, level * maxR));
          const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
          return <path key={level} d={path} fill="none" stroke="var(--border-accent)" strokeWidth="1" strokeDasharray="2 4" opacity="0.6" />;
        })}
        {/* Axes */}
        {Array.from({ length: n }, (_, i) => {
          const [x, y] = pointAt(i, maxR);
          return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="var(--border-accent)" strokeWidth="1" opacity="0.4" />;
        })}
        {/* Data polygon with glow */}
        <path d={dataPath} fill="var(--accent-alpha)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
        {/* Data dots */}
        {dataPoints.map((p, i) => (
          <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="var(--bg-base)" stroke="var(--accent)" strokeWidth="2" />
        ))}
        {/* Labels positioned further out */}
        {RADAR_DIMENSIONS.map((dim, i) => {
          const [x, y] = pointAt(i, maxR + 25);
          return (
            <text 
              key={dim.label} x={x} y={y} 
              textAnchor="middle" dominantBaseline="central" 
              className="fill-text-primary text-[10px] font-mono tracking-wider"
            >
              {dim.label.toUpperCase()}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

function TerminalMockup() {
  const [lines, setLines] = useState<number>(0);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setLines(l => (l < 5 ? l + 1 : l));
    }, 800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="hud-border rounded-xl bg-bg-surface-1 overflow-hidden shadow-[0_0_30px_var(--shadow-glow)] relative">
      <div className="scanner-line" />
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 sm:py-3 border-b border-border bg-bg-surface-2">
        <div className="flex gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent/60 shadow-[0_0_5px_var(--accent)]" />
        </div>
        <span className="text-[9px] sm:text-[10px] text-text-muted font-mono tracking-widest">USEAI_UPLINK_V1</span>
      </div>
      <div className="p-4 sm:p-6 font-mono text-xs sm:text-sm leading-relaxed min-h-[220px] sm:min-h-[280px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-text-muted">
          <span className="text-accent">&gt;</span> npx @devness/useai stats
        </motion.div>
        
        {lines > 0 && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mt-4 text-text-primary space-y-2">
            <div className="flex justify-between border-b border-border-accent pb-2">
              <span className="text-text-secondary">THIS WEEK</span>
              <span className="text-accent text-[10px] bg-[var(--accent-alpha)] px-2 py-0.5 rounded-md border border-accent/20">12 sessions</span>
            </div>

            {lines > 1 && (
              <div className="flex items-center gap-2 sm:gap-4 py-2">
                <Clock className="w-4 h-4 text-accent shrink-0" />
                <span>Active Time: <span className="text-accent font-bold">8h 42m</span></span>
              </div>
            )}

            {lines > 2 && (
              <div className="flex items-center gap-2 sm:gap-4 py-2">
                <Target className="w-4 h-4 text-blue-400 shrink-0" />
                <span className="truncate">Output: <span className="text-text-primary">6 features</span> <span className="text-text-muted">· 3 fixes · 2 refactors</span></span>
              </div>
            )}

            {lines > 3 && (
              <div className="flex items-center gap-2 sm:gap-4 py-2">
                <Gauge className="w-4 h-4 text-purple-400 shrink-0" />
                <span className="truncate">Complexity: <span className="text-text-primary">4 complex</span> <span className="text-text-muted">· 5 medium · 2 simple</span></span>
              </div>
            )}

            {lines > 4 && (
              <div className="flex items-center gap-2 sm:gap-4 py-2 text-accent">
                <TrendingUp className="w-4 h-4 shrink-0" />
                <span className="animate-pulse truncate">SPACE: 82 — Rank #4,092 (Top 12%)</span>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
}

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
      className={`group relative inline-flex items-center gap-2 sm:gap-4 px-4 sm:px-6 py-3 sm:py-3.5 rounded-xl border border-border-accent bg-bg-surface-1 font-mono text-xs sm:text-sm text-text-secondary hover:text-accent transition-all cursor-pointer overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-[var(--accent-alpha)] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
      <span className="text-text-muted select-none group-hover:animate-pulse z-10">&gt;</span>
      <span className="z-10 tracking-wide text-text-primary truncate">{command}</span>
      {copied ? (
        <Check className="w-4 h-4 text-accent shrink-0 z-10 drop-shadow-[0_0_8px_var(--accent)]" />
      ) : (
        <Clipboard className="w-4 h-4 text-text-muted group-hover:text-accent shrink-0 transition-colors z-10" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero Dashboard Animation                                           */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  Tool Marquee                                                       */
/* ------------------------------------------------------------------ */

/** Split tools into two rows for dual marquee. */
const MARQUEE_KEYS_ROW1 = ['cursor', 'claude-code', 'gemini-cli', 'codex', 'windsurf', 'opencode'];
const MARQUEE_KEYS_ROW2 = ['aider', 'amazon-q-cli', 'github-copilot', 'vscode', 'cline', 'zed', 'augment', 'goose', 'amp', 'junie', 'roo-code', 'continue', 'trae'];
const MARQUEE_ROW1 = SUPPORTED_AI_TOOLS.filter(t => MARQUEE_KEYS_ROW1.includes(t.key));
const MARQUEE_ROW2 = SUPPORTED_AI_TOOLS.filter(t => MARQUEE_KEYS_ROW2.includes(t.key));

function ToolChip({ tool }: { tool: (typeof SUPPORTED_AI_TOOLS)[number] }) {
  const color = TOOL_COLORS[tool.key] ?? '#91919a';
  const iconSrc = TOOL_ICONS[tool.key];
  const iconMask = iconSrc
    ? {
        WebkitMaskImage: `url("${iconSrc}")`,
        maskImage: `url("${iconSrc}")`,
        WebkitMaskRepeat: 'no-repeat',
        maskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskPosition: 'center',
        WebkitMaskSize: 'contain',
        maskSize: 'contain',
        backgroundColor: color,
      } as React.CSSProperties
    : undefined;

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg border border-border/30 bg-bg-surface-1/50">
      {iconSrc ? (
        <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 block shrink-0" style={iconMask} />
      ) : (
        <span className="text-[8px] sm:text-[9px] font-black shrink-0" style={{ color }}>{tool.name.slice(0, 2).toUpperCase()}</span>
      )}
      <span className="text-[9px] sm:text-[10px] font-mono text-text-muted whitespace-nowrap">{tool.name}</span>
    </div>
  );
}

function ToolMarquee() {
  const row1 = [...MARQUEE_ROW1, ...MARQUEE_ROW1];
  const row2 = [...MARQUEE_ROW2, ...MARQUEE_ROW2];

  return (
    <div className="mt-3 sm:mt-5 px-0">
      <div className="max-w-full sm:max-w-md mx-auto lg:mx-0 lg:ml-auto w-full overflow-hidden relative">
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-6 sm:w-10 z-10 bg-gradient-to-r from-bg-base to-transparent pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-6 sm:w-10 z-10 bg-gradient-to-l from-bg-base to-transparent pointer-events-none" />

        {/* Row 1 -- scrolls left, slower */}
        <div
          className="flex gap-2 sm:gap-3 animate-marquee"
          style={{ width: 'max-content', animationDuration: '35s' }}
        >
          {row1.map((tool, i) => <ToolChip key={`r1-${tool.key}-${i}`} tool={tool} />)}
        </div>

        {/* Row 2 -- scrolls right, faster */}
        <div
          className="flex gap-2 sm:gap-3 mt-1.5 sm:mt-2 animate-marquee-reverse"
          style={{ width: 'max-content', animationDuration: '25s' }}
        >
          {row2.map((tool, i) => <ToolChip key={`r2-${tool.key}-${i}`} tool={tool} />)}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero Dashboard Animation                                           */
/* ------------------------------------------------------------------ */

const DASHBOARD_SECTIONS = [
  {
    key: 'activity',
    label: 'THIS WEEK',
    badge: 'FEB 17 – 23',
    summary: '12 sessions · 8h 42m · 11 milestones',
  },
  {
    key: 'output',
    label: 'OUTPUT',
    badge: '11 shipped',
    summary: '6 features · 3 fixes · 2 refactors',
  },
  {
    key: 'growth',
    label: 'GROWTH',
    badge: '+6 pts',
    summary: 'SPACE 82 / 100 · Rank #4,092',
  },
] as const;

function HeroDashboardPreview() {
  const [activeSection, setActiveSection] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveSection((s) => (s + 1) % 3);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full relative z-10 px-0">
      <div className="max-w-full sm:max-w-md mx-auto lg:mx-0 lg:ml-auto w-full">
        <div className="hud-border rounded-xl bg-bg-surface-1/90 backdrop-blur-md overflow-hidden shadow-[0_0_30px_var(--shadow-glow)]">
          {/* Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-2.5 border-b border-border bg-bg-surface-2">
            <span className="text-[9px] sm:text-[10px] font-mono text-text-muted tracking-widest flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              USEAI_DASHBOARD
            </span>
            <div className="flex gap-1.5">
              <div className="w-2 h-2 rounded-full bg-border" />
              <div className="w-2 h-2 rounded-full bg-border" />
              <div className="w-2 h-2 rounded-full bg-accent/60 shadow-[0_0_4px_var(--accent)]" />
            </div>
          </div>

          <div className="p-3 sm:p-4 md:p-5 space-y-0">
            {DASHBOARD_SECTIONS.map((section, idx) => {
              const isActive = activeSection === idx;
              return (
                <div key={section.key}>
                  {/* Section Header — always visible */}
                  <button
                    onClick={() => setActiveSection(idx)}
                    className={`w-full flex items-center justify-between py-2.5 cursor-pointer transition-colors duration-300 ${
                      isActive ? 'opacity-100' : 'opacity-50 hover:opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <motion.div
                        animate={{ scale: isActive ? 1 : 0.7, backgroundColor: isActive ? 'var(--accent)' : 'var(--border)' }}
                        transition={{ duration: 0.3 }}
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                      />
                      <span className="text-[9px] font-mono text-text-muted tracking-widest">{section.label}</span>
                    </div>
                    <AnimatePresence mode="wait">
                      {!isActive && (
                        <motion.span
                          key="summary"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 0.6, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.25 }}
                          className="text-[8px] sm:text-[9px] font-mono text-text-muted truncate max-w-[55%] sm:max-w-none text-right"
                        >
                          {section.summary}
                        </motion.span>
                      )}
                      {isActive && (
                        <motion.span
                          key="badge"
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.25 }}
                          className="text-[9px] font-mono text-accent"
                        >
                          {section.badge}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>

                  {/* Expanded Content */}
                  <AnimatePresence initial={false}>
                    {isActive && (
                      <motion.div
                        key={`content-${section.key}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ height: { duration: 0.4, ease: [0.4, 0, 0.2, 1] }, opacity: { duration: 0.3, delay: 0.05 } }}
                        className="overflow-hidden"
                      >
                        <div className="pb-3">
                          {/* Activity Content */}
                          {section.key === 'activity' && (
                            <div className="grid grid-cols-3 gap-2">
                              {[
                                { value: '12', label: 'SESSIONS', highlight: false },
                                { value: '8h 42m', label: 'ACTIVE', highlight: true },
                                { value: '11', label: 'MILESTONES', highlight: false },
                              ].map((stat, i) => (
                                <motion.div
                                  key={stat.label}
                                  initial={{ opacity: 0, y: 12 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ duration: 0.35, delay: i * 0.08 }}
                                  className={`bg-bg-surface-2/80 rounded-lg p-2 sm:p-2.5 text-center border ${stat.highlight ? 'border-accent/20' : 'border-border/30'}`}
                                >
                                  <motion.div
                                    initial={{ scale: 0.8 }}
                                    animate={{ scale: 1 }}
                                    transition={{ duration: 0.3, delay: 0.15 + i * 0.08 }}
                                    className={`text-base sm:text-lg font-black leading-none mb-0.5 ${stat.highlight ? 'text-accent' : 'text-text-primary'}`}
                                  >
                                    {stat.value}
                                  </motion.div>
                                  <div className="text-[7px] sm:text-[8px] font-mono text-text-muted tracking-wider">{stat.label}</div>
                                </motion.div>
                              ))}
                            </div>
                          )}

                          {/* Output Content */}
                          {section.key === 'output' && (
                            <div>
                              <div className="space-y-2">
                                {[
                                  { label: 'Features', count: 6, pct: 55, color: 'bg-accent' },
                                  { label: 'Bug Fixes', count: 3, pct: 27, color: 'bg-blue-400' },
                                  { label: 'Refactors', count: 2, pct: 18, color: 'bg-purple-400' },
                                ].map((item, i) => (
                                  <motion.div
                                    key={item.label}
                                    initial={{ opacity: 0, x: -16 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ duration: 0.3, delay: i * 0.1 }}
                                    className="flex items-center gap-2.5"
                                  >
                                    <span className="text-[10px] font-mono text-text-secondary w-16 shrink-0">{item.label}</span>
                                    <div className="flex-1 bg-bg-surface-2 h-1.5 rounded-full overflow-hidden">
                                      <motion.div
                                        className={`h-full ${item.color} rounded-full`}
                                        initial={{ width: '0%' }}
                                        animate={{ width: `${item.pct}%` }}
                                        transition={{ duration: 0.8, delay: 0.2 + i * 0.12, ease: [0.4, 0, 0.2, 1] }}
                                      />
                                    </div>
                                    <motion.span
                                      initial={{ opacity: 0 }}
                                      animate={{ opacity: 1 }}
                                      transition={{ duration: 0.3, delay: 0.5 + i * 0.1 }}
                                      className="text-[10px] font-mono font-bold text-text-primary w-3 text-right shrink-0"
                                    >
                                      {item.count}
                                    </motion.span>
                                  </motion.div>
                                ))}
                              </div>
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ duration: 0.3, delay: 0.6 }}
                                className="flex gap-3 mt-2.5"
                              >
                                {[
                                  { label: '4 complex', color: 'text-accent' },
                                  { label: '5 medium', color: 'text-blue-400' },
                                  { label: '2 simple', color: 'text-text-muted' },
                                ].map(c => (
                                  <span key={c.label} className={`text-[9px] font-mono ${c.color}`}>{c.label}</span>
                                ))}
                              </motion.div>
                            </div>
                          )}

                          {/* Growth Content */}
                          {section.key === 'growth' && (
                            <div className="flex items-end justify-between">
                              <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: 0.05 }}
                              >
                                <div className="flex items-baseline gap-1.5">
                                  <motion.span
                                    initial={{ scale: 0.6, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    transition={{ duration: 0.4, delay: 0.15, type: 'spring', stiffness: 200 }}
                                    className="text-2xl sm:text-3xl font-black text-accent leading-none"
                                  >
                                    82
                                  </motion.span>
                                  <span className="text-[10px] font-mono text-text-muted">/ 100</span>
                                </div>
                                <motion.div
                                  initial={{ opacity: 0, x: -8 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ duration: 0.3, delay: 0.3 }}
                                  className="text-[10px] font-mono text-green-400 mt-1 flex items-center gap-1"
                                >
                                  <TrendingUp className="w-3 h-3" /> +6 from last week
                                </motion.div>
                              </motion.div>
                              <motion.div
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.35, delay: 0.15 }}
                                className="text-right"
                              >
                                <motion.div
                                  initial={{ scale: 0.8 }}
                                  animate={{ scale: 1 }}
                                  transition={{ duration: 0.3, delay: 0.25 }}
                                  className="text-base sm:text-lg font-black text-text-primary font-mono leading-none"
                                >
                                  #4,092
                                </motion.div>
                                <div className="text-[9px] font-mono text-text-muted mt-1">Top 12% globally</div>
                              </motion.div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Divider between sections */}
                  {idx < DASHBOARD_SECTIONS.length - 1 && (
                    <div className="h-px bg-border/30" />
                  )}
                </div>
              );
            })}

            {/* Progress bar indicator */}
            <div className="pt-2">
              <div className="h-0.5 bg-bg-surface-2 rounded-full overflow-hidden">
                <motion.div
                  key={activeSection}
                  className="h-full bg-accent/60 rounded-full"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 4, ease: 'linear' }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const [heroReady, setHeroReady] = useState(false);
  const onHeroComplete = useCallback(() => setHeroReady(true), []);

  return (
    <div className="min-h-screen bg-bg-base overflow-x-clip selection:bg-accent/30 selection:text-white relative">
      <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />
      <div className="blur-blob w-[300px] h-[300px] sm:w-[450px] sm:h-[450px] lg:w-[600px] lg:h-[600px] top-[-10%] left-[-10%]" style={{ backgroundImage: 'radial-gradient(circle, rgba(var(--accent-rgb), var(--glow-opacity)) 0%, rgba(var(--accent-rgb), 0) 70%)' }} />
      <div className="blur-blob w-[250px] h-[250px] sm:w-[400px] sm:h-[400px] lg:w-[500px] lg:h-[500px] bottom-[20%] right-[-5%]" style={{ animationDelay: '-5s', backgroundImage: 'radial-gradient(circle, var(--glow-blue) 0%, rgba(59, 130, 246, 0) 70%)' }} />

      <main className="relative z-10 pb-16 sm:pb-24 lg:pb-32">
        {/* ── Hero ── */}
        <section className="relative pt-20 sm:pt-28 lg:pt-36 pb-8 sm:pb-12 overflow-x-clip min-h-[calc(100vh-90px)] xl:min-h-0 flex items-center">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 w-full grid lg:grid-cols-2 gap-8 lg:gap-6 items-center relative z-10 [&>*]:min-w-0">
            
            {/* Left Content */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left w-full min-w-0 overflow-hidden">
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="flex flex-wrap items-center gap-2 mb-4 sm:mb-6">
                <span className="hud-border px-3 py-1 rounded-full inline-flex items-center gap-2">
                  <Activity className="w-3 h-3 text-accent shrink-0" />
                  <span className="text-[9px] sm:text-[10px] font-mono text-text-secondary tracking-widest whitespace-nowrap">TRACKING 20+ AI TOOLS</span>
                </span>
                <span className="px-3 py-1 rounded-full inline-flex items-center gap-1.5 border border-accent/30 bg-[var(--accent-alpha)]">
                  <Github className="w-3 h-3 text-accent shrink-0" />
                  <span className="text-[9px] sm:text-[10px] font-mono text-accent font-bold tracking-widest whitespace-nowrap">100% OPEN SOURCE</span>
                </span>
              </motion.div>

              <HeroHeading onAnimationComplete={onHeroComplete} />

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={heroReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5 }}
                className="text-sm md:text-base text-text-muted max-w-full sm:max-w-[90%] lg:max-w-lg mb-5 sm:mb-7 leading-relaxed font-light px-1 sm:px-0"
              >
                Every session captured. Every milestone tracked. See what you build,
                where your time goes, and how your skills grow — <span className="text-text-primary font-medium">across all your AI tools.</span>
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={heroReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: 0.05 }}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-5 sm:mb-6 font-mono text-[10px] sm:text-xs tracking-wider text-text-muted"
              >
                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5 text-accent" /> Local-first</span>
                <span className="text-border">|</span>
                <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5 text-accent" /> No code ever leaves your machine</span>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={heroReady ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
                transition={{ duration: 0.5, delay: 0.1 }}
                className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-full sm:max-w-xl"
              >
                <CopyCommand command="npx @devness/useai" className="w-full sm:w-auto shrink-0 py-2.5 px-4 sm:px-5" />
              </motion.div>
            </div>

            {/* Right Content - Dashboard Preview + Tool Marquee */}
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="w-full relative z-10 overflow-hidden"
            >
              <HeroDashboardPreview />
              <ToolMarquee />
            </motion.div>
            
          </div>
        </section>

        {/* ── Visual Break ── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent my-6 sm:my-10 max-w-7xl mx-auto px-4 sm:px-6" />

        {/* ── Your AI Journal ── */}
        <section id="features" className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="grid lg:grid-cols-12 gap-8 lg:gap-12">

            <motion.div variants={fadeUp} className="lg:col-span-4 flex flex-col justify-center">
              <div className="text-[10px] font-mono tracking-widest text-accent mb-3 sm:mb-4 border-l-2 border-accent pl-2">YOUR_AI_JOURNAL</div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-text-primary mb-4 sm:mb-6">
                Everything You Build, <br/><span className="gradient-text">Nothing You Forget</span>
              </h2>
              <p className="text-sm sm:text-base text-text-muted leading-relaxed mb-6 sm:mb-8">
                What did you build today? How complex was it? Where did your hours go? UseAI captures
                your complete AI development activity — the output you shipped and the skills behind it.
              </p>
              <Link href="/explore" className="inline-flex items-center gap-2 text-accent text-sm font-mono hover:text-accent-bright max-w-max border-b border-accent/30 pb-1">
                Explore All Features <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <motion.div variants={stagger} className="lg:col-span-8 grid sm:grid-cols-2 gap-3 sm:gap-4">
              {FEATURES.map((m, i) => (
                <motion.div
                  key={m.title}
                  variants={fadeUp}
                  className="hud-border rounded-xl p-4 sm:p-6 bg-bg-surface-1/80 hover:bg-bg-surface-2 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-4 sm:mb-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-bg-surface-2 flex items-center justify-center border border-border-accent relative overflow-hidden">
                      <div className="absolute inset-0 opacity-20" style={{ background: m.accent }} />
                      <m.icon className="w-5 h-5 sm:w-6 sm:h-6 z-10" style={{ color: m.accent }} />
                    </div>
                    <span className="text-text-muted font-mono text-xs opacity-50 group-hover:opacity-100 transition-opacity">0{i+1}</span>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-text-primary mb-2 font-mono tracking-wide">{m.title}</h3>
                  <p className="text-xs sm:text-sm text-text-muted leading-relaxed">{m.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ── Privacy by Design ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-24">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            className="text-center mb-10 sm:mb-14 max-w-3xl mx-auto"
          >
            <motion.div variants={fadeUp} className="text-[10px] font-mono tracking-widest text-accent mb-3 sm:mb-4">OPEN_SOURCE · AGPL-3.0_LICENSE</motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-text-primary mb-4 sm:mb-6">
              Privacy by <span className="gradient-text">Design</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-sm sm:text-base text-text-muted leading-relaxed">
              UseAI is fully open source under the AGPL-3.0 license. No source code, no file paths, no prompts — nothing
              sensitive ever leaves your machine. Audit the code yourself.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-5">
            {[
              { icon: Code2, title: 'OPEN SOURCE', desc: 'Full source code on GitHub under the AGPL-3.0 license. Fork it, audit it, contribute to it.' },
              { icon: Eye, title: 'PUBLIC TITLES ONLY', desc: 'Milestones use generic descriptions like "Fixed auth bug" — no project names, file paths, or company info appear publicly.' },
              { icon: Database, title: 'ZERO PAYLOAD', desc: 'No source code, file paths, or prompt contents are ever transmitted. Only aggregate metrics.' },
              { icon: Lock, title: 'LOCAL DAEMON', desc: 'All processing happens locally in ~/.useai. You fully own and control your raw data.' },
              { icon: ShieldCheck, title: 'CRYPTO VERIFIED', desc: 'Sessions are Ed25519 signed and hash-chained. Tamper-proof, provable records.' },
            ].map(item => (
              <motion.div key={item.title} variants={fadeUp} className="hud-border rounded-xl p-4 sm:p-5 bg-bg-surface-1/60 hover:bg-bg-surface-2/60 transition-colors">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 mb-3 sm:mb-4">
                  <item.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-mono font-bold text-xs text-text-primary mb-2">{item.title}</h3>
                <p className="text-xs text-text-muted leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="flex justify-center mt-8 sm:mt-10"
          >
            <a
              href="https://github.com/devness-com/useai"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-accent/30 bg-[var(--accent-alpha)] font-mono text-xs sm:text-sm text-accent hover:bg-accent hover:text-bg-base transition-colors font-bold tracking-wider"
            >
              <Github className="w-4 h-4" /> VIEW ON GITHUB
            </a>
          </motion.div>
        </section>

        {/* ── Setup ── */}
        <section className="bg-bg-surface-1/30 py-16 sm:py-24 lg:py-32 relative border-y border-border/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
              <TerminalMockup />
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="space-y-8 sm:space-y-12">
              <div>
                <motion.div variants={fadeUp} className="text-[10px] font-mono tracking-widest text-accent mb-3 sm:mb-4 border-l-2 border-accent pl-2">ZERO_FRICTION</motion.div>
                <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-text-primary mb-4 sm:mb-6">
                  One Command. <span className="gradient-text-accent">Zero Friction.</span>
                </motion.h2>
                <motion.p variants={fadeUp} className="text-sm sm:text-base text-text-muted leading-relaxed">
                  UseAI is completely invisible during your workflow. No context switching,
                  no extra tabs, no manual logging. Just code — the daemon captures everything.
                </motion.p>
              </div>

              <div className="space-y-4 sm:space-y-6">
                {STEPS.map((s, idx) => (
                  <motion.div key={s.step} variants={fadeUp} className="flex gap-3 sm:gap-6 items-start group">
                    <div className="text-xs font-mono font-bold text-accent px-2 py-1 bg-[var(--accent-alpha)] border border-accent/20 rounded-md mt-1 shrink-0">
                      {s.step}
                    </div>
                    <div className="flex-1 min-w-0 border-b border-border-accent/30 pb-4 sm:pb-6 group-hover:border-accent transition-colors">
                      <h3 className="font-mono text-text-primary mb-2 tracking-wide uppercase font-bold text-sm sm:text-base">{s.title}</h3>
                      <p className="text-xs sm:text-sm text-text-muted mb-3">{s.description}</p>
                      <code className="block text-[10px] font-mono text-accent/70 bg-bg-surface-2/80 p-2 rounded-lg overflow-x-auto">
                        &gt; {s.command}
                      </code>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Your AI Identity ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-24">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            className="text-center mb-10 sm:mb-16 max-w-3xl mx-auto"
          >
            <motion.div variants={fadeUp} className="text-[10px] font-mono tracking-widest text-accent mb-3 sm:mb-4">VISIBILITY</motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-text-primary mb-4 sm:mb-6">
              Your AI Developer <br/><span className="gradient-text">Identity</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-sm sm:text-base text-text-muted leading-relaxed">
              GitHub shows your commits. UseAI shows what you built with AI and how well you wield it.
              A verified profile that proves you&#39;re not just using AI — you&#39;re proficient with it.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {[
              { icon: Globe, title: 'PUBLIC PROFILE', desc: 'A shareable page showing your AI activity — tools used, languages, output volume, complexity distribution, and SPACE scores. Your AI development resume.' },
              { icon: Fingerprint, title: 'VERIFIED MILESTONES', desc: 'Every milestone is cryptographically signed with Ed25519. Not self-reported. Not inflatable. Provable proof of what you shipped.' },
              { icon: Users, title: 'PROFESSIONAL SIGNAL', desc: 'In a world where every developer "uses AI," show you actually know how to wield it. Visible to recruiters, teams, and the community.' },
            ].map(item => (
              <motion.div key={item.title} variants={fadeUp} className="hud-border rounded-xl p-5 sm:p-6 lg:p-8 bg-bg-surface-1/60 text-center">
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 mx-auto mb-4 sm:mb-6">
                  <item.icon className="w-6 h-6 sm:w-7 sm:h-7 text-accent" />
                </div>
                <h3 className="font-mono font-bold text-sm text-text-primary mb-2 sm:mb-3">{item.title}</h3>
                <p className="text-xs sm:text-sm text-text-muted leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Leaderboard Section ── */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-24 lg:py-32">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            className="text-center mb-12 sm:mb-20 max-w-3xl mx-auto"
          >
            <motion.div variants={fadeUp} className="inline-flex justify-center mb-4 sm:mb-6">
               <Trophy className="w-10 h-10 sm:w-12 sm:h-12 text-accent drop-shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]" />
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-3xl sm:text-4xl md:text-6xl font-black uppercase tracking-tight text-text-primary mb-4 sm:mb-6">
              See Where You <span className="gradient-text">Stand</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-sm sm:text-base lg:text-lg text-text-muted leading-relaxed">
              Once you know your numbers, see how they compare. The global leaderboard ranks developers by AI Proficiency Score — a composite of output, efficiency, prompt quality, consistency, and breadth.
            </motion.p>
          </motion.div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="lg:col-span-5 flex justify-center lg:justify-end">
              <SkillRadar />
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="lg:col-span-7 hud-border rounded-xl p-4 sm:p-6 lg:p-8 bg-bg-surface-1">
              <div className="flex justify-between items-center border-b border-border/50 pb-3 sm:pb-4 mb-4 sm:mb-6">
                <span className="font-mono text-xs sm:text-sm text-text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE_RANKINGS
                </span>
                <Link href="/leaderboard" className="text-xs font-mono text-accent hover:underline">VIEW_ALL &gt;</Link>
              </div>

              <div className="space-y-3 sm:space-y-4">
                {[
                  { rank: 1, name: "0xNeural", score: 98, level: "AI Prime" },
                  { rank: 2, name: "CyberDev", score: 94, level: "Architect" },
                  { rank: 3, name: "NeonCoder", score: 91, level: "Architect" },
                  { rank: 4, name: "You", score: "--", level: "Get Started" },
                ].map((user, idx) => (
                  <motion.div key={user.name} variants={fadeUp} className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl bg-bg-surface-2/50 border ${idx === 0 ? 'border-accent/40' : 'border-transparent'}`}>
                    <div className="flex items-center gap-3 sm:gap-4">
                      <span className={`font-mono text-base sm:text-lg font-bold w-5 sm:w-6 text-center ${idx === 0 ? 'text-accent' : 'text-text-muted'}`}>
                        {user.rank}
                      </span>
                      <div className="flex flex-col">
                        <span className={`font-mono font-bold text-sm sm:text-base ${idx === 3 ? 'text-accent border-b border-accent border-dashed' : 'text-text-primary'}`}>{user.name}</span>
                        <span className="text-[9px] sm:text-[10px] text-text-muted tracking-widest uppercase">{user.level}</span>
                      </div>
                    </div>
                    <div className="font-mono text-lg sm:text-xl font-bold text-text-primary tracking-widest">{user.score}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

      </main>
    </div>
  );
}
