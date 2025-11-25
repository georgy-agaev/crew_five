import { useEffect, useState } from 'react';

import { fetchCampaigns, triggerDraftGenerate, triggerSmartleadSend, type Campaign } from '../apiClient';

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState(10);
  const [sendDryRun, setSendDryRun] = useState(true);
  const [sendBatchSize, setSendBatchSize] = useState(10);
  const [summary, setSummary] = useState<string | null>(null);

  useEffect(() => {
    fetchCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err?.message ?? 'Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, []);

  const runDraftGenerate = async (id: string) => {
    setSummary(null);
    const result = await triggerDraftGenerate(id, { dryRun, limit });
    setSummary(`Drafts: generated=${result.generated}, dryRun=${result.dryRun}`);
  };

  const runSend = async () => {
    setSummary(null);
    const result = await triggerSmartleadSend({ dryRun: sendDryRun, batchSize: sendBatchSize });
    setSummary(
      `Send: fetched=${result.fetched} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`
    );
  };

  if (loading) return <p>Loading campaigns...</p>;
  if (error) return <p>{error}</p>;

  return (
    <section>
      <h2>Campaigns</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
            <th>Drafts</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.status ?? 'n/a'}</td>
              <td>
                <button onClick={() => runDraftGenerate(c.id)}>Generate Drafts</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 16 }}>
        <label>
          Drafts dry-run
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

      <div style={{ marginTop: 24 }}>
        <h3>Smartlead Send</h3>
        <label>
          Dry-run
          <input type="checkbox" checked={sendDryRun} onChange={(e) => setSendDryRun(e.target.checked)} />
        </label>
        <label style={{ marginLeft: 12 }}>
          Batch size
          <input
            type="number"
            value={sendBatchSize}
            onChange={(e) => setSendBatchSize(Number(e.target.value))}
            style={{ width: 64 }}
          />
        </label>
        <div style={{ marginTop: 8 }}>
          <button onClick={runSend}>Send via Smartlead (mock)</button>
        </div>
      </div>

      {summary && (
        <div style={{ marginTop: 16 }}>
          <strong>Summary:</strong> {summary}
        </div>
      )}
    </section>
  );
}
