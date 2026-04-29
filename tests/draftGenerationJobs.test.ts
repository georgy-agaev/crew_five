import { describe, expect, it, vi } from 'vitest';

import {
  findActiveDraftGenerationJob,
  getDraftGenerationJobStatus,
  startDraftGenerationJob,
} from '../src/services/draftGenerationJobs';

function createJobsClient(seed: any[] = [], campaignSeed: any[] = []) {
  const jobs = new Map<string, any>();
  const campaigns = new Map<string, any>();
  let seq = 0;

  for (const row of seed) {
    jobs.set(row.id, row);
  }
  for (const row of campaignSeed) {
    campaigns.set(row.id, row);
  }

  const client = {
    from: vi.fn((table: string) => {
      if (table === 'campaigns') {
        return {
          update: vi.fn((patch: any) => {
            const filters: Record<string, unknown> = {};
            const query = {
              eq(field: string, value: unknown) {
                filters[field] = value;
                return query;
              },
              then(resolve: (value: { data: null; error: null }) => void) {
                for (const [id, row] of campaigns.entries()) {
                  const matches = Object.entries(filters).every(
                    ([filterField, expected]) => row[filterField] === expected
                  );
                  if (matches) {
                    campaigns.set(id, { ...row, ...patch });
                  }
                }
                resolve({ data: null, error: null });
              },
            };
            return query;
          }),
        };
      }
      if (table !== 'jobs') throw new Error(`unexpected table ${table}`);
      return {
        insert: vi.fn((payload: any) => {
          const row = {
            id: `job-${++seq}`,
            type: payload.type,
            status: payload.status,
            segment_id: payload.segment_id ?? null,
            segment_version: payload.segment_version ?? null,
            payload: payload.payload ?? {},
            result: {},
            created_at: '2026-04-28T10:00:00Z',
            updated_at: '2026-04-28T10:00:00Z',
          };
          jobs.set(row.id, row);
          return {
            select: vi.fn(() => ({
              single: vi.fn(async () => ({ data: row, error: null })),
            })),
          };
        }),
        update: vi.fn((patch: any) => ({
          eq: vi.fn((_field: string, id: string) => ({
            select: vi.fn(() => ({
              single: vi.fn(async () => {
                const current = jobs.get(id);
                const updated = { ...current, ...patch };
                jobs.set(id, updated);
                return { data: updated, error: null };
              }),
            })),
          })),
        })),
        select: vi.fn(() => {
          const filters: Record<string, unknown> = {};
          const containsFilters: Record<string, Record<string, unknown>> = {};
          const inFilters: Record<string, unknown[]> = {};
          const query = {
            eq(field: string, value: unknown) {
              filters[field] = value;
              return query;
            },
            in(field: string, values: unknown[]) {
              inFilters[field] = values;
              return query;
            },
            contains(field: string, value: Record<string, unknown>) {
              containsFilters[field] = value;
              return query;
            },
            order() {
              return query;
            },
            limit() {
              return query;
            },
            maybeSingle: vi.fn(async () => {
              const row = Array.from(jobs.values()).find((job) => {
                const eqOk = Object.entries(filters).every(([field, value]) => job[field] === value);
                const inOk = Object.entries(inFilters).every(([field, values]) => values.includes(job[field]));
                const containsOk = Object.entries(containsFilters).every(([field, value]) => {
                  const source = job[field] ?? {};
                  return Object.entries(value).every(([key, expected]) => source[key] === expected);
                });
                return eqOk && inOk && containsOk;
              });
              return { data: row ?? null, error: null };
            }),
          };
          return query;
        }),
      };
    }),
  } as any;

  return { client, jobs, campaigns };
}

describe('draftGenerationJobs', () => {
  const freshTimestamp = () => new Date().toISOString();

  it('starts a draft generation job and completes it in the background', async () => {
    const { client, campaigns } = createJobsClient([], [{ id: 'camp-1', status: 'generating' }]);
    const runGeneration = vi.fn(async () => ({
      generated: 3,
      skipped: 2,
      failed: 0,
      requested_contact_count: 5,
      skipped_by_reason: { already_used: 2 },
      skipped_details: [{ contact_id: 'contact-1', reason: 'already_used' }],
      errors: [],
    }));

    const started = await startDraftGenerationJob(
      client,
      { campaignId: 'camp-1', dryRun: false, limit: 20, draftsModel: 'opus' },
      runGeneration
    );

    expect(started).toEqual({
      jobId: 'job-1',
      status: 'running',
      campaignId: 'camp-1',
      dryRun: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = await getDraftGenerationJobStatus(client, started.jobId);
    expect(runGeneration).toHaveBeenCalledWith(
      {
        campaignId: 'camp-1',
        dryRun: false,
        limit: 20,
        draftsModel: 'opus',
      },
      expect.any(Function)
    );
    expect(status).toMatchObject({
      jobId: 'job-1',
      status: 'completed',
      campaignId: 'camp-1',
      generated: 3,
      skipped: 2,
      failed: 0,
      requestedContactCount: 5,
      totalRecipients: 5,
      lastEvent: 'completed',
      skippedByReason: { already_used: 2 },
    });
    expect(status?.skippedDetails).toHaveLength(1);
    expect(campaigns.get('camp-1')).toMatchObject({ status: 'review' });
  });

  it('updates running job counters from streamed progress events', async () => {
    const { client } = createJobsClient();
    const runGeneration = vi.fn(async (_request, reportProgress) => {
      await reportProgress({
        event: 'started',
        campaign_id: 'camp-1',
        dry_run: false,
        total_companies: 1,
        total_recipients: 3,
      });
      await reportProgress({
        event: 'skipped',
        company_id: 'company-1',
        employee_id: 'contact-1',
        reason: 'already_used',
      });
      await reportProgress({
        event: 'draft_created',
        draft_id: 'draft-1',
        company_id: 'company-1',
        employee_id: 'contact-2',
        subject: 'Hello',
      });
      return {
        generated: 1,
        skipped: 1,
        failed: 0,
        requested_contact_count: 3,
        skipped_by_reason: { already_used: 1 },
        errors: [],
      };
    });

    const started = await startDraftGenerationJob(
      client,
      { campaignId: 'camp-1', dryRun: false },
      runGeneration
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = await getDraftGenerationJobStatus(client, started.jobId);
    expect(status).toMatchObject({
      status: 'completed',
      generated: 1,
      skipped: 1,
      failed: 0,
      requestedContactCount: 3,
      totalRecipients: 3,
      skippedByReason: { already_used: 1 },
    });
    expect(status?.result.progress_events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'started' }),
        expect.objectContaining({ event: 'skipped', reason: 'already_used' }),
        expect.objectContaining({ event: 'draft_created', draft_id: 'draft-1' }),
      ])
    );
  });

  it('returns the active campaign job instead of starting a duplicate', async () => {
    const { client } = createJobsClient([
      {
        id: 'job-existing',
        type: 'draft_generation',
        status: 'running',
        segment_id: null,
        segment_version: null,
        payload: { campaignId: 'camp-1', dryRun: true },
        result: { generated: 1, failed: 0, skipped: 0 },
        created_at: freshTimestamp(),
        updated_at: freshTimestamp(),
      },
    ]);
    const runGeneration = vi.fn(async () => ({ generated: 1 }));

    const started = await startDraftGenerationJob(
      client,
      { campaignId: 'camp-1', dryRun: false },
      runGeneration
    );

    expect(started).toEqual({
      jobId: 'job-existing',
      status: 'running',
      campaignId: 'camp-1',
      dryRun: true,
    });
    expect(runGeneration).not.toHaveBeenCalled();
  });

  it('records a failed job when the generator throws', async () => {
    const { client } = createJobsClient();
    const runGeneration = vi.fn(async () => {
      throw new Error('Outreach bridge not configured');
    });

    const started = await startDraftGenerationJob(
      client,
      { campaignId: 'camp-1', dryRun: false },
      runGeneration
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = await getDraftGenerationJobStatus(client, started.jobId);
    expect(status).toMatchObject({
      status: 'failed',
      generated: 0,
      failed: 1,
      skipped: 0,
      lastEvent: 'failed',
      errors: ['Outreach bridge not configured'],
    });
  });

  it('preserves streamed counters when a post-generation assertion fails', async () => {
    const { client } = createJobsClient();
    const runGeneration = vi.fn(async (_request, reportProgress) => {
      await reportProgress({
        event: 'started',
        campaign_id: 'camp-1',
        dry_run: false,
        total_recipients: 5,
      });
      await reportProgress({
        event: 'draft_created',
        draft_id: 'draft-1',
        company_id: 'company-1',
        employee_id: 'contact-1',
      });
      await reportProgress({
        event: 'skipped',
        company_id: 'company-1',
        employee_id: 'contact-2',
        reason: 'not_targeted_by_strategy',
      });
      await reportProgress({
        event: 'failed',
        company_id: 'company-1',
        employee_id: 'contact-3',
        error: 'LLM did not return a draft for this recipient',
      });
      throw new Error('Draft generation safety assertion failed: Outreach generated 1 unsafe intro draft(s)');
    });

    const started = await startDraftGenerationJob(
      client,
      { campaignId: 'camp-1', dryRun: false },
      runGeneration
    );
    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = await getDraftGenerationJobStatus(client, started.jobId);
    expect(status).toMatchObject({
      status: 'failed',
      generated: 1,
      skipped: 1,
      failed: 1,
      requestedContactCount: 5,
      totalRecipients: 5,
      lastEvent: 'failed',
    });
    expect(status?.errors).toEqual([
      'LLM did not return a draft for this recipient',
      'Draft generation safety assertion failed: Outreach generated 1 unsafe intro draft(s)',
    ]);
  });

  it('finds the active draft generation job for UI recovery', async () => {
    const { client } = createJobsClient([
      {
        id: 'job-active',
        type: 'draft_generation',
        status: 'running',
        segment_id: null,
        segment_version: null,
        payload: { campaignId: 'camp-1', dryRun: false },
        result: { generated: 2, failed: 0, skipped: 1, lastEvent: 'draft_created' },
        created_at: freshTimestamp(),
        updated_at: freshTimestamp(),
      },
    ]);

    const active = await findActiveDraftGenerationJob(client, 'camp-1');

    expect(active).toMatchObject({
      jobId: 'job-active',
      status: 'running',
      campaignId: 'camp-1',
      generated: 2,
      skipped: 1,
      lastEvent: 'draft_created',
    });
  });

  it('marks stale active campaign jobs failed and returns no active job', async () => {
    const { client, jobs, campaigns } = createJobsClient(
      [
        {
          id: 'job-stale',
          type: 'draft_generation',
          status: 'running',
          segment_id: null,
          segment_version: null,
          payload: { campaignId: 'camp-1', dryRun: false },
          result: {
            generated: 2,
            failed: 0,
            skipped: 3,
            errors: [],
            lastEvent: 'recipient_started',
          },
          created_at: '2000-01-01T00:00:00Z',
          updated_at: '2000-01-01T00:00:00Z',
        },
      ],
      [{ id: 'camp-1', status: 'generating' }]
    );

    const active = await findActiveDraftGenerationJob(client, 'camp-1');
    const stale = jobs.get('job-stale');

    expect(active).toBeNull();
    expect(stale).toMatchObject({
      status: 'failed',
      result: {
        generated: 2,
        skipped: 3,
        failed: 1,
        error_code: 'draft_generation_stale_timeout',
        lastEvent: 'failed',
      },
    });
    expect(stale.result.errors[0]).toContain('did not receive progress');
    expect(campaigns.get('camp-1')).toMatchObject({ status: 'review' });
  });

  it('returns a failed status view when polling a stale job', async () => {
    const { client } = createJobsClient([
      {
        id: 'job-stale',
        type: 'draft_generation',
        status: 'running',
        segment_id: null,
        segment_version: null,
        payload: { campaignId: 'camp-1', dryRun: false },
        result: { generated: 4, failed: 0, skipped: 5, errors: [] },
        created_at: '2000-01-01T00:00:00Z',
        updated_at: '2000-01-01T00:00:00Z',
      },
    ]);

    const status = await getDraftGenerationJobStatus(client, 'job-stale');

    expect(status).toMatchObject({
      jobId: 'job-stale',
      status: 'failed',
      campaignId: 'camp-1',
      generated: 4,
      skipped: 5,
      failed: 1,
      lastEvent: 'failed',
    });
    expect(status?.result.error_code).toBe('draft_generation_stale_timeout');
  });

  it('does not let a stale campaign job block a new start', async () => {
    const { client, jobs } = createJobsClient([
      {
        id: 'job-stale',
        type: 'draft_generation',
        status: 'running',
        segment_id: null,
        segment_version: null,
        payload: { campaignId: 'camp-1', dryRun: true },
        result: { generated: 0, failed: 0, skipped: 10, errors: [] },
        created_at: '2000-01-01T00:00:00Z',
        updated_at: '2000-01-01T00:00:00Z',
      },
    ]);
    const runGeneration = vi.fn(async () => ({
      generated: 1,
      skipped: 0,
      failed: 0,
      requested_contact_count: 1,
      errors: [],
    }));

    const started = await startDraftGenerationJob(
      client,
      { campaignId: 'camp-1', dryRun: false, contactIds: ['contact-1'] },
      runGeneration
    );

    expect(started).toMatchObject({
      jobId: 'job-1',
      status: 'running',
      campaignId: 'camp-1',
      dryRun: false,
    });
    expect(jobs.get('job-stale')).toMatchObject({
      status: 'failed',
      result: { error_code: 'draft_generation_stale_timeout' },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(runGeneration).toHaveBeenCalledTimes(1);
  });
});
