import { afterEach, describe, expect, it, vi } from 'vitest';

import { enrichCommand } from '../src/commands/enrich';
import { enqueueSegmentEnrichment, runSegmentEnrichmentOnce } from '../src/services/enrichSegment';
import { createEnrichmentProviderRegistry, getEnrichmentAdapter } from '../src/services/enrichment/registry';
import * as exaIntegration from '../src/integrations/exa';
import * as enrichSegmentSvc from '../src/services/enrichSegment';
import * as snapshotWorkflow from '../src/services/segmentSnapshotWorkflow';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('enrichment', () => {
  it('enqueues enrichment and optionally runs now', async () => {
    const ensureSpy = vi
      .spyOn(snapshotWorkflow, 'ensureFinalSegmentSnapshot')
      .mockResolvedValue({ version: 1, count: 3 });
    const enqueueSpy = vi.spyOn(enrichSegmentSvc, 'enqueueSegmentEnrichment').mockResolvedValue({
      id: 'job-1',
      type: 'enrich',
      status: 'created',
      segment_id: 'seg-1',
      segment_version: 1,
      payload: { adapter: 'mock', member_contact_ids: ['c1'], member_company_ids: ['co1'] },
      result: null,
      created_at: '',
      updated_at: '',
    } as any);
    const runSpy = vi.spyOn(enrichSegmentSvc, 'runSegmentEnrichmentOnce').mockResolvedValue({
      jobId: 'job-1',
      processed: 1,
      skipped: 0,
      failed: 0,
      dryRun: false,
    });
    const client = { from: vi.fn() } as any;

    const queued = await enrichCommand(client, { segmentId: 'seg-1', adapter: 'mock', dryRun: false });
    expect(ensureSpy).toHaveBeenCalledWith(client, 'seg-1');
    expect(enqueueSpy).toHaveBeenCalledWith(client, expect.objectContaining({ segmentId: 'seg-1', adapter: 'mock' }));
    expect(runSpy).not.toHaveBeenCalled();
    expect(queued.status).toBe('queued');
    expect(queued.jobId).toBe('job-1');

    const runNow = await enrichCommand(client, {
      segmentId: 'seg-1',
      adapter: 'mock',
      dryRun: false,
      runNow: true,
    });
    expect(runSpy).toHaveBeenCalledWith(client, expect.objectContaining({ id: 'job-1' }), { dryRun: false });
    expect(runNow.status).toBe('completed');
    expect(runNow.summary?.processed).toBe(1);
  });

  it('enrich_run_with_exa_adapter_uses_async_job_flow', async () => {
    const ensureSpy = vi
      .spyOn(snapshotWorkflow, 'ensureFinalSegmentSnapshot')
      .mockResolvedValue({ version: 1, count: 3 });
    const enqueueSpy = vi.spyOn(enrichSegmentSvc, 'enqueueSegmentEnrichment').mockResolvedValue({
      id: 'job-2',
      type: 'enrich',
      status: 'created',
      segment_id: 'seg-2',
      segment_version: 1,
      payload: { adapter: 'exa', member_contact_ids: ['c1'], member_company_ids: ['co1'] },
      result: null,
      created_at: '',
      updated_at: '',
    } as any);
    const runSpy = vi.spyOn(enrichSegmentSvc, 'runSegmentEnrichmentOnce').mockResolvedValue({
      jobId: 'job-2',
      processed: 1,
      skipped: 0,
      failed: 0,
      dryRun: false,
    });
    process.env.EXA_API_KEY = 'test-key';
    const client = { from: vi.fn() } as any;

    const queued = await enrichCommand(client, { segmentId: 'seg-2', adapter: 'exa', dryRun: false });

    expect(ensureSpy).toHaveBeenCalledWith(client, 'seg-2');
    expect(enqueueSpy).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ segmentId: 'seg-2', adapter: 'exa' })
    );
    expect(runSpy).not.toHaveBeenCalled();
    expect(queued.status).toBe('queued');
    expect(queued.mode).toBe('async');
  });

  it('enqueue_segment_enrichment_creates_enrich_job_with_targets', async () => {
    const selectMembers = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ contact_id: 'c1', company_id: 'co1' }],
            error: null,
          }),
        }),
      }),
    });
    const insertJob = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: {
            id: 'job-1',
            type: 'enrich',
            status: 'created',
            segment_id: 'seg-1',
            segment_version: 1,
            payload: {},
            result: null,
            created_at: '',
            updated_at: '',
          },
          error: null,
        }),
      }),
    });
    const selectSegment = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: { id: 'seg-1', version: 1 },
          error: null,
        }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'segments') return { select: selectSegment };
      if (table === 'segment_members') return { select: selectMembers };
      if (table === 'jobs') return { insert: insertJob };
      return { select: vi.fn(), insert: vi.fn() };
    });

    const client = { from } as any;

    const job = await enqueueSegmentEnrichment(client, {
      segmentId: 'seg-1',
      adapter: 'mock',
      limit: 10,
    });

    expect(from).toHaveBeenCalledWith('segment_members');
    expect(from).toHaveBeenCalledWith('jobs');
    expect(job.id).toBe('job-1');
  });

  it('run_segment_enrichment_writes_research_to_companies_and_employees', async () => {
    const updateCompanies = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const updateEmployees = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const updateJob = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'job-1',
              type: 'enrich',
              status: 'completed',
              segment_id: 'seg-1',
              segment_version: 1,
              payload: {},
              result: { processed: 2 },
              created_at: '',
              updated_at: '',
            },
            error: null,
          }),
        }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'companies') return { update: updateCompanies };
      if (table === 'employees') return { update: updateEmployees };
      if (table === 'jobs') return { update: updateJob };
      return { update: vi.fn(), from: vi.fn() };
    });

    const client = { from } as any;

    const adapter = getEnrichmentAdapter('mock');
    const companySpy = vi.spyOn(adapter, 'fetchCompanyInsights');
    const employeeSpy = vi.spyOn(adapter, 'fetchEmployeeInsights');

    const summary = await runSegmentEnrichmentOnce(
      client,
      {
        id: 'job-1',
        type: 'enrich',
        status: 'created',
        segment_id: 'seg-1',
        segment_version: 1,
        payload: {
          adapter: 'mock',
          member_contact_ids: ['c1'],
          member_company_ids: ['co1'],
        },
        result: null,
        created_at: '',
        updated_at: '',
      } as any,
      { dryRun: false }
    );

    expect(companySpy).toHaveBeenCalled();
    expect(employeeSpy).toHaveBeenCalled();
    expect(updateCompanies).toHaveBeenCalled();
    expect(updateEmployees).toHaveBeenCalled();
    expect(updateJob).toHaveBeenCalled();
    expect(summary.processed).toBeGreaterThan(0);
  });

  it('get_enrichment_adapter_returns_exa_when_requested', async () => {
    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            company_name: 'Acme Corp',
            website: 'https://acme.example',
            region: 'US',
            full_name: 'Jane Doe',
            position: 'CTO',
            company_id: 'company-1',
          },
        }),
      }),
    });
    const mockSupabase = {
      from: vi.fn(() => ({ select })),
    } as any;
    const mockResearchClient = {
      researchCompany: vi.fn().mockResolvedValue({ summary: 'Company summary', sources: [] }),
      researchContact: vi.fn().mockResolvedValue({ summary: 'Contact summary', sources: [] }),
    };
    vi.spyOn(exaIntegration, 'buildExaResearchClientFromEnv').mockReturnValue(mockResearchClient as any);

    const adapter = getEnrichmentAdapter('exa', mockSupabase);
    const companyResult = await adapter.fetchCompanyInsights({ company_id: 'company-1' });
    await adapter.fetchEmployeeInsights({ contact_id: 'contact-1' });

    expect(companyResult.summary).toBe('Company summary');
    expect(mockResearchClient.researchCompany).toHaveBeenCalled();
    expect(mockResearchClient.researchContact).toHaveBeenCalled();
  });
  it('enrichment_provider_registry_registers_exa_parallel_firecrawl_anysite', () => {
    process.env.EXA_API_KEY = 'test-key';
    process.env.PARALLEL_API_KEY = 'test-parallel';
    process.env.FIRECRAWL_API_KEY = 'test-firecrawl';
    process.env.ANYSITE_API_KEY = 'test-anysite';
    const supabase = { from: vi.fn() } as any;
    const registry = createEnrichmentProviderRegistry(supabase);
    expect(() => registry.getAdapter('exa')).not.toThrow();
    expect(() => registry.getAdapter('parallel')).not.toThrow();
    expect(() => registry.getAdapter('firecrawl')).not.toThrow();
    expect(() => registry.getAdapter('anysite')).not.toThrow();
  });

  it('exa_enrichment_adapter_updates_company_research', async () => {
    const selectCompany = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            company_name: 'Acme Corp',
            website: 'https://acme.example',
            region: 'US',
          },
        }),
      }),
    });
    const updateCompanies = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const updateEmployees = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const updateJob = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'job-1',
              type: 'enrich',
              status: 'completed',
              segment_id: 'seg-1',
              segment_version: 1,
              payload: {},
              result: { processed: 1 },
              created_at: '',
              updated_at: '',
            },
            error: null,
          }),
        }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'companies') return { select: selectCompany, update: updateCompanies };
      if (table === 'employees') return { update: updateEmployees };
      if (table === 'jobs') return { update: updateJob };
      return { select: vi.fn(), update: vi.fn() };
    });

    const client = { from } as any;

    const mockResearchClient = {
      researchCompany: vi.fn().mockResolvedValue({
        summary: 'Company summary',
        sources: [{ url: 'https://acme.example', title: 'Acme' }],
      }),
      researchContact: vi.fn().mockResolvedValue({
        summary: 'Contact summary',
        sources: [],
      }),
    };
    vi.spyOn(exaIntegration, 'buildExaResearchClientFromEnv').mockReturnValue(mockResearchClient as any);

    const summary = await runSegmentEnrichmentOnce(
      client,
      {
        id: 'job-1',
        type: 'enrich',
        status: 'created',
        segment_id: 'seg-1',
        segment_version: 1,
        payload: {
          adapter: 'exa',
          member_contact_ids: [],
          member_company_ids: ['co1'],
        },
        result: null,
        created_at: '',
        updated_at: '',
      } as any,
      { dryRun: false }
    );

    expect(selectCompany).toHaveBeenCalled();
    expect(mockResearchClient.researchCompany).toHaveBeenCalledWith({
      companyName: 'Acme Corp',
      website: 'https://acme.example',
      country: 'US',
    });
    expect(updateCompanies).toHaveBeenCalledWith(
      expect.objectContaining({
        company_research: expect.objectContaining({
          provider: 'exa',
          entity: 'company',
          company_id: 'co1',
          summary: 'Company summary',
        }),
      })
    );
    expect(summary.processed).toBe(1);
  });

  it('exa_enrichment_adapter_updates_employee_ai_research_data', async () => {
    const selectEmployee = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({
          data: {
            id: 'contact-1',
            full_name: 'Jane Doe',
            position: 'CTO',
            company_id: 'co1',
            company_name: 'Acme Corp',
          },
        }),
      }),
    });
    const updateCompanies = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const updateEmployees = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const updateJob = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: {
              id: 'job-1',
              type: 'enrich',
              status: 'completed',
              segment_id: 'seg-1',
              segment_version: 1,
              payload: {},
              result: { processed: 1 },
              created_at: '',
              updated_at: '',
            },
            error: null,
          }),
        }),
      }),
    });

    const from = vi.fn((table: string) => {
      if (table === 'employees') return { select: selectEmployee, update: updateEmployees };
      if (table === 'companies') return { update: updateCompanies };
      if (table === 'jobs') return { update: updateJob };
      return { select: vi.fn(), update: vi.fn() };
    });

    const client = { from } as any;

    const mockResearchClient = {
      researchCompany: vi.fn().mockResolvedValue({
        summary: 'Company summary',
        sources: [{ url: 'https://acme.example', title: 'Acme' }],
      }),
      researchContact: vi.fn().mockResolvedValue({
        summary: 'Contact summary',
        sources: [],
      }),
    };
    vi.spyOn(exaIntegration, 'buildExaResearchClientFromEnv').mockReturnValue(mockResearchClient as any);

    const summary = await runSegmentEnrichmentOnce(
      client,
      {
        id: 'job-1',
        type: 'enrich',
        status: 'created',
        segment_id: 'seg-1',
        segment_version: 1,
        payload: {
          adapter: 'exa',
          member_contact_ids: ['contact-1'],
          member_company_ids: [],
        },
        result: null,
        created_at: '',
        updated_at: '',
      } as any,
      { dryRun: false }
    );

    expect(selectEmployee).toHaveBeenCalled();
    expect(mockResearchClient.researchContact).toHaveBeenCalledWith({
      fullName: 'Jane Doe',
      role: 'CTO',
      companyName: 'Acme Corp',
      website: null,
      linkedinUrl: null,
    });
    expect(updateEmployees).toHaveBeenCalledWith(
      expect.objectContaining({
        ai_research_data: expect.objectContaining({
          provider: 'exa',
          entity: 'employee',
          contact_id: 'contact-1',
          summary: 'Contact summary',
        }),
      })
    );
    expect(summary.processed).toBe(1);
  });

  it('resolve_enrichment_adapter_throws_for_unknown_provider', () => {
    const supabase = { from: vi.fn() } as any;
    const registry = createEnrichmentProviderRegistry(supabase);
    expect(() => registry.getAdapter('unknown-provider')).toThrow(/Unknown enrichment provider/);
  });
});
