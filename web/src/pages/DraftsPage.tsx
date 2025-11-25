import { useEffect, useState } from 'react';

import { fetchCampaigns, triggerDraftGenerate, type Campaign } from '../apiClient';

export function DraftsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState(10);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err?.message ?? 'Failed to load campaigns'));
  }, []);

  const runGenerate = async () => {
    if (!selected) return;
    setLoading(true);
    setError(null);
    try {
      const res = await triggerDraftGenerate(selected, { dryRun, limit });
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
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      {message && (
        <div style={{ marginTop: 12 }}>
          <strong>{message}</strong>
        </div>
      )}
    </section>
  );
}
