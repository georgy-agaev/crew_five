import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  fetchCampaigns,
  fetchDrafts,
  fetchEvents,
  fetchReplyPatterns,
  triggerDraftGenerate,
  triggerSmartleadSend,
} from './apiClient';

describe('web api client (live adapter)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetchCampaigns hits campaigns endpoint', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [{ id: 'c1', name: 'C' }] });
    const data = await fetchCampaigns();
    expect(fetch).toHaveBeenCalledWith('/api/campaigns', expect.any(Object));
    expect(data[0].id).toBe('c1');
  });

  it('triggerDraftGenerate sends dry-run by default', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ generated: 0, dryRun: true }) });
    const data = await triggerDraftGenerate('c1');
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.dryRun).toBe(true);
    expect(data.dryRun).toBe(true);
  });

  it('triggerSmartleadSend passes batch size and dry-run', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ sent: 0, skipped: 1, failed: 0, fetched: 5 }) });
    await triggerSmartleadSend({ batchSize: 5, dryRun: true });
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.batchSize).toBe(5);
    expect(body.dryRun).toBe(true);
  });

  it('fetchEvents uses since/limit', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });
    await fetchEvents({ since: '2025-01-01', limit: 10 });
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('since=2025-01-01');
    expect(url).toContain('limit=10');
  });

  it('fetchReplyPatterns uses topN/since', async () => {
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });
    await fetchReplyPatterns({ since: '2025-01-01', topN: 3 });
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('topN=3');
    expect(url).toContain('since=2025-01-01');
  });
});
