import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadClient() {
  vi.resetModules();
  return import('./apiClient');
}

describe('web api client (live adapter)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('fetchCampaigns hits campaigns endpoint', async () => {
    const { fetchCampaigns } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [{ id: 'c1', name: 'C' }] });
    const data = await fetchCampaigns();
    expect(fetch).toHaveBeenCalledWith('/api/campaigns', expect.any(Object));
    expect(data[0].id).toBe('c1');
  });

  it('triggerDraftGenerate sends dry-run by default', async () => {
    const { triggerDraftGenerate } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ generated: 0, dryRun: true }) });
    const data = await triggerDraftGenerate('c1');
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.dryRun).toBe(true);
    expect(data.dryRun).toBe(true);
  });

  it('triggerDraftGenerate sends mode flags', async () => {
    const { triggerDraftGenerate } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ generated: 0, dryRun: true }) });
    await triggerDraftGenerate('c1', { dataQualityMode: 'strict', interactionMode: 'express' });
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.dataQualityMode).toBe('strict');
    expect(body.interactionMode).toBe('express');
  });

  it('triggerSmartleadSend passes batch size and dry-run', async () => {
    const { triggerSmartleadSend } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ sent: 0, skipped: 1, failed: 0, fetched: 5 }) });
    await triggerSmartleadSend({ batchSize: 5, dryRun: true });
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.batchSize).toBe(5);
    expect(body.dryRun).toBe(true);
  });

  it('fetchEvents uses since/limit', async () => {
    const { fetchEvents } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });
    await fetchEvents({ since: '2025-01-01', limit: 10 });
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('since=2025-01-01');
    expect(url).toContain('limit=10');
  });

  it('fetchReplyPatterns uses topN/since', async () => {
    const { fetchReplyPatterns } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });
    await fetchReplyPatterns({ since: '2025-01-01', topN: 3 });
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('topN=3');
    expect(url).toContain('since=2025-01-01');
  });

  it('uses VITE_API_BASE when provided', async () => {
    vi.stubEnv('VITE_API_BASE', 'http://example.com/custom');
    const { fetchCampaigns } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });
    await fetchCampaigns();
    expect(fetch).toHaveBeenCalledWith('http://example.com/custom/campaigns', expect.any(Object));
    vi.unstubAllEnvs();
  });

  it('throws on non-ok responses with status code', async () => {
    const { triggerDraftGenerate } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: false, status: 500 });
    await expect(triggerDraftGenerate('c1')).rejects.toThrow('API error 500');
  });

  it('fetchMeta returns readiness status', async () => {
    const { fetchMeta } = await loadClient();
    (fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ mode: 'live', apiBase: '/api', smartleadReady: true, supabaseReady: true }),
    });
    const meta = await fetchMeta();
    expect(meta.mode).toBe('live');
    expect(meta.smartleadReady).toBe(true);
  });
});
