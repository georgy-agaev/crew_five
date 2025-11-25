import { describe, expect, it } from 'vitest';

import { fetchCampaigns, triggerDraftGenerate, triggerSmartleadSend } from './apiClient';

describe('web api client (mock)', () => {
  it('fetchCampaigns returns mock list', async () => {
    const campaigns = await fetchCampaigns();
    expect(campaigns.length).toBeGreaterThan(0);
  });

  it('triggerDraftGenerate respects dry-run', async () => {
    const result = await triggerDraftGenerate('camp', { dryRun: true, limit: 5 });
    expect(result.generated).toBe(0);
    expect(result.dryRun).toBe(true);
  });

  it('triggerSmartleadSend respects dry-run', async () => {
    const result = await triggerSmartleadSend({ dryRun: true, batchSize: 5 });
    expect(result.sent).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.fetched).toBe(5);
  });
});
