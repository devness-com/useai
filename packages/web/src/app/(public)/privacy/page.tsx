import {
  Shield,
  Eye,
  Database,
  Lock,
  Globe,
  Server,
  Fingerprint,
  Trash2,
  CloudOff,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const SESSION_FIELDS = [
  { field: 'session_id', description: 'Random UUID identifying the session', synced: true, public: false },
  { field: 'client', description: 'Which AI tool (e.g. "claude", "cursor")', synced: true, public: true },
  { field: 'task_type', description: 'Category: coding, debugging, testing, planning, reviewing, documenting, learning', synced: true, public: true },
  { field: 'model', description: 'AI model ID (e.g. "claude-sonnet-4-6")', synced: true, public: true },
  { field: 'started_at', description: 'ISO timestamp when session began', synced: true, public: true },
  { field: 'ended_at', description: 'ISO timestamp when session ended', synced: true, public: true },
  { field: 'duration_seconds', description: 'Total session length in seconds', synced: true, public: true },
  { field: 'project', description: 'Project name (root directory name)', synced: true, public: false },
  { field: 'languages', description: 'Programming languages used', synced: true, public: true },
  { field: 'files_touched', description: 'Count of files modified (number only, never file names)', synced: true, public: true },
  { field: 'title', description: 'Generic public description (no project names)', synced: true, public: true },
  { field: 'private_title', description: 'Detailed description (may include project names)', synced: true, public: false },
];

const NEVER_TRACKED = [
  'Your source code, diffs, patches, or snippets',
  'Your prompts — what you ask the AI',
  'AI responses — what the AI generates',
  'File names or paths — only the count of files touched',
  'Directory structure — no tree or layout information',
  'Git history — no commits, branches, or diffs',
  'Credentials — no API keys, tokens, passwords, or secrets',
  'Screen content — no screenshots or terminal output',
];

const DATA_CONTROLS = [
  {
    icon: FileText,
    title: 'INSPECT',
    command: 'useai status',
    description: 'View a summary of all locally stored data. Or inspect raw JSONL files directly in ~/.useai/data/',
  },
  {
    icon: Database,
    title: 'EXPORT',
    command: 'useai export',
    description: 'Export all your data as JSON. Your sessions are plain JSONL files you can read with any text editor.',
  },
  {
    icon: Trash2,
    title: 'DELETE',
    command: 'useai purge',
    description: 'Delete all local data. You can also remove individual session files from ~/.useai/data/sealed/',
  },
  {
    icon: CloudOff,
    title: 'NEVER SYNC',
    command: null,
    description: 'Simply don\'t run "useai login". The MCP server makes zero network calls unless you explicitly authenticate and sync.',
  },
];

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg-base">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-24 pb-12">

        {/* Page Header */}
        <div className="mb-16 max-w-3xl">
          <div className="text-[10px] font-mono tracking-widest text-accent mb-3 border-l-2 border-accent pl-2">LEGAL</div>
          <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-text-primary mb-4">
            Privacy <span className="gradient-text-accent">Policy</span>
          </h1>
          <p className="text-sm sm:text-base text-text-muted leading-relaxed mb-2">
            UseAI is local-first by architecture, not just by policy. This document describes every field
            captured, where data is stored, what happens when you sync, and what controls you have.
          </p>
          <p className="text-xs text-text-muted font-mono">
            Last updated: February 2026 &middot; Effective immediately
          </p>
        </div>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  CORE PRIVACY PROMISE                                       */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">CORE</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Privacy by Architecture</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              The UseAI MCP server writes to disk and makes <span className="text-text-primary font-bold">zero network calls</span> during
              your coding sessions. Data only leaves your machine when you explicitly choose to sync by running{' '}
              <code className="text-accent font-mono text-xs">useai sync</code>.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              If you never authenticate (<code className="text-accent font-mono text-xs">useai login</code>),
              the MCP server operates entirely offline. All data stays in{' '}
              <code className="text-accent font-mono text-xs">~/.useai/</code> on your machine.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { icon: Eye, title: 'NO CODE ACCESS', description: 'UseAI never reads, transmits, or stores your source code.' },
              { icon: Lock, title: 'NO PROMPTS', description: 'Your conversations with AI tools are never captured or stored.' },
              { icon: Shield, title: 'LOCAL FIRST', description: 'All processing happens on your machine. No cloud dependency.' },
              { icon: Globe, title: 'OPT-IN SYNC', description: 'Data only leaves your machine when you explicitly choose.' },
            ].map((item) => (
              <div key={item.title} className="hud-border rounded-xl p-5 bg-bg-surface-1/80 text-center">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 mx-auto mb-3">
                  <item.icon className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-mono font-bold text-xs text-text-primary mb-2">{item.title}</h4>
                <p className="text-xs text-text-muted leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  WHAT WE TRACK                                              */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">TRACKED</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">What We Collect</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="text-[10px] font-mono tracking-widest text-accent mb-6 border-l-2 border-accent pl-2">SESSION_METADATA</div>

          <div className="hud-border rounded-xl bg-bg-surface-1/80 overflow-hidden mb-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-[10px] font-mono font-bold text-accent tracking-widest px-4 py-3">FIELD</th>
                    <th className="text-left text-[10px] font-mono font-bold text-accent tracking-widest px-4 py-3">DESCRIPTION</th>
                    <th className="text-center text-[10px] font-mono font-bold text-accent tracking-widest px-4 py-3">SYNCED</th>
                    <th className="text-center text-[10px] font-mono font-bold text-accent tracking-widest px-4 py-3">PUBLIC</th>
                  </tr>
                </thead>
                <tbody>
                  {SESSION_FIELDS.map((field) => (
                    <tr key={field.field} className="border-b border-border/30 last:border-0">
                      <td className="px-4 py-2.5">
                        <code className="text-xs font-mono text-text-primary">{field.field}</code>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-text-muted">{field.description}</td>
                      <td className="px-4 py-2.5 text-center text-xs font-mono">
                        {field.synced ? <span className="text-accent">Yes</span> : <span className="text-text-muted">No</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center text-xs font-mono">
                        {field.public === true ? <span className="text-accent">Yes</span> : field.public === false ? <span className="text-error">No</span> : <span className="text-text-muted">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-8">
            <h4 className="text-sm font-bold text-text-primary mb-3">Evaluation Metrics</h4>
            <p className="text-xs text-text-muted leading-relaxed mb-3">
              At the end of each session, the AI model self-assesses session quality using the SPACE framework.
              This includes scores (1-5) for prompt quality, context provided, independence level, and scope quality,
              along with improvement tips for any dimension scored below 5. Evaluation data is synced when you choose
              to sync but is never publicly visible.
            </p>
            <h4 className="text-sm font-bold text-text-primary mb-3">Cryptographic Fields</h4>
            <p className="text-xs text-text-muted leading-relaxed">
              Each session includes a SHA-256 hash chain anchor (<code className="text-accent font-mono text-xs">chain_start_hash</code>,{' '}
              <code className="text-accent font-mono text-xs">chain_end_hash</code>) and an Ed25519{' '}
              <code className="text-accent font-mono text-xs">seal_signature</code>. These enable tamper evidence
              and are synced with the session data.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  WHAT WE NEVER TRACK                                        */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">NEVER</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">What We Never Collect</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              UseAI <span className="text-text-primary font-bold">never</span> captures any of the following, regardless of
              whether you sync or not:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {NEVER_TRACKED.map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs text-text-muted">
                  <span className="text-error mt-0.5 shrink-0">&times;</span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <p className="text-xs text-text-muted mt-4">
              You can verify this by auditing the open-source MCP tool handlers in{' '}
              <a
                href="https://github.com/devness-com/useai/tree/main/packages/mcp/src/tools"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-bright border-b border-accent/30"
              >
                packages/mcp/src/tools/
              </a>.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  LOCAL STORAGE                                              */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">LOCAL</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Where Data Lives</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed mb-4">
              All data is stored in <code className="text-accent font-mono text-xs">~/.useai/</code> on your machine.
              All files are plain JSON or JSONL that you can inspect with any text editor.
            </p>
            <div className="bg-bg-surface-2 rounded-lg p-4 font-mono text-xs text-text-secondary">
              <div className="text-text-muted">~/.useai/</div>
              <div className="ml-4">keystore.json <span className="text-text-muted ml-2"># Ed25519 key pair (private key encrypted)</span></div>
              <div className="ml-4">config.json <span className="text-text-muted ml-2"># Settings, auth token, sync preferences</span></div>
              <div className="ml-4">daemon.pid <span className="text-text-muted ml-2"># Running daemon PID</span></div>
              <div className="ml-4">data/</div>
              <div className="ml-8">active/ <span className="text-text-muted ml-2"># In-progress session records (JSONL)</span></div>
              <div className="ml-8">sealed/ <span className="text-text-muted ml-2"># Completed session records (JSONL)</span></div>
              <div className="ml-8">sessions.json <span className="text-text-muted ml-2"># Session index</span></div>
              <div className="ml-8">milestones.json <span className="text-text-muted ml-2"># Milestone records</span></div>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  CLOUD SYNC                                                 */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">SYNC</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Cloud Sync</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80 mb-6">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              Cloud sync is entirely <span className="text-text-primary font-bold">opt-in</span>. When you run{' '}
              <code className="text-accent font-mono text-xs">useai sync</code>, full session records are sent to
              the UseAI server. This includes all metadata fields above, including{' '}
              <code className="text-accent font-mono text-xs">private_title</code> and{' '}
              <code className="text-accent font-mono text-xs">project</code> name.
            </p>
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              Sessions are deduplicated by <code className="text-accent font-mono text-xs">session_id</code> — syncing
              the same session twice will not create duplicates.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 shrink-0">
                  <Globe className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-mono font-bold text-sm text-text-primary">PUBLICLY VISIBLE</h4>
              </div>
              <ul className="space-y-1.5 text-xs text-text-muted">
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Public title (never private_title)</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Category (bugfix, feature, etc.)</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Complexity (simple, medium, complex)</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Created date</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Aggregate stats: hours, streak, languages</li>
              </ul>
            </div>
            <div className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 shrink-0">
                  <Server className="w-5 h-5 text-accent" />
                </div>
                <h4 className="font-mono font-bold text-sm text-text-primary">SERVER-SIDE STORAGE</h4>
              </div>
              <ul className="space-y-1.5 text-xs text-text-muted">
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> PostgreSQL database</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Full session records (including private_title)</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Daily aggregates computed from sessions</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Data stored indefinitely (no TTL policy yet)</li>
                <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> Deletion API planned but not yet available</li>
              </ul>
            </div>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  YOUR CONTROLS                                              */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">CONTROLS</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Your Controls</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {DATA_CONTROLS.map((control) => (
              <div key={control.title} className="hud-border rounded-xl p-5 bg-bg-surface-1/80">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg bg-[var(--accent-alpha)] flex items-center justify-center border border-accent/20 shrink-0">
                    <control.icon className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h4 className="font-mono font-bold text-sm text-text-primary">{control.title}</h4>
                    {control.command && (
                      <code className="text-[10px] font-mono text-accent/70">{control.command}</code>
                    )}
                  </div>
                </div>
                <p className="text-xs text-text-muted leading-relaxed">{control.description}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  WEBSITE & COOKIES                                          */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">WEBSITE</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Website & Cookies</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              The UseAI website (<span className="text-text-primary">useai.dev</span>) uses minimal cookies
              required for authentication (JWT session token). We do not use advertising trackers,
              third-party analytics, or marketing cookies.
            </p>
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              When you create an account and log in, we store your email address, display name, username,
              and avatar URL. Authentication uses OTP (one-time password) sent to your email — no passwords are stored.
            </p>
            <p className="text-sm text-text-muted leading-relaxed">
              The website may make requests to the GitHub API to fetch repository star counts for display purposes.
              No personal data is sent to GitHub through these requests.
            </p>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  TRANSPARENCY                                               */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">TRANSPARENCY</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Cloud Code Transparency</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-24">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              The UseAI MCP server, CLI, and all client-side code are{' '}
              <a
                href="https://github.com/devness-com/useai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:text-accent-bright border-b border-accent/30"
              >
                open source
              </a>{' '}
              and auditable under the MIT license.
            </p>
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              The cloud API (useai.dev backend) is <span className="text-text-primary font-bold">not open source</span>.
              This means you cannot directly audit how the server processes your data after sync. To compensate:
            </p>
            <ul className="space-y-1.5 text-xs text-text-muted ml-4">
              <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> This document describes server behavior as accurately as possible</li>
              <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> The sync payload sections above show exactly what leaves your machine</li>
              <li className="flex items-start gap-2"><span className="text-accent shrink-0">&bull;</span> We commit to keeping this document updated when server behavior changes</li>
            </ul>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════ */}
        {/*  CONTACT                                                    */}
        {/* ════════════════════════════════════════════════════════════ */}

        <div className="flex items-center gap-4 mb-12">
          <div className="text-[10px] font-mono tracking-widest text-accent border-l-2 border-accent pl-2">CONTACT</div>
          <h2 className="text-lg font-black text-text-primary uppercase tracking-wide">Questions & Contact</h2>
          <div className="flex-1 h-px bg-gradient-to-r from-accent/30 to-transparent" />
        </div>

        <section className="mb-8">
          <div className="hud-border rounded-xl p-6 bg-bg-surface-1/80">
            <p className="text-sm text-text-muted leading-relaxed mb-3">
              If you have questions about this privacy policy or data handling, you can:
            </p>
            <ul className="space-y-1.5 text-xs text-text-muted ml-4 mb-4">
              <li className="flex items-start gap-2">
                <span className="text-accent shrink-0">&bull;</span>
                Open an issue on{' '}
                <a href="https://github.com/devness-com/useai/issues" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-bright border-b border-accent/30">
                  GitHub
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent shrink-0">&bull;</span>
                Email us at{' '}
                <a href="mailto:privacy@useai.dev" className="text-accent hover:text-accent-bright border-b border-accent/30">
                  privacy@useai.dev
                </a>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-accent shrink-0">&bull;</span>
                For security vulnerabilities, see our{' '}
                <Link href="/security" className="text-accent hover:text-accent-bright border-b border-accent/30">
                  Security Policy
                </Link>
              </li>
            </ul>
            <p className="text-xs text-text-muted">
              For full technical details, see the{' '}
              <a href="https://github.com/devness-com/useai/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-bright border-b border-accent/30">
                PRIVACY.md
              </a>{' '}
              in our repository.
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
