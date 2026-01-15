import { afterEach, describe, expect, it, vi } from 'vitest';

import { enrichCommand } from '../src/commands/enrich';
import { enqueueSegmentEnrichment, runSegmentEnrichmentOnce } from '../src/services/enrichSegment';
import { createEnrichmentProviderRegistry, getEnrichmentAdapter } from '../src/services/enrichment/registry';
import * as exaIntegration from '../src/integrations/exa';
import * as firecrawlIntegration from '../src/integrations/firecrawl';
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

  it('enrich_run_with_parallel_provider_uses_parallel_adapter', async () => {
    process.env.PARALLEL_API_KEY = 'test-parallel-key';
    const ensureSpy = vi
      .spyOn(snapshotWorkflow, 'ensureFinalSegmentSnapshot')
      .mockResolvedValue({ version: 1, count: 3 });
    const enqueueSpy = vi.spyOn(enrichSegmentSvc, 'enqueueSegmentEnrichment').mockResolvedValue({
      id: 'job-3',
      type: 'enrich',
      status: 'created',
      segment_id: 'seg-3',
      segment_version: 1,
      payload: { adapter: 'parallel', member_contact_ids: [], member_company_ids: ['co1'] },
      result: null,
      created_at: '',
      updated_at: '',
    } as any);
    const runSpy = vi.spyOn(enrichSegmentSvc, 'runSegmentEnrichmentOnce').mockResolvedValue({
      jobId: 'job-3',
      processed: 1,
      skipped: 0,
      failed: 0,
      dryRun: false,
    });
    const client = { from: vi.fn() } as any;

    const queued = await enrichCommand(client, {
      segmentId: 'seg-3',
      provider: 'parallel',
      dryRun: false,
    });

    expect(ensureSpy).toHaveBeenCalledWith(client, 'seg-3');
    expect(enqueueSpy).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ segmentId: 'seg-3', adapter: 'parallel' })
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
    const selectCompanies = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
    });
    const selectEmployees = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
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
      if (table === 'companies') return { select: selectCompanies, update: updateCompanies };
      if (table === 'employees') return { select: selectEmployees, update: updateEmployees };
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
    expect(updateCompanies).toHaveBeenCalledWith(
      expect.objectContaining({
        company_research: expect.objectContaining({
          version: 1,
          providers: expect.objectContaining({
            mock: expect.anything(),
          }),
          lastUpdatedAt: expect.any(String),
        }),
      })
    );
    expect(updateEmployees).toHaveBeenCalledWith(
      expect.objectContaining({
        ai_research_data: expect.objectContaining({
          version: 1,
          providers: expect.objectContaining({
            mock: expect.anything(),
          }),
          lastUpdatedAt: expect.any(String),
        }),
      })
    );
    expect(updateJob).toHaveBeenCalled();
    expect(updateJob).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'completed',
        result: expect.objectContaining({
          provider: 'mock',
          counts: expect.any(Object),
          sampledErrors: expect.any(Object),
        }),
      })
    );
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

  it('get_enrichment_adapter_returns_firecrawl_and_uses_company_website', async () => {
    const companyRow = { company_name: 'Acme Corp', website: 'acme.example', region: 'US' };

    const selectCompanies = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        maybeSingle: vi.fn().mockResolvedValue({ data: companyRow, error: null }),
      }),
    });

    const mockSupabase = { from: vi.fn(() => ({ select: selectCompanies })) } as any;

    const search = vi.fn().mockResolvedValue([
      { url: 'https://acme.example/about', title: 'About', description: 'About Acme' },
      { url: 'https://acme.example/services', title: 'Services', description: 'Services list' },
    ]);
    const scrape = vi.fn().mockResolvedValue({
      url: 'https://acme.example',
      title: 'Acme',
      description: 'Acme desc',
      markdown: '# Acme\\nWe do things',
    });

    vi.spyOn(firecrawlIntegration, 'buildFirecrawlClientFromEnv').mockReturnValue({ search, scrape } as any);

    const adapter = getEnrichmentAdapter('firecrawl', mockSupabase);
    const result = await adapter.fetchCompanyInsights({ company_id: 'company-1' });

    expect(result.provider).toBe('firecrawl');
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.stringContaining('site:acme.example'),
      })
    );
    const scrapedOrigins = scrape.mock.calls.map(([args]) => new URL((args as any).url).origin);
    expect(scrapedOrigins).toContain('https://acme.example');
    expect(result.sources?.length).toBeGreaterThan(0);
    expect(String(result.summary ?? '')).toMatch(/Acme/i);
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
    const selectCompany = vi.fn((columns: string) => {
      if (columns.includes('id, company_research')) {
        return {
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              company_name: 'Acme Corp',
              website: 'https://acme.example',
              region: 'US',
            },
          }),
        }),
      };
    });
    const updateCompanies = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    const selectEmployees = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [], error: null }),
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
      if (table === 'employees') return { select: selectEmployees, update: updateEmployees };
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
          version: 1,
          providers: expect.objectContaining({
            exa: expect.objectContaining({
              provider: 'exa',
              entity: 'company',
              company_id: 'co1',
              summary: 'Company summary',
            }),
          }),
        }),
      })
    );
    expect(summary.processed).toBe(1);
  });

  it('exa_enrichment_adapter_updates_employee_ai_research_data', async () => {
    const selectEmployee = vi.fn((columns: string) => {
      if (columns.includes('id, ai_research_data')) {
        return {
          in: vi.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      return {
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
      };
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
      if (table === 'companies') return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }), update: updateCompanies };
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
          version: 1,
          providers: expect.objectContaining({
            exa: expect.objectContaining({
              provider: 'exa',
              entity: 'employee',
              contact_id: 'contact-1',
              summary: 'Contact summary',
            }),
          }),
        }),
      })
    );
    expect(summary.processed).toBe(1);
  });

  it('resolve_enrichment_adapter_throws_for_unknown_provider', () => {
    const supabase = { from: vi.fn() } as any;
    const registry = createEnrichmentProviderRegistry(supabase);
    try {
      registry.getAdapter('unknown-provider');
      throw new Error('Expected getAdapter to throw');
    } catch (err: any) {
      expect(err.message).toMatch(/Unknown enrichment provider/);
      expect(err.code).toBe('ENRICHMENT_PROVIDER_UNKNOWN');
    }
  });
});
