import { useEffect, useState } from 'react';
import { RefreshCw, ChevronDown, ChevronRight, CloudUpload, LogIn, LogOut, CloudDownload, Clock, Eye, Copy, Check, Download } from 'lucide-react';
import type { SyncLogEntry } from '../lib/api';
import { fetchLogs } from '../lib/api';

type EventFilter = SyncLogEntry['event'] | 'all';

const EVENT_LABELS: Record<SyncLogEntry['event'], string> = {
  sync: 'Sync',
  auto_sync: 'Auto Sync',
  login: 'Login',
  logout: 'Logout',
  cloud_pull: 'Cloud Pull',
};

const EVENT_ICONS: Record<SyncLogEntry['event'], typeof CloudUpload> = {
  sync: CloudUpload,
  auto_sync: Clock,
  login: LogIn,
  logout: LogOut,
  cloud_pull: CloudDownload,
};

const STATUS_COLORS: Record<SyncLogEntry['status'], string> = {
  success: 'text-emerald-400',
  error: 'text-red-400',
  info: 'text-blue-400',
};

const STATUS_DOT_COLORS: Record<SyncLogEntry['status'], string> = {
  success: 'bg-emerald-400',
  error: 'bg-red-400',
  info: 'bg-blue-400',
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function LogEntry({ entry }: { entry: SyncLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const [showPayload, setShowPayload] = useState(false);
  const [copied, setCopied] = useState(false);
  const Icon = EVENT_ICONS[entry.event];
  const hasDetails = (entry.details && Object.keys(entry.details).length > 0) || !!entry.payload;

  return (
    <div className="group">
      <button
        onClick={() => hasDetails && setExpanded(!expanded)}
        className={`w-full flex items-start gap-2.5 px-3 py-2 text-left transition-colors ${hasDetails ? 'hover:bg-bg-surface-2/50 cursor-pointer' : 'cursor-default'}`}
      >
        <div className={`mt-0.5 shrink-0 ${STATUS_COLORS[entry.status]}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-primary truncate">{entry.message}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT_COLORS[entry.status]}`} />
              <span className="text-[10px] text-text-muted">{EVENT_LABELS[entry.event]}</span>
            </span>
            <span className="text-[10px] text-text-muted/60">{formatTime(entry.timestamp)}</span>
            {entry.payload && (
              <span className="text-[10px] text-accent/60 font-mono">{entry.payload.method} {new URL(entry.payload.endpoint).pathname}</span>
            )}
          </div>
        </div>
        {hasDetails && (
          <div className="mt-0.5 shrink-0 text-text-muted/40">
            {expanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </div>
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-2 pl-9 space-y-1.5">
          {/* Summary details */}
          {entry.details && Object.keys(entry.details).length > 0 && (
            <div className="bg-bg-surface-2/60 rounded-md px-2.5 py-1.5 space-y-0.5">
              {Object.entries(entry.details).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-4 text-[10px]">
                  <span className="text-text-muted">{key.replace(/_/g, ' ')}</span>
                  <span className="text-text-primary font-mono">{typeof value === 'string' ? value : JSON.stringify(value)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Payload viewer */}
          {entry.payload && (
            <div>
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowPayload(!showPayload); }}
                  className="flex items-center gap-1.5 text-[10px] font-medium text-accent/70 hover:text-accent transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  {showPayload ? 'Hide' : 'View'} exact data sent
                </button>
                {showPayload && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigator.clipboard.writeText(JSON.stringify(entry.payload!.body, null, 2));
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                      className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-primary transition-colors"
                      title="Copy to clipboard"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        const blob = new Blob([JSON.stringify(entry.payload!.body, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `log-${entry.event}-${new Date(entry.timestamp).toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      }}
                      className="flex items-center gap-1 text-[10px] font-medium text-text-muted hover:text-text-primary transition-colors"
                      title="Download as JSON"
                    >
                      <Download className="w-3 h-3" />
                      Download
                    </button>
                  </>
                )}
              </div>
              {showPayload && (
                <pre className="mt-1 bg-bg-base border border-border/40 rounded-md px-2.5 py-2 text-[10px] font-mono text-text-secondary overflow-x-auto max-h-80 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed">
                  {JSON.stringify(entry.payload.body, null, 2)}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const PAGE_SIZE = 30;

export function LogsPage() {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<EventFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = () => {
    setLoading(true);
    fetchLogs()
      .then((data) => {
        setLogs(data);
        setError(null);
      })
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  // Reset visible count when filter changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [filter]);

  const filtered = filter === 'all' ? logs : logs.filter((l) => l.event === filter);
  const sorted = [...filtered].reverse(); // newest first
  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  const eventTypes: EventFilter[] = ['all', 'sync', 'auto_sync', 'login', 'logout', 'cloud_pull'];

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center">
        <div className="text-sm text-danger">Failed to load logs: {error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto pt-2 pb-12 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {eventTypes.map((e) => (
            <button
              key={e}
              onClick={() => setFilter(e)}
              className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-colors ${
                filter === e
                  ? 'bg-bg-surface-2 text-text-primary'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {e === 'all' ? 'All' : EVENT_LABELS[e]}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-surface-2 transition-colors disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Log list */}
      <section className="bg-bg-surface-1 border border-border/50 rounded-xl overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-text-muted">Loading logs...</div>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-sm text-text-muted">No log entries yet</div>
            <div className="text-[11px] text-text-muted/60 mt-1">
              Sync, login, or pull from cloud to see activity here
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {visible.map((entry) => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </section>

      {/* Load more */}
      {hasMore && (
        <div className="text-center">
          <button
            onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
            className="px-4 py-1.5 rounded-md text-[11px] font-medium text-text-muted hover:text-text-primary bg-bg-surface-1 border border-border/50 hover:border-border transition-colors"
          >
            Show more ({sorted.length - visibleCount} remaining)
          </button>
        </div>
      )}
    </div>
  );
}

export default LogsPage;

