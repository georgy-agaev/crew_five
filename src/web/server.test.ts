/* eslint-disable @typescript-eslint/no-unused-vars */
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

  it('routes segments and snapshot/enrich/status', async () => {
    const listSegments = vi.fn(async () => [{ id: 's1', name: 'Seg', version: 1 }]);
    const snapshotSegment = vi.fn(async () => ({ version: 1, count: 10 }));
    const enqueueSegmentEnrichment = vi.fn(async () => ({ id: 'job1', payload: {} }));
    const runSegmentEnrichmentOnce = vi.fn(async () => ({ processed: 2, dryRun: false, jobId: 'job1' }));
    const getSegmentEnrichmentStatus = vi.fn(async () => ({ jobId: 'job1', status: 'completed' }));

    const baseDeps: any = {
      ...deps,
      listSegments,
      snapshotSegment,
      enqueueSegmentEnrichment,
      runSegmentEnrichmentOnce,
      getSegmentEnrichmentStatus,
    };

    const resList = await dispatch(baseDeps, { method: 'GET', pathname: '/api/segments' });
    expect(listSegments).toHaveBeenCalledTimes(1);
    expect((resList.body as any[])[0].id).toBe('s1');

    const resSnap = await dispatch(
      baseDeps,
      { method: 'POST', pathname: '/api/segments/snapshot', body: { segmentId: 's1' } },
      buildMeta({ mode: 'live' })
    );
    expect(snapshotSegment).toHaveBeenCalledWith({ segmentId: 's1', finalize: true, allowEmpty: false, maxContacts: undefined });
    expect((resSnap.body as any).version).toBe(1);

    const resEnrich = await dispatch(
      baseDeps,
      { method: 'POST', pathname: '/api/enrich/segment', body: { segmentId: 's1', runNow: true, adapter: 'mock' } },
      buildMeta({ mode: 'live' })
    );
    expect(enqueueSegmentEnrichment).toHaveBeenCalledWith({ segmentId: 's1', adapter: 'mock', dryRun: undefined, limit: undefined });
    expect(runSegmentEnrichmentOnce).toHaveBeenCalledTimes(1);
    expect((resEnrich.body as any).summary.jobId).toBe('job1');

    const resStatus = await dispatch(
      baseDeps,
      { method: 'GET', pathname: '/api/enrich/status', searchParams: new URLSearchParams({ segmentId: 's1' }) },
      buildMeta({ mode: 'live' })
    );
    expect(getSegmentEnrichmentStatus).toHaveBeenCalledWith('s1');
    expect((resStatus.body as any).status).toBe('completed');
  });

  it('routes ICP profile/hypothesis CRUD', async () => {
    const listIcpProfiles = vi.fn(async () => [{ id: 'p1', name: 'ICP' }]);
    const createIcpProfile = vi.fn(async ({ name }) => ({ id: 'p1', name }));
    const listIcpHypotheses = vi.fn(async () => [{ id: 'h1', hypothesis_label: 'test' }]);
    const createIcpHypothesis = vi.fn(async ({ icpProfileId }) => ({ id: 'h1', icpProfileId }));

    const baseDeps: any = {
      ...deps,
      listIcpProfiles,
      createIcpProfile,
      listIcpHypotheses,
      createIcpHypothesis,
    };

    const resProfiles = await dispatch(baseDeps, { method: 'GET', pathname: '/api/icp/profiles' });
    expect(listIcpProfiles).toHaveBeenCalledTimes(1);
    expect((resProfiles.body as any[])[0].id).toBe('p1');

    const resProfileCreate = await dispatch(
      baseDeps,
      { method: 'POST', pathname: '/api/icp/profiles', body: { name: 'New ICP' } },
      buildMeta({ mode: 'live' })
    );
    expect(createIcpProfile).toHaveBeenCalledWith({ name: 'New ICP', description: undefined });
    expect((resProfileCreate.body as any).id).toBe('p1');

    const resHypList = await dispatch(baseDeps, { method: 'GET', pathname: '/api/icp/hypotheses' });
    expect(listIcpHypotheses).toHaveBeenCalledTimes(1);
    expect((resHypList.body as any[])[0].id).toBe('h1');

    const resHypCreate = await dispatch(
      baseDeps,
      { method: 'POST', pathname: '/api/icp/hypotheses', body: { icpProfileId: 'p1', hypothesisLabel: 'H' } },
      buildMeta({ mode: 'live' })
    );
    expect(createIcpHypothesis).toHaveBeenCalledWith({ icpProfileId: 'p1', hypothesisLabel: 'H', segmentId: undefined, searchConfig: undefined });
    expect((resHypCreate.body as any).id).toBe('h1');
  });

  it('routes analytics summary/optimize and prompt registry', async () => {
    const analyticsSummary = vi.fn(async ({ groupBy, since }) => [{ groupBy, since }]);
    const analyticsOptimize = vi.fn(async ({ since }) => ({ suggestions: [{ draft_pattern: 'p', recommendation: 'keep' }], simSummary: [] }));
    const listPromptRegistry = vi.fn(async () => [{ coach_prompt_id: 'cp1', version: 'v1' }]);
    const resSummary = await dispatch(
      {
        ...deps,
        analyticsSummary,
        analyticsOptimize,
        listPromptRegistry,
      } as any,
      { method: 'GET', pathname: '/api/analytics/summary', searchParams: new URLSearchParams({ groupBy: 'icp', since: '2025' }) },
      buildMeta({ mode: 'live' })
    );
    expect(analyticsSummary).toHaveBeenCalledWith({ groupBy: 'icp', since: '2025' });
    expect((resSummary.body as any[])[0].groupBy).toBe('icp');

    const resOptimize = await dispatch(
      {
        ...deps,
        analyticsSummary,
        analyticsOptimize,
        listPromptRegistry,
      } as any,
      { method: 'GET', pathname: '/api/analytics/optimize', searchParams: new URLSearchParams({ since: '2025' }) },
      buildMeta({ mode: 'live' })
    );
    expect(analyticsOptimize).toHaveBeenCalledWith({ since: '2025' });
    expect((resOptimize.body as any).suggestions[0].draft_pattern).toBe('p');

    const resPromptRegistry = await dispatch(
      {
        ...deps,
        analyticsSummary,
        analyticsOptimize,
        listPromptRegistry,
      } as any,
      { method: 'GET', pathname: '/api/prompt-registry' },
      buildMeta({ mode: 'live' })
    );
    expect(listPromptRegistry).toHaveBeenCalledTimes(1);
    expect((resPromptRegistry.body as any[])[0].coach_prompt_id).toBe('cp1');
  });

  it('routes sim stub', async () => {
    const createSimJobStub = vi.fn(async ({ mode }) => ({ status: 'coming_soon', jobId: 'job-sim', mode }));
    const res = await dispatch(
      { ...deps, createSimJobStub } as any,
      { method: 'POST', pathname: '/api/sim', body: { mode: 'full_sim', segmentId: 's1' } },
      buildMeta({ mode: 'live' })
    );
    expect(createSimJobStub).toHaveBeenCalledWith({ mode: 'full_sim', segmentId: 's1' });
    expect((res.body as any).jobId).toBe('job-sim');
    expect((res.body as any).status).toBe('coming_soon');
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
    vi.stubEnv('SMARTLEAD_API_BASE', '');
    vi.stubEnv('SMARTLEAD_API_KEY', '');
    vi.stubEnv('SMARTLEAD_MCP_URL', '');
    vi.stubEnv('SMARTLEAD_MCP_TOKEN', '');
    expect(() => createLiveDeps({} as any)).toThrow('SMARTLEAD_MCP_URL and SMARTLEAD_MCP_TOKEN');
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

  it('lists companies with filters and cap', async () => {
    const listCompanies = vi.fn(async () => [{ id: 'c1', name: 'Acme' }]);
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listCompanies,
        listContacts: vi.fn(),
      } as any,
      { method: 'GET', pathname: '/api/companies', searchParams: new URLSearchParams({ segment: 'AI' }) },
      buildMeta({ mode: 'live' })
    );
    expect(listCompanies).toHaveBeenCalledWith({ segment: 'AI', limit: undefined });
    expect((res.body as any[])[0].id).toBe('c1');
  });

  it('lists contacts by company ids', async () => {
    const listContacts = vi.fn(async () => [{ id: 'p1', company_id: 'c1', email: 'a@b.com' }]);
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listCompanies: vi.fn(),
        listContacts,
      } as any,
      { method: 'GET', pathname: '/api/contacts', searchParams: new URLSearchParams({ companyIds: 'c1,c2' }) },
      buildMeta({ mode: 'live' })
    );
    expect(listContacts).toHaveBeenCalledWith({ companyIds: ['c1', 'c2'], limit: undefined });
    expect((res.body as any[])[0].id).toBe('p1');
  });

  it('smartlead send defaults to dry-run', async () => {
    const sendSmartlead = vi.fn(async (payload) => ({
      sent: 0,
      failed: 0,
      skipped: payload.leadIds?.length ?? 0,
      fetched: payload.leadIds?.length ?? 0,
      dryRun: payload.dryRun,
    }));
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead,
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listCompanies: vi.fn(),
        listContacts: vi.fn(),
      } as any,
      { method: 'POST', pathname: '/api/smartlead/send', body: { batchSize: 20, leadIds: ['a', 'b'] } },
      buildMeta({ mode: 'live' })
    );
    expect(sendSmartlead).toHaveBeenCalledWith({ batchSize: 20, dryRun: true, leadIds: ['a', 'b'] });
    expect((res.body as any).skipped).toBe(2);
  });

  it('lists smartlead campaigns via client', async () => {
    const listActiveCampaigns = vi.fn(async () => [{ id: 'c1', name: 'Live', status: 'active' }]);
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listCompanies: vi.fn(),
        listContacts: vi.fn(),
        listSmartleadCampaigns: listActiveCampaigns,
      } as any,
      { method: 'GET', pathname: '/api/smartlead/campaigns' },
      buildMeta({ mode: 'live' })
    );
    expect(listActiveCampaigns).toHaveBeenCalledTimes(1);
    expect((res.body as any[])[0].id).toBe('c1');
  });

  it('creates smartlead campaign with dry-run', async () => {
    const smartleadCreateCampaign = vi.fn();
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listCompanies: vi.fn(),
        listContacts: vi.fn(),
        listSmartleadCampaigns: vi.fn(),
        smartleadCreateCampaign,
      } as any,
      { method: 'POST', pathname: '/api/smartlead/campaigns', body: { name: 'New', dryRun: true } },
      buildMeta({ mode: 'live' })
    );
    expect(smartleadCreateCampaign).not.toHaveBeenCalled();
    expect((res.body as any).dryRun).toBe(true);
    expect((res.body as any).name).toBe('New');
  });

  it('creates smartlead campaign when not dry-run', async () => {
    const smartleadCreateCampaign = vi.fn(async ({ name }) => ({ id: 'n1', name, status: 'active' }));
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listCompanies: vi.fn(),
        listContacts: vi.fn(),
        listSmartleadCampaigns: vi.fn(),
        smartleadCreateCampaign,
      } as any,
      { method: 'POST', pathname: '/api/smartlead/campaigns', body: { name: 'New', dryRun: false } },
      buildMeta({ mode: 'live' })
    );
    expect(smartleadCreateCampaign).toHaveBeenCalledWith({ name: 'New' });
    expect((res.body as any).id).toBe('n1');
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

  it('routes coach icp/hypothesis generate and prompt registry create', async () => {
    const generateIcpProfile = vi.fn(async (payload) => ({ id: 'p1', ...payload }));
    const generateIcpHypothesis = vi.fn(async (payload) => ({ id: 'h1', ...payload }));
    const createPromptRegistryEntry = vi.fn(async (payload) => ({ id: payload.id ?? 'pr1', ...payload }));

    const icpRes = await dispatch(
      { ...deps, generateIcpProfile, generateIcpHypothesis, createPromptRegistryEntry } as any,
      { method: 'POST', pathname: '/api/coach/icp', body: { name: 'ICP' } },
      buildMeta({ mode: 'live' })
    );
    expect(generateIcpProfile).toHaveBeenCalledWith({ name: 'ICP' });
    expect((icpRes.body as any).id).toBe('p1');

    const hypRes = await dispatch(
      { ...deps, generateIcpProfile, generateIcpHypothesis, createPromptRegistryEntry } as any,
      { method: 'POST', pathname: '/api/coach/hypothesis', body: { icpProfileId: 'p1', label: 'H1' } },
      buildMeta({ mode: 'live' })
    );
    expect(generateIcpHypothesis).toHaveBeenCalledWith({ icpProfileId: 'p1', label: 'H1' });
    expect((hypRes.body as any).id).toBe('h1');

    const prRes = await dispatch(
      { ...deps, generateIcpProfile, generateIcpHypothesis, createPromptRegistryEntry } as any,
      { method: 'POST', pathname: '/api/prompt-registry', body: { id: 'pr1', step: 'icp' } },
      buildMeta({ mode: 'live' })
    );
    expect(createPromptRegistryEntry).toHaveBeenCalledWith({ id: 'pr1', step: 'icp' });
    expect((prRes.body as any).id).toBe('pr1');
  });
});
