'use client';

import { useEffect, useState } from 'react';

interface RadarChartData {
  output: number;
  efficiency: number;
  promptQuality: number;
  consistency: number;
  breadth: number;
}

interface RadarChartProps {
  data: RadarChartData;
  size?: number;
}

const DIMENSIONS = [
  { key: 'output' as const, label: 'Output' },
  { key: 'efficiency' as const, label: 'Efficiency' },
  { key: 'promptQuality' as const, label: 'Prompts' },
  { key: 'consistency' as const, label: 'Consistency' },
  { key: 'breadth' as const, label: 'Breadth' },
];

export function RadarChart({ data, size = 280 }: RadarChartProps) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setAnimated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const cx = size / 2;
  const cy = size / 2;
  const maxR = size * 0.32;
  const n = DIMENSIONS.length;
  const angleStep = (2 * Math.PI) / n;

  const pointAt = (i: number, r: number): [number, number] => {
    const angle = -Math.PI / 2 + i * angleStep;
    return [cx + r * Math.cos(angle), cy + r * Math.sin(angle)];
  };

  const values = DIMENSIONS.map((d) => (data[d.key] / 100));
  const dataPoints = values.map((v, i) => pointAt(i, (animated ? v : 0) * maxR));
  const dataPath =
    dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';

  const gridLevels = [0.25, 0.5, 0.75, 1.0];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full max-w-[280px]"
      role="img"
      aria-label="Radar chart showing AI proficiency dimensions"
    >
      {/* Grid rings */}
      {gridLevels.map((level) => {
        const pts = Array.from({ length: n }, (_, i) => pointAt(i, level * maxR));
        const path =
          pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`).join(' ') + 'Z';
        return (
          <path
            key={level}
            d={path}
            fill="none"
            stroke="var(--border-accent)"
            strokeWidth="1"
            strokeDasharray="2 4"
            opacity="0.5"
          />
        );
      })}

      {/* Axes */}
      {Array.from({ length: n }, (_, i) => {
        const [x, y] = pointAt(i, maxR);
        return (
          <line
            key={`axis-${i}`}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--border-accent)"
            strokeWidth="1"
            opacity="0.3"
          />
        );
      })}

      {/* Data polygon */}
      <path
        d={dataPath}
        fill="rgba(var(--accent-rgb), 0.15)"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        style={{
          transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />

      {/* Data dots */}
      {dataPoints.map((p, i) => (
        <circle
          key={`dot-${i}`}
          cx={p[0]}
          cy={p[1]}
          r="3.5"
          fill="var(--bg-base)"
          stroke="var(--accent)"
          strokeWidth="2"
          style={{
            transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
          }}
        />
      ))}

      {/* Labels */}
      {DIMENSIONS.map((dim, i) => {
        const [x, y] = pointAt(i, maxR + 22);
        return (
          <text
            key={dim.key}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-text-secondary text-[10px] font-mono tracking-wider"
          >
            {dim.label.toUpperCase()}
          </text>
        );
      })}

      {/* Value labels */}
      {DIMENSIONS.map((dim, i) => {
        const val = data[dim.key];
        const [x, y] = pointAt(i, (animated ? values[i] : 0) * maxR);
        return (
          <text
            key={`val-${dim.key}`}
            x={x}
            y={y - 10}
            textAnchor="middle"
            className="fill-accent text-[9px] font-mono font-bold"
            style={{
              transition: 'all 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
              opacity: animated ? 1 : 0,
            }}
          >
            {val}
          </text>
        );
      })}
    </svg>
  );
}
