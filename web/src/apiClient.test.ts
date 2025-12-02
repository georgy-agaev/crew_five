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
    await triggerDraftGenerate('c1', {
      dataQualityMode: 'strict',
      interactionMode: 'express',
      icpProfileId: 'p1',
      icpHypothesisId: 'h1',
      provider: 'openai',
      model: 'gpt-4o-mini',
    });
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.dataQualityMode).toBe('strict');
    expect(body.interactionMode).toBe('express');
    expect(body.icpProfileId).toBe('p1');
    expect(body.icpHypothesisId).toBe('h1');
    expect(body.provider).toBe('openai');
    expect(body.model).toBe('gpt-4o-mini');
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

  it('fetchCompanies builds query params', async () => {
    const { fetchCompanies } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });
    await fetchCompanies({ segment: 'AI', limit: 50 });
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('/companies?');
    expect(url).toContain('segment=AI');
    expect(url).toContain('limit=50');
  });

  it('fetchContacts passes companyIds list', async () => {
    const { fetchContacts } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [] });
    await fetchContacts({ companyIds: ['c1', 'c2'] });
    const url = (fetch as any).mock.calls[0][0] as string;
    expect(url).toContain('companyIds=c1%2Cc2');
  });

  it('triggerSmartleadPreview defaults dry-run', async () => {
    const { triggerSmartleadPreview } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ dryRun: true }) });
    await triggerSmartleadPreview({ batchSize: 5, leadIds: ['a'] });
    const body = JSON.parse((fetch as any).mock.calls[0][1].body);
    expect(body.dryRun).toBe(true);
    expect(body.leadIds).toEqual(['a']);
  });

  it('fetchSmartleadCampaigns hits smartlead campaigns endpoint', async () => {
    const { fetchSmartleadCampaigns } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => [{ id: 'c1', name: 'Camp' }] });
    await fetchSmartleadCampaigns();
    expect(fetch).toHaveBeenCalledWith('/api/smartlead/campaigns', expect.any(Object));
  });

  it('createSmartleadCampaign posts name and dry-run default', async () => {
    const { createSmartleadCampaign } = await loadClient();
    (fetch as any).mockResolvedValue({ ok: true, json: async () => ({ id: 'n1' }) });
    await createSmartleadCampaign({ name: 'New One' });
    const call = (fetch as any).mock.calls[0];
    expect(call[0]).toBe('/api/smartlead/campaigns');
    const body = JSON.parse(call[1].body);
    expect(body.name).toBe('New One');
    expect(body.dryRun).toBe(true);
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
    (fetch as any).mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'boom' }),
    });
    await expect(triggerDraftGenerate('c1')).rejects.toThrow('API error 500: boom');
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

  it('fetchSegments and snapshotSegment hit segment endpoints', async () => {
    const { fetchSegments, snapshotSegment } = await loadClient();
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [{ id: 's1' }] });
    const segments = await fetchSegments();
    expect(fetch).toHaveBeenCalledWith('/api/segments', expect.any(Object));
    expect(segments[0].id).toBe('s1');

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ version: 1, count: 10 }) });
    await snapshotSegment({ segmentId: 's1' });
    const call = (fetch as any).mock.calls.at(-1);
    expect(call[0]).toBe('/api/segments/snapshot');
    const body = JSON.parse(call[1].body);
    expect(body.segmentId).toBe('s1');
    expect(body.finalize).toBe(true);
  });

  it('enqueueSegmentEnrichment and fetchEnrichmentStatus use enrich routes', async () => {
    const { enqueueSegmentEnrichment, fetchEnrichmentStatus } = await loadClient();
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'queued', jobId: 'j1' }) });
    await enqueueSegmentEnrichment({ segmentId: 's1', adapter: 'mock', runNow: false });
    const enrichCall = (fetch as any).mock.calls.at(-1);
    expect(enrichCall[0]).toBe('/api/enrich/segment');
    const enrichBody = JSON.parse(enrichCall[1].body);
    expect(enrichBody.segmentId).toBe('s1');
    expect(enrichBody.adapter).toBe('mock');

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'completed', jobId: 'j1' }) });
    await fetchEnrichmentStatus('s1');
    const statusUrl = (fetch as any).mock.calls.at(-1)[0] as string;
    expect(statusUrl).toContain('/api/enrich/status');
    expect(statusUrl).toContain('segmentId=s1');
  });

  it('ICP profile/hypothesis CRUD hits expected endpoints', async () => {
    const { fetchIcpProfiles, createIcpProfile, fetchIcpHypotheses, createIcpHypothesis } = await loadClient();
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'p1' }] });
    await fetchIcpProfiles();
    expect(fetch).toHaveBeenCalledWith('/api/icp/profiles', expect.any(Object));

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'p2' }) });
    await createIcpProfile({ name: 'ICP' });
    const icpBody = JSON.parse((fetch as any).mock.calls.at(-1)[1].body);
    expect(icpBody.name).toBe('ICP');

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'h1' }] });
    await fetchIcpHypotheses({ icpProfileId: 'p1' });
    const hypUrl = (fetch as any).mock.calls.at(-1)[0] as string;
    expect(hypUrl).toContain('/api/icp/hypotheses');
    expect(hypUrl).toContain('icpProfileId=p1');

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'h2' }) });
    await createIcpHypothesis({ icpProfileId: 'p1', hypothesisLabel: 'H1' });
    const hypBody = JSON.parse((fetch as any).mock.calls.at(-1)[1].body);
    expect(hypBody.icpProfileId).toBe('p1');
    expect(hypBody.hypothesisLabel).toBe('H1');
  });

  it('analytics summary/optimize and prompt registry endpoints are called', async () => {
    const {
      fetchAnalyticsSummary,
      fetchAnalyticsOptimize,
      fetchPromptRegistry,
      createPromptRegistryEntry,
      generateIcpProfileViaCoach,
      generateHypothesisViaCoach,
    } = await loadClient();
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [] });
    await fetchAnalyticsSummary({ groupBy: 'pattern', since: '2025' });
    const summaryUrl = (fetch as any).mock.calls.at(-1)[0] as string;
    expect(summaryUrl).toContain('/api/analytics/summary');
    expect(summaryUrl).toContain('groupBy=pattern');
    expect(summaryUrl).toContain('since=2025');

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ suggestions: [] }) });
    await fetchAnalyticsOptimize({ since: '2025' });
    const optimizeUrl = (fetch as any).mock.calls.at(-1)[0] as string;
    expect(optimizeUrl).toContain('/api/analytics/optimize');

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => [] });
    await fetchPromptRegistry();
    expect((fetch as any).mock.calls.at(-1)[0]).toBe('/api/prompt-registry');

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'draft_intro_v4' }) });
    await createPromptRegistryEntry({
      id: 'draft_intro_v4',
      step: 'draft',
      version: 'v4',
      rollout_status: 'pilot',
      description: 'New intro prompt',
    });
    const createCall = (fetch as any).mock.calls.at(-1);
    expect(createCall[0]).toBe('/api/prompt-registry');
    const createBody = JSON.parse(createCall[1].body);
    expect(createBody.id).toBe('draft_intro_v4');
    expect(createBody.step).toBe('draft');

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'p1' }) });
    await generateIcpProfileViaCoach({ name: 'ICP' });
    expect((fetch as any).mock.calls.at(-1)[0]).toBe('/api/coach/icp');

    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'h1' }) });
    await generateHypothesisViaCoach({ icpProfileId: 'p1', hypothesisLabel: 'H1' });
    expect((fetch as any).mock.calls.at(-1)[0]).toBe('/api/coach/hypothesis');
  });

  it('createSimJob posts payload to /api/sim', async () => {
    const { createSimJob } = await loadClient();
    (fetch as any).mockResolvedValueOnce({ ok: true, json: async () => ({ jobId: 'sim1', status: 'coming_soon' }) });
    await createSimJob({ segmentId: 's1', mode: 'light_roast' });
    const simCall = (fetch as any).mock.calls.at(-1);
    expect(simCall[0]).toBe('/api/sim');
    const body = JSON.parse(simCall[1].body);
    expect(body.segmentId).toBe('s1');
    expect(body.mode).toBe('light_roast');
  });
});
