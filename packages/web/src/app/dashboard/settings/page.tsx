'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/store/auth-store';
import { apiFetch } from '@/lib/api-client';
import { Save, Loader2, Check, Trash2, AlertTriangle } from 'lucide-react';

export default function SettingsPage() {
  const { user, setAuth, token } = useAuthStore();
  const [username, setUsername] = useState(user?.username || '');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // Danger zone state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [deleteResult, setDeleteResult] = useState<{ sessions_deleted: number; milestones_deleted: number } | null>(null);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
    }
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const updated = await apiFetch<any>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify({ username, display_name: displayName, bio }),
      });
      if (token) setAuth(token, updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteData = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      const result = await apiFetch<{ deleted: boolean; sessions_deleted: number; milestones_deleted: number }>('/api/sync/data', {
        method: 'DELETE',
      });
      setDeleteResult(result);
      setShowDeleteConfirm(false);
      setDeleteConfirmText('');
    } catch {
      setDeleteError('Failed to delete data. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-lg">
      <h1 className="text-xl font-black text-text-primary mb-6">Profile Settings</h1>

      <form onSubmit={handleSave} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-bg-surface-1 text-sm text-text-primary outline-none focus:border-accent transition-colors"
            placeholder="your-username"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-bg-surface-1 text-sm text-text-primary outline-none focus:border-accent transition-colors"
            placeholder="Your Name"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-text-muted uppercase tracking-wider mb-1.5">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full px-3 py-2.5 rounded-lg border border-border bg-bg-surface-1 text-sm text-text-primary outline-none focus:border-accent transition-colors resize-none"
            placeholder="Tell the world about your AI coding journey..."
          />
        </div>

        {error && <p className="text-xs text-error">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent-bright text-black font-bold rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saved ? 'Saved!' : 'Save Changes'}
        </button>
      </form>

      {/* Danger Zone */}
      <div className="mt-12 pt-8 border-t border-error/20">
        <h2 className="text-sm font-black text-error uppercase tracking-wider mb-1">Danger Zone</h2>
        <p className="text-xs text-text-muted mb-4">
          Irreversible actions that affect your cloud data.
        </p>

        <div className="rounded-lg border border-error/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Delete Cloud Data</h3>
              <p className="text-xs text-text-muted mt-0.5">
                Permanently delete all your sessions, streaks, badges, and milestones from the cloud.
                Your local data in <code className="text-[11px] bg-bg-surface-1 px-1 rounded">~/.useai/</code> is not affected and can be re-synced.
              </p>
            </div>
            {!showDeleteConfirm && !deleteResult && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-error border border-error/30 rounded-lg hover:bg-error/10 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>

          {showDeleteConfirm && (
            <div className="mt-4 pt-4 border-t border-error/10">
              <div className="flex items-start gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-error shrink-0 mt-0.5" />
                <p className="text-xs text-text-secondary">
                  This will permanently delete <strong>all</strong> your cloud data including sessions, daily syncs, milestones, streaks, and badges.
                  If you belong to an organization, your data will no longer be visible to org admins.
                </p>
              </div>
              <label className="block text-xs text-text-muted mb-1.5">
                Type <strong className="text-text-primary">delete my data</strong> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-error/30 bg-bg-surface-1 text-sm text-text-primary outline-none focus:border-error transition-colors mb-3"
                placeholder="delete my data"
                autoFocus
              />
              {deleteError && <p className="text-xs text-error mb-3">{deleteError}</p>}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteData}
                  disabled={deleteConfirmText !== 'delete my data' || deleting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-error rounded-lg hover:bg-error/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  {deleting ? 'Deleting...' : 'Permanently Delete'}
                </button>
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteConfirmText(''); setDeleteError(''); }}
                  className="px-3 py-1.5 text-xs font-bold text-text-muted hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {deleteResult && (
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-start gap-2">
                <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <div className="text-xs text-text-secondary">
                  <p className="font-bold text-text-primary">Cloud data deleted successfully.</p>
                  <p className="mt-1">
                    {deleteResult.sessions_deleted} sessions and {deleteResult.milestones_deleted} milestones removed.
                    You can re-sync your local data at any time.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
