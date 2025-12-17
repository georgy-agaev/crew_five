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
    const createSegment = vi.fn(async (input) => ({ id: 's2', ...input, created_at: '2025-01-01T00:00:00Z', version: 0 }));
    const snapshotSegment = vi.fn(async () => ({ version: 1, count: 10 }));
    const enqueueSegmentEnrichment = vi.fn(async () => ({ id: 'job1', payload: {} }));
    const runSegmentEnrichmentOnce = vi.fn(async () => ({ processed: 2, dryRun: false, jobId: 'job1' }));
    const getSegmentEnrichmentStatus = vi.fn(async () => ({ jobId: 'job1', status: 'completed' }));

    const baseDeps: any = {
      ...deps,
      listSegments,
      createSegment,
      snapshotSegment,
      enqueueSegmentEnrichment,
      runSegmentEnrichmentOnce,
      getSegmentEnrichmentStatus,
    };

    const resList = await dispatch(baseDeps, { method: 'GET', pathname: '/api/segments' });
    expect(listSegments).toHaveBeenCalledTimes(1);
    expect((resList.body as any[])[0].id).toBe('s1');

    const resCreate = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/segments',
        body: {
          name: 'Test Segment',
          locale: 'en',
          filterDefinition: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
          description: 'Test segment description',
        },
      },
      buildMeta({ mode: 'live' })
    );
    expect(resCreate.status).toBe(201);
    expect(createSegment).toHaveBeenCalledWith({
      name: 'Test Segment',
      locale: 'en',
      filterDefinition: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
      description: 'Test segment description',
      createdBy: undefined,
    });
    expect((resCreate.body as any).id).toBe('s2');
    expect((resCreate.body as any).name).toBe('Test Segment');

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

  it('validates required fields for POST /api/segments', async () => {
    const createSegment = vi.fn(async (input) => ({ id: 's2', ...input }));
    const baseDeps: any = { ...deps, createSegment };

    // Missing name
    const resMissingName = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/segments',
        body: { locale: 'en', filterDefinition: [] },
      },
      buildMeta({ mode: 'live' })
    );
    expect(resMissingName.status).toBe(400);
    expect((resMissingName.body as any).error).toBe('name is required');

    // Missing locale
    const resMissingLocale = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/segments',
        body: { name: 'Test', filterDefinition: [] },
      },
      buildMeta({ mode: 'live' })
    );
    expect(resMissingLocale.status).toBe(400);
    expect((resMissingLocale.body as any).error).toBe('locale is required');

    // Missing filterDefinition
    const resMissingFilter = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/segments',
        body: { name: 'Test', locale: 'en' },
      },
      buildMeta({ mode: 'live' })
    );
    expect(resMissingFilter.status).toBe(400);
    expect((resMissingFilter.body as any).error).toBe('filterDefinition is required');
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

  it('routes ICP discovery run and candidate listing', async () => {
    const runIcpDiscovery = vi.fn(async ({ icpProfileId, icpHypothesisId, limit }) => ({
      jobId: 'job-1',
      runId: 'run-1',
      provider: 'exa',
      status: 'running',
    }));
    const listIcpDiscoveryCandidates = vi.fn(async ({ runId }) => [
      { id: 'cand-1', name: 'Example One', domain: 'example.com' },
    ]);

    const baseDeps: any = {
      ...deps,
      runIcpDiscovery,
      listIcpDiscoveryCandidates,
    };

    const resRun = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/icp/discovery',
        body: { icpProfileId: 'icp-1', icpHypothesisId: 'hypo-1', limit: 25 },
      },
      buildMeta({ mode: 'live' })
    );
    expect(runIcpDiscovery).toHaveBeenCalledWith({
      icpProfileId: 'icp-1',
      icpHypothesisId: 'hypo-1',
      limit: 25,
    });
    expect((resRun.body as any).runId).toBe('run-1');

    const resCandidates = await dispatch(
      baseDeps,
      {
        method: 'GET',
        pathname: '/api/icp/discovery/candidates',
        searchParams: new URLSearchParams({ runId: 'run-1' }),
      },
      buildMeta({ mode: 'live' })
    );
    expect(listIcpDiscoveryCandidates).toHaveBeenCalledWith({
      runId: 'run-1',
      icpProfileId: undefined,
      icpHypothesisId: undefined,
    });
    const list = resCandidates.body as any[];
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('cand-1');
  });

  it('routes analytics summary/optimize and prompt registry', async () => {
    const analyticsSummary = vi.fn(async ({ groupBy, since }) => [{ groupBy, since }]);
    const analyticsOptimize = vi.fn(async ({ since }) => ({ suggestions: [{ draft_pattern: 'p', recommendation: 'keep' }], simSummary: [] }));
    const listPromptRegistry = vi.fn(async () => [{ id: 'uuid-1', coach_prompt_id: 'cp1', version: 'v1', rollout_status: 'active' }]);
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
    const rows = resPromptRegistry.body as any[];
    expect(rows[0].coach_prompt_id).toBe('cp1');
    // UI should see id as the human coach_prompt_id, not the internal UUID.
    expect(rows[0].id).toBe('cp1');
    expect(rows[0].is_active).toBe(true);
  });

  it('routes prompt registry active endpoints', async () => {
    const listPromptRegistry = vi.fn(async () => [
      { id: 'draft_intro_v1', step: 'draft', coach_prompt_id: 'draft_intro_v1', rollout_status: 'active' },
      { id: 'draft_intro_v2', step: 'draft', coach_prompt_id: 'draft_intro_v2', rollout_status: 'pilot' },
      { id: 'icp_intro_v1', step: 'icp_profile', coach_prompt_id: 'icp_intro_v1', rollout_status: 'active' },
    ]);
    const getActivePromptForStep = vi.fn(async (step: string) =>
      step === 'draft' ? 'draft_intro_v1' : step === 'icp_profile' ? 'icp_intro_v1' : null
    );
    const setActivePromptForStep = vi.fn(async () => {});

    const baseDeps: any = {
      ...deps,
      listPromptRegistry,
      getActivePromptForStep,
      setActivePromptForStep,
    };

    const resFiltered = await dispatch(
      baseDeps,
      {
        method: 'GET',
        pathname: '/api/prompt-registry',
        searchParams: new URLSearchParams({ step: 'draft' }),
      },
      buildMeta({ mode: 'live' })
    );
    const filtered = resFiltered.body as any[];
    expect(listPromptRegistry).toHaveBeenCalledTimes(1);
    expect(filtered).toHaveLength(2);
    expect(filtered[0].is_active).toBe(true);
    expect(filtered[1].is_active).toBe(false);

    const resActive = await dispatch(
      baseDeps,
      {
        method: 'GET',
        pathname: '/api/prompt-registry/active',
        searchParams: new URLSearchParams({ step: 'draft' }),
      },
      buildMeta({ mode: 'live' })
    );
    expect(getActivePromptForStep).toHaveBeenCalledWith('draft');
    expect(resActive.body).toEqual({ step: 'draft', coach_prompt_id: 'draft_intro_v1' });

    const resSet = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/prompt-registry/active',
        body: { step: 'icp_profile', coach_prompt_id: 'icp_intro_v1' },
      },
      buildMeta({ mode: 'live' })
    );
    expect(setActivePromptForStep).toHaveBeenCalledWith('icp_profile', 'icp_intro_v1');
    expect(resSet.body).toEqual({ ok: true });
  });

  it('live deps prompt registry create uses coach_prompt_id and lets UUID default', async () => {
    const insert = vi.fn((rows: any[]) => {
      const payload = rows[0];
      return {
        select: () => ({
          single: () =>
            Promise.resolve({
              data: { ...payload, id: 'uuid-1' },
              error: null,
            }),
        }),
      };
    });
    const from = vi.fn((table: string) => {
      if (table === 'prompt_registry') {
        return { insert };
      }
      return {
        select: vi.fn(),
        update: vi.fn(),
        insert: vi.fn(),
      };
    });
    const supabase = { from } as any;

    const fakeAiClient: any = {};
    const fakeSmartlead: any = { listCampaigns: vi.fn(async () => ({ campaigns: [] })) };
    const chatClient: any = { complete: vi.fn().mockResolvedValue('{}') };

    const liveDeps = createLiveDeps({
      supabase,
      aiClient: fakeAiClient,
      smartlead: fakeSmartlead,
      chatClient,
    }) as any;

    const created = await liveDeps.createPromptRegistryEntry({
      id: 'draft_intro_v1',
      step: 'draft',
      version: 'v1',
      rollout_status: 'pilot',
    });

    expect(from).toHaveBeenCalledWith('prompt_registry');
    expect(insert).toHaveBeenCalledTimes(1);
    const insertedRow = insert.mock.calls[0]?.[0][0];
    expect(insertedRow.id).toBeUndefined();
    expect(insertedRow.coach_prompt_id).toBe('draft_intro_v1');
    expect(insertedRow.step).toBe('draft');
    expect(created.id).toBe('uuid-1');
    expect(created.coach_prompt_id).toBe('draft_intro_v1');
  });

  it('live deps prompt registry create falls back rollout_status when check constraint fails', async () => {
    const insert = vi
      .fn()
      // First insert fails with rollout_status CHECK constraint error.
      .mockImplementationOnce((rows: any[]) => {
        const payload = rows[0];
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: null,
                error: new Error(
                  'new row for relation "prompt_registry" violates check constraint "prompt_registry_rollout_status_check"'
                ),
              }),
          }),
        };
      })
      // Second insert succeeds with normalized rollout_status.
      .mockImplementationOnce((rows: any[]) => {
        const payload = rows[0];
        return {
          select: () => ({
            single: () =>
              Promise.resolve({
                data: { ...payload, id: 'uuid-2' },
                error: null,
              }),
          }),
        };
      });

    const from = vi.fn((table: string) => {
      if (table === 'prompt_registry') {
        return { insert };
      }
      // Fallback for ensurePromptRegistryColumns calls etc.
      return {
        select: vi.fn(),
        update: vi.fn(),
        insert: vi.fn(),
      };
    });
    const supabase = { from } as any;

    const fakeAiClient: any = {};
    const fakeSmartlead: any = { listCampaigns: vi.fn(async () => ({ campaigns: [] })) };
    const chatClient: any = { complete: vi.fn().mockResolvedValue('{}') };

    const liveDeps = createLiveDeps({
      supabase,
      aiClient: fakeAiClient,
      smartlead: fakeSmartlead,
      chatClient,
    }) as any;

    const created = await liveDeps.createPromptRegistryEntry({
      id: 'draft_intro_v1',
      step: 'draft',
      version: 'v1',
      rollout_status: 'pilot',
    });

    expect(insert).toHaveBeenCalledTimes(2);
    const firstPayload = insert.mock.calls[0]?.[0][0];
    const secondPayload = insert.mock.calls[1]?.[0][0];
    expect(firstPayload.rollout_status).toBe('pilot');
    expect(secondPayload.rollout_status).toBe('active');
    expect(created.id).toBe('uuid-2');
    expect(created.coach_prompt_id).toBe('draft_intro_v1');
    expect(created.rollout_status).toBe('active');
  });

  it('live deps generateIcpProfile/generateIcpHypothesis forward promptId into coach jobs', async () => {
    const insertJob = vi.fn((row: any) => ({
      select: () => ({
        single: () =>
          Promise.resolve({
            data: { id: 'job-icp', ...row },
            error: null,
          }),
      }),
    }));
    const updateJob = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'job-icp', status: 'completed', result: {} },
            error: null,
          }),
        }),
      }),
    });
    const insertProfile = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'icp-10', name: 'ICP' },
          error: null,
        }),
      }),
    });
    const insertHypo = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'hyp-10', icp_id: 'icp-10' },
          error: null,
        }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'jobs') return { insert: insertJob, update: updateJob };
      if (table === 'icp_profiles') return { insert: insertProfile };
      if (table === 'icp_hypotheses') return { insert: insertHypo };
      if (table === 'prompt_registry') {
        return {
          select: () => ({
            eq: () => ({
              limit: () =>
                Promise.resolve({
                  data: [{ prompt_text: 'Coach prompt text' }],
                  error: null,
                }),
            }),
          }),
        };
      }
      return { insert: vi.fn(), update: vi.fn(), select: vi.fn() };
    });
    const supabase = { from } as any;

    let coachCall = 0;
    const chatClient: any = {
      complete: vi.fn().mockImplementation(async () => {
        coachCall += 1;
        if (coachCall === 1) {
          return JSON.stringify({
            name: 'ICP',
            description: 'Desc',
            companyCriteria: {},
            personaCriteria: {},
          });
        }
        return JSON.stringify({
          hypothesisLabel: 'Stub Hypothesis',
          searchConfig: {},
        });
      }),
    };
    const fakeAiClient: any = {}; // not used by ICP coach paths
    const fakeSmartlead: any = { listCampaigns: vi.fn(async () => ({ campaigns: [] })) };

    const liveDeps = createLiveDeps({
      supabase,
      aiClient: fakeAiClient,
      smartlead: fakeSmartlead,
      chatClient,
    }) as any;

    await liveDeps.generateIcpProfile({ name: 'ICP', promptId: 'icp_profile_v1' });
    const insertedProfileJob = insertJob.mock.calls[0]?.[0];
    expect(insertedProfileJob.payload?.input?.promptId).toBe('icp_profile_v1');

    insertJob.mockClear();
    await liveDeps.generateIcpHypothesis({
      icpProfileId: 'icp-10',
      icpDescription: 'Desc',
      promptId: 'icp_hypothesis_v1',
    });
    const insertedHypoJob = insertJob.mock.calls[0]?.[0];
    expect(insertedHypoJob.payload?.input?.promptId).toBe('icp_hypothesis_v1');
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
    const generateIcpProfile = vi.fn(async (payload) => ({ jobId: 'job-1', profile: { id: 'p1', ...payload } }));
    const generateIcpHypothesis = vi.fn(async (payload) => ({
      jobId: 'job-2',
      hypothesis: { id: 'h1', ...payload },
    }));
    const createPromptRegistryEntry = vi.fn(async (payload) => ({ id: payload.id ?? 'pr1', ...payload }));

    const icpRes = await dispatch(
      { ...deps, generateIcpProfile, generateIcpHypothesis, createPromptRegistryEntry } as any,
      { method: 'POST', pathname: '/api/coach/icp', body: { name: 'ICP' } },
      buildMeta({ mode: 'live' })
    );
    expect(generateIcpProfile).toHaveBeenCalledWith({ name: 'ICP' });
    expect((icpRes.body as any).profile.id).toBe('p1');
    expect((icpRes.body as any).jobId).toBe('job-1');

    const hypRes = await dispatch(
      { ...deps, generateIcpProfile, generateIcpHypothesis, createPromptRegistryEntry } as any,
      { method: 'POST', pathname: '/api/coach/hypothesis', body: { icpProfileId: 'p1', label: 'H1' } },
      buildMeta({ mode: 'live' })
    );
    expect(generateIcpHypothesis).toHaveBeenCalledWith({ icpProfileId: 'p1', label: 'H1' });
    expect((hypRes.body as any).hypothesis.id).toBe('h1');
    expect((hypRes.body as any).jobId).toBe('job-2');

    const prRes = await dispatch(
      { ...deps, generateIcpProfile, generateIcpHypothesis, createPromptRegistryEntry } as any,
      { method: 'POST', pathname: '/api/prompt-registry', body: { id: 'pr1', step: 'icp' } },
      buildMeta({ mode: 'live' })
    );
    expect(createPromptRegistryEntry).toHaveBeenCalledWith({ id: 'pr1', step: 'icp' });
    expect((prRes.body as any).id).toBe('pr1');
  });

  it('forwards promptId through coach endpoints', async () => {
    const generateIcpProfile = vi.fn(async (payload) => ({ jobId: 'job-3', profile: { id: 'p2', ...payload } }));
    const generateIcpHypothesis = vi.fn(async (payload) => ({
      jobId: 'job-4',
      hypothesis: { id: 'h2', ...payload },
    }));

    await dispatch(
      { ...deps, generateIcpProfile, generateIcpHypothesis } as any,
      { method: 'POST', pathname: '/api/coach/icp', body: { name: 'ICP', promptId: 'icp_profile_v1' } },
      buildMeta({ mode: 'live' })
    );
    expect(generateIcpProfile).toHaveBeenCalledWith({ name: 'ICP', promptId: 'icp_profile_v1' });

    await dispatch(
      { ...deps, generateIcpProfile, generateIcpHypothesis } as any,
      {
        method: 'POST',
        pathname: '/api/coach/hypothesis',
        body: { icpProfileId: 'p1', label: 'H1', promptId: 'icp_hypothesis_v1' },
      },
      buildMeta({ mode: 'live' })
    );
    expect(generateIcpHypothesis).toHaveBeenCalledWith({
      icpProfileId: 'p1',
      label: 'H1',
      promptId: 'icp_hypothesis_v1',
    });
  });

  it('exposes a consolidated services view', async () => {
    const meta = buildMeta({ mode: 'live' });
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
      } as any,
      { method: 'GET', pathname: '/api/services' },
      meta
    );
    const body = res.body as any;
    expect(Array.isArray(body.services)).toBe(true);
    const supabase = body.services.find((s: any) => s.name === 'Supabase');
    const smartlead = body.services.find((s: any) => s.name === 'Smartlead');
    expect(supabase).toBeDefined();
    expect(smartlead).toBeDefined();
    expect(supabase.category).toBe('database');
    expect(smartlead.category).toBe('delivery');
  });

  it('routes POST /api/filters/ai-suggest to aiSuggestFilters', async () => {
    const mockSuggestions = [
      {
        filters: [
          { field: 'employees.role', operator: 'eq', value: 'CTO' },
          { field: 'companies.employees', operator: 'gte', value: 50 },
        ],
        rationale: 'Targeting technology decision makers at mid-sized companies',
        targetAudience: 'CTOs at growing tech companies',
      },
    ];
    const aiSuggestFilters = vi.fn(async () => mockSuggestions);
    const testDeps = {
      ...deps,
      aiSuggestFilters,
    };

    const res = await dispatch(
      testDeps as any,
      {
        method: 'POST',
        pathname: '/api/filters/ai-suggest',
        body: {
          userDescription: 'Target CTOs at AI companies with 50+ employees',
          icpProfileId: 'profile-123',
          icpContext: 'Enterprise AI/ML',
          maxSuggestions: 3,
        },
      }
    );

    expect(aiSuggestFilters).toHaveBeenCalledWith({
      userDescription: 'Target CTOs at AI companies with 50+ employees',
      icpProfileId: 'profile-123',
      icpContext: 'Enterprise AI/ML',
      maxSuggestions: 3,
    });
    expect(res.status).toBe(200);
    expect((res.body as any).suggestions).toEqual(mockSuggestions);
  });

  it('returns 400 when userDescription is missing in ai-suggest', async () => {
    const aiSuggestFilters = vi.fn();
    const testDeps = {
      ...deps,
      aiSuggestFilters,
    };

    const res = await dispatch(
      testDeps as any,
      {
        method: 'POST',
        pathname: '/api/filters/ai-suggest',
        body: {},
      }
    );

    expect(res.status).toBe(400);
    expect((res.body as any).error).toBe('userDescription is required');
    expect(aiSuggestFilters).not.toHaveBeenCalled();
  });

  it('returns 501 when aiSuggestFilters is not configured', async () => {
    const res = await dispatch(
      deps as any,
      {
        method: 'POST',
        pathname: '/api/filters/ai-suggest',
        body: { userDescription: 'test' },
      }
    );

    expect(res.status).toBe(501);
    expect((res.body as any).error).toBe('AI filter suggestions not configured');
  });

  it('returns 500 when aiSuggestFilters throws an error', async () => {
    const aiSuggestFilters = vi.fn(async () => {
      throw new Error('AI service unavailable');
    });
    const testDeps = {
      ...deps,
      aiSuggestFilters,
    };

    const res = await dispatch(
      testDeps as any,
      {
        method: 'POST',
        pathname: '/api/filters/ai-suggest',
        body: { userDescription: 'test' },
      }
    );

    expect(res.status).toBe(500);
    expect((res.body as any).error).toBe('AI service unavailable');
  });
});
