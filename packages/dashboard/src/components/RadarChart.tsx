import { motion } from 'motion/react';

export interface RadarChartData {
  output: number;
  efficiency: number;
  promptQuality: number;
  consistency: number;
  breadth: number;
}

interface RadarChartProps {
  data: RadarChartData;
}

const AXES: { key: keyof RadarChartData; label: string }[] = [
  { key: 'output', label: 'Output' },
  { key: 'efficiency', label: 'Efficiency' },
  { key: 'promptQuality', label: 'Prompts' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'breadth', label: 'Breadth' },
];

const LEVELS = [0.2, 0.4, 0.6, 0.8, 1.0];
const CX = 150;
const CY = 150;
const R = 110;

function pentagonPoint(
  axisIndex: number,
  radius: number,
  cx: number,
  cy: number,
  r: number,
): [number, number] {
  const angle = (Math.PI * 2 * axisIndex) / 5 - Math.PI / 2;
  return [cx + r * radius * Math.cos(angle), cy + r * radius * Math.sin(angle)];
}

function pentagonPath(scale: number, cx: number, cy: number, r: number): string {
  const points: string[] = [];
  for (let i = 0; i < 5; i++) {
    const [x, y] = pentagonPoint(i, scale, cx, cy, r);
    points.push(`${x},${y}`);
  }
  return points.join(' ');
}

function labelPosition(
  axisIndex: number,
  cx: number,
  cy: number,
  r: number,
): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  const [x, y] = pentagonPoint(axisIndex, 1.22, cx, cy, r);
  let anchor: 'start' | 'middle' | 'end' = 'middle';
  if (axisIndex === 1 || axisIndex === 2) anchor = 'start';
  if (axisIndex === 3 || axisIndex === 4) anchor = 'end';
  return { x, y, anchor };
}

export function RadarChart({ data }: RadarChartProps) {
  const values = AXES.map((a) => Math.max(Math.min(data[a.key] / 100, 1), 0));

  const dataPoints: string[] = [];
  for (let i = 0; i < 5; i++) {
    const val = Math.max(values[i]!, 0.03);
    const [x, y] = pentagonPoint(i, val, CX, CY, R);
    dataPoints.push(`${x},${y}`);
  }
  const dataPath = dataPoints.join(' ');

  return (
    <svg viewBox="0 0 300 300" width={300} height={300} className="overflow-visible">
      {/* Grid rings */}
      {LEVELS.map((scale) => (
        <polygon
          key={scale}
          points={pentagonPath(scale, CX, CY, R)}
          fill="none"
          stroke="var(--color-bg-surface-3)"
          strokeWidth={0.5}
          opacity={0.5}
        />
      ))}

      {/* Axis lines */}
      {Array.from({ length: 5 }).map((_, i) => {
        const [x, y] = pentagonPoint(i, 1, CX, CY, R);
        return (
          <line
            key={`axis-${i}`}
            x1={CX}
            y1={CY}
            x2={x}
            y2={y}
            stroke="var(--color-bg-surface-3)"
            strokeWidth={0.5}
            opacity={0.35}
          />
        );
      })}

      {/* Data fill */}
      <motion.polygon
        points={dataPath}
        fill="var(--color-accent)"
        fillOpacity={0.15}
        stroke="var(--color-accent)"
        strokeWidth={1.5}
        strokeLinejoin="round"
        initial={{ opacity: 0, scale: 0.4 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        style={{ transformOrigin: `${CX}px ${CY}px` }}
      />

      {/* Data points */}
      {values.map((val, i) => {
        const v = Math.max(val, 0.03);
        const [x, y] = pentagonPoint(i, v, CX, CY, R);
        return (
          <motion.circle
            key={`point-${i}`}
            cx={x}
            cy={y}
            r={3}
            fill="var(--color-accent-bright)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + i * 0.05 }}
          />
        );
      })}

      {/* Axis labels */}
      {AXES.map((axis, i) => {
        const pos = labelPosition(i, CX, CY, R);
        return (
          <text
            key={axis.key}
            x={pos.x}
            y={pos.y}
            textAnchor={pos.anchor}
            dominantBaseline="central"
            className="text-[10px] font-medium"
            fill="var(--color-text-secondary)"
          >
            {axis.label}
          </text>
        );
      })}

      {/* Value labels at each point */}
      {values.map((val, i) => {
        const pct = Math.round(val * 100);
        const v = Math.max(val, 0.03);
        const [x, y] = pentagonPoint(i, v, CX, CY, R);
        // Offset inward slightly from the data point
        const offsetAngle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
        const offsetX = x - 12 * Math.cos(offsetAngle);
        const offsetY = y - 12 * Math.sin(offsetAngle);
        return (
          <text
            key={`val-${i}`}
            x={offsetX}
            y={offsetY}
            textAnchor="middle"
            dominantBaseline="central"
            className="text-[8px] font-mono"
            fill="var(--color-text-muted)"
          >
            {pct}
          </text>
        );
      })}
    </svg>
  );
}
