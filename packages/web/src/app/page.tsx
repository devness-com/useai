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
  Sparkles,
  TrendingUp,
  Lock,
  Database,
  Fingerprint,
  Trophy,
  ChevronRight,
  Zap,
  Github,
  Activity
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  UseAI SVG Logo                                                     */
/* ------------------------------------------------------------------ */

function UseAILogo({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 611.54 143.47" className={className}>
      <g fill="var(--text-primary)">
        <path d="M21.4,121.85c-4.57-4.57-6.85-10.02-6.85-16.37V17.23c0-3.1,1.55-4.65,4.64-4.65h25.55c3.1,0,4.65,1.55,4.65,4.65v76.64c0,3.25,1.12,6,3.37,8.25,2.24,2.25,4.99,3.37,8.25,3.37h27.87c3.25,0,6-1.12,8.25-3.37,2.24-2.24,3.37-4.99,3.37-8.25V17.23c0-3.1,1.55-4.65,4.64-4.65h25.55c3.1,0,4.65,1.55,4.65,4.65v88.25c0,6.35-2.29,11.81-6.85,16.37-4.57,4.57-10.03,6.85-16.37,6.85H37.78c-6.35,0-11.81-2.28-16.37-6.85Z"/>
        <path d="M146.93,124.06v-13.93c0-3.1,1.55-4.65,4.64-4.65h69.67c3.25,0,6-1.12,8.25-3.37,2.24-2.24,3.37-4.99,3.37-8.25s-1.12-6-3.37-8.25c-2.25-2.24-4.99-3.37-8.25-3.37h-51.09c-6.35,0-11.81-2.28-16.37-6.85-4.57-4.57-6.85-10.02-6.85-16.37v-23.22c0-6.35,2.28-11.81,6.85-16.37,4.56-4.57,10.02-6.85,16.37-6.85h92.9c3.1,0,4.65,1.55,4.65,4.65v13.94c0,3.1-1.55,4.65-4.65,4.65h-69.67c-3.25,0-6,1.12-8.25,3.37-2.25,2.25-3.37,4.99-3.37,8.25s1.12,6,3.37,8.25c2.24,2.25,4.99,3.37,8.25,3.37h51.09c6.35,0,11.8,2.29,16.37,6.85,4.57,4.57,6.85,10.03,6.85,16.37v23.22c0,6.35-2.29,11.81-6.85,16.37-4.57,4.57-10.03,6.85-16.37,6.85h-92.9c-3.1,0-4.64-1.55-4.64-4.65Z"/>
        <path d="M286.16,121.85c-4.57-4.57-6.85-10.02-6.85-16.37V35.81c0-6.35,2.28-11.81,6.85-16.37,4.56-4.57,10.02-6.85,16.37-6.85h74.32c6.35,0,11.8,2.29,16.37,6.85,4.57,4.57,6.85,10.03,6.85,16.37v23.22c0,6.35-2.29,11.81-6.85,16.37-4.57,4.57-10.03,6.85-16.37,6.85h-62.71v11.61c0,3.25,1.12,6,3.37,8.25,2.24,2.25,4.99,3.37,8.25,3.37h69.67c3.1,0,4.65,1.55,4.65,4.65v13.93c0,3.1-1.55,4.65-4.65,4.65h-92.9c-6.35,0-11.81-2.28-16.37-6.85ZM361.87,55.66c2.24-2.24,3.37-4.99,3.37-8.25s-1.12-6-3.37-8.25c-2.25-2.24-4.99-3.37-8.25-3.37h-27.87c-3.25,0-6,1.12-8.25,3.37-2.25,2.25-3.37,4.99-3.37,8.25v11.61h39.48c3.25,0,6-1.12,8.25-3.37Z"/>
      </g>
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
    title: 'Initialize Uplink',
    description: 'One command seamlessly integrates UseAI into your existing MCP workflow.',
    command: 'npx @devness/useai@latest',
  },
  {
    step: '02',
    title: 'Execute & Track',
    description: 'Write code. UseAI runs silently in the background capturing actionable telemetry.',
    command: 'Tracking protocol activated...',
  },
  {
    step: '03',
    title: 'Analyze & Dominate',
    description: 'Review your performance matrix and rise up the global AI proficiency ranks.',
    command: 'npx @devness/useai@latest stats',
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
      <div className="absolute inset-0 bg-accent/5 rounded-full blur-3xl animate-pulse" />
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
        <path d={dataPath} fill="rgba(var(--accent-rgb), 0.15)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
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
    <div className="hud-border rounded-xl bg-bg-surface-1 overflow-hidden shadow-[0_0_30px_rgba(var(--accent-rgb),0.1)] relative">
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
          <span className="text-accent">&gt;</span> npx @devness/useai@latest stats
        </motion.div>
        
        {lines > 0 && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mt-4 text-text-primary space-y-2">
            <div className="flex justify-between border-b border-border-accent pb-2">
              <span className="text-text-secondary">SYSTEM STATUS:</span>
              <span className="text-accent text-[10px] bg-accent/10 px-2 py-0.5 rounded-md border border-accent/20">ONLINE</span>
            </div>
            
            {lines > 1 && (
              <div className="flex items-center gap-4 py-2">
                <Gauge className="w-4 h-4 text-accent" />
                <span>AI Proficiency Score: <span className="text-accent font-bold">78</span>/100</span>
              </div>
            )}
            
            {lines > 2 && (
              <div className="flex items-center gap-4 py-2">
                <Target className="w-4 h-4 text-blue-400" />
                <span>Prompt Quality: <span className="text-text-primary">4.1</span> <span className="text-text-muted">/ 5.0</span></span>
              </div>
            )}
            
            {lines > 3 && (
              <div className="flex items-center gap-4 py-2">
                <Terminal className="w-4 h-4 text-purple-400" />
                <span>Top Tool Interface: <span className="text-text-primary">Claude Code</span></span>
              </div>
            )}
            
            {lines > 4 && (
              <div className="flex items-center gap-4 py-2 text-accent">
                <Zap className="w-4 h-4" />
                <span className="animate-pulse">Global Rank: #4,092 — Top 12%</span>
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
      <div className="absolute inset-0 bg-accent/5 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out" />
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
/*  Page Components                                                    */
/* ------------------------------------------------------------------ */

function TopNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    
    // Check initial state
    handleScroll();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 w-full z-50 transition-all duration-300 border-b transform-gpu ${
      scrolled 
        ? 'bg-bg-base/80 backdrop-blur-md border-border shadow-sm' 
        : 'bg-transparent border-transparent shadow-none'
    }`}>
      <div className="flex items-center justify-between max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center gap-3">
          <UseAILogo className="h-5 drop-shadow-[0_0_8px_rgba(var(--accent-rgb),0.2)]" />
          <div className="hidden md:flex items-center px-2 py-0.5 rounded-md border border-accent/20 bg-accent/5 text-[10px] text-accent font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse mr-1.5" />
            SYSTEM_ONLINE
          </div>
        </div>
        
        <div className="flex items-center gap-8">
          <a href="#features" className="hidden md:block text-xs font-mono tracking-widest text-text-muted hover:text-accent transition-colors">
            // FEATURES
          </a>
          <Link href="/leaderboard" className="hidden md:block text-xs font-mono tracking-widest text-text-muted hover:text-accent transition-colors">
            // LEADERBOARD
          </Link>
          <Link href="/login" className="cyber-button px-5 py-2 rounded-lg text-xs font-bold font-mono tracking-widest bg-accent text-white border border-accent flex items-center gap-2">
            ACCESS_TERM <Terminal className="w-3 h-3" />
          </Link>
        </div>
      </div>
    </nav>
  );
}

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    
    // Check initial state
    handleScroll();
    
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-bg-base overflow-x-hidden selection:bg-accent/30 selection:text-white relative">
      <div className="fixed inset-0 cyber-grid pointer-events-none z-0" />
      <div className="blur-blob w-[600px] h-[600px] top-[-10%] left-[-10%]" style={{ backgroundImage: 'radial-gradient(circle, rgba(var(--accent-rgb), 0.15) 0%, rgba(var(--accent-rgb), 0) 70%)' }} />
      <div className="blur-blob w-[500px] h-[500px] bottom-[20%] right-[-5%]" style={{ animationDelay: '-5s', backgroundImage: 'radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, rgba(59, 130, 246, 0) 70%)' }} />

      <TopNav />

      <main className="relative z-10 pb-32">
        {/* ── Hero ── */}
        <section className="relative pt-32 md:pt-48 pb-16 px-6 flex flex-col justify-center items-center overflow-x-hidden min-h-[90vh]">
          <div className="max-w-5xl mx-auto text-center w-full flex flex-col items-center mb-20 relative z-10">
            <div className="flex flex-col items-center w-full">
              
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="hud-border px-4 py-1.5 rounded-full mb-8 inline-flex items-center gap-3">
                <Activity className="w-3 h-3 text-accent" />
                <span className="text-xs font-mono text-text-secondary tracking-widest">PROFILING_ACTIVE</span>
              </motion.div>

              <motion.h1 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
                className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter text-text-primary leading-[1.2] sm:leading-[1.25] mb-8"
              >
                KNOW HOW YOU <br className="hidden md:block" />
                <span className="gradient-text-accent italic inline-block py-2 pr-4">CODE WITH AI</span>
              </motion.h1>

              <motion.p 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.2 }}
                className="text-lg md:text-xl text-text-muted max-w-2xl text-center mb-12 leading-relaxed font-light"
              >
                Capture every AI session across any tool. Turn raw activity into an actionable 
                intelligence profile. <span className="text-text-primary font-medium">Measure, improve, and dominate the leaderboard.</span>
              </motion.p>

              <motion.div 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-xl mx-auto mt-2"
              >
                <CopyCommand command="npx @devness/useai@latest" className="w-full sm:w-auto shrink-0" />
                <span className="text-text-muted font-mono text-xs hidden sm:block">OR</span>
                <Link href="/login" className="cyber-button rounded-xl w-full sm:w-auto shrink-0 group inline-flex items-center justify-center gap-3 px-8 py-3.5 bg-text-primary text-bg-base font-bold text-sm tracking-wider uppercase transition-colors hover:bg-white/90">
                  View Dashboard
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </Link>
              </motion.div>
            </div>
          </div>

          {/* Scrolling Tool Strip */}
          <div className="w-full max-w-full overflow-hidden flex flex-col items-center gap-4 opacity-70 relative z-10 transition-transform transform-gpu">
            <span className="text-[10px] font-mono text-text-muted tracking-widest uppercase mb-2">// Supported Integrations</span>
            <div className="flex w-max animate-marquee">
              {[1, 2].map((group) => (
                <div key={group} className="flex gap-6 whitespace-nowrap pr-6">
                  {[...AI_TOOLS, ...AI_TOOLS].map((tool, idx) => (
                    <div key={`${tool.name}-${idx}`} className="flex items-center gap-2 px-4 py-2 rounded-full border border-border-accent/40 bg-bg-surface-1/90 transform-gpu will-change-transform">
                      <div className="w-2 h-2 rounded-full" style={{ background: tool.color, boxShadow: `0 0 10px ${tool.glow}` }} />
                      <span className="font-mono text-xs text-text-secondary">{tool.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Visual Break ── */}
        <div className="w-full h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent my-10 max-w-7xl mx-auto" />

        {/* ── Intelligence Grid (Features) ── */}
        <section id="features" className="max-w-7xl mx-auto px-6 py-24">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="grid lg:grid-cols-12 gap-12">
            
            <motion.div variants={fadeUp} className="lg:col-span-4 flex flex-col justify-center">
              <div className="text-[10px] font-mono tracking-widest text-accent mb-4 border-l-2 border-accent pl-2">TELEMETRY_DATABANKS</div>
              <h2 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-text-primary mb-6">
                Quantify <br/><span className="gradient-text">Your Process</span>
              </h2>
              <p className="text-text-muted leading-relaxed mb-8">
                Raw output isn't enough. UseAI monitors how you orchestrate AI tools—analyzing 
                prompt complexity, task scoping, and autonomy.
              </p>
              <Link href="/explore" className="inline-flex items-center gap-2 text-accent text-sm font-mono hover:text-accent-bright max-w-max border-b border-accent/30 pb-1">
                Explore Metric Definitions <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>

            <motion.div variants={stagger} className="lg:col-span-8 grid sm:grid-cols-2 gap-4">
              {METRICS.map((m, i) => (
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

        {/* ── Architecture / Terminal Section ── */}
        <section className="bg-bg-surface-1/30 py-32 relative border-y border-border/50">
          <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
            
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
              <TerminalMockup />
            </motion.div>

            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} className="space-y-12">
              <div>
                <motion.div variants={fadeUp} className="text-[10px] font-mono tracking-widest text-accent mb-4 border-l-2 border-accent pl-2">INITIALIZATION</motion.div>
                <motion.h2 variants={fadeUp} className="text-4xl font-black uppercase tracking-tight text-text-primary mb-6">
                  Frictionless <span className="gradient-text-accent">Integration</span>
                </motion.h2>
                <motion.p variants={fadeUp} className="text-text-muted leading-relaxed">
                  We built UseAI to be completely invisible during your workflow. No context switching, 
                  no extra tabs. Just code, and let the daemon handle the telemetry.
                </motion.p>
              </div>

              <div className="space-y-6">
                {STEPS.map((s, idx) => (
                  <motion.div key={s.step} variants={fadeUp} className="flex gap-6 items-start group">
                    <div className="text-xs font-mono font-bold text-accent px-2 py-1 bg-accent/10 border border-accent/20 rounded-md mt-1">
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

        {/* ── Compete Section ── */}
        <section className="max-w-7xl mx-auto px-6 py-32">
          <motion.div 
            initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger} 
            className="text-center mb-20 max-w-3xl mx-auto"
          >
            <motion.div variants={fadeUp} className="inline-flex justify-center mb-6">
               <Trophy className="w-12 h-12 text-accent drop-shadow-[0_0_15px_rgba(var(--accent-rgb),0.5)]" />
            </motion.div>
            <motion.h2 variants={fadeUp} className="text-4xl md:text-6xl font-black uppercase tracking-tight text-text-primary mb-6">
              Global <span className="gradient-text">Leaderboard</span>
            </motion.h2>
            <motion.p variants={fadeUp} className="text-lg text-text-muted leading-relaxed">
              Coding is a multiplayer game. Compare your AI Proficiency Score (APS) against top developers globally. Prove your efficiency.
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
                  { rank: 4, name: "You (Soon)", score: "--", level: "Initiate" },
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

      {/* ── Footer ── */}
      <footer className="relative z-10 border-t border-border/50 bg-bg-surface-1 pt-12 pb-6">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between flex-wrap gap-6">
          <div className="flex flex-col gap-2">
            <UseAILogo className="h-4 opacity-50 hover:opacity-100 transition-opacity" />
            <span className="text-[10px] text-text-muted font-mono tracking-widest">© {new Date().getFullYear()} DEVNESS NETWORK</span>
          </div>
          
          <div className="flex items-center gap-6">
            <a href="https://github.com/AhmedElBanna/useai" target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-text-muted hover:text-accent transition-colors flex items-center gap-2">
              <Github className="w-4 h-4" /> REPOSITORY
            </a>
            <a href="https://www.npmjs.com/package/@devness/useai" target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-text-muted hover:text-accent transition-colors flex items-center gap-2">
              <Terminal className="w-4 h-4" /> PACKAGE
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
