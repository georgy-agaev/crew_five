import { afterEach, describe, expect, it, vi } from 'vitest';

import { enrichCommand } from '../src/commands/enrich';
import { enqueueSegmentEnrichment, runSegmentEnrichmentOnce } from '../src/services/enrichSegment';
import { getEnrichmentAdapter } from '../src/services/enrichment/registry';
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
});
