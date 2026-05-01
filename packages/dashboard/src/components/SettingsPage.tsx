import { useEffect, useState, useCallback, useRef } from 'react';
import { Camera, Cloud, AlertTriangle, ChevronDown, Save, Check, Loader2, HardDrive, CloudUpload, ScrollText, Info, ShieldCheck } from 'lucide-react';
import type { FullConfig, UserOrg } from '../lib/api';
import { fetchFullConfig, patchConfig, fetchMyOrgs } from '../lib/api';
import { useDashboardStore } from '../store';

// ── Inline sub-components ───────────────────────────────────────────────────

function InfoTooltip({ fields, example }: { fields: string[]; example?: string | undefined }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!show) return;
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [show]);

  return (
    <span className="relative inline-flex" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShow(v => !v); }}
        className="p-0.5 rounded-full text-text-muted/50 hover:text-text-muted transition-colors cursor-pointer"
      >
        <Info className="w-3 h-3" />
      </button>
      {show && (
        <div className="absolute left-5 bottom-0 z-[100] w-52 p-2 rounded-md border shadow-lg text-[10px] leading-relaxed max-h-72 overflow-y-auto" style={{ backgroundColor: 'var(--bg-surface-2)', borderColor: 'var(--border)', color: 'var(--text-muted)', opacity: 1 }}>
          <div className="font-medium text-text-secondary mb-1">Fields synced:</div>
          <div className="font-mono space-y-0.5">
            {fields.map(f => <div key={f}>{f}</div>)}
          </div>
          {example && (
            <div className="mt-1.5 pt-1.5 border-t border-border/30">
              <div className="font-medium text-text-secondary mb-0.5">Example:</div>
              <div className="text-text-muted/80 italic">{example}</div>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  warning,
  disabled,
  info,
  example,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warning?: string;
  disabled?: boolean;
  info?: string[];
  example?: string;
}) {
  return (
    <label className={`flex items-start justify-between gap-3 py-2 group ${disabled ? 'cursor-default' : 'cursor-pointer'}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-text-primary">{label}</span>
          {info && <InfoTooltip fields={info} example={example} />}
        </div>
        {description && <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">{description}</div>}
        {warning && checked && (
          <div className="flex items-center gap-1 mt-1 text-[11px] text-warning">
            <AlertTriangle className="w-3 h-3 shrink-0" />
            {warning}
          </div>
        )}
      </div>
      <button
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200
          ${checked ? 'bg-[#52525b]' : 'bg-bg-surface-2'}
          ${disabled ? 'cursor-not-allowed' : ''}
        `}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200
            ${checked ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>
    </label>
  );
}

function SettingSelect({
  label,
  description,
  value,
  options,
  onChange,
  info,
  example,
}: {
  label: string;
  description?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  info?: string[];
  example?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium text-text-primary">{label}</span>
          {info && <InfoTooltip fields={info} example={example} />}
        </div>
        {description && <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">{description}</div>}
      </div>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-bg-surface-2 border border-border/50 rounded-md px-2.5 py-1 pr-7 text-xs text-text-primary cursor-pointer hover:border-border transition-colors"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function configsEqual(a: FullConfig, b: FullConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ── Main ────────────────────────────────────────────────────────────────────

type SaveState = 'idle' | 'saving' | 'saved' | 'error';

export function SettingsPage({ onTabChange }: { onTabChange?: (tab: string) => void }) {
  const storeConfig = useDashboardStore((s) => s.config);
  const [saved, setSaved] = useState<FullConfig | null>(null); // last-saved config from server
  const [draft, setDraft] = useState<FullConfig | null>(null); // local draft being edited
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveResult, setSaveResult] = useState<string[] | null>(null); // tools updated
  const [error, setError] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<UserOrg[]>([]);

  useEffect(() => {
    fetchFullConfig()
      .then((c) => {
        setSaved(c);
        setDraft(structuredClone(c));
        if (c.authenticated) fetchMyOrgs().then(data => {
          if (Array.isArray(data)) setOrgs(data.filter(o => o?.org?.id));
        }).catch(() => {});
        if (!c.authenticated) setOrgs([]);
      })
      .catch((err) => setError((err as Error).message));
  }, [storeConfig?.authenticated]);

  const isDirty = saved && draft ? !configsEqual(saved, draft) : false;

  const handleSave = useCallback(async () => {
    if (!draft || !saved) return;
    setSaveState('saving');
    setSaveResult(null);
    try {
      const result = await patchConfig({
        capture: draft.capture,
        sync: draft.sync,
      });
      const { instructionsUpdated, ...config } = result;
      setSaved(config);
      setDraft(structuredClone(config));
      setSaveResult(instructionsUpdated ?? []);
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  }, [draft, saved]);

  const handleDiscard = useCallback(() => {
    if (saved) setDraft(structuredClone(saved));
  }, [saved]);

  // Local draft setters (no API calls)
  const setSync = useCallback((partial: Partial<FullConfig['sync']>) => {
    setDraft((d) => d ? { ...d, sync: { ...d.sync, ...partial } } : d);
  }, []);

  if (error) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center">
        <div className="text-sm text-danger">Failed to load config: {error}</div>
      </div>
    );
  }

  if (!draft) {
    return (
      <div className="max-w-xl mx-auto mt-12 text-center">
        <div className="text-sm text-text-muted">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto pt-2 pb-12 space-y-5">
      {/* Capture */}
      <section className="bg-bg-surface-1 border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Camera className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Capture</h2>
        </div>
        <p className="text-[11px] text-text-muted mb-3">What data is captured for each prompt and what gets synced to the cloud.</p>

        <div className="space-y-3">
          {/* Local only — never synced */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
              <HardDrive className="w-3 h-3 text-emerald" />
              <span className="text-[10px] font-semibold text-emerald uppercase tracking-wider">Local only — never synced</span>
            </div>
            <div className="divide-y divide-border/30 rounded-lg border border-emerald/15 bg-emerald/[0.03] px-3">
              <div className="py-2">
                <div className="text-xs font-medium text-text-primary">Prompts</div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">Full prompt text — always saved locally.</div>
              </div>
              <div className="py-2">
                <div className="text-xs font-medium text-text-primary">Prompt images</div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">AI-generated descriptions of attached images — always saved locally.</div>
              </div>
            </div>
          </div>

          {/* Choose what to sync */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5 px-0.5">
              <CloudUpload className="w-3 h-3 text-blue" />
              <span className="text-[10px] font-semibold text-blue uppercase tracking-wider">Configure what gets sent on manual or auto sync</span>
            </div>
            {!draft.authenticated && (
              <p className="text-[11px] text-text-muted mb-1">Sign in first to configure sync settings.</p>
            )}
            {draft.authenticated && <div className="divide-y divide-border/30 rounded-lg border border-blue/15 bg-blue/[0.03] px-3">
              <div className="py-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-text-primary">Leaderboard Stats</span>
                  <InfoTooltip fields={['promptId', 'connectionId', 'client', 'taskType', 'title', 'model', 'startedAt', 'endedAt', 'durationMs', 'languages', 'filesTouchedCount', 'activeSegments', 'promptImageCount', 'prevHash', 'hash', 'signature', '— Evaluation scores —', 'promptQuality', 'contextProvided', 'scopeQuality', 'independenceLevel', 'taskOutcome', 'iterationCount', 'toolsLeveraged', '— Daily totals —', 'clockTimeSeconds', 'aiTimeSeconds', 'multiplier', 'promptCount', 'streakDays', 'taskTypes', 'clients']} example="aiTimeSeconds: 7200, promptQuality: 4, taskOutcome: completed" />
                </div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">Session data, evaluation scores, and daily totals — always included with sync.</div>
              </div>
              <SettingSelect
                label="Evaluation reasons"
                description="Text explaining why each score was given."
                value={draft.sync.evaluationReasons}
                info={['promptQualityReason', 'contextProvidedReason', 'scopeQualityReason', 'independenceLevelReason', 'taskOutcomeReason', '*Ideal — what would make each score 5/5']}
                example='"Clear question but missing file context"'
                options={[
                  { value: 'all', label: 'All reasons' },
                  { value: 'belowPerfect', label: 'Below 5/5 only' },
                  { value: 'none', label: 'None' },
                ]}
                onChange={(v) => setSync({ evaluationReasons: v as FullConfig['sync']['evaluationReasons'] })}
              />
              <div className="py-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-text-primary">Milestones</span>
                  <InfoTooltip fields={['title', 'privateTitle', 'category', 'complexity']} example='title: "Built login page", category: "feature"' />
                </div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">Always synced — only visible to you as the owner, never shown publicly.</div>
              </div>
              <div className="py-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-text-primary">Private details</span>
                  <InfoTooltip fields={['privateTitle', 'project']} example='privateTitle: "Fixed auth bug in login.ts"' />
                </div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">Always synced — only visible to you as the owner, never shown publicly.</div>
              </div>
            </div>}
          </div>
        </div>
      </section>

      {/* Cloud Sync */}
      <section className="bg-bg-surface-1 border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Auto Sync Settings</h2>
        </div>
        <p className="text-[11px] text-text-muted mb-3">
          Configure automatic data sync to useai.dev.
          {!draft.authenticated && ' Sign in first to enable sync.'}
        </p>

        {draft.authenticated && (
        <div className="divide-y divide-border/30">
          <SettingToggle
            label="Auto-sync"
            description="Automatically sync data on a schedule."
            checked={draft.sync.autoSync}
            onChange={(v) => setSync({ autoSync: v })}
          />

          {draft.sync.autoSync && (
            <div className="space-y-3 pt-2">
              {orgs.length > 0 && (
                <div className="px-0.5">
                  <div className="text-[10px] text-text-muted mb-1">Your organizations:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {orgs.map((o) => (
                      <span
                        key={o.org.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald/10 text-[10px] font-medium text-emerald"
                      >
                        {o.org.name}
                        <span className="text-emerald/50">{o.role}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="divide-y divide-border/30">
                <SettingSelect
                  label="Sync interval"
                  description="How often to sync data."
                  value={String(draft.sync.intervalHours)}
                  options={[
                    { value: '0.25', label: 'Every 15 minutes' },
                    { value: '0.5', label: 'Every 30 minutes' },
                    { value: '1', label: 'Every hour' },
                    { value: '2', label: 'Every 2 hours' },
                    { value: '3', label: 'Every 3 hours' },
                    { value: '6', label: 'Every 6 hours' },
                    { value: '12', label: 'Every 12 hours' },
                    { value: '24', label: 'Every 24 hours' },
                  ]}
                  onChange={(v) => setSync({ intervalHours: Number(v) })}
                />
              </div>
            </div>
          )}
        </div>
        )}
      </section>

      {/* Seal Verification */}
      <section className="bg-bg-surface-1 border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="w-4 h-4 text-emerald" />
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Seal Verification</h2>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] text-text-muted leading-relaxed">
            When a session ends, a verification request is sent to useai.dev with the session ID and timestamp.
            The server generates a unique signature and stores it. This proves the session was sealed in real-time
            and not fabricated later.
          </p>
          <div className="divide-y divide-border/30 rounded-lg border border-emerald/15 bg-emerald/[0.03] px-3">
            <div className="py-2 flex items-start gap-2">
              <span className="text-[10px] font-mono text-emerald mt-0.5">→</span>
              <div>
                <div className="text-xs font-medium text-text-primary">What's sent</div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">Session ID + end timestamp — no prompt content, no code, no evaluation data.</div>
              </div>
            </div>
            <div className="py-2 flex items-start gap-2">
              <span className="text-[10px] font-mono text-emerald mt-0.5">→</span>
              <div>
                <div className="text-xs font-medium text-text-primary">What happens</div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">Server generates a hash and returns the signature.</div>
              </div>
            </div>
            <div className="py-2 flex items-start gap-2">
              <span className="text-[10px] font-mono text-emerald mt-0.5">→</span>
              <div>
                <div className="text-xs font-medium text-text-primary">Why</div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">Only verified sessions are counted towards the leaderboard.</div>
              </div>
            </div>
            <div className="py-2 flex items-start gap-2">
              <span className="text-[10px] font-mono text-emerald mt-0.5">→</span>
              <div>
                <div className="text-xs font-medium text-text-primary">If offline</div>
                <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">Session seals normally without verification. It won't count towards the leaderboard.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* More */}
      <section className="bg-bg-surface-1 border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <ScrollText className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">More</h2>
        </div>
        <div className="flex items-center gap-2">
          {draft.authenticated && (
            <button
              onClick={() => onTabChange?.('logs')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-bg-surface-2 border border-border/50 text-text-primary hover:bg-bg-surface-3 transition-colors"
            >
              <ScrollText className="w-3 h-3" />
              View sync logs
            </button>
          )}
          <button
            onClick={() => onTabChange?.('faqs')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-bg-surface-2 border border-border/50 text-text-primary hover:bg-bg-surface-3 transition-colors"
          >
            <Info className="w-3 h-3" />
            FAQs
          </button>
        </div>
      </section>

      {/* Save bar */}
      {isDirty && (
        <div className="sticky bottom-4 flex items-center justify-between gap-3 bg-bg-surface-1 border border-border/50 rounded-xl px-4 py-3 shadow-lg">
          <div className="text-xs text-text-muted">
            {saveState === 'saved' && saveResult
              ? `Saved. Updated instructions in ${saveResult.length} tool${saveResult.length !== 1 ? 's' : ''}: ${saveResult.join(', ') || 'none installed'}`
              : saveState === 'error'
                ? 'Failed to save. Try again.'
                : 'You have unsaved changes'}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              disabled={saveState === 'saving'}
              className="px-3 py-1.5 rounded-md text-xs font-medium text-text-muted hover:text-text-primary border border-border/50 hover:border-border transition-colors disabled:opacity-50"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saveState === 'saving'}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent text-bg-base hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {saveState === 'saving' ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : saveState === 'saved' ? (
                <Check className="w-3 h-3" />
              ) : (
                <Save className="w-3 h-3" />
              )}
              {saveState === 'saving' ? 'Saving...' : saveState === 'saved' ? 'Saved' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettingsPage;

