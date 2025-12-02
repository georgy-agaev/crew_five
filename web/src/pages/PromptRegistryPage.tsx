import { useEffect, useState } from 'react';

import {
  createPromptRegistryEntry,
  fetchPromptRegistry,
  type PromptEntry,
  type PromptStep,
} from '../apiClient';
import { Alert } from '../components/Alert';

export function formatPromptLabel(entry: PromptEntry) {
  const version = entry.version ? (entry.version.startsWith('v') ? entry.version : `v${entry.version}`) : '';
  return `${entry.id} (${entry.step}) ${version}${
    entry.rollout_status ? ` · ${entry.rollout_status}` : ''
  }`;
}

const steps: Array<{ key: PromptStep; label: string }> = [
  { key: 'icp_profile', label: 'ICP Profile' },
  { key: 'icp_hypothesis', label: 'Hypothesis' },
  { key: 'draft', label: 'Draft' },
];

export function PromptRegistryPage() {
  const [entries, setEntries] = useState<PromptEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    id: '',
    step: 'draft' as PromptStep,
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
        step: form.step,
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
          <select value={form.step} onChange={(e) => setForm({ ...form, step: e.target.value as PromptStep })}>
            {steps.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
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
            placeholder="Variant prompt text (optional; system scaffold is fixed)"
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
            System scaffold is fixed in code; text here is user-variant only. Edits beyond rollout_status/description
            require a new ID.
          </small>
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <h3>Entries</h3>
        <ul>
          {entries.map((entry) => (
            <li key={entry.id}>
              <strong>{formatPromptLabel(entry)}</strong>
              {entry.description ? ` — ${entry.description}` : ''}
              {entry.prompt_text ? (
                <div className="muted small">Variant text: {entry.prompt_text.slice(0, 80)}...</div>
              ) : (
                <div className="muted small">
                  No variant text stored. Refer to template repo for scaffold + variant content.
                </div>
              )}
            </li>
          ))}
          {entries.length === 0 && <li>No entries</li>}
        </ul>
      </div>
    </section>
  );
}
