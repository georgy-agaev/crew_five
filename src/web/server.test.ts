import { describe, expect, it, vi } from 'vitest';

import { buildMeta, createLiveDeps, dispatch } from './server';

const campaigns = [{ id: 'c1', name: 'One', status: 'draft' }];

describe('web adapter server', () => {
  const deps = {
    listCampaigns: vi.fn(async () => campaigns),
    listDrafts: vi.fn(async () => []),
    generateDrafts: vi.fn(async () => ({ generated: 0, dryRun: true })),
    sendSmartlead: vi.fn(async () => ({ sent: 0, failed: 0, skipped: 0, fetched: 0 })),
    listEvents: vi.fn(async () => []),
    listReplyPatterns: vi.fn(async () => []),
  };
  it('routes campaigns to handler', async () => {
    const res = await dispatch(deps, { method: 'GET', pathname: '/api/campaigns' });
    expect(deps.listCampaigns).toHaveBeenCalledTimes(1);
    expect((res.body as any[])[0].id).toBe('c1');
  });

  it('routes draft generation to handler', async () => {
    const res = await dispatch(deps, {
      method: 'POST',
      pathname: '/api/drafts/generate',
      body: { campaignId: 'c1', dryRun: true, interactionMode: 'express', dataQualityMode: 'strict' },
    },
    buildMeta({ mode: 'live' }));
    expect(deps.generateDrafts).toHaveBeenCalledWith({
      campaignId: 'c1',
      dryRun: true,
      interactionMode: 'express',
      dataQualityMode: 'strict',
    });
    expect(res.status).toBe(200);
  });

  it('listCampaigns uses live deps when provided', async () => {
    vi.stubEnv('SUPABASE_URL', 'http://example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');
    vi.stubEnv('SMARTLEAD_MCP_URL', 'http://smartlead');
    vi.stubEnv('SMARTLEAD_MCP_TOKEN', 'token');
    const select = vi.fn(async () => ({ data: [{ id: 'c2', name: 'Live', status: 'ready' }], error: null }));
    const supabase = {
      from: vi.fn(() => ({ select })),
    };
    const liveDeps = createLiveDeps({ supabase });
    const res = await liveDeps.listCampaigns();
    expect(supabase.from).toHaveBeenCalledWith('campaigns');
    expect(res[0].id).toBe('c2');
    vi.unstubAllEnvs();
  });

  it('throws when Smartlead env missing in live mode', () => {
    vi.stubEnv('SUPABASE_URL', 'http://example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');
    expect(() => createLiveDeps({} as any)).toThrow('SMARTLEAD_MCP_URL and SMARTLEAD_MCP_TOKEN are required');
    vi.unstubAllEnvs();
  });

  it('routes events and patterns with filters', async () => {
    const listEvents = vi.fn(async ({ since, limit }) => [{ id: 'e1', event_type: since ?? 'evt', occurred_at: 't' }]);
    const listReplyPatterns = vi.fn(async ({ topN }) => [{ reply_label: 'r', count: topN ?? 1 }]);
    const resEvents = await dispatch(
      { listCampaigns: vi.fn(), listDrafts: vi.fn(), generateDrafts: vi.fn(), sendSmartlead: vi.fn(), listEvents, listReplyPatterns },
      { method: 'GET', pathname: '/api/events', searchParams: new URLSearchParams({ since: '2025', limit: '5' }) },
      buildMeta({ mode: 'live' })
    );
    expect(listEvents).toHaveBeenCalledWith({ since: '2025', limit: 5 });
    expect((resEvents.body as any[])[0].event_type).toBe('2025');

    const resPatterns = await dispatch(
      { listCampaigns: vi.fn(), listDrafts: vi.fn(), generateDrafts: vi.fn(), sendSmartlead: vi.fn(), listEvents, listReplyPatterns },
      { method: 'GET', pathname: '/api/reply-patterns', searchParams: new URLSearchParams({ topN: '2' }) },
      buildMeta({ mode: 'live' })
    );
    expect(listReplyPatterns).toHaveBeenCalledWith({ since: undefined, topN: 2 });
    expect((resPatterns.body as any[])[0].count).toBe(2);
  });

  it('meta route reports readiness', async () => {
    const meta = buildMeta({ mode: 'live' });
    const res = await dispatch(
      { listCampaigns: vi.fn(), listDrafts: vi.fn(), generateDrafts: vi.fn(), sendSmartlead: vi.fn(), listEvents: vi.fn(), listReplyPatterns: vi.fn() },
      { method: 'GET', pathname: '/api/meta' },
      meta
    );
    expect((res.body as any).mode).toBe(meta.mode);
    expect((res.body as any).apiBase).toBe('/api');
  });
});
