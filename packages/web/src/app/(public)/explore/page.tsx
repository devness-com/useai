import { Sparkles, BarChart3, Target } from 'lucide-react';
import { SUPPORTED_AI_TOOLS, TOOL_COLORS, TOOL_ICONS, spaceFramework } from '@useai/shared';

const APS_COMPONENTS = [
  { name: 'Output', weight: 25, description: 'Complexity-weighted milestones completed per window' },
  { name: 'Efficiency', weight: 25, description: 'Files touched per hour of active AI session time' },
  { name: 'Prompt Quality', weight: 20, description: 'Average session evaluation score using SPACE weights' },
  { name: 'Consistency', weight: 15, description: 'Active coding days streak, capped at 14 days' },
  { name: 'Breadth', weight: 15, description: 'Unique programming languages used across sessions' },
];

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-12">

        {/* Metric Definitions */}
        <div id="metrics" className="scroll-mt-24 mb-24">
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-6 h-6 text-accent" />
            <h2 className="text-2xl font-black text-text-primary">Metric Definitions</h2>
          </div>

          {/* SPACE Framework overview */}
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-8">
            <div className="text-[10px] font-mono tracking-widest text-accent mb-3 border-l-2 border-accent pl-2">SPACE_FRAMEWORK</div>
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

          {/* Dimension cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-16">
            {spaceFramework.rubrics.map((rubric) => (
              <div
                key={rubric.dimension}
                className="hud-border rounded-xl p-6 bg-bg-surface-1/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-text-primary">{rubric.label}</h3>
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

          {/* Session Score */}
          <div className="flex items-center gap-3 mb-4">
            <Target className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-black text-text-primary">Session Score</h3>
          </div>
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-16">
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              Each session receives a <span className="text-text-primary font-bold">0&ndash;100</span> score computed from the four
              SPACE dimensions using their assigned weights:
            </p>
            <div className="font-mono text-sm text-text-secondary bg-bg-surface-2 rounded-lg p-4">
              score = (prompt_quality / 5 &times; 0.30) + (context_provided / 5 &times; 0.25) + (independence_level / 5 &times; 0.25) + (scope_quality / 5 &times; 0.20) &times; 100
            </div>
            <p className="text-xs text-text-muted mt-3">
              A perfect score of 100 requires a 5 in every dimension. The weighting ensures prompt quality has the
              largest impact, reflecting how much clear communication drives productive AI sessions.
            </p>
          </div>

          {/* APS */}
          <div className="flex items-center gap-3 mb-4">
            <BarChart3 className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-black text-text-primary">AI Proficiency Score (APS)</h3>
          </div>
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-4">
            <p className="text-sm text-text-muted leading-relaxed">
              The APS is a composite <span className="text-text-primary font-bold">0&ndash;1000</span> score
              that aggregates your performance across multiple sessions. It combines five components, each
              normalized to 0&ndash;1 and weighted to produce a holistic measure of AI-assisted development proficiency.
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
        </div>

        {/* Supported Tools */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-8">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-accent" />
            <h1 className="text-2xl font-black text-text-primary">Supported Tools</h1>
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
                <h3 className="text-sm font-bold text-text-primary mb-1 group-hover:text-accent transition-colors">
                  {tool.name}
                </h3>
                <p className="text-xs text-text-muted">{tool.description}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <h2 className="text-lg font-bold text-text-primary mb-3">Want to add your tool?</h2>
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
      </div>
    </div>
  );
}
