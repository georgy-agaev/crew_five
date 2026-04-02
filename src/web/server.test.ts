/* eslint-disable @typescript-eslint/no-unused-vars */
import { describe, expect, it, vi } from 'vitest';

import {
  buildMeta,
  createLiveDeps,
  createWebAdapter,
  dispatch,
  startInboxPollScheduler,
  startInboxPollSchedulerFromEnv,
} from './server';
import * as generateDraftsTrigger from './liveDeps/generateDraftsTrigger.js';

const campaigns = [{ id: 'c1', name: 'One', status: 'draft' }];

function stubSendSmartlead() {
  return vi.fn(async (payload: any) => ({
    dryRun: Boolean(payload?.dryRun),
    campaignId: String(payload?.campaignId ?? 'camp'),
    smartleadCampaignId: String(payload?.smartleadCampaignId ?? 'sl'),
    leadsPrepared: 0,
    leadsPushed: 0,
    sequencesPrepared: 0,
    sequencesSynced: 0,
    skippedContactsNoEmail: 0,
  }));
}

async function invokeServer(
  server: ReturnType<typeof createWebAdapter>,
  request: {
    method: string;
    url: string;
  }
) {
  const handler = server.listeners('request')[0] as (
    req: AsyncIterable<Buffer> & { method: string; url: string },
    res: { writeHead: (status: number, headers?: Record<string, unknown>) => void; end: (body?: string) => void }
  ) => void | Promise<void>;

  let statusCode = 200;
  let headers: Record<string, unknown> = {};
  let body = '';

  const req = {
    method: request.method,
    url: request.url,
    [Symbol.asyncIterator]() {
      return {
        next: async () => ({ done: true as const, value: undefined }),
      };
    },
  };

  const res = {
    writeHead(status: number, value: Record<string, unknown> = {}) {
      statusCode = status;
      headers = value;
    },
    end(value = '') {
      body = value;
    },
  };

  await handler(req, res);
  return { statusCode, headers, body };
}

describe('web adapter server', () => {
  const deps = {
    listCampaigns: vi.fn(async () => campaigns),
    listDrafts: vi.fn(async () => []),
    generateDrafts: vi.fn(async () => ({ generated: 0, dryRun: true })),
    sendSmartlead: stubSendSmartlead(),
    listEvents: vi.fn(async () => []),
    listReplyPatterns: vi.fn(async () => []),
  };
  it('routes campaigns to handler', async () => {
    const res = await dispatch(deps, { method: 'GET', pathname: '/api/campaigns' });
    expect(deps.listCampaigns).toHaveBeenCalledTimes(1);
    expect((res.body as any[])[0].id).toBe('c1');
  });

  it('routes campaign companies detail view', async () => {
    const listCampaignCompanies = vi.fn(async () => ({
      campaign: {
        id: 'c1',
        name: 'One',
        status: 'draft',
        segment_id: 's1',
        segment_version: 2,
      },
      companies: [
        {
          company_id: 'comp-1',
          company_name: 'Example Co',
          website: null,
          employee_count: null,
          region: null,
          office_qualification: null,
          company_description: null,
          company_research: null,
          contact_count: 2,
          enrichment: {
            status: 'missing' as const,
            last_updated_at: null,
            provider_hint: null,
          },
        },
      ],
    }));

    const res = await dispatch(
      {
        ...deps,
        listCampaignCompanies,
      },
      { method: 'GET', pathname: '/api/campaigns/c1/companies' }
    );

    expect(listCampaignCompanies).toHaveBeenCalledWith('c1');
    expect((res.body as any).campaign.id).toBe('c1');
    expect((res.body as any).companies[0].company_id).toBe('comp-1');
  });

  it('routes campaign status transition metadata', async () => {
    const getCampaignStatusTransitions = vi.fn(async () => ({
      campaignId: 'c1',
      currentStatus: 'draft',
      allowedTransitions: ['ready', 'review'],
    }));

    const res = await dispatch(
      {
        ...deps,
        getCampaignStatusTransitions,
      } as any,
      { method: 'GET', pathname: '/api/campaigns/c1/status-transitions' }
    );

    expect(getCampaignStatusTransitions).toHaveBeenCalledWith('c1');
    expect((res.body as any).currentStatus).toBe('draft');
    expect((res.body as any).allowedTransitions).toEqual(['ready', 'review']);
  });

  it('routes campaign status updates', async () => {
    const updateCampaignStatus = vi.fn(async ({ campaignId, status }) => ({
      id: campaignId,
      name: 'One',
      status,
    }));

    const res = await dispatch(
      {
        ...deps,
        updateCampaignStatus,
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns/c1/status',
        body: { status: 'ready' },
      }
    );

    expect(updateCampaignStatus).toHaveBeenCalledWith({
      campaignId: 'c1',
      status: 'ready',
    });
    expect((res.body as any).status).toBe('ready');
  });

  it('returns route error metadata when campaign status update is blocked by mailbox guard', async () => {
    const error: Error & { code?: string; statusCode?: number } = new Error(
      'Assign at least one mailbox sender identity before sending'
    );
    error.code = 'MAILBOX_ASSIGNMENT_REQUIRED';
    error.statusCode = 409;
    const updateCampaignStatus = vi.fn(async () => {
      throw error;
    });

    const res = await dispatch(
      {
        ...deps,
        updateCampaignStatus,
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns/c1/status',
        body: { status: 'sending' },
      }
    );

    expect(res.status).toBe(409);
    expect((res.body as any).code).toBe('MAILBOX_ASSIGNMENT_REQUIRED');
  });

  it('routes campaign followup candidates', async () => {
    const listCampaignFollowupCandidates = vi.fn(async () => [
      {
        contact_id: 'contact-1',
        company_id: 'company-1',
        intro_sent: true,
        intro_sent_at: '2026-03-14T12:00:00Z',
        intro_sender_identity: 'rep@example.com',
        reply_received: true,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_sent: false,
        eligible: false,
        days_since_intro: 2,
        auto_reply: null,
      },
    ]);

    const res = await dispatch(
      {
        ...deps,
        listCampaignFollowupCandidates,
      } as any,
      { method: 'GET', pathname: '/api/campaigns/c1/followup-candidates' }
    );

    expect(listCampaignFollowupCandidates).toHaveBeenCalledWith('c1');
    expect((res.body as any).candidates).toHaveLength(1);
    expect((res.body as any).summary.ineligible).toBe(1);
  });

  it('routes campaign launch preview', async () => {
    const getCampaignLaunchPreview = vi.fn(async (input) => ({
      ok: true,
      campaign: {
        name: input.name,
        status: 'draft',
      },
      segment: {
        id: input.segmentId,
        version: input.segmentVersion,
        snapshotStatus: 'existing',
      },
      summary: {
        companyCount: 2,
        contactCount: 3,
        sendableContactCount: 2,
        freshCompanyCount: 1,
        staleCompanyCount: 0,
        missingCompanyCount: 1,
        senderAssignmentCount: 1,
      },
      senderPlan: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['voicexpertout.ru'],
      },
      warnings: [],
    }));

    const res = await dispatch(
      {
        ...deps,
        getCampaignLaunchPreview,
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns/launch-preview',
        body: {
          name: 'Launch Q2',
          segmentId: 'seg-1',
          segmentVersion: 1,
          snapshotMode: 'reuse',
          senderPlan: {
            assignments: [
              {
                mailboxAccountId: 'mbox-1',
                senderIdentity: 'sales@voicexpertout.ru',
                provider: 'imap_mcp',
              },
            ],
          },
        },
      }
    );

    expect(getCampaignLaunchPreview).toHaveBeenCalledWith({
      name: 'Launch Q2',
      segmentId: 'seg-1',
      segmentVersion: 1,
      snapshotMode: 'reuse',
      senderPlan: {
        assignments: [
          {
            mailboxAccountId: 'mbox-1',
            senderIdentity: 'sales@voicexpertout.ru',
            provider: 'imap_mcp',
          },
        ],
      },
    });
    expect(res.status).toBe(200);
    expect((res.body as any).ok).toBe(true);
    expect((res.body as any).segment.snapshotStatus).toBe('existing');
  });

  it('routes campaign launch mutation', async () => {
    const launchCampaign = vi.fn(async (input) => ({
      campaign: {
        id: 'camp-9',
        name: input.name,
        status: 'draft',
      },
      segment: {
        id: input.segmentId,
        version: 3,
        snapshot: {
          version: 3,
          count: 120,
        },
      },
      senderPlan: {
        assignments: [],
        summary: {
          assignmentCount: 0,
          mailboxAccountCount: 0,
          senderIdentityCount: 0,
          domainCount: 0,
          domains: [],
        },
      },
    }));

    const res = await dispatch(
      {
        ...deps,
        launchCampaign,
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns/launch',
        body: {
          name: 'Launch Q2',
          segmentId: 'seg-1',
          segmentVersion: 1,
          snapshotMode: 'reuse',
        },
      }
    );

    expect(launchCampaign).toHaveBeenCalledWith({
      name: 'Launch Q2',
      segmentId: 'seg-1',
      segmentVersion: 1,
      snapshotMode: 'reuse',
    });
    expect(res.status).toBe(201);
    expect((res.body as any).campaign.id).toBe('camp-9');
  });

  it('routes raw campaign creation with offer id and hypothesis id', async () => {
    const createCampaign = vi.fn(async (input) => ({
      id: 'camp-raw-1',
      name: input.name,
      offer_id: input.offerId ?? null,
      icp_hypothesis_id: input.icpHypothesisId ?? null,
      status: 'draft',
      segment_id: input.segmentId,
      segment_version: input.segmentVersion,
    }));

    const res = await dispatch(
      {
        ...deps,
        createCampaign,
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns',
        body: {
          name: 'Launch Raw Q2',
          segmentId: 'seg-1',
          segmentVersion: 1,
          offerId: 'offer-1',
          icpHypothesisId: 'hyp-1',
          createdBy: 'codex',
        },
      }
    );

    expect(createCampaign).toHaveBeenCalledWith({
      name: 'Launch Raw Q2',
      segmentId: 'seg-1',
      segmentVersion: 1,
      offerId: 'offer-1',
      icpHypothesisId: 'hyp-1',
      createdBy: 'codex',
    });
    expect(res.status).toBe(201);
    expect((res.body as any).offer_id).toBe('offer-1');
    expect((res.body as any).icp_hypothesis_id).toBe('hyp-1');
  });

  it('routes offers list', async () => {
    const listOffers = vi.fn(async () => [
      {
        id: 'offer-1',
        title: 'Negotiation room audit',
        project_name: 'VoiceXpert',
        description: 'Audit offer',
        status: 'active',
      },
    ]);

    const res = await dispatch(
      {
        ...deps,
        listOffers,
      } as any,
      {
        method: 'GET',
        pathname: '/api/offers',
        searchParams: new URLSearchParams({ status: 'active' }),
      }
    );

    expect(listOffers).toHaveBeenCalledWith({ status: 'active' });
    expect(res.status).toBe(200);
    expect((res.body as any[])[0].id).toBe('offer-1');
  });

  it('routes offer create', async () => {
    const createOffer = vi.fn(async (input) => ({
      id: 'offer-1',
      title: input.title,
      project_name: input.projectName ?? null,
      description: input.description ?? null,
      status: input.status ?? 'active',
    }));

    const res = await dispatch(
      {
        ...deps,
        createOffer,
      } as any,
      {
        method: 'POST',
        pathname: '/api/offers',
        body: {
          title: 'Negotiation room audit',
          projectName: 'VoiceXpert',
          description: 'Audit offer',
          status: 'active',
        },
      }
    );

    expect(createOffer).toHaveBeenCalledWith({
      title: 'Negotiation room audit',
      projectName: 'VoiceXpert',
      description: 'Audit offer',
      status: 'active',
    });
    expect(res.status).toBe(201);
    expect((res.body as any).id).toBe('offer-1');
  });

  it('routes offer update', async () => {
    const updateOffer = vi.fn(async (_offerId, input) => ({
      id: 'offer-1',
      title: 'Negotiation room audit',
      project_name: 'VoiceXpert',
      description: input.description ?? null,
      status: input.status ?? 'active',
    }));

    const res = await dispatch(
      {
        ...deps,
        updateOffer,
      } as any,
      {
        method: 'PUT',
        pathname: '/api/offers/offer-1',
        body: {
          description: 'Updated audit offer',
          status: 'inactive',
        },
      }
    );

    expect(updateOffer).toHaveBeenCalledWith('offer-1', {
      description: 'Updated audit offer',
      status: 'inactive',
    });
    expect(res.status).toBe(200);
    expect((res.body as any).status).toBe('inactive');
  });

  it('routes projects list/create/update', async () => {
    const listProjects = vi.fn(async () => [
      {
        id: 'project-1',
        key: 'voicexpert',
        name: 'VoiceXpert',
        description: 'Core workspace',
        status: 'active',
      },
    ]);
    const createProject = vi.fn(async (input) => ({
      id: 'project-1',
      key: input.key,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? 'active',
    }));
    const updateProject = vi.fn(async (_projectId, input) => ({
      id: 'project-1',
      key: 'voicexpert',
      name: input.name ?? 'VoiceXpert',
      description: input.description ?? null,
      status: input.status ?? 'active',
    }));

    const listRes = await dispatch(
      {
        ...deps,
        listProjects,
        createProject,
        updateProject,
      } as any,
      {
        method: 'GET',
        pathname: '/api/projects',
        searchParams: new URLSearchParams({ status: 'active' }),
      },
      buildMeta({ mode: 'live' })
    );
    expect(listProjects).toHaveBeenCalledWith({ status: 'active' });
    expect((listRes.body as any[])[0].key).toBe('voicexpert');

    const createRes = await dispatch(
      {
        ...deps,
        listProjects,
        createProject,
        updateProject,
      } as any,
      {
        method: 'POST',
        pathname: '/api/projects',
        body: {
          key: 'voicexpert',
          name: 'VoiceXpert',
          description: 'Core workspace',
        },
      },
      buildMeta({ mode: 'live' })
    );
    expect(createProject).toHaveBeenCalledWith({
      key: 'voicexpert',
      name: 'VoiceXpert',
      description: 'Core workspace',
      status: undefined,
    });
    expect((createRes.body as any).status).toBe('active');

    const updateRes = await dispatch(
      {
        ...deps,
        listProjects,
        createProject,
        updateProject,
      } as any,
      {
        method: 'PUT',
        pathname: '/api/projects/project-1',
        body: {
          name: 'VoiceXpert Core',
          description: 'Updated',
          status: 'inactive',
        },
      },
      buildMeta({ mode: 'live' })
    );
    expect(updateProject).toHaveBeenCalledWith('project-1', {
      name: 'VoiceXpert Core',
      description: 'Updated',
      status: 'inactive',
    });
    expect((updateRes.body as any).status).toBe('inactive');
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
    expect(snapshotSegment).toHaveBeenCalledWith({ segmentId: 's1', finalize: true, allowEmpty: false });
    expect(enqueueSegmentEnrichment).toHaveBeenCalledWith({ segmentId: 's1', adapter: 'mock', dryRun: undefined, limit: 25 });
    expect(runSegmentEnrichmentOnce).toHaveBeenCalledTimes(1);
    expect((resEnrich.body as any).summary.jobId).toBe('job1');

    const resStatus = await dispatch(
      baseDeps,
      { method: 'GET', pathname: '/api/enrich/status', searchParams: new URLSearchParams({ segmentId: 's1' }) },
      buildMeta({ mode: 'live' })
    );
    expect(getSegmentEnrichmentStatus).toHaveBeenCalledWith('s1');
    expect((resStatus.body as any).status).toBe('completed');

    const resMulti = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/enrich/segment/multi',
        body: { segmentId: 's1', providers: ['exa', 'parallel'], runNow: true },
      },
      buildMeta({ mode: 'live' })
    );
    expect(resMulti.status).toBe(200);
    expect(snapshotSegment).toHaveBeenCalledWith({ segmentId: 's1', finalize: true, allowEmpty: false });
    expect(enqueueSegmentEnrichment).toHaveBeenCalledWith({ segmentId: 's1', adapter: 'exa', dryRun: false, limit: 25 });
    expect(enqueueSegmentEnrichment).toHaveBeenCalledWith({ segmentId: 's1', adapter: 'parallel', dryRun: false, limit: 25 });
    expect(runSegmentEnrichmentOnce).toHaveBeenCalledTimes(3); // 1 from single + 2 from multi
  });

  it('routes batch segment enrichment across multiple segments', async () => {
    const snapshotSegment = vi.fn(async ({ segmentId }) => ({ version: 1, segmentId, count: 10 }));
    const enqueueSegmentEnrichment = vi.fn(async ({ segmentId }) => ({
      id: `job-${segmentId}`,
      payload: { segmentId },
    }));
    const runSegmentEnrichmentOnce = vi.fn(async (job) => ({
      processed: 3,
      dryRun: false,
      jobId: job.id,
    }));

    const res = await dispatch(
      {
        ...deps,
        snapshotSegment,
        enqueueSegmentEnrichment,
        runSegmentEnrichmentOnce,
      } as any,
      {
        method: 'POST',
        pathname: '/api/enrich/segments/batch',
        body: { segmentIds: ['s1', 's2'], adapter: 'firecrawl', runNow: true },
      },
      buildMeta({ mode: 'live' })
    );

    expect(res.status).toBe(200);
    expect(snapshotSegment).toHaveBeenCalledWith({
      segmentId: 's1',
      finalize: true,
      allowEmpty: false,
    });
    expect(snapshotSegment).toHaveBeenCalledWith({
      segmentId: 's2',
      finalize: true,
      allowEmpty: false,
    });
    expect(enqueueSegmentEnrichment).toHaveBeenCalledWith({
      segmentId: 's1',
      adapter: 'firecrawl',
      dryRun: false,
      limit: 25,
    });
    expect(enqueueSegmentEnrichment).toHaveBeenCalledWith({
      segmentId: 's2',
      adapter: 'firecrawl',
      dryRun: false,
      limit: 25,
    });
    expect(runSegmentEnrichmentOnce).toHaveBeenCalledTimes(2);
    expect((res.body as any).results).toEqual([
      {
        segmentId: 's1',
        status: 'completed',
        jobId: 'job-s1',
        summary: { processed: 3, dryRun: false, jobId: 'job-s1' },
      },
      {
        segmentId: 's2',
        status: 'completed',
        jobId: 'job-s2',
        summary: { processed: 3, dryRun: false, jobId: 'job-s2' },
      },
    ]);
  });

  it('routes enrichment settings endpoints', async () => {
    const getEnrichmentSettings = vi.fn(async () => ({
      version: 2,
      defaultProviders: ['mock'],
      primaryCompanyProvider: 'mock',
      primaryEmployeeProvider: 'mock',
    }));
    const setEnrichmentSettings = vi.fn(async (payload) => ({ ...payload, version: 2 }));
    const baseDeps: any = { ...deps, getEnrichmentSettings, setEnrichmentSettings };

    const resGet = await dispatch(baseDeps, { method: 'GET', pathname: '/api/settings/enrichment' });
    expect(resGet.status).toBe(200);
    expect(getEnrichmentSettings).toHaveBeenCalledTimes(1);

    const resPost = await dispatch(baseDeps, {
      method: 'POST',
      pathname: '/api/settings/enrichment',
      body: { defaultProviders: ['exa', 'firecrawl'], primaryCompanyProvider: 'firecrawl', primaryEmployeeProvider: 'exa' },
    });
    expect(resPost.status).toBe(200);
    expect(setEnrichmentSettings).toHaveBeenCalledWith({
      defaultProviders: ['exa', 'firecrawl'],
      primaryCompanyProvider: 'firecrawl',
      primaryEmployeeProvider: 'exa',
    });
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

  it('accepts and logs AI attribution metadata when creating segments', async () => {
    const createSegment = vi.fn(async (input) => ({
      id: 's-ai-123',
      ...input,
      created_at: '2025-12-17T00:00:00Z',
      version: 0
    }));
    const baseDeps: any = { ...deps, createSegment };

    // Spy on console.log to verify AI attribution logging
    const consoleLogSpy = vi.spyOn(console, 'log');

    const resWithAttribution = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/segments',
        body: {
          name: 'AI-Suggested Segment',
          locale: 'en',
          filterDefinition: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
          description: 'Segment from AI suggestion',
          aiAttribution: {
            suggestionId: 'sugg-456',
            userDescription: 'Target CTOs at AI companies',
          },
        },
      },
      buildMeta({ mode: 'live' })
    );

    expect(resWithAttribution.status).toBe(201);
    expect(createSegment).toHaveBeenCalledWith({
      name: 'AI-Suggested Segment',
      locale: 'en',
      filterDefinition: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }],
      description: 'Segment from AI suggestion',
      createdBy: undefined,
    });
    expect((resWithAttribution.body as any).id).toBe('s-ai-123');

    // Verify AI attribution was logged
    expect(consoleLogSpy).toHaveBeenCalledWith(
      '[Segment Creation] AI-assisted segment created:',
      expect.objectContaining({
        segmentId: 's-ai-123',
        segmentName: 'AI-Suggested Segment',
        suggestionId: 'sugg-456',
        userDescription: 'Target CTOs at AI companies',
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/),
      })
    );

    consoleLogSpy.mockRestore();
  });

  it('does not log attribution when aiAttribution is not provided', async () => {
    const createSegment = vi.fn(async (input) => ({
      id: 's-manual-456',
      ...input,
      created_at: '2025-12-17T00:00:00Z',
      version: 0
    }));
    const baseDeps: any = { ...deps, createSegment };

    const consoleLogSpy = vi.spyOn(console, 'log');

    const resWithoutAttribution = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/segments',
        body: {
          name: 'Manual Segment',
          locale: 'en',
          filterDefinition: [{ field: 'companies.industry', operator: 'eq', value: 'Tech' }],
          description: 'Manually created segment',
        },
      },
      buildMeta({ mode: 'live' })
    );

    expect(resWithoutAttribution.status).toBe(201);
    expect((resWithoutAttribution.body as any).id).toBe('s-manual-456');

    // Verify AI attribution was NOT logged
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      '[Segment Creation] AI-assisted segment created:',
      expect.any(Object)
    );

    consoleLogSpy.mockRestore();
  });

  it('routes ICP profile/hypothesis CRUD', async () => {
    const listIcpProfiles = vi.fn(async () => [{ id: 'p1', name: 'ICP' }]);
    const createIcpProfile = vi.fn(async ({ name }) => ({ id: 'p1', name }));
    const listIcpHypotheses = vi.fn(async () => [{ id: 'h1', hypothesis_label: 'test' }]);
    const createIcpHypothesis = vi.fn(async ({ icpProfileId, offerId, messagingAngle }) => ({
      id: 'h1',
      icpProfileId,
      offerId,
      messagingAngle,
    }));
    const getIcpProfileLearnings = vi.fn(async (profileId) => ({
      profileId,
      profileName: 'ICP',
      offeringDomain: 'voicexpert.ru',
      learnings: ['Use negotiation-room language'],
      updatedAt: '2026-03-17T10:00:00Z',
    }));
    const updateIcpProfileLearnings = vi.fn(async ({ profileId, learnings }) => ({
      profileId,
      profileName: 'ICP',
      offeringDomain: 'voicexpert.ru',
      learnings,
      updatedAt: '2026-03-17T11:00:00Z',
    }));
    const listIcpOfferingMappings = vi.fn(async () => [
      {
        profileId: 'p1',
        profileName: 'ICP',
        offeringDomain: 'voicexpert.ru',
        learningsCount: 1,
      },
    ]);

    const baseDeps: any = {
      ...deps,
      listIcpProfiles,
      createIcpProfile,
      listIcpHypotheses,
      createIcpHypothesis,
      getIcpProfileLearnings,
      updateIcpProfileLearnings,
      listIcpOfferingMappings,
    };

    const resProfiles = await dispatch(baseDeps, { method: 'GET', pathname: '/api/icp/profiles' });
    expect(listIcpProfiles).toHaveBeenCalledTimes(1);
    expect((resProfiles.body as any[])[0].id).toBe('p1');

    const resProfileCreate = await dispatch(
      baseDeps,
      { method: 'POST', pathname: '/api/icp/profiles', body: { name: 'New ICP', projectId: 'project-1' } },
      buildMeta({ mode: 'live' })
    );
    expect(createIcpProfile).toHaveBeenCalledWith({
      name: 'New ICP',
      projectId: 'project-1',
      description: undefined,
    });
    expect((resProfileCreate.body as any).id).toBe('p1');

    const resHypList = await dispatch(baseDeps, { method: 'GET', pathname: '/api/icp/hypotheses' });
    expect(listIcpHypotheses).toHaveBeenCalledTimes(1);
    expect((resHypList.body as any[])[0].id).toBe('h1');

    const resHypCreate = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/icp/hypotheses',
        body: {
          icpProfileId: 'p1',
          hypothesisLabel: 'H',
          offerId: 'offer-1',
          messagingAngle: 'Negotiation room refresh',
        },
      },
      buildMeta({ mode: 'live' })
    );
    expect(createIcpHypothesis).toHaveBeenCalledWith({
      icpProfileId: 'p1',
      hypothesisLabel: 'H',
      offerId: 'offer-1',
      segmentId: undefined,
      searchConfig: undefined,
      targetingDefaults: undefined,
      messagingAngle: 'Negotiation room refresh',
      patternDefaults: undefined,
      notes: undefined,
    });
    expect((resHypCreate.body as any).id).toBe('h1');

    const resLearnings = await dispatch(
      baseDeps,
      { method: 'GET', pathname: '/api/icp/profiles/p1/learnings' },
      buildMeta({ mode: 'live' })
    );
    expect(getIcpProfileLearnings).toHaveBeenCalledWith('p1');
    expect((resLearnings.body as any).learnings).toEqual(['Use negotiation-room language']);

    const resLearningsUpdate = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/icp/profiles/p1/learnings',
        body: { learnings: ['Avoid marketing tone', 'Avoid marketing tone', ''] },
      },
      buildMeta({ mode: 'live' })
    );
    expect(updateIcpProfileLearnings).toHaveBeenCalledWith({
      profileId: 'p1',
      learnings: ['Avoid marketing tone', 'Avoid marketing tone', ''],
    });
    expect((resLearningsUpdate.body as any).learnings).toEqual([
      'Avoid marketing tone',
      'Avoid marketing tone',
      '',
    ]);

    const resOfferings = await dispatch(
      baseDeps,
      { method: 'GET', pathname: '/api/icp/offerings' },
      buildMeta({ mode: 'live' })
    );
    expect(listIcpOfferingMappings).toHaveBeenCalledTimes(1);
    expect((resOfferings.body as any[])[0].offeringDomain).toBe('voicexpert.ru');
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
    const dashboardOverview = vi.fn(async () => ({
      campaigns: { total: 1, active: 1, byStatus: [{ status: 'draft', count: 1 }] },
      pending: { draftsOnReview: 1, inboxReplies: 2, staleEnrichment: 3, missingEnrichment: 4 },
      recentActivity: [{ kind: 'reply', id: 'evt-1', timestamp: '2026-03-18T12:00:00Z', title: 'Reply positive', subtitle: null }],
    }));
    const analyticsSummary = vi.fn(async ({ groupBy, since }) => [{ groupBy, since }]);
    const analyticsRejectionReasons = vi.fn(async ({ since }) => ({
      total_rejected: 1,
      by_reason: [{ review_reason_code: 'marketing_tone', count: 1 }],
      by_pattern: [],
      by_pattern_and_reason: [],
      by_campaign: [],
      by_email_type: [],
      by_icp_profile: [],
      by_icp_hypothesis: [],
      since,
    }));
    const analyticsOptimize = vi.fn(async ({ since }) => ({ suggestions: [{ draft_pattern: 'p', recommendation: 'keep' }], simSummary: [] }));
    const listPromptRegistry = vi.fn(async () => [{ id: 'uuid-1', coach_prompt_id: 'cp1', version: 'v1', rollout_status: 'active' }]);
    const resDashboard = await dispatch(
      {
        ...deps,
        dashboardOverview,
        analyticsSummary,
        analyticsRejectionReasons,
        analyticsOptimize,
        listPromptRegistry,
      } as any,
      { method: 'GET', pathname: '/api/dashboard/overview' },
      buildMeta({ mode: 'live' })
    );
    expect(dashboardOverview).toHaveBeenCalledTimes(1);
    expect((resDashboard.body as any).pending.inboxReplies).toBe(2);

    const resSummary = await dispatch(
      {
        ...deps,
        dashboardOverview,
        analyticsSummary,
        analyticsRejectionReasons,
        analyticsOptimize,
        listPromptRegistry,
      } as any,
      { method: 'GET', pathname: '/api/analytics/summary', searchParams: new URLSearchParams({ groupBy: 'icp', since: '2025' }) },
      buildMeta({ mode: 'live' })
    );
    expect(analyticsSummary).toHaveBeenCalledWith({ groupBy: 'icp', since: '2025' });
    expect((resSummary.body as any[])[0].groupBy).toBe('icp');

    const resRejectionReasons = await dispatch(
      {
        ...deps,
        dashboardOverview,
        analyticsSummary,
        analyticsRejectionReasons,
        analyticsOptimize,
        listPromptRegistry,
      } as any,
      { method: 'GET', pathname: '/api/analytics/rejection-reasons', searchParams: new URLSearchParams({ since: '2025' }) },
      buildMeta({ mode: 'live' })
    );
    expect(analyticsRejectionReasons).toHaveBeenCalledWith({ since: '2025' });
    expect((resRejectionReasons.body as any).by_reason[0].review_reason_code).toBe('marketing_tone');

    const resOptimize = await dispatch(
      {
        ...deps,
        dashboardOverview,
        analyticsSummary,
        analyticsRejectionReasons,
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
        dashboardOverview,
        analyticsSummary,
        analyticsRejectionReasons,
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

  it('createLiveDeps exposes direct send and inbox polling when imap-mcp is configured', () => {
    vi.stubEnv('SUPABASE_URL', 'http://example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');
    vi.stubEnv('SMARTLEAD_MCP_URL', 'http://smartlead');
    vi.stubEnv('SMARTLEAD_MCP_TOKEN', 'token');
    vi.stubEnv('OUTREACH_SEND_CAMPAIGN_CMD', '');
    vi.stubEnv('OUTREACH_PROCESS_REPLIES_CMD', '');
    vi.stubEnv('IMAP_MCP_SERVER_ROOT', '/opt/imap-mcp');
    vi.stubEnv('IMAP_MCP_HOME', '/state/imap');

    const supabase = { from: vi.fn(() => ({ select: vi.fn() })) };
    const withTrigger = createLiveDeps({ supabase });
    expect(typeof withTrigger.runCampaignAutoSendSweep).toBe('function');
    expect(typeof withTrigger.executeCampaignSend).toBe('function');
    expect(typeof withTrigger.triggerInboxPoll).toBe('function');

    vi.stubEnv('IMAP_MCP_SERVER_ROOT', '');
    vi.stubEnv('IMAP_MCP_HOME', '');
    const withoutTrigger = createLiveDeps({ supabase });
    expect(withoutTrigger.runCampaignAutoSendSweep).toBeUndefined();
    expect(withoutTrigger.executeCampaignSend).toBeUndefined();
    expect(withoutTrigger.triggerInboxPoll).toBeUndefined();

    vi.unstubAllEnvs();
  });

  it('createLiveDeps routes draft generation through Outreach trigger when configured', async () => {
    vi.stubEnv('SUPABASE_URL', 'http://example.com');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'key');
    vi.stubEnv('OUTREACH_GENERATE_DRAFTS_CMD', 'outreach generate-drafts');

    const triggerSpy = vi.spyOn(generateDraftsTrigger, 'triggerGenerateDrafts').mockResolvedValue({
      generated: 2,
      dryRun: true,
      source: 'outreacher-generate-drafts',
      requestedAt: '2026-04-01T10:00:00.000Z',
      campaignId: 'c1',
    } as any);

    const liveDeps = createLiveDeps({
      supabase: { from: vi.fn() } as any,
      smartlead: {} as any,
    });

    const result = await liveDeps.generateDrafts({
      campaignId: 'c1',
      dryRun: true,
      limit: 3,
      interactionMode: 'express',
      dataQualityMode: 'strict',
    });

    expect(triggerSpy).toHaveBeenCalledWith({
      campaignId: 'c1',
      dryRun: true,
      limit: 3,
      interactionMode: 'express',
      dataQualityMode: 'strict',
    });
    expect(result).toMatchObject({
      generated: 2,
      dryRun: true,
      source: 'outreacher-generate-drafts',
      campaignId: 'c1',
    });

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
      { listCampaigns: vi.fn(), listDrafts: vi.fn(), generateDrafts: vi.fn(), sendSmartlead: stubSendSmartlead(), listEvents, listReplyPatterns },
      { method: 'GET', pathname: '/api/events', searchParams: new URLSearchParams({ since: '2025', limit: '5' }) },
      buildMeta({ mode: 'live' })
    );
    expect(listEvents).toHaveBeenCalledWith({ since: '2025', limit: 5 });
    expect((resEvents.body as any[])[0].event_type).toBe('2025');

    const resPatterns = await dispatch(
      { listCampaigns: vi.fn(), listDrafts: vi.fn(), generateDrafts: vi.fn(), sendSmartlead: stubSendSmartlead(), listEvents, listReplyPatterns },
      { method: 'GET', pathname: '/api/reply-patterns', searchParams: new URLSearchParams({ topN: '2' }) },
      buildMeta({ mode: 'live' })
    );
    expect(listReplyPatterns).toHaveBeenCalledWith({ since: undefined, topN: 2 });
    expect((resPatterns.body as any[])[0].count).toBe(2);
  });

  it('routes inbox replies view', async () => {
    const listInboxReplies = vi.fn(async () => ({
      replies: [
        {
          id: 'evt-1',
          campaign_id: 'camp-1',
          campaign_name: 'Q1 Push',
          reply_label: 'positive',
          handled: false,
          handled_at: null,
          handled_by: null,
          event_type: 'replied',
          occurred_at: '2026-03-15T13:30:00Z',
          reply_text: 'Sounds interesting.',
          contact_name: 'Bianca Mock',
          company_name: 'Mock Co',
        },
      ],
      total: 1,
    }));
    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: stubSendSmartlead(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listInboxReplies,
      } as any,
      { method: 'GET', pathname: '/api/inbox/replies' },
      buildMeta({ mode: 'live' })
    );
    expect(listInboxReplies).toHaveBeenCalledWith({
      campaignId: undefined,
      replyLabel: undefined,
      handled: undefined,
      limit: undefined,
      linkage: undefined,
    });
    expect((res.body as any).total).toBe(1);
    expect((res.body as any).replies[0].reply_text).toBe('Sounds interesting.');
  });

  it('routes inbox replies category and linkage filters', async () => {
    const listInboxReplies = vi.fn(async () => ({ replies: [], total: 0 }));
    await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: stubSendSmartlead(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listInboxReplies,
      } as any,
      {
        method: 'GET',
        pathname: '/api/inbox/replies',
        searchParams: new URLSearchParams({
          category: 'bounce',
          linkage: 'linked',
          handled: 'false',
          limit: '25',
        }),
      },
      buildMeta({ mode: 'live' })
    );

    expect(listInboxReplies).toHaveBeenCalledWith({
      campaignId: undefined,
      replyLabel: undefined,
      category: 'bounce',
      handled: false,
      limit: 25,
      linkage: 'linked',
    });
  });

  it('routes inbox handled-state updates', async () => {
    const markInboxReplyHandled = vi.fn(async ({ replyId, handledBy }) => ({
      id: replyId,
      handled: true,
      handled_at: '2026-03-18T22:00:00Z',
      handled_by: handledBy ?? 'web-ui',
    }));
    const markInboxReplyUnhandled = vi.fn(async (replyId) => ({
      id: replyId,
      handled: false,
      handled_at: null,
      handled_by: null,
    }));

    const handledRes = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: stubSendSmartlead(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        markInboxReplyHandled,
        markInboxReplyUnhandled,
      } as any,
      {
        method: 'POST',
        pathname: '/api/inbox/replies/evt-1/handled',
        body: { handledBy: 'operator' },
      },
      buildMeta({ mode: 'live' })
    );
    expect(markInboxReplyHandled).toHaveBeenCalledWith({
      replyId: 'evt-1',
      handledBy: 'operator',
    });
    expect((handledRes.body as any).handled).toBe(true);

    const unhandledRes = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: stubSendSmartlead(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        markInboxReplyHandled,
        markInboxReplyUnhandled,
      } as any,
      {
        method: 'POST',
        pathname: '/api/inbox/replies/evt-1/unhandled',
      },
      buildMeta({ mode: 'live' })
    );
    expect(markInboxReplyUnhandled).toHaveBeenCalledWith('evt-1');
    expect((unhandledRes.body as any).handled).toBe(false);
  });

  it('routes inbox poll trigger', async () => {
    const triggerInboxPoll = vi.fn(async (payload) => ({
      source: 'outreacher-process-replies',
      requestedAt: '2026-03-17T10:00:00.000Z',
      upstreamStatus: 202,
      accepted: true,
      mailboxAccountId: payload.mailboxAccountId ?? null,
      processed: 3,
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: stubSendSmartlead(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        triggerInboxPoll,
      } as any,
      {
        method: 'POST',
        pathname: '/api/inbox/poll',
        body: { mailboxAccountId: 'mbox-1', lookbackHours: 24 },
      },
      buildMeta({ mode: 'live' })
    );

    expect(triggerInboxPoll).toHaveBeenCalledWith({
      mailboxAccountId: 'mbox-1',
      lookbackHours: 24,
    });
    expect(res.status).toBe(202);
    expect((res.body as any).accepted).toBe(true);
    expect((res.body as any).mailboxAccountId).toBe('mbox-1');
  });

  it('starts inbox poll scheduler from env in live mode', async () => {
    vi.useFakeTimers();
    const triggerInboxPoll = vi.fn(async () => ({
      source: 'outreacher-process-replies' as const,
      requestedAt: '2026-03-19T10:00:00.000Z',
      upstreamStatus: 200,
      accepted: true,
      processed: 1,
    }));
    const logger = { log: vi.fn(), error: vi.fn() };
    const previousEnabled = process.env.INBOX_POLL_ENABLED;
    const previousInterval = process.env.INBOX_POLL_INTERVAL_MINUTES;
    const previousLookback = process.env.INBOX_POLL_LOOKBACK_HOURS;
    process.env.INBOX_POLL_ENABLED = 'true';
    process.env.INBOX_POLL_INTERVAL_MINUTES = '5';
    process.env.INBOX_POLL_LOOKBACK_HOURS = '12';

    try {
      const scheduler = startInboxPollSchedulerFromEnv({ triggerInboxPoll } as any, {
        mode: 'live',
        logger,
      });
      expect(scheduler?.intervalMs).toBe(5 * 60 * 1000);
      expect(scheduler?.lookbackHours).toBe(12);

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

      expect(triggerInboxPoll).toHaveBeenCalledWith({ lookbackHours: 12 });
      scheduler?.stop();
    } finally {
      vi.useRealTimers();
      process.env.INBOX_POLL_ENABLED = previousEnabled;
      process.env.INBOX_POLL_INTERVAL_MINUTES = previousInterval;
      process.env.INBOX_POLL_LOOKBACK_HOURS = previousLookback;
    }
  });

  it('prevents overlapping inbox poll scheduler runs', async () => {
    vi.useFakeTimers();
    let resolveRun: any = null;
    const triggerInboxPoll = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRun = () =>
            resolve({
              source: 'outreacher-process-replies' as const,
              requestedAt: '2026-03-19T10:00:00.000Z',
              upstreamStatus: 200,
              accepted: true,
              processed: 1,
            });
        })
    );

    try {
      const scheduler = startInboxPollScheduler(
        { triggerInboxPoll } as any,
        { intervalMs: 1000, lookbackHours: 24, logger: { log: vi.fn(), error: vi.fn() } }
      );

      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      expect(triggerInboxPoll).toHaveBeenCalledTimes(1);

      const finishRun = resolveRun;
      if (!finishRun) {
        throw new Error('Expected scheduler run to be pending');
      }
      finishRun();
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(1000);
      expect(triggerInboxPoll).toHaveBeenCalledTimes(2);

      scheduler?.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('formats non-Error inbox poll failures instead of logging [object Object]', async () => {
    vi.useFakeTimers();
    const triggerInboxPoll = vi
      .fn()
      .mockRejectedValueOnce({ message: 'boom', code: 'ECONNRESET' })
      .mockResolvedValueOnce({
        source: 'outreacher-process-replies' as const,
        requestedAt: '2026-03-19T10:00:00.000Z',
        upstreamStatus: 200,
        accepted: true,
        processed: 1,
      });
    const logger = { log: vi.fn(), error: vi.fn() };

    try {
      const scheduler = startInboxPollScheduler(
        { triggerInboxPoll } as any,
        { intervalMs: 1000, lookbackHours: 24, logger }
      );

      await vi.advanceTimersByTimeAsync(1000);
      await Promise.resolve();
      expect(logger.error).toHaveBeenCalledWith(
        '[web adapter] inbox poll failed: boom | code=ECONNRESET'
      );

      await vi.advanceTimersByTimeAsync(1000);
      expect(triggerInboxPoll).toHaveBeenCalledTimes(2);
      scheduler?.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('routes batch draft status updates', async () => {
    const updateDraftStatuses = vi.fn(async ({ draftIds, status, reviewer, metadata }) => ({
      updated: [
        { id: 'draft-1', status, reviewer, metadata: { review_surface: 'builder-v2', reason: 'ready_to_send', ...metadata } },
        { id: 'draft-2', status, reviewer, metadata: { review_surface: 'builder-v2', reason: 'ready_to_send', ...metadata } },
      ],
      summary: {
        totalRequested: draftIds.length,
        updatedCount: 2,
        status,
      },
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: stubSendSmartlead(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        updateDraftStatuses,
      } as any,
      {
        method: 'POST',
        pathname: '/api/drafts/batch-status',
        body: {
          draftIds: ['draft-1', 'draft-2'],
          status: 'approved',
          reviewer: 'outreacher',
          metadata: { reason: 'ready_to_send' },
        },
      },
      buildMeta({ mode: 'live' })
    );

    expect(updateDraftStatuses).toHaveBeenCalledWith({
      draftIds: ['draft-1', 'draft-2'],
      status: 'approved',
      reviewer: 'outreacher',
      metadata: { reason: 'ready_to_send' },
    });
    expect((res.body as any).summary.updatedCount).toBe(2);
    expect((res.body as any).updated[0].status).toBe('approved');
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

  it('routes directory companies view with filters', async () => {
    const listDirectoryCompanies = vi.fn(async () => ({
      items: [{ companyId: 'co-1', companyName: 'Acme AI' }],
      summary: {
        total: 1,
        enrichment: { fresh: 1, stale: 0, missing: 0 },
        segments: [{ segment: 'AI', count: 1 }],
      },
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listDirectoryCompanies,
      } as any,
      {
        method: 'GET',
        pathname: '/api/directory/companies',
        searchParams: new URLSearchParams({
          segment: 'AI',
          enrichmentStatus: 'fresh',
          q: 'acme',
          limit: '25',
        }),
      },
      buildMeta({ mode: 'live' })
    );

    expect(listDirectoryCompanies).toHaveBeenCalledWith({
      segment: 'AI',
      enrichmentStatus: 'fresh',
      query: 'acme',
      limit: 25,
    });
    expect((res.body as any).summary.total).toBe(1);
    expect((res.body as any).items[0].companyId).toBe('co-1');
  });

  it('routes directory contacts view with filters', async () => {
    const listDirectoryContacts = vi.fn(async () => ({
      items: [{ contactId: 'ct-1', fullName: 'Alice Doe' }],
      summary: {
        total: 1,
        emailStatus: { work: 1, generic: 0, missing: 0 },
        enrichment: { fresh: 1, stale: 0, missing: 0 },
      },
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listDirectoryContacts,
      } as any,
      {
        method: 'GET',
        pathname: '/api/directory/contacts',
        searchParams: new URLSearchParams({
          companyIds: 'co-1,co-2',
          segment: 'AI',
          emailStatus: 'work',
          enrichmentStatus: 'fresh',
          q: 'alice',
          limit: '50',
        }),
      },
      buildMeta({ mode: 'live' })
    );

    expect(listDirectoryContacts).toHaveBeenCalledWith({
      companyIds: ['co-1', 'co-2'],
      segment: 'AI',
      emailStatus: 'work',
      enrichmentStatus: 'fresh',
      query: 'alice',
      limit: 50,
    });
    expect((res.body as any).summary.total).toBe(1);
    expect((res.body as any).items[0].contactId).toBe('ct-1');
  });

  it('ignores invalid directory enum filters', async () => {
    const listDirectoryContacts = vi.fn(async () => ({
      items: [],
      summary: {
        total: 0,
        emailStatus: { work: 0, generic: 0, missing: 0 },
        enrichment: { fresh: 0, stale: 0, missing: 0 },
      },
    }));

    await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listDirectoryContacts,
      } as any,
      {
        method: 'GET',
        pathname: '/api/directory/contacts',
        searchParams: new URLSearchParams({
          emailStatus: 'verified',
          enrichmentStatus: 'unknown',
        }),
      },
      buildMeta({ mode: 'live' })
    );

    expect(listDirectoryContacts).toHaveBeenCalledWith({
      companyIds: undefined,
      segment: undefined,
      emailStatus: undefined,
      enrichmentStatus: undefined,
      query: undefined,
      limit: undefined,
    });
  });

  it('routes directory employee name repair preview', async () => {
    const previewEmployeeNameRepairs = vi.fn(async () => ({
      mode: 'dry-run',
      summary: {
        scanned_count: 10,
        candidate_count: 2,
        fixable_count: 1,
        skipped_count: 1,
        updated_count: 0,
      },
      candidates: [{ employee_id: 'emp-1', confidence: 'high' }],
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        previewEmployeeNameRepairs,
      } as any,
      {
        method: 'GET',
        pathname: '/api/directory/employee-name-repairs',
        searchParams: new URLSearchParams({ confidence: 'all' }),
      },
      buildMeta({ mode: 'live' })
    );

    expect(previewEmployeeNameRepairs).toHaveBeenCalledWith({ confidence: 'all' });
    expect((res.body as any).mode).toBe('dry-run');
    expect((res.body as any).summary.candidate_count).toBe(2);
  });

  it('routes directory employee name repair apply', async () => {
    const applyEmployeeNameRepairs = vi.fn(async () => ({
      mode: 'apply',
      summary: {
        scanned_count: 10,
        candidate_count: 2,
        fixable_count: 2,
        skipped_count: 0,
        updated_count: 2,
      },
      candidates: [{ employee_id: 'emp-1', confidence: 'high' }],
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        applyEmployeeNameRepairs,
      } as any,
      {
        method: 'POST',
        pathname: '/api/directory/employee-name-repairs/apply',
        body: { confidence: 'high' },
      },
      buildMeta({ mode: 'live' })
    );

    expect(applyEmployeeNameRepairs).toHaveBeenCalledWith({ confidence: 'high' });
    expect((res.body as any).mode).toBe('apply');
    expect((res.body as any).summary.updated_count).toBe(2);
  });

  it('routes directory contact invalidation', async () => {
    const markDirectoryContactInvalid = vi.fn(async () => ({
      contactId: 'ct-1',
      processingStatus: 'invalid',
      updatedAt: '2026-03-18T10:00:00Z',
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        markDirectoryContactInvalid,
      } as any,
      {
        method: 'POST',
        pathname: '/api/directory/contacts/ct-1/mark-invalid',
      },
      buildMeta({ mode: 'live' })
    );

    expect(markDirectoryContactInvalid).toHaveBeenCalledWith('ct-1');
    expect((res.body as any).processingStatus).toBe('invalid');
  });

  it('routes directory contact deletion and surfaces dependency conflicts', async () => {
    const deleteDirectoryContact = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Contact cannot be deleted because dependent drafts or segment memberships exist'), {
          code: 'CONTACT_DELETE_CONFLICT',
          details: { drafts: 2, segmentMemberships: 1 },
        })
      )
      .mockResolvedValueOnce({ contactId: 'ct-2', deleted: true });

    const conflict = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        deleteDirectoryContact,
      } as any,
      {
        method: 'POST',
        pathname: '/api/directory/contacts/ct-1/delete',
      },
      buildMeta({ mode: 'live' })
    );

    expect(conflict.status).toBe(409);
    expect((conflict.body as any).details).toEqual({ drafts: 2, segmentMemberships: 1 });

    const success = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        deleteDirectoryContact,
      } as any,
      {
        method: 'POST',
        pathname: '/api/directory/contacts/ct-2/delete',
      },
      buildMeta({ mode: 'live' })
    );

    expect(deleteDirectoryContact).toHaveBeenCalledWith('ct-1');
    expect(deleteDirectoryContact).toHaveBeenCalledWith('ct-2');
    expect((success.body as any).deleted).toBe(true);
  });

  it('routes directory company invalidation', async () => {
    const markDirectoryCompanyInvalid = vi.fn(async () => ({
      companyId: 'co-1',
      processingStatus: 'invalid',
      updatedAt: '2026-03-18T11:00:00Z',
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        markDirectoryCompanyInvalid,
      } as any,
      {
        method: 'POST',
        pathname: '/api/directory/companies/co-1/mark-invalid',
      },
      buildMeta({ mode: 'live' })
    );

    expect(markDirectoryCompanyInvalid).toHaveBeenCalledWith('co-1');
    expect((res.body as any).processingStatus).toBe('invalid');
  });

  it('routes directory company deletion and surfaces dependency conflicts', async () => {
    const deleteDirectoryCompany = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Company cannot be deleted because dependent contacts, drafts, or segment memberships exist'), {
          code: 'COMPANY_DELETE_CONFLICT',
          details: { contacts: 3, drafts: 2, segmentMemberships: 1 },
        })
      )
      .mockResolvedValueOnce({ companyId: 'co-2', deleted: true });

    const conflict = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        deleteDirectoryCompany,
      } as any,
      {
        method: 'POST',
        pathname: '/api/directory/companies/co-1/delete',
      },
      buildMeta({ mode: 'live' })
    );

    expect(conflict.status).toBe(409);
    expect((conflict.body as any).details).toEqual({ contacts: 3, drafts: 2, segmentMemberships: 1 });

    const success = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        deleteDirectoryCompany,
      } as any,
      {
        method: 'POST',
        pathname: '/api/directory/companies/co-2/delete',
      },
      buildMeta({ mode: 'live' })
    );

    expect(deleteDirectoryCompany).toHaveBeenCalledWith('co-1');
    expect(deleteDirectoryCompany).toHaveBeenCalledWith('co-2');
    expect((success.body as any).deleted).toBe(true);
  });

  it('routes directory contact update', async () => {
    const updateDirectoryContact = vi.fn(async () => ({
      contactId: 'ct-1',
      fullName: 'Alice Doe',
      position: 'CTO',
      workEmail: 'alice@acme.ai',
      genericEmail: null,
      processingStatus: 'completed',
      updatedAt: '2026-03-18T12:00:00Z',
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        updateDirectoryContact,
      } as any,
      {
        method: 'POST',
        pathname: '/api/directory/contacts/ct-1/update',
        body: { full_name: 'Alice Doe', position: 'CTO' },
      },
      buildMeta({ mode: 'live' })
    );

    expect(updateDirectoryContact).toHaveBeenCalledWith('ct-1', {
      full_name: 'Alice Doe',
      position: 'CTO',
    });
    expect((res.body as any).contactId).toBe('ct-1');
  });

  it('routes directory company update', async () => {
    const updateDirectoryCompany = vi.fn(async () => ({
      companyId: 'co-1',
      companyName: 'Acme AI',
      website: 'https://acme.ai',
      segment: 'AI',
      status: 'Active',
      officeQualification: 'More',
      employeeCount: 42,
      primaryEmail: 'hello@acme.ai',
      companyDescription: 'Infra tooling',
      region: 'Paris',
      processingStatus: 'completed',
      updatedAt: '2026-03-18T12:30:00Z',
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        updateDirectoryCompany,
      } as any,
      {
        method: 'POST',
        pathname: '/api/directory/companies/co-1/update',
        body: { company_name: 'Acme AI', website: 'https://acme.ai' },
      },
      buildMeta({ mode: 'live' })
    );

    expect(updateDirectoryCompany).toHaveBeenCalledWith('co-1', {
      company_name: 'Acme AI',
      website: 'https://acme.ai',
    });
    expect((res.body as any).companyId).toBe('co-1');
  });

  it('routes company import preview and apply', async () => {
    const previewCompanyImport = vi.fn(async (records) => ({
      mode: 'dry-run',
      summary: {
        total_count: records.length,
        created_count: 1,
        updated_count: 0,
        skipped_count: 0,
        employee_created_count: 0,
        employee_updated_count: 0,
      },
      items: [
        {
          company_name: 'Acme AI',
          tin: '1234567890',
          action: 'create',
          match_field: null,
          office_qualification: 'Less',
          warnings: [],
        },
      ],
    }));
    const applyCompanyImport = vi.fn(async (records) => ({
      mode: 'apply',
      summary: {
        total_count: records.length,
        created_count: 1,
        updated_count: 0,
        skipped_count: 0,
        employee_created_count: 2,
        employee_updated_count: 0,
      },
      items: [
        {
          company_name: 'Acme AI',
          tin: '1234567890',
          action: 'create',
          match_field: null,
          office_qualification: 'Less',
          warnings: [],
        },
      ],
    }));

    const records = [
      {
        company_name: 'Acme AI',
        tin: '1234567890',
        employees: [{ full_name: 'Alice Doe', work_email: 'alice@acme.ai' }],
      },
    ];

    const previewRes = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        previewCompanyImport,
        applyCompanyImport,
      } as any,
      {
        method: 'POST',
        pathname: '/api/company-import/preview',
        body: { records },
      },
      buildMeta({ mode: 'live' })
    );

    expect(previewCompanyImport).toHaveBeenCalledWith(records);
    expect((previewRes.body as any).mode).toBe('dry-run');

    const applyRes = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        previewCompanyImport,
        applyCompanyImport,
      } as any,
      {
        method: 'POST',
        pathname: '/api/company-import/apply',
        body: { records },
      },
      buildMeta({ mode: 'live' })
    );

    expect(applyCompanyImport).toHaveBeenCalledWith(records);
    expect((applyRes.body as any).mode).toBe('apply');
    expect((applyRes.body as any).summary.employee_created_count).toBe(2);
  });

  it('routes company import process start and status', async () => {
    const startCompanyImportProcess = vi.fn(async ({ companyIds, mode, source }) => ({
      jobId: 'job-company-1',
      status: 'created',
      totalCompanies: companyIds.length,
      mode,
      batchSize: 2,
      source,
    }));
    const getCompanyImportProcessStatus = vi.fn(async (jobId) => ({
      jobId,
      status: 'running',
      totalCompanies: 2,
      processedCompanies: 1,
      completedCompanies: 1,
      failedCompanies: 0,
      skippedCompanies: 0,
      mode: 'full',
      batchSize: 2,
      source: 'xlsx-import',
      results: [{ companyId: 'co-1', status: 'completed' }],
      errors: [],
    }));

    const baseDeps = {
      listCampaigns: vi.fn(),
      listDrafts: vi.fn(),
      generateDrafts: vi.fn(),
      sendSmartlead: vi.fn(),
      listEvents: vi.fn(),
      listReplyPatterns: vi.fn(),
      startCompanyImportProcess,
      getCompanyImportProcessStatus,
    } as any;

    const startRes = await dispatch(
      baseDeps,
      {
        method: 'POST',
        pathname: '/api/company-import/process',
        body: { companyIds: ['co-1', 'co-2'], mode: 'full', source: 'xlsx-import' },
      },
      buildMeta({ mode: 'live' })
    );

    expect(startCompanyImportProcess).toHaveBeenCalledWith({
      companyIds: ['co-1', 'co-2'],
      mode: 'full',
      source: 'xlsx-import',
    });
    expect(startRes.status).toBe(202);
    expect((startRes.body as any).jobId).toBe('job-company-1');

    const statusRes = await dispatch(
      baseDeps,
      {
        method: 'GET',
        pathname: '/api/company-import/process/job-company-1',
      },
      buildMeta({ mode: 'live' })
    );

    expect(getCompanyImportProcessStatus).toHaveBeenCalledWith('job-company-1');
    expect(statusRes.status).toBe(200);
    expect((statusRes.body as any).processedCompanies).toBe(1);
  });

  it('routes mailbox inventory and campaign mailbox summary', async () => {
    const listMailboxes = vi.fn(async () => [
      {
        mailboxAccountId: 'mbox-1',
        senderIdentity: 'sales@acme.ai',
        user: 'sales',
        domain: 'acme.ai',
        provider: 'imap_mcp',
        campaignCount: 2,
        outboundCount: 5,
        lastSentAt: '2026-03-18T09:00:00Z',
      },
    ]);
    const getCampaignMailboxSummary = vi.fn(async () => ({
      campaignId: 'camp-1',
      mailboxes: [
        {
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@acme.ai',
          user: 'sales',
          domain: 'acme.ai',
          provider: 'imap_mcp',
          campaignCount: 1,
          outboundCount: 2,
          lastSentAt: '2026-03-18T09:00:00Z',
        },
      ],
      consistency: {
        consistent: true,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        recommendedMailboxAccountId: 'mbox-1',
        recommendedSenderIdentity: 'sales@acme.ai',
      },
    }));

    const inventory = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listMailboxes,
        getCampaignMailboxSummary,
      } as any,
      {
        method: 'GET',
        pathname: '/api/mailboxes',
      },
      buildMeta({ mode: 'live' })
    );

    expect(listMailboxes).toHaveBeenCalledTimes(1);
    expect((inventory.body as any[])[0].mailboxAccountId).toBe('mbox-1');

    const campaignSummary = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead: vi.fn(),
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
        listMailboxes,
        getCampaignMailboxSummary,
      } as any,
      {
        method: 'GET',
        pathname: '/api/campaigns/camp-1/mailbox-summary',
      },
      buildMeta({ mode: 'live' })
    );

    expect(getCampaignMailboxSummary).toHaveBeenCalledWith('camp-1');
    expect((campaignSummary.body as any).consistency.consistent).toBe(true);
  });

  it('routes campaign mailbox assignment read and replace', async () => {
    const getCampaignMailboxAssignment = vi.fn(async (campaignId) => ({
      campaignId,
      assignments: [
        {
          id: 'assign-1',
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@acme.ai',
          user: 'sales',
          domain: 'acme.ai',
          provider: 'imap_mcp',
          source: 'outreacher',
          assignedAt: '2026-03-18T20:00:00Z',
          metadata: null,
        },
      ],
      summary: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['acme.ai'],
      },
    }));
    const replaceCampaignMailboxAssignment = vi.fn(async ({ campaignId, assignments, source }) => ({
      campaignId,
      assignments,
      source,
    }));

    const readRes = await dispatch(
      {
        ...deps,
        getCampaignMailboxAssignment,
        replaceCampaignMailboxAssignment,
      } as any,
      {
        method: 'GET',
        pathname: '/api/campaigns/camp-1/mailbox-assignment',
      },
      buildMeta({ mode: 'live' })
    );
    expect(getCampaignMailboxAssignment).toHaveBeenCalledWith('camp-1');
    expect((readRes.body as any).summary.assignmentCount).toBe(1);

    const writeRes = await dispatch(
      {
        ...deps,
        getCampaignMailboxAssignment,
        replaceCampaignMailboxAssignment,
      } as any,
      {
        method: 'PUT',
        pathname: '/api/campaigns/camp-1/mailbox-assignment',
        body: {
          source: 'outreacher',
          assignments: [
            {
              mailboxAccountId: 'mbox-1',
              senderIdentity: 'sales@acme.ai',
            },
          ],
        },
      },
      buildMeta({ mode: 'live' })
    );
    expect(replaceCampaignMailboxAssignment).toHaveBeenCalledWith({
      campaignId: 'camp-1',
      source: 'outreacher',
      assignments: [
        {
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@acme.ai',
        },
      ],
    });
    expect((writeRes.body as any).campaignId).toBe('camp-1');
  });

  it('routes campaign send preflight', async () => {
    const getCampaignSendPreflight = vi.fn(async (campaignId) => ({
      campaign: {
        id: campaignId,
        name: 'Ready Campaign',
        status: 'ready',
        segment_id: 'seg-1',
        segment_version: 1,
      },
      readyToSend: false,
      blockers: [
        {
          code: 'missing_recipient_email',
          message: 'Some approved drafts are missing a sendable recipient email',
        },
      ],
      summary: {
        mailboxAssignmentCount: 1,
        draftCount: 3,
        approvedDraftCount: 2,
        generatedDraftCount: 0,
        rejectedDraftCount: 1,
        sentDraftCount: 0,
        sendableApprovedDraftCount: 1,
        approvedMissingRecipientEmailCount: 1,
      },
      senderPlan: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['acme.ai'],
      },
    }));

    const res = await dispatch(
      {
        ...deps,
        getCampaignSendPreflight,
      } as any,
      {
        method: 'GET',
        pathname: '/api/campaigns/camp-1/send-preflight',
      },
      buildMeta({ mode: 'live' })
    );

    expect(getCampaignSendPreflight).toHaveBeenCalledWith('camp-1');
    expect((res.body as any).readyToSend).toBe(false);
    expect((res.body as any).blockers[0].code).toBe('missing_recipient_email');
  });

  it('routes campaign send execution', async () => {
    const executeCampaignSend = vi.fn(async ({ campaignId, reason, batchLimit }) => ({
      accepted: true,
      source: 'crew_five-send-execution',
      requestedAt: '2026-03-24T09:00:00.000Z',
      campaignId,
      reason,
      provider: 'imap_mcp',
      selectedCount: 3,
      sentCount: 2,
      failedCount: 1,
      skippedCount: 0,
      results: [],
      batchLimit,
    }));

    const res = await dispatch(
      {
        ...deps,
        executeCampaignSend,
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns/camp-1/send',
        body: {
          reason: 'auto_send_mixed',
          batchLimit: 25,
        },
      },
      buildMeta({ mode: 'live' })
    );

    expect(executeCampaignSend).toHaveBeenCalledWith({
      campaignId: 'camp-1',
      reason: 'auto_send_mixed',
      batchLimit: 25,
    });
    expect((res.body as any).sentCount).toBe(2);
  });

  it('routes campaign next-wave preview and create', async () => {
    const getCampaignNextWavePreview = vi.fn(async (input) => ({
      sourceCampaign: { id: input.sourceCampaignId, name: 'Wave 1' },
      defaults: {
        targetSegmentId: 'seg-1',
        targetSegmentVersion: 1,
        offerId: 'offer-1',
        icpHypothesisId: 'hyp-1',
        sendPolicy: {
          sendTimezone: 'Europe/Moscow',
          sendWindowStartHour: 9,
          sendWindowEndHour: 17,
          sendWeekdaysOnly: true,
        },
        senderPlanSummary: {
          assignmentCount: 1,
          mailboxAccountCount: 1,
          senderIdentityCount: 1,
          domainCount: 1,
          domains: ['acme.ai'],
        },
      },
      summary: {
        candidateContactCount: 5,
        eligibleContactCount: 2,
        blockedContactCount: 3,
      },
      blockedBreakdown: {
        suppressed_contact: 1,
        already_contacted_recently: 1,
        no_sendable_email: 1,
        already_in_target_wave: 0,
        already_used_in_source_wave: 0,
      },
      items: [],
    }));
    const createCampaignNextWave = vi.fn(async (input) => ({
      campaign: {
        id: 'camp-next',
        name: input.name,
        status: 'draft',
      },
      sourceCampaign: { id: input.sourceCampaignId, name: 'Wave 1' },
      defaults: {
        targetSegmentId: 'seg-1',
        targetSegmentVersion: 1,
        offerId: 'offer-1',
        icpHypothesisId: 'hyp-1',
        sendPolicy: {
          sendTimezone: 'Europe/Moscow',
          sendWindowStartHour: 9,
          sendWindowEndHour: 17,
          sendWeekdaysOnly: true,
        },
        senderPlanSummary: {
          assignmentCount: 1,
          mailboxAccountCount: 1,
          senderIdentityCount: 1,
          domainCount: 1,
          domains: ['acme.ai'],
        },
      },
      senderPlan: {
        assignments: [],
        summary: {
          assignmentCount: 0,
          mailboxAccountCount: 0,
          senderIdentityCount: 0,
          domainCount: 0,
          domains: [],
        },
      },
      sendPolicy: {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
      },
      summary: {
        candidateContactCount: 5,
        eligibleContactCount: 2,
        blockedContactCount: 3,
      },
      blockedBreakdown: {
        suppressed_contact: 1,
        already_contacted_recently: 1,
        no_sendable_email: 1,
        already_in_target_wave: 0,
        already_used_in_source_wave: 0,
      },
      items: [],
    }));

    const previewRes = await dispatch(
      {
        ...deps,
        getCampaignNextWavePreview,
        createCampaignNextWave,
      } as any,
      {
        method: 'GET',
        pathname: '/api/campaigns/camp-1/next-wave-preview',
      },
      buildMeta({ mode: 'live' })
    );
    expect(getCampaignNextWavePreview).toHaveBeenCalledWith({
      sourceCampaignId: 'camp-1',
    });
    expect((previewRes.body as any).summary.eligibleContactCount).toBe(2);

    const createRes = await dispatch(
      {
        ...deps,
        getCampaignNextWavePreview,
        createCampaignNextWave,
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns/next-wave',
        body: {
          sourceCampaignId: 'camp-1',
          name: 'Wave 2',
        },
      },
      buildMeta({ mode: 'live' })
    );
    expect(createCampaignNextWave).toHaveBeenCalledWith({
      sourceCampaignId: 'camp-1',
      name: 'Wave 2',
    });
    expect((createRes.body as any).campaign.id).toBe('camp-next');
  });

  it('routes campaign rotation preview', async () => {
    const getCampaignRotationPreview = vi.fn(async (input) => ({
      sourceCampaign: {
        campaignId: input.sourceCampaignId,
        campaignName: 'Wave 1',
        offerId: 'offer-1',
        offerTitle: 'Offer 1',
        icpHypothesisId: 'hyp-1',
        icpHypothesisLabel: 'Hypothesis 1',
        icpProfileId: 'icp-1',
        icpProfileName: 'ICP 1',
      },
      summary: {
        sourceContactCount: 5,
        candidateCount: 2,
        eligibleCandidateContactCount: 3,
        blockedCandidateContactCount: 7,
      },
      candidates: [],
      contacts: [],
    }));

    const res = await dispatch(
      {
        ...deps,
        getCampaignRotationPreview,
      } as any,
      {
        method: 'GET',
        pathname: '/api/campaigns/camp-1/rotation-preview',
      },
      buildMeta({ mode: 'live' })
    );

    expect(getCampaignRotationPreview).toHaveBeenCalledWith({
      sourceCampaignId: 'camp-1',
    });
    expect((res.body as any).summary.candidateCount).toBe(2);
  });

  it('returns 400 for domain rotation preview errors', async () => {
    const error: any = new Error('Campaign rotation preview requires a sent source wave');
    error.code = 'CAMPAIGN_ROTATION_REQUIRES_SENT_SOURCE_WAVE';
    const getCampaignRotationPreview = vi.fn(async () => {
      throw error;
    });

    const res = await dispatch(
      {
        ...deps,
        getCampaignRotationPreview,
      } as any,
      {
        method: 'GET',
        pathname: '/api/campaigns/camp-draft/rotation-preview',
      },
      buildMeta({ mode: 'live' })
    );

    expect(res.status).toBe(400);
    expect((res.body as any).error).toBe('Campaign rotation preview requires a sent source wave');
  });

  it('routes campaign auto-send settings read and update', async () => {
    const getCampaignAutoSendSettings = vi.fn(async (campaignId) => ({
      campaignId,
      campaignName: 'Auto Send Campaign',
      campaignStatus: 'review',
      autoSendIntro: true,
      autoSendBump: false,
      bumpMinDaysSinceIntro: 3,
      updatedAt: '2026-03-21T10:00:00Z',
    }));
    const updateCampaignAutoSendSettings = vi.fn(async (params) => ({
      campaignId: params.campaignId,
      campaignName: 'Auto Send Campaign',
      campaignStatus: 'review',
      autoSendIntro: params.autoSendIntro ?? false,
      autoSendBump: params.autoSendBump ?? false,
      bumpMinDaysSinceIntro: params.bumpMinDaysSinceIntro ?? 3,
      updatedAt: '2026-03-21T10:01:00Z',
    }));

    const readRes = await dispatch(
      {
        ...deps,
        getCampaignAutoSendSettings,
        updateCampaignAutoSendSettings,
      } as any,
      {
        method: 'GET',
        pathname: '/api/campaigns/camp-1/auto-send',
      },
      buildMeta({ mode: 'live' })
    );

    expect(getCampaignAutoSendSettings).toHaveBeenCalledWith('camp-1');
    expect((readRes.body as any).autoSendIntro).toBe(true);

    const writeRes = await dispatch(
      {
        ...deps,
        getCampaignAutoSendSettings,
        updateCampaignAutoSendSettings,
      } as any,
      {
        method: 'PUT',
        pathname: '/api/campaigns/camp-1/auto-send',
        body: {
          autoSendIntro: true,
          autoSendBump: true,
          bumpMinDaysSinceIntro: 5,
        },
      },
      buildMeta({ mode: 'live' })
    );

    expect(updateCampaignAutoSendSettings).toHaveBeenCalledWith({
      campaignId: 'camp-1',
      autoSendIntro: true,
      autoSendBump: true,
      bumpMinDaysSinceIntro: 5,
    });
    expect((writeRes.body as any).autoSendBump).toBe(true);
  });

  it('routes campaign company attach', async () => {
    const attachCompaniesToCampaign = vi.fn(async (params) => ({
      campaignId: params.campaignId,
      summary: {
        requestedCompanyCount: params.companyIds.length,
        attachedCompanyCount: 1,
        alreadyPresentCompanyCount: 0,
        blockedCompanyCount: 0,
        invalidCompanyCount: 0,
        insertedContactCount: 2,
        alreadyPresentContactCount: 0,
      },
      items: [],
    }));

    const res = await dispatch(
      {
        ...deps,
        attachCompaniesToCampaign,
      } as any,
      {
        method: 'POST',
        pathname: '/api/campaigns/camp-1/companies/attach',
        body: {
          companyIds: ['co-1', 'co-2'],
          attachedBy: 'web-ui',
          source: 'import_workspace',
        },
      },
      buildMeta({ mode: 'live' })
    );

    expect(attachCompaniesToCampaign).toHaveBeenCalledWith({
      campaignId: 'camp-1',
      companyIds: ['co-1', 'co-2'],
      attachedBy: 'web-ui',
      source: 'import_workspace',
    });
    expect((res.body as any).summary.requestedCompanyCount).toBe(2);
  });

  it('routes campaign detail read model', async () => {
    const getCampaignReadModel = vi.fn(async (campaignId) => ({
      campaign: {
        id: campaignId,
        name: 'Wave 1',
        status: 'review',
        segment_id: 'seg-1',
        segment_version: 1,
      },
      segment: null,
      icp_profile: null,
      icp_hypothesis: null,
      companies: [
        {
          company_id: 'co-1',
          company_name: 'Acme',
          contact_count: 1,
          enrichment: {
            status: 'fresh',
            last_updated_at: '2026-03-21T12:00:00Z',
            provider_hint: 'exa',
          },
          employees: [
            {
              contact_id: 'contact-1',
              full_name: 'Alice',
              position: 'CEO',
              work_email: 'alice@example.com',
              generic_email: null,
              draft_counts: {
                total: 0,
                intro: 0,
                bump: 0,
                generated: 0,
                approved: 0,
                rejected: 0,
                sent: 0,
              },
              outbound_count: 0,
              sent_count: 0,
              replied: false,
              reply_count: 0,
            },
          ],
        },
      ],
    }));

    const res = await dispatch(
      {
        ...deps,
        getCampaignReadModel,
      } as any,
      {
        method: 'GET',
        pathname: '/api/campaigns/camp-1/detail',
      },
      buildMeta({ mode: 'live' })
    );

    expect(getCampaignReadModel).toHaveBeenCalledWith('camp-1');
    expect((res.body as any).companies[0].employees[0].contact_id).toBe('contact-1');
  });

  it('routes campaign send policy read and update', async () => {
    const getCampaignSendPolicy = vi.fn(async (campaignId) => ({
      campaignId,
      campaignName: 'EMEA Campaign',
      campaignStatus: 'review',
      sendTimezone: 'Europe/Berlin',
      sendWindowStartHour: 8,
      sendWindowEndHour: 16,
      sendWeekdaysOnly: true,
      updatedAt: '2026-03-21T12:00:00Z',
    }));
    const updateCampaignSendPolicy = vi.fn(async (params) => ({
      campaignId: params.campaignId,
      campaignName: 'US Campaign',
      campaignStatus: 'review',
      sendTimezone: params.sendTimezone ?? 'America/New_York',
      sendWindowStartHour: params.sendWindowStartHour ?? 9,
      sendWindowEndHour: params.sendWindowEndHour ?? 17,
      sendWeekdaysOnly: params.sendWeekdaysOnly ?? false,
      updatedAt: '2026-03-21T12:10:00Z',
    }));

    const readRes = await dispatch(
      {
        ...deps,
        getCampaignSendPolicy,
        updateCampaignSendPolicy,
      } as any,
      {
        method: 'GET',
        pathname: '/api/campaigns/camp-1/send-policy',
      },
      buildMeta({ mode: 'live' })
    );

    expect(getCampaignSendPolicy).toHaveBeenCalledWith('camp-1');
    expect((readRes.body as any).sendTimezone).toBe('Europe/Berlin');

    const writeRes = await dispatch(
      {
        ...deps,
        getCampaignSendPolicy,
        updateCampaignSendPolicy,
      } as any,
      {
        method: 'PUT',
        pathname: '/api/campaigns/camp-1/send-policy',
        body: {
          sendTimezone: 'America/New_York',
          sendWindowStartHour: 9,
          sendWindowEndHour: 17,
          sendWeekdaysOnly: false,
        },
      },
      buildMeta({ mode: 'live' })
    );

    expect(updateCampaignSendPolicy).toHaveBeenCalledWith({
      campaignId: 'camp-1',
      sendTimezone: 'America/New_York',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: false,
    });
    expect((writeRes.body as any).sendWeekdaysOnly).toBe(false);
  });

  it('smartlead send defaults to dry-run', async () => {
    const sendSmartlead = vi.fn(async (payload) => ({
      dryRun: payload.dryRun,
      campaignId: payload.campaignId,
      smartleadCampaignId: payload.smartleadCampaignId,
      leadsPrepared: 0,
      leadsPushed: 0,
      sequencesPrepared: 0,
      sequencesSynced: 0,
      skippedContactsNoEmail: 0,
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
      {
        method: 'POST',
        pathname: '/api/smartlead/send',
        body: { batchSize: 20, campaignId: 'camp-1', smartleadCampaignId: 'sl-1' },
      },
      buildMeta({ mode: 'live' })
    );
    expect(sendSmartlead).toHaveBeenCalledWith({
      batchSize: 20,
      dryRun: true,
      campaignId: 'camp-1',
      smartleadCampaignId: 'sl-1',
    });
    expect((res.body as any).dryRun).toBe(true);
  });

  it('routes batch smartlead send across multiple campaigns', async () => {
    const sendSmartlead = vi.fn(async ({ campaignId, smartleadCampaignId, dryRun, batchSize }) => ({
      dryRun,
      campaignId,
      smartleadCampaignId,
      batchSize,
      leadsPrepared: 10,
      leadsPushed: dryRun ? 0 : 10,
      sequencesPrepared: 1,
      sequencesSynced: 1,
      skippedContactsNoEmail: 0,
    }));

    const res = await dispatch(
      {
        listCampaigns: vi.fn(),
        listDrafts: vi.fn(),
        generateDrafts: vi.fn(),
        sendSmartlead,
        listEvents: vi.fn(),
        listReplyPatterns: vi.fn(),
      } as any,
      {
        method: 'POST',
        pathname: '/api/smartlead/send/batch',
        body: {
          items: [
            { campaignId: 'camp-1', smartleadCampaignId: 'sl-1' },
            { campaignId: 'camp-2', smartleadCampaignId: 'sl-2' },
          ],
          batchSize: 25,
          dryRun: false,
        },
      },
      buildMeta({ mode: 'live' })
    );

    expect(res.status).toBe(200);
    expect(sendSmartlead).toHaveBeenCalledTimes(2);
    expect(sendSmartlead).toHaveBeenNthCalledWith(1, {
      campaignId: 'camp-1',
      smartleadCampaignId: 'sl-1',
      batchSize: 25,
      dryRun: false,
      step: undefined,
      variantLabel: undefined,
    });
    expect(sendSmartlead).toHaveBeenNthCalledWith(2, {
      campaignId: 'camp-2',
      smartleadCampaignId: 'sl-2',
      batchSize: 25,
      dryRun: false,
      step: undefined,
      variantLabel: undefined,
    });
    expect((res.body as any).results).toEqual([
      {
        campaignId: 'camp-1',
        smartleadCampaignId: 'sl-1',
        status: 'completed',
        summary: {
          dryRun: false,
          campaignId: 'camp-1',
          smartleadCampaignId: 'sl-1',
          batchSize: 25,
          leadsPrepared: 10,
          leadsPushed: 10,
          sequencesPrepared: 1,
          sequencesSynced: 1,
          skippedContactsNoEmail: 0,
        },
      },
      {
        campaignId: 'camp-2',
        smartleadCampaignId: 'sl-2',
        status: 'completed',
        summary: {
          dryRun: false,
          campaignId: 'camp-2',
          smartleadCampaignId: 'sl-2',
          batchSize: 25,
          leadsPrepared: 10,
          leadsPushed: 10,
          sequencesPrepared: 1,
          sequencesSynced: 1,
          skippedContactsNoEmail: 0,
        },
      },
    ]);
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
      { listCampaigns: vi.fn(), listDrafts: vi.fn(), generateDrafts: vi.fn(), sendSmartlead: stubSendSmartlead(), listEvents: vi.fn(), listReplyPatterns: vi.fn() },
      { method: 'GET', pathname: '/api/meta' },
      meta
    );
    expect((res.body as any).mode).toBe(meta.mode);
    expect((res.body as any).apiBase).toBe('/api');
  });

  it('adds CORS headers for JSON responses', async () => {
    const server = createWebAdapter(deps as any, buildMeta({ mode: 'live' }));
    const response = await invokeServer(server, { method: 'GET', url: '/api/meta' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(String(response.headers['access-control-allow-methods'])).toContain('GET');
  });

  it('handles CORS preflight requests', async () => {
    const server = createWebAdapter(deps as any, buildMeta({ mode: 'live' }));
    const response = await invokeServer(server, { method: 'OPTIONS', url: '/api/meta' });

    expect(response.statusCode).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('*');
    expect(String(response.headers['access-control-allow-headers'])).toContain('content-type');
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
