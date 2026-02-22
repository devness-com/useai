import { Sparkles } from 'lucide-react';
import { SUPPORTED_AI_TOOLS, TOOL_COLORS, TOOL_ICONS } from '@useai/shared';

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-6xl mx-auto px-6 pt-24 pb-12">
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
