import { useMemo } from 'react';
import { Brain } from 'lucide-react';
import { motion } from 'motion/react';
import type { SessionSeal } from '@useai/shared/types';
import type { Milestone } from '@useai/shared/types';

interface SkillRadarProps {
  sessions: SessionSeal[];
  milestones: Milestone[];
  streak: number;
}

const AXES = ['Output', 'Efficiency', 'Prompts', 'Consistency', 'Breadth'] as const;

/** Compute a point on the pentagon at a given axis index and radius (0-1). */
function pentagonPoint(
  axisIndex: number,
  radius: number,
  cx: number,
  cy: number,
  r: number,
): [number, number] {
  // Start from top (-90deg) and go clockwise
  const angle = (Math.PI * 2 * axisIndex) / 5 - Math.PI / 2;
  return [cx + r * radius * Math.cos(angle), cy + r * radius * Math.sin(angle)];
}

/** Build an SVG polygon path for a pentagon at a given scale (0-1). */
function pentagonPath(scale: number, cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 5; i++) {
    const [x, y] = pentagonPoint(i, scale, cx, cy, r);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

/** Label positions offset outward from the pentagon vertices. */
function labelPosition(
  axisIndex: number,
  cx: number,
  cy: number,
  r: number,
): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const [x, y] = pentagonPoint(axisIndex, 1.28, cx, cy, r);
  let anchor: 'start' | 'middle' | 'end' = 'middle';
  if (axisIndex === 1 || axisIndex === 2) anchor = 'start';
  if (axisIndex === 3 || axisIndex === 4) anchor = 'end';
  return { x, y, anchor };
}

export function SkillRadar({ sessions, milestones, streak }: SkillRadarProps) {
  const { values, hasEvalData } = useMemo(() => {
    // Output: complexity-weighted milestones / 10
    const COMPLEXITY_WEIGHT: Record<string, number> = {
      simple: 1,
      medium: 2,
      complex: 4,
    };
    let complexityWeighted = 0;
    for (const m of milestones) {
      complexityWeighted += COMPLEXITY_WEIGHT[m.complexity] ?? 1;
    }
    const output = Math.min(1, complexityWeighted / 10);

    // Efficiency: totalFilesTouched / max(totalHours, 1) / 20
    const totalFiles = sessions.reduce((sum, s) => sum + s.files_touched, 0);
    const totalHours = sessions.reduce((sum, s) => sum + s.duration_seconds, 0) / 3600;
    const efficiency = Math.min(1, totalFiles / Math.max(totalHours, 1) / 20);

    // Prompts: avg prompt_quality / 5 from evaluations
    const evaluated = sessions.filter((s) => s.evaluation != null);
    let avgPromptQuality = 0;
    const evalExists = evaluated.length > 0;
    if (evalExists) {
      const sum = evaluated.reduce((acc, s) => acc + s.evaluation!.prompt_quality, 0);
      avgPromptQuality = sum / evaluated.length / 5;
    }

    // Consistency: streak / 14
    const consistency = Math.min(1, streak / 14);

    // Breadth: unique languages / 5
    const uniqueLangs = new Set<string>();
    for (const s of sessions) {
      for (const lang of s.languages) {
        uniqueLangs.add(lang);
      }
    }
    const breadth = Math.min(1, uniqueLangs.size / 5);

    return {
      values: [output, efficiency, avgPromptQuality, consistency, breadth],
      hasEvalData: evalExists,
    };
  }, [sessions, milestones, streak]);

  const cx = 100;
  const cy = 100;
  const r = 70;

  // Build the data polygon path
  const dataPoints: string[] = [];
  for (let i = 0; i < 5; i++) {
    const val = Math.max(values[i]!, 0.02); // minimum so shape is visible
    const [x, y] = pentagonPoint(i, val, cx, cy, r);
    dataPoints.push(`${x},${y}`);
  }
  const dataPath = dataPoints.join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="rounded-xl bg-bg-surface-1 border border-border/50 p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="p-1.5 rounded-lg bg-bg-surface-2">
          <Brain className="w-3.5 h-3.5 text-text-muted" />
        </div>
        <h2 className="text-sm font-bold text-text-muted uppercase tracking-widest">
          Skill Profile
        </h2>
      </div>

      <div className="flex justify-center">
        <svg
          viewBox="0 0 200 200"
          width={200}
          height={200}
          className="overflow-visible"
        >
          {/* Grid rings */}
          {[0.33, 0.66, 1.0].map((scale) => (
            <polygon
              key={scale}
              points={pentagonPath(scale, cx, cy, r)}
              fill="none"
              stroke="var(--color-bg-surface-3)"
              strokeWidth={0.5}
              opacity={0.6}
            />
          ))}

          {/* Axis lines from center to each vertex */}
          {Array.from({ length: 5 }).map((_, i) => {
            const [x, y] = pentagonPoint(i, 1, cx, cy, r);
            return (
              <line
                key={`axis-${i}`}
                x1={cx}
                y1={cy}
                x2={x}
                y2={y}
                stroke="var(--color-bg-surface-3)"
                strokeWidth={0.5}
                opacity={0.4}
              />
            );
          })}

          {/* Data shape */}
          <motion.polygon
            points={dataPath}
            fill="var(--color-accent)"
            fillOpacity={0.2}
            stroke="var(--color-accent)"
            strokeWidth={1.5}
            strokeLinejoin="round"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />

          {/* Data points */}
          {values.map((val, i) => {
            const v = Math.max(val, 0.02);
            const [x, y] = pentagonPoint(i, v, cx, cy, r);
            const isGrayed = i === 2 && !hasEvalData;
            return (
              <circle
                key={`point-${i}`}
                cx={x}
                cy={y}
                r={2.5}
                fill={isGrayed ? 'var(--color-text-muted)' : 'var(--color-accent-bright)'}
                opacity={isGrayed ? 0.4 : 1}
              />
            );
          })}

          {/* Labels */}
          {AXES.map((label, i) => {
            const pos = labelPosition(i, cx, cy, r);
            const isGrayed = i === 2 && !hasEvalData;
            return (
              <text
                key={label}
                x={pos.x}
                y={pos.y}
                textAnchor={pos.anchor}
                dominantBaseline="central"
                className="text-[9px] font-medium"
                fill={isGrayed ? 'var(--color-text-muted)' : 'var(--color-text-secondary)'}
                opacity={isGrayed ? 0.5 : 1}
              >
                {label}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Score summary below */}
      <div className="flex justify-center gap-3 mt-2 flex-wrap">
        {AXES.map((label, i) => {
          const isGrayed = i === 2 && !hasEvalData;
          const pct = Math.round(values[i]! * 100);
          return (
            <span
              key={label}
              className={`text-[10px] font-mono ${isGrayed ? 'text-text-muted/50' : 'text-text-muted'}`}
            >
              {pct}%
            </span>
          );
        })}
      </div>
    </motion.div>
  );
}
