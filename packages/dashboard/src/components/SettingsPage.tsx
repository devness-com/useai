import { useEffect, useState, useCallback } from 'react';
import { Camera, BarChart3, Cloud, Shield, AlertTriangle, ChevronDown, Save, Check, Loader2 } from 'lucide-react';
import type { FullConfig } from '../lib/api';
import { fetchFullConfig, patchConfig } from '../lib/api';

// ── Inline sub-components ───────────────────────────────────────────────────

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  warning,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  warning?: string;
}) {
  return (
    <label className="flex items-start justify-between gap-3 py-2 cursor-pointer group">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-primary">{label}</div>
        <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">{description}</div>
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
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200
          ${checked ? 'bg-text-muted' : 'bg-bg-surface-2'}
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
}: {
  label: string;
  description: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-text-primary">{label}</div>
        <div className="text-[11px] text-text-muted leading-relaxed mt-0.5">{description}</div>
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

export function SettingsPage() {
  const [saved, setSaved] = useState<FullConfig | null>(null); // last-saved config from server
  const [draft, setDraft] = useState<FullConfig | null>(null); // local draft being edited
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [saveResult, setSaveResult] = useState<string[] | null>(null); // tools updated
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFullConfig()
      .then((c) => {
        setSaved(c);
        setDraft(structuredClone(c));
      })
      .catch((err) => setError((err as Error).message));
  }, []);

  const isDirty = saved && draft ? !configsEqual(saved, draft) : false;

  const handleSave = useCallback(async () => {
    if (!draft || !saved) return;
    setSaveState('saving');
    setSaveResult(null);
    try {
      const result = await patchConfig({
        capture: draft.capture,
        sync: draft.sync,
        evaluation_framework: draft.evaluation_framework,
      });
      const { instructions_updated, ...config } = result;
      setSaved(config);
      setDraft(structuredClone(config));
      setSaveResult(instructions_updated ?? []);
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
  const setCapture = useCallback((partial: Partial<FullConfig['capture']>) => {
    setDraft((d) => d ? { ...d, capture: { ...d.capture, ...partial } } : d);
  }, []);

  const setSync = useCallback((partial: Partial<Omit<FullConfig['sync'], 'include'>>) => {
    setDraft((d) => d ? { ...d, sync: { ...d.sync, ...partial } } : d);
  }, []);

  const setSyncInclude = useCallback((partial: Partial<FullConfig['sync']['include']>) => {
    setDraft((d) => d ? { ...d, sync: { ...d.sync, include: { ...d.sync.include, ...partial } } } : d);
  }, []);

  const setFramework = useCallback((v: string) => {
    setDraft((d) => d ? { ...d, evaluation_framework: v } : d);
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
        <p className="text-[11px] text-text-muted mb-3">What data to record locally for each session.</p>

        <div className="divide-y divide-border/30">
          <SettingToggle
            label="Prompts"
            description="Record prompt word count and content metadata"
            checked={draft.capture.prompt}
            onChange={(v) => setCapture({ prompt: v })}
          />
          <SettingToggle
            label="Prompt images"
            description="Record image descriptions from prompts"
            checked={draft.capture.prompt_images}
            onChange={(v) => setCapture({ prompt_images: v })}
          />
          <SettingToggle
            label="Evaluation scores"
            description="Record session quality scores (SPACE framework)"
            checked={draft.capture.evaluation}
            onChange={(v) => setCapture({ evaluation: v })}
          />
          <SettingSelect
            label="Evaluation reasons"
            description="When to include reason text for each score"
            value={draft.capture.evaluation_reasons}
            options={[
              { value: 'all', label: 'All scores' },
              { value: 'below_perfect', label: 'Below perfect only' },
              { value: 'none', label: 'None' },
            ]}
            onChange={(v) => setCapture({ evaluation_reasons: v as FullConfig['capture']['evaluation_reasons'] })}
          />
          <SettingToggle
            label="Milestones"
            description="Record milestones (accomplishments) from each session"
            checked={draft.capture.milestones}
            onChange={(v) => setCapture({ milestones: v })}
          />
        </div>
      </section>

      {/* Evaluation */}
      <section className="bg-bg-surface-1 border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Evaluation</h2>
        </div>
        <p className="text-[11px] text-text-muted mb-3">How sessions are scored.</p>

        <SettingSelect
          label="Framework"
          description="Scoring method used for session evaluations"
          value={draft.evaluation_framework}
          options={[
            { value: 'space', label: 'SPACE (weighted)' },
            { value: 'raw', label: 'Raw (equal weight)' },
          ]}
          onChange={setFramework}
        />
      </section>

      {/* Cloud Sync */}
      <section className="bg-bg-surface-1 border border-border/50 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Cloud className="w-4 h-4 text-text-muted" />
          <h2 className="text-xs font-bold text-text-muted uppercase tracking-widest">Cloud Sync</h2>
        </div>
        <p className="text-[11px] text-text-muted mb-3">
          Sync session data to useai.dev for leaderboards and public profiles.
          {!draft.authenticated && ' Login first to enable sync.'}
        </p>

        <div className="divide-y divide-border/30">
          <SettingToggle
            label="Auto-sync"
            description="Automatically sync data on a schedule"
            checked={draft.sync.enabled}
            onChange={(v) => setSync({ enabled: v })}
          />

          {draft.sync.enabled && (
            <>
              <SettingSelect
                label="Sync interval"
                description="How often to sync data"
                value={String(draft.sync.interval_hours)}
                options={[
                  { value: '1', label: 'Every hour' },
                  { value: '2', label: 'Every 2 hours' },
                  { value: '3', label: 'Every 3 hours' },
                  { value: '6', label: 'Every 6 hours' },
                  { value: '12', label: 'Every 12 hours' },
                  { value: '24', label: 'Every 24 hours' },
                ]}
                onChange={(v) => setSync({ interval_hours: Number(v) })}
              />

              <div className="pt-3 pb-1">
                <div className="text-[11px] font-medium text-text-muted uppercase tracking-wider mb-2">Include in sync</div>
              </div>

              <SettingToggle
                label="Sessions"
                description="Session metadata (duration, task type, client)"
                checked={draft.sync.include.sessions}
                onChange={(v) => setSyncInclude({ sessions: v })}
              />
              <SettingToggle
                label="Evaluations"
                description="Session quality scores"
                checked={draft.sync.include.evaluations}
                onChange={(v) => setSyncInclude({ evaluations: v })}
              />
              <SettingToggle
                label="Milestones"
                description="Accomplishments and categories"
                checked={draft.sync.include.milestones}
                onChange={(v) => setSyncInclude({ milestones: v })}
              />
              <SettingToggle
                label="Model"
                description="AI model used for each session"
                checked={draft.sync.include.model}
                onChange={(v) => setSyncInclude({ model: v })}
              />
              <SettingToggle
                label="Languages"
                description="Programming languages used"
                checked={draft.sync.include.languages}
                onChange={(v) => setSyncInclude({ languages: v })}
              />
              {/* Privacy-sensitive section */}
              <div className="pt-3 pb-1">
                <div className="flex items-center gap-1.5">
                  <Shield className="w-3 h-3 text-warning" />
                  <div className="text-[11px] font-medium text-warning uppercase tracking-wider">Privacy-sensitive</div>
                </div>
              </div>

              <SettingToggle
                label="Prompts"
                description="Prompt content sent to AI tools"
                checked={draft.sync.include.prompts}
                onChange={(v) => setSyncInclude({ prompts: v })}
                warning="Prompts may contain sensitive code or context"
              />
              <SettingToggle
                label="Private titles"
                description="Detailed session/milestone titles with project names"
                checked={draft.sync.include.private_titles}
                onChange={(v) => setSyncInclude({ private_titles: v })}
                warning="May reveal project names and specifics"
              />
              <SettingToggle
                label="Projects"
                description="Project names associated with sessions"
                checked={draft.sync.include.projects}
                onChange={(v) => setSyncInclude({ projects: v })}
                warning="Project names will be visible on your profile"
              />
            </>
          )}
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
