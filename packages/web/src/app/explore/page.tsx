import { Terminal, Sparkles } from 'lucide-react';

const TOOLS = [
  { name: 'Claude Code', description: 'Anthropic\'s CLI coding assistant', color: '#e2b45a' },
  { name: 'Cursor', description: 'AI-first code editor', color: '#fafafa' },
  { name: 'GitHub Copilot', description: 'AI pair programmer by GitHub', color: '#6e40c9' },
  { name: 'Windsurf', description: 'AI-powered IDE', color: '#00d4aa' },
  { name: 'Gemini CLI', description: 'Google\'s AI coding tool', color: '#4285f4' },
  { name: 'OpenAI Codex', description: 'OpenAI\'s code generation', color: '#10a37f' },
  { name: 'Aider', description: 'AI pair programming in terminal', color: '#14b8a6' },
  { name: 'Amazon Q', description: 'AWS AI developer assistant', color: '#ff9900' },
];

export default function ExplorePage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <nav className="flex items-center justify-between max-w-5xl mx-auto px-6 py-4">
        <a href="/" className="text-xl font-black tracking-tight text-text-primary">
          use<span className="text-accent">AI</span>
        </a>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Sparkles className="w-6 h-6 text-accent" />
          <h1 className="text-2xl font-black text-text-primary">Supported Tools</h1>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {TOOLS.map((tool) => (
            <div
              key={tool.name}
              className="p-5 rounded-xl border border-border/50 bg-bg-surface-1/50 hover:border-accent/30 transition-colors group"
            >
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center mb-3 text-sm font-black"
                style={{ backgroundColor: `${tool.color}15`, color: tool.color }}
              >
                <Terminal className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-bold text-text-primary mb-1 group-hover:text-accent transition-colors">
                {tool.name}
              </h3>
              <p className="text-xs text-text-muted">{tool.description}</p>
            </div>
          ))}
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
