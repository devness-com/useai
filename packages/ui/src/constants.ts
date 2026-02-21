export const TOOL_COLORS: Record<string, string> = {
  'claude-code': '#d4a04a',
  codex: '#10a37f',
  openai: '#10a37f',
  cursor: '#00b4d8',
  copilot: '#6e40c9',
  windsurf: '#38bdf8',
  'github-copilot': '#6e40c9',
  aider: '#4ade80',
  continue: '#f97316',
  cody: '#ff6b6b',
  tabby: '#a78bfa',
  roo: '#f472b6',
  gemini: '#4285f4',
};

export const TOOL_DISPLAY_NAMES: Record<string, string> = {
  'claude-code': 'Claude Code',
  codex: 'Codex',
  openai: 'OpenAI',
  cursor: 'Cursor',
  copilot: 'GitHub Copilot',
  windsurf: 'Windsurf',
  'github-copilot': 'GitHub Copilot',
  aider: 'Aider',
  continue: 'Continue',
  cody: 'Sourcegraph Cody',
  tabby: 'TabbyML',
  roo: 'Roo Code',
  mcp: 'MCP Client',
  gemini: 'Gemini',
};

export const TOOL_INITIALS: Record<string, string> = {
  'claude-code': 'CC',
  codex: 'OX',
  openai: 'OA',
  cursor: 'Cu',
  copilot: 'CP',
  windsurf: 'WS',
  'github-copilot': 'CP',
  aider: 'Ai',
  continue: 'Co',
  cody: 'Cy',
  tabby: 'Tb',
  roo: 'Ro',
  mcp: 'MC',
  gemini: 'Ge',
};

/** Map client keys to inline SVG data URIs (embedded for single-file build). */
export const TOOL_ICONS: Record<string, string> = {
  'claude-code': `data:image/svg+xml,${encodeURIComponent('<svg fill="currentColor" fill-rule="evenodd" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M14.034 3.627a1.625 1.625 0 0 0-2.913-.174L4.51 14.89a1.625 1.625 0 0 0 1.456 2.36h4.441l-1.58 4.249a1.625 1.625 0 0 0 2.886 1.288l7.394-12a1.625 1.625 0 0 0-1.443-2.412h-4.918z"></path></svg>')}`,
  codex: `data:image/svg+xml,${encodeURIComponent('<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg>')}`,
  openai: `data:image/svg+xml,${encodeURIComponent('<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073z"/></svg>')}`,
  cursor: `data:image/svg+xml,${encodeURIComponent('<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M3 3l18 9-18 9 4-9z"/></svg>')}`,
  gemini: `data:image/svg+xml,${encodeURIComponent('<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 0C12 6.627 6.627 12 0 12c6.627 0 12 5.373 12 12 0-6.627 5.373-12 12-12-6.627 0-12-5.373-12-12Z"/></svg>')}`,
};

export const CATEGORY_COLORS: Record<string, string> = {
  feature: '#4ade80',
  bugfix: '#f87171',
  refactor: '#a78bfa',
  test: '#38bdf8',
  docs: '#fbbf24',
  setup: '#6b655c',
  deployment: '#f97316',
  other: '#9c9588',
};

/**
 * Normalize a raw client string to a known key.
 * Handles variants like "gemini-cli-mcp-client" -> "gemini".
 */
const KNOWN_CLIENTS = Object.keys(TOOL_COLORS);
export function resolveClient(raw: string): string {
  if (TOOL_COLORS[raw]) return raw;
  const match = KNOWN_CLIENTS
    .filter((k) => raw.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ?? raw;
}
