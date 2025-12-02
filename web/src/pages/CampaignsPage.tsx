import { useEffect, useState } from 'react';

import { fetchCampaigns, triggerDraftGenerate, triggerSmartleadSend, type Campaign } from '../apiClient';
import { Alert } from '../components/Alert';
import { loadSettings } from '../hooks/useSettingsStore';

export function modeSummary(
  dataQuality: 'strict' | 'graceful',
  interaction: 'express' | 'coach'
) {
  return `${dataQuality} / ${interaction}`;
}

export function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dryRun, setDryRun] = useState(true);
  const [limit, setLimit] = useState(10);
  const [sendDryRun, setSendDryRun] = useState(true);
  const [sendBatchSize, setSendBatchSize] = useState(10);
  const [summary, setSummary] = useState<string | null>(null);
  const [dataQualityMode, setDataQualityMode] = useState<'strict' | 'graceful'>('strict');
  const [interactionMode, setInteractionMode] = useState<'express' | 'coach'>('express');

  useEffect(() => {
    fetchCampaigns()
      .then(setCampaigns)
      .catch((err) => setError(err?.message ?? 'Failed to load campaigns'))
      .finally(() => setLoading(false));
  }, []);

  const runDraftGenerate = async (id: string) => {
    setSummary(null);
    setError(null);
    setLoading(true);
    const settings = loadSettings();
    const draftModel = settings.providers.draft;
    try {
      const result = await triggerDraftGenerate(id, {
        dryRun,
        limit,
        provider: draftModel.provider,
        model: draftModel.model,
      });
      setSummary(
        `Drafts: generated=${result.generated}, dryRun=${result.dryRun}, modes=${modeSummary(
          dataQualityMode,
          interactionMode
        )}`
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to generate drafts');
    } finally {
      setLoading(false);
    }
  };

  const runSend = async () => {
    setSummary(null);
    setError(null);
    setLoading(true);
    try {
      const result = await triggerSmartleadSend({ dryRun: sendDryRun, batchSize: sendBatchSize });
      setSummary(
        `Send: fetched=${result.fetched} sent=${result.sent} failed=${result.failed} skipped=${result.skipped}`
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Campaigns</h2>
      {error && <Alert kind="error">{error}</Alert>}
      {loading && <Alert>Loading...</Alert>}
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
      <div style={{ marginTop: 12 }}>
        <fieldset style={{ border: '1px solid #e2e8f0', padding: 8, borderRadius: 6 }}>
          <legend>Modes</legend>
          <div>
            <label>
              Data quality
              <select
                value={dataQualityMode}
                onChange={(e) => setDataQualityMode(e.target.value as 'strict' | 'graceful')}
                style={{ marginLeft: 8 }}
              >
                <option value="strict">Strict (default)</option>
                <option value="graceful">Graceful</option>
              </select>
            </label>
          </div>
          <div style={{ marginTop: 8 }}>
            <label>
              Interaction mode
              <select
                value={interactionMode}
                onChange={(e) => setInteractionMode(e.target.value as 'express' | 'coach')}
                style={{ marginLeft: 8 }}
              >
                <option value="express">Pipeline Express (default)</option>
                <option value="coach">Interactive Coach</option>
              </select>
            </label>
          </div>
        </fieldset>
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
