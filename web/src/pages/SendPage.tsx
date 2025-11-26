import { useState } from 'react';

import { triggerSmartleadSend } from '../apiClient';
import { Alert } from '../components/Alert';

export function isSendDisabled(opts: { loading: boolean; hasApproved: boolean; smartleadReady: boolean }) {
  return opts.loading || !opts.hasApproved || !opts.smartleadReady;
}

type SendPageProps = {
  smartleadReady?: boolean;
};

export function SendPage({ smartleadReady = true }: SendPageProps) {
  const [dryRun, setDryRun] = useState(true);
  const [batchSize, setBatchSize] = useState(10);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApproved, setHasApproved] = useState(false);

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
        <label>
          <input
            type="checkbox"
            checked={hasApproved}
            onChange={(e) => setHasApproved(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          I confirm approved drafts are ready
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <button onClick={runSend} disabled={isSendDisabled({ loading, hasApproved, smartleadReady })}>
          Run Send
        </button>
        {!smartleadReady && <small style={{ marginLeft: 8 }}>Smartlead env missing; send disabled.</small>}
      </div>
      {loading && <Alert>Loading...</Alert>}
      {error && <Alert kind="error">{error}</Alert>}
      {summary && (
        <div style={{ marginTop: 12 }}>
          <strong>{summary}</strong>
        </div>
      )}
    </section>
  );
}
