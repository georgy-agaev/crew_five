import { useState } from 'react';

import { triggerSmartleadSend } from '../apiClient';

export function SendPage() {
  const [dryRun, setDryRun] = useState(true);
  const [batchSize, setBatchSize] = useState(10);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSend = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await triggerSmartleadSend({ dryRun, batchSize });
      setSummary(
        `Send: fetched=${res.fetched} sent=${res.sent} failed=${res.failed} skipped=${res.skipped} dryRun=${dryRun}`
      );
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section>
      <h2>Send via Smartlead (Mock)</h2>
      <div>
        <label>
          Dry-run
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} />
        </label>
        <label style={{ marginLeft: 12 }}>
          Batch size
          <input
            type="number"
            value={batchSize}
            onChange={(e) => setBatchSize(Number(e.target.value))}
            style={{ width: 64 }}
          />
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={runSend}>Run Send</button>
      </div>
      {loading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      {summary && (
        <div style={{ marginTop: 12 }}>
          <strong>{summary}</strong>
        </div>
      )}
    </section>
  );
}
