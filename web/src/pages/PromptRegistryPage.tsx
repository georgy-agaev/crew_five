// @ts-nocheck
import { useEffect, useState } from 'react';

import {
  createPromptRegistryEntry,
  fetchPromptRegistry,
  setActivePrompt,
  type PromptEntry,
} from '../apiClient';
import { Alert } from '../components/Alert';

export function formatPromptLabel(entry: PromptEntry) {
  const version = entry.version ? (entry.version.startsWith('v') ? entry.version : `v${entry.version}`) : '';
  const status = entry.rollout_status ? ` · ${entry.rollout_status}` : '';
  return `${entry.id}${version ? ` ${version}` : ''}${status}`;
}

export function PromptRegistryPage() {
  const [entries, setEntries] = useState<PromptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    id: '',
    version: 'v1',
    description: '',
    rollout_status: 'pilot' as PromptEntry['rollout_status'],
    prompt_text: '',
  });

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPromptRegistry();
      setEntries(data);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load prompt registry');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onCreate = async () => {
    if (!form.id.trim()) {
      setError('Prompt ID is required');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await createPromptRegistryEntry({
        id: form.id.trim(),
        version: form.version,
        description: form.description || undefined,
        rollout_status: form.rollout_status,
        prompt_text: form.prompt_text || undefined,
      });
      setForm({ ...form, description: '', prompt_text: '' });
      await load();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create prompt entry');
    } finally {
      setLoading(false);
    }
  };

  const onSetActive = async (step: string, promptId: string) => {
    setLoading(true);
    setError(null);
    try {
      await setActivePrompt(step, promptId);
      await load(step);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to set active prompt');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Prompt Registry</h2>
      {error && <Alert kind="error">{error}</Alert>}
      {loading && <Alert>Loading...</Alert>}

      <div style={{ marginTop: 12 }}>
        <h3>Create prompt entry</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            placeholder="coach_prompt_id"
            value={form.id}
            onChange={(e) => setForm({ ...form, id: e.target.value })}
          />
          <input
            placeholder="version"
            value={form.version}
            onChange={(e) => setForm({ ...form, version: e.target.value })}
            style={{ width: 96 }}
          />
          <select
            value={form.rollout_status}
            onChange={(e) => setForm({ ...form, rollout_status: e.target.value as PromptEntry['rollout_status'] })}
          >
            <option value="pilot">Pilot</option>
            <option value="active">Active</option>
            <option value="retired">Retired</option>
          </select>
        </div>
        <div style={{ marginTop: 8 }}>
          <input
            placeholder="Description"
            style={{ width: '60%' }}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <textarea
            placeholder="System prompt text (full system prompt used by coach)"
            rows={3}
            style={{ width: '80%' }}
            value={form.prompt_text}
            onChange={(e) => setForm({ ...form, prompt_text: e.target.value })}
          />
        </div>
        <div style={{ marginTop: 8 }}>
          <button onClick={onCreate} disabled={loading}>
            {loading ? 'Saving...' : 'Create'}
          </button>
          <small style={{ marginLeft: 8 }}>
            Text here is the full system prompt used by the coach; substantial prompt wording changes should be made
            via a new prompt id/version.
          </small>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>All entries</h3>
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{formatPromptLabel(entry)}</strong>
              {entry.is_active && (
                <span className="pill pill--subtle" style={{ marginLeft: 8 }}>
                  Active
                </span>
              )}
              {entry.description ? ` — ${entry.description}` : ''}
              {entry.prompt_text ? (
                <div className="muted small">System prompt: {entry.prompt_text.slice(0, 80)}...</div>
              ) : (
                <div className="muted small">
                  No system prompt text stored. This prompt will fall back to the default scaffold.
                </div>
              )}
              {entry.step && (
                <button
                  style={{ marginLeft: 8 }}
                  disabled={loading || entry.is_active}
                  onClick={() => onSetActive(entry.step as any, entry.id)}
                >
                  {entry.is_active ? 'Active' : 'Set active'}
                </button>
              )}
            </li>
          ))}
          {entries.length === 0 && <li>No entries</li>}
        </ul>
      </div>
    </section>
  );
}
