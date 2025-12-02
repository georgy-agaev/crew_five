import { useEffect, useState } from 'react';

import { fetchCampaigns, fetchDrafts, triggerDraftGenerate, type Campaign } from '../apiClient';
import { Alert } from '../components/Alert';
import { loadSettings } from '../hooks/useSettingsStore';

export type DraftRow = {
  id: string;
  status?: string;
  contact?: string;
};

export function filterDraftsByStatus(drafts: DraftRow[], status: string) {
  if (!status) return drafts;
  return drafts.filter((d) => d.status === status);
}

export function DraftsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState(10);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('');

  useEffect(() => {
    fetchCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err?.message ?? 'Failed to load campaigns'));
  }, []);

  useEffect(() => {
    if (!selected) {
      setDrafts([]);
      return;
    }
    setLoading(true);
    setError(null);
    fetchDrafts(selected)
      .then(setDrafts)
      .catch((err) => setError(err?.message ?? 'Failed to load drafts'))
      .finally(() => setLoading(false));
  }, [selected]);

  const runGenerate = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    const settings = loadSettings();
    const draftModel = settings.providers.draft;
    try {
      const res = await triggerDraftGenerate(selected, {
        dryRun,
        limit,
        provider: draftModel.provider,
        model: draftModel.model,
      });
      setMessage(`Generated=${res.generated} dryRun=${res.dryRun}`);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate drafts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Drafts</h2>
      <div style={{ marginBottom: 12 }}>
        <label>
          Campaign
          <select value={selected ?? ''} onChange={(e) => setSelected(e.target.value)} style={{ marginLeft: 8 }}>
            <option value="">Select...</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div>
        <label>
          Dry-run
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
        </label>
        <label style={{ marginLeft: 12 }}>
          Limit
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            style={{ width: 64 }}
          />
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={runGenerate} disabled={!selected}>
          Generate Drafts
        </button>
      </div>
      <div style={{ marginTop: 16 }}>
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ marginLeft: 8 }}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filterDraftsByStatus(drafts, statusFilter).map((d) => (
              <tr key={d.id}>
                <td>{d.id}</td>
                <td>{d.status ?? 'n/a'}</td>
              </tr>
            ))}
            {drafts.length === 0 && (
              <tr>
                <td colSpan={2}>No drafts</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {loading && <Alert>Loading...</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {message && (
        <div style={{ marginTop: 12 }}>
          <strong>{message}</strong>
        </div>
      )}
    </section>
  );
}
