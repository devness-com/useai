'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
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
  TrendingUp,
  Lock,
  Database,
  Fingerprint,
  Trophy,
  Zap,
  Activity
} from 'lucide-react';

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
    <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center">
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-bg-surface-2">
        <div className="flex gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-border" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent/60 shadow-[0_0_5px_var(--accent)]" />
        </div>
        <span className="text-[10px] text-text-muted font-mono tracking-widest">USEAI_UPLINK_V1</span>
      </div>
      <div className="p-6 font-mono text-sm leading-relaxed min-h-[280px]">
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
              <div className="flex items-center gap-4 py-2">
                <Clock className="w-4 h-4 text-accent" />
                <span>Active Time: <span className="text-accent font-bold">8h 42m</span></span>
              </div>
            )}

            {lines > 2 && (
              <div className="flex items-center gap-4 py-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span>Output: <span className="text-text-primary">6 features</span> <span className="text-text-muted">· 3 bug fixes · 2 refactors</span></span>
              </div>
            )}

            {lines > 3 && (
              <div className="flex items-center gap-4 py-2">
                <Gauge className="w-4 h-4 text-purple-400" />
                <span>Complexity: <span className="text-text-primary">4 complex</span> <span className="text-text-muted">· 5 medium · 2 simple</span></span>
              </div>
            )}

            {lines > 4 && (
              <div className="flex items-center gap-4 py-2 text-accent">
                <TrendingUp className="w-4 h-4" />
                <span className="animate-pulse">SPACE: 82 — Rank #4,092 (Top 12%)</span>
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
      className={`group relative inline-flex items-center gap-4 px-6 py-3.5 rounded-xl border border-border-accent bg-bg-surface-1 font-mono text-sm text-text-secondary hover:text-accent transition-all cursor-pointer overflow-hidden ${className}`}
    >
      <div className="absolute inset-0 bg-[var(--accent-alpha)] translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
      <span className="text-text-muted select-none group-hover:animate-pulse z-10">&gt;</span>
      <span className="z-10 tracking-wide text-text-primary">{command}</span>
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

import { AnimatePresence } from 'motion/react';

function HeroDashboardAnimation() {
  const [activePanel, setActivePanel] = useState(0);
  const [panel3Climbed, setPanel3Climbed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setActivePanel((p) => (p + 1) % 3);
    }, 4000); // 4 seconds per panel

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (activePanel === 2) {
      setPanel3Climbed(false);
      timeout = setTimeout(() => setPanel3Climbed(true), 1200);
    } else {
      setPanel3Climbed(false);
    }
    return () => clearTimeout(timeout);
  }, [activePanel]);

  const leaderboardUsers = panel3Climbed ? [
    { id: '0xNeural', rank: 1, name: '0xNeural', score: 96, isYou: false },
    { id: 'you', rank: 2, name: 'You', score: 92, isYou: true },
    { id: 'CyberDev', rank: 3, name: 'CyberDev', score: 91, isYou: false },
  ] : [
    { id: '0xNeural', rank: 1, name: '0xNeural', score: 96, isYou: false },
    { id: 'CyberDev', rank: 2, name: 'CyberDev', score: 91, isYou: false },
    { id: 'you', rank: 3, name: 'You', score: 89, isYou: true },
  ];

  const smoothTransition = { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="w-full relative z-10 px-4 md:px-0 mt-6 md:mt-0">
      <div className="flex flex-col gap-3 relative max-w-lg mx-auto lg:mx-0 lg:ml-auto w-full min-h-[340px]">
        {/* Connecting Lines (Desktop only) */}
        <div className="hidden lg:block absolute -right-6 top-[2.5rem] bottom-[4rem] w-px bg-border-accent/30 -z-10">
          <motion.div 
            className="w-full bg-accent/80 origin-top"
            initial={{ height: '33%' }}
            animate={{ height: activePanel === 0 ? '33%' : activePanel === 1 ? '66%' : '100%' }}
            transition={smoothTransition}
          />
        </div>

        {/* Panel 1: Code / Prompt Input */}
        <div 
          onClick={() => setActivePanel(0)}
          className={`cursor-pointer hud-border rounded-xl bg-bg-surface-1/90 backdrop-blur-md p-3 flex flex-col border transition-all duration-500 overflow-hidden ${
            activePanel === 0 
              ? 'border-accent/40 shadow-[0_0_20px_rgba(var(--accent-rgb),0.15)] ring-1 ring-accent/30' 
              : 'border-border-accent/20 opacity-50 hover:opacity-70 grayscale-[50%]'
          }`}
        >
          <div className={`flex items-center justify-between transition-all duration-500 ${activePanel === 0 ? 'border-b border-border/50 pb-1.5 mb-2' : ''}`}>
            <span className={`font-mono text-[10px] flex items-center gap-1.5 transition-colors ${activePanel === 0 ? 'text-accent' : 'text-text-muted'}`}>
              <Terminal className="w-2.5 h-2.5" /> IDE_ACTIVITY
            </span>
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-red-400/50" />
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400/50" />
              <div className="w-1.5 h-1.5 rounded-full bg-green-400/50" />
            </div>
          </div>
          <AnimatePresence initial={false}>
            {activePanel === 0 && (
              <motion.div 
                key="panel-1-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={smoothTransition}
                className="overflow-hidden"
              >
                <div className="font-mono text-xs space-y-2 leading-relaxed">
                  <p className="text-text-primary"><span className="text-text-muted select-none">&gt;</span> "Refactor auth logic to use JWT"</p>
                  
                  <div className="relative h-[6.5rem] w-full mt-2">
                    <motion.div 
                      key="ide-results"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.4 }}
                      className="text-[10px] sm:text-xs text-text-secondary bg-bg-surface-2 p-2.5 rounded-lg absolute top-0 left-0 w-full pointer-events-none space-y-2 border border-border-accent/30 shadow-inner"
                    >
                      <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> <span>Call <span className="text-purple-400 font-bold">useai_start</span></span>
                      </motion.div>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.2 }} className="flex items-center gap-2 pl-[14px]">
                        <span className="text-text-muted">... refactoring 4 files</span>
                      </motion.div>
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.0 }} className="flex items-center gap-2 pl-[14px]">
                        <span className="text-green-400">✔</span> <span>All tests passed</span>
                      </motion.div>
                      <motion.div initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 2.6 }} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" /> <span>Call <span className="text-purple-400 font-bold">useai_end</span></span>
                      </motion.div>
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Panel 2: Session Output */}
        <div 
          onClick={() => setActivePanel(1)}
          className={`cursor-pointer hud-border rounded-xl bg-bg-surface-1/90 backdrop-blur-md p-3 flex flex-col border transition-all duration-500 overflow-hidden ${
            activePanel === 1 
              ? 'border-accent/40 shadow-[0_0_20px_rgba(var(--accent-rgb),0.15)] ring-1 ring-accent/30' 
              : 'border-border-accent/20 opacity-50 hover:opacity-70 grayscale-[50%]'
          }`}
        >
           <div className={`flex items-center justify-between transition-all duration-500 ${activePanel === 1 ? 'border-b border-border/50 pb-1.5 mb-2' : ''}`}>
            <span className={`font-mono text-[10px] flex items-center gap-1.5 transition-colors ${activePanel === 1 ? 'text-accent' : 'text-text-muted'}`}>
              <Brain className="w-2.5 h-2.5" /> SESSION_CAPTURED
            </span>
            <motion.div 
              animate={{ rotate: activePanel === 1 ? 360 : 0 }} 
              transition={{ duration: 2, repeat: activePanel === 1 ? Infinity : 0, ease: 'linear' }}
            >
              <Zap className={`w-2.5 h-2.5 ${activePanel === 1 ? 'text-accent' : 'text-text-muted'}`} />
            </motion.div>
          </div>
          <AnimatePresence initial={false}>
            {activePanel === 1 && (
              <motion.div 
                key="panel-2-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={smoothTransition}
                className="overflow-hidden"
              >
                <div className="space-y-1.5 pt-1">
                  {[
                    { label: 'DURATION', value: '2h 14m', delay: 0.2 },
                    { label: 'OUTPUT', value: '3 features · 1 bug fix', delay: 0.3 },
                    { label: 'COMPLEXITY', value: 'High', delay: 0.4 },
                    { label: 'LANGUAGES', value: 'TypeScript, Python', delay: 0.5 },
                    { label: 'TOOL', value: 'Claude Code', delay: 0.6 },
                  ].map((m) => (
                    <motion.div
                      key={m.label}
                      initial={{ opacity: 0, x: -5 }}
                      animate={{ opacity: activePanel === 1 ? 1 : 0, x: activePanel === 1 ? 0 : -5 }}
                      transition={{ duration: 0.4, delay: m.delay }}
                      className="flex justify-between items-center text-[9px] sm:text-[10px] font-mono py-1 border-b border-border/20"
                    >
                      <span className="text-text-muted">{m.label}</span>
                      <span className="text-text-primary">{m.value}</span>
                    </motion.div>
                  ))}

                   <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8 }}
                      className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between"
                   >
                      <div className="text-[10px] text-text-muted font-mono tracking-widest">SPACE_SCORE</div>
                      <div className="text-xl font-black text-accent drop-shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)] leading-none">92</div>
                   </motion.div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Panel 3: Leaderboard Climb */}
        <div 
          onClick={() => setActivePanel(2)}
          className={`cursor-pointer hud-border rounded-xl bg-bg-surface-1/90 backdrop-blur-md p-3 flex flex-col border transition-all duration-500 overflow-hidden ${
            activePanel === 2 
              ? 'border-accent/40 shadow-[0_0_20px_rgba(var(--accent-rgb),0.15)] ring-1 ring-accent/30' 
              : 'border-border-accent/20 opacity-50 hover:opacity-70 grayscale-[50%]'
          }`}
        >
          <div className={`flex items-center justify-between transition-all duration-500 ${activePanel === 2 ? 'border-b border-border/50 pb-1.5 mb-2' : ''}`}>
            <span className={`font-mono text-[10px] flex items-center gap-1.5 transition-colors ${activePanel === 2 ? 'text-accent' : 'text-text-muted'}`}>
              <Trophy className="w-2.5 h-2.5" /> GLOBAL_RANK
            </span>
            <span className={`text-[9px] font-mono ${activePanel === 2 ? 'text-accent animate-pulse' : 'text-text-muted'}`}>
              {activePanel === 2 ? 'UPDATING...' : 'WAITING'}
            </span>
          </div>
          
          <AnimatePresence initial={false}>
            {activePanel === 2 && (
              <motion.div 
                key="panel-3-content"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={smoothTransition}
                className="overflow-hidden"
              >
                <div className="relative pt-1 flex flex-col gap-1.5">
                  {leaderboardUsers.map(user => (
                    <motion.div
                      layout
                      key={`user-${user.id}`}
                      className={`w-full flex justify-between items-center p-2 rounded text-xs font-mono ${user.isYou ? 'bg-accent/10 border border-accent/30 z-10' : 'bg-bg-surface-2/50 opacity-80'}`}
                      style={{ transformOrigin: "top" }}
                      initial={user.isYou && !panel3Climbed ? { opacity: 0, scale: 0.9 } : { scale: 1, opacity: 1 }}
                      animate={
                        user.isYou 
                          ? (panel3Climbed ? { scale: [1, 1.05, 1], opacity: 1 } : { scale: 1, opacity: 1 })
                          : { opacity: panel3Climbed ? 0.5 : 1 }
                      }
                      transition={{ duration: 0.4 }}
                    >
                      <span className={`${user.isYou ? 'text-accent font-bold flex items-center gap-2' : 'text-text-muted'}`}>
                        {user.isYou && panel3Climbed && <TrendingUp className="w-3 h-3" />}
                        {user.rank}. {user.name}
                      </span>
                      <span className={user.isYou ? 'text-accent font-bold' : ''}>{user.score}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-base overflow-x-hidden selection:bg-accent/30 selection:text-white relative">
      <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />
      <div className="blur-blob w-[600px] h-[600px] top-[-10%] left-[-10%]" style={{ backgroundImage: 'radial-gradient(circle, rgba(var(--accent-rgb), var(--glow-opacity)) 0%, rgba(var(--accent-rgb), 0) 70%)' }} />
      <div className="blur-blob w-[500px] h-[500px] bottom-[20%] right-[-5%]" style={{ animationDelay: '-5s', backgroundImage: 'radial-gradient(circle, var(--glow-blue) 0%, rgba(59, 130, 246, 0) 70%)' }} />

      <main className="relative z-10 pb-32">
        {/* ── Hero ── */}
        <section className="relative pt-28 lg:pt-36 pb-12 overflow-x-hidden min-h-[calc(100vh-90px)] xl:min-h-0 flex items-center">
          <div className="max-w-7xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-8 lg:gap-6 items-center relative z-10">
            
            {/* Left Content */}
            <div className="flex flex-col items-center lg:items-start text-center lg:text-left w-full">
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="hud-border px-3 py-1 rounded-full mb-6 inline-flex items-center gap-2">
                <Activity className="w-3 h-3 text-accent" />
                <span className="text-[10px] font-mono text-text-secondary tracking-widest">TRACKING 10+ AI TOOLS</span>
              </motion.div>

              <motion.h1
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-text-primary leading-[1.05] sm:leading-[1.1] mb-6"
              >
                YOUR COMPLETE AI <br className="hidden md:block" />
                <span className="gradient-text-accent italic inline-block py-1 pr-4">DEVELOPMENT STORY</span>
              </motion.h1>

              <motion.p
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                className="text-sm md:text-base text-text-muted max-w-[90%] lg:max-w-xl mb-8 leading-relaxed font-light"
              >
                Every feature you ship, every hour you invest, every skill you sharpen — automatically
                captured across all your AI tools. <span className="text-text-primary font-medium">See what you build. Know where your time goes. Prove what you&#39;re capable of.</span>
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-xl"
              >
                <CopyCommand command="npx @devness/useai" className="w-full sm:w-auto shrink-0 py-2.5 px-5" />
                <span className="text-text-muted font-mono text-[10px] hidden sm:block">OR</span>
                <Link href="/login" className="cyber-button rounded-xl w-full sm:w-auto shrink-0 group inline-flex items-center justify-center gap-2 px-6 py-3 bg-text-primary text-bg-base font-bold text-xs tracking-wider uppercase transition-opacity hover:opacity-80">
                  Dashboard
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </div>

            {/* Right Content - Dashboard Interactive Animation */}
            <motion.div 
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
              className="w-full relative z-10 lg:-translate-y-4"
            >
              <HeroDashboardAnimation />
            </motion.div>
            
          </div>
        </section>

        {/* ── Visual Break ── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent my-10 max-w-7xl mx-auto px-6" />

        {/* ── Your AI Journal ── */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="grid lg:grid-cols-12 gap-12">
            
            <motion.div variants={fadeUp} className="lg:col-span-4 flex flex-col justify-center">
              <div className="text-[10px] font-mono tracking-widest text-accent mb-4 border-l-2 border-accent pl-2">YOUR_AI_JOURNAL</div>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-text-primary mb-6">
                Everything You Build, <br/><span className="gradient-text">Nothing You Forget</span>
              </h2>
              <p className="text-text-muted leading-relaxed mb-8">
                What did you build today? How complex was it? Where did your hours go? UseAI captures
                your complete AI development activity — the output you shipped and the skills behind it.
              </p>
              <Link href="/explore#metrics" className="inline-flex items-center gap-2 text-accent text-sm font-mono hover:text-accent-bright max-w-max border-b border-accent/30 pb-1">
                Explore All Metrics <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <motion.div variants={stagger} className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
              {FEATURES.map((m, i) => (
                <motion.div 
                  key={m.title} 
                  variants={fadeUp} 
                  className="hud-border rounded-xl p-6 bg-bg-surface-1/80 hover:bg-bg-surface-2 transition-colors group"
                >
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-12 h-12 rounded-xl bg-bg-surface-2 flex items-center justify-center border border-border-accent relative overflow-hidden">
                      <div className="absolute inset-0 opacity-20" style={{ background: m.accent }} />
                      <m.icon className="w-6 h-6 z-10" style={{ color: m.accent }} />
                    </div>
                    <span className="text-text-muted font-mono text-xs opacity-50 group-hover:opacity-100 transition-opacity">0{i+1}</span>
                  </div>
                  <h3 className="text-lg font-bold text-text-primary mb-2 font-mono tracking-wide">{m.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{m.description}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* ── Setup ── */}
        <section className="bg-bg-surface-1/30 py-32 relative border-y border-border/50">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
              <TerminalMockup />
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="space-y-12">
              <div>
                <motion.div variants={fadeUp} className="text-[10px] font-mono tracking-widest text-accent mb-4 border-l-2 border-accent pl-2">ZERO_FRICTION</motion.div>
                <motion.h2 variants={fadeUp} className="text-4xl font-black uppercase tracking-tight text-text-primary mb-6">
                  One Command. <span className="gradient-text-accent">Zero Friction.</span>
                </motion.h2>
                <motion.p variants={fadeUp} className="text-text-muted leading-relaxed">
                  UseAI is completely invisible during your workflow. No context switching,
                  no extra tabs, no manual logging. Just code — the daemon captures everything.
                </motion.p>
              </div>

              <div className="space-y-6">
                {STEPS.map((s, idx) => (
                  <motion.div key={s.step} variants={fadeUp} className="flex gap-6 items-start group">
                    <div className="text-xs font-mono font-bold text-accent px-2 py-1 bg-[var(--accent-alpha)] border border-accent/20 rounded-md mt-1">
                      {s.step}
                    </div>
                    <div className="flex-1 border-b border-border-accent/30 pb-6 group-hover:border-accent transition-colors">
                      <h3 className="font-mono text-text-primary mb-2 tracking-wide uppercase font-bold">{s.title}</h3>
                      <p className="text-sm text-text-muted mb-3">{s.description}</p>
                      <code className="block text-[10px] font-mono text-accent/70 bg-bg-surface-2/80 p-2 rounded-lg">
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
        <section className="max-w-7xl mx-auto px-6 py-24">
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}
            className="text-center mb-16 max-w-3xl mx-auto"
          >
            <motion.div variants={fadeUp} className="text-[10px] font-mono tracking-widest text-accent mb-4">VISIBILITY</motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-5xl font-black uppercase tracking-tight text-text-primary mb-6">
              Your AI Developer <br/><span className="gradient-text">Identity</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-text-muted leading-relaxed">
              GitHub shows your commits. UseAI shows what you built with AI and how well you wield it.
              A verified profile that proves you&#39;re not just using AI — you&#39;re proficient with it.
            </motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Globe, title: 'PUBLIC PROFILE', desc: 'A shareable page showing your AI activity — tools used, languages, output volume, complexity distribution, and SPACE scores. Your AI development resume.' },
              { icon: Fingerprint, title: 'VERIFIED MILESTONES', desc: 'Every milestone is cryptographically signed with Ed25519. Not self-reported. Not inflatable. Provable proof of what you shipped.' },
              { icon: Users, title: 'PROFESSIONAL SIGNAL', desc: 'In a world where every developer "uses AI," show you actually know how to wield it. Visible to recruiters, teams, and the community.' },
            ].map(item => (
              <motion.div key={item.title} variants={fadeUp} className="hud-border rounded-xl p-8 bg-bg-surface-1/60 text-center">
                <div className="w-14 h-14 rounded-xl bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 mx-auto mb-6">
                  <item.icon className="w-7 h-7 text-accent" />
                </div>
                <h3 className="font-mono font-bold text-sm text-text-primary mb-3">{item.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </section>

        {/* ── Leaderboard Section ── */}
        <section className="max-w-7xl mx-auto px-6 py-32">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} 
            className="text-center mb-20 max-w-3xl mx-auto"
          >
            <motion.div variants={fadeUp} className="inline-flex justify-center mb-6">
               <Trophy className="w-12 h-12 text-accent drop-shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]" />
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-black uppercase tracking-tight text-text-primary mb-6">
              See Where You <span className="gradient-text">Stand</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-text-muted leading-relaxed">
              Once you know your numbers, see how they compare. The global leaderboard ranks developers by AI Proficiency Score — a composite of output, efficiency, prompt quality, consistency, and breadth.
            </motion.p>
          </motion.div>

          <div className="grid lg:grid-cols-12 gap-12 items-center">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} className="lg:col-span-5 flex justify-center lg:justify-end">
              <SkillRadar />
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={stagger} className="lg:col-span-7 hud-border rounded-xl p-8 bg-bg-surface-1">
              <div className="flex justify-between items-center border-b border-border/50 pb-4 mb-6">
                <span className="font-mono text-sm text-text-primary flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> LIVE_RANKINGS
                </span>
                <Link href="/leaderboard" className="text-xs font-mono text-accent hover:underline">VIEW_ALL &gt;</Link>
              </div>

              <div className="space-y-4">
                {[
                  { rank: 1, name: "0xNeural", score: 98, level: "AI Prime" },
                  { rank: 2, name: "CyberDev", score: 94, level: "Architect" },
                  { rank: 3, name: "NeonCoder", score: 91, level: "Architect" },
                  { rank: 4, name: "You", score: "--", level: "Get Started" },
                ].map((user, idx) => (
                  <motion.div key={user.name} variants={fadeUp} className={`flex items-center justify-between p-3 rounded-xl bg-bg-surface-2/50 border ${idx === 0 ? 'border-accent/40' : 'border-transparent'}`}>
                    <div className="flex items-center gap-4">
                      <span className={`font-mono text-lg font-bold w-6 text-center ${idx === 0 ? 'text-accent' : 'text-text-muted'}`}>
                        {user.rank}
                      </span>
                      <div className="flex flex-col">
                        <span className={`font-mono font-bold ${idx === 3 ? 'text-accent border-b border-accent border-dashed' : 'text-text-primary'}`}>{user.name}</span>
                        <span className="text-[10px] text-text-muted tracking-widest uppercase">{user.level}</span>
                      </div>
                    </div>
                    <div className="font-mono text-xl font-bold text-text-primary tracking-widest">{user.score}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Privacy / Verification ── */}
        <section className="bg-bg-surface-1/20 border-t border-border/30 py-24">
          <div className="max-w-7xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-mono text-text-primary mb-12 flex items-center justify-center gap-3">
              <Shield className="w-6 h-6 text-accent" /> SECURE_PROTOCOLS
            </h2>
            <div className="grid md:grid-cols-3 gap-8 text-left">
              {[
                { icon: Database, title: 'ZERO PAYLOAD', desc: 'No source code, file paths, or prompt contents are ever transmitted. Telemetry only.' },
                { icon: Lock, title: 'LOCAL DAEMON', desc: 'Processing happens locally in ~/.useai. You fully own and control your raw data timeline.' },
                { icon: Fingerprint, title: 'CRYPTO VERIFIED', desc: 'Public milestones and APS scores are HMAC-signed for authenticity on the leaderboard.' }
              ].map(item => (
                <div key={item.title} className="p-6 rounded-xl border border-border/40 bg-bg-surface-1/40 hover:border-accent/30 transition-colors">
                  <item.icon className="w-8 h-8 text-text-muted mb-4" />
                  <h3 className="font-mono font-bold text-sm text-text-primary mb-2">{item.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
