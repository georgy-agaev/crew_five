import { describe, expect, it, vi } from 'vitest';

import {
  getCompanyImportProcessStatus,
  startCompanyImportProcess,
} from './companyImportProcessing.js';

function createClient(existingCompanyIds: string[]) {
  const jobs = new Map<string, any>();
  let jobSeq = 0;

  return {
    jobs,
    client: {
      from: vi.fn((table: string) => {
        if (table === 'companies') {
          return {
            select: vi.fn(() => ({
              in: vi.fn(async (_field: string, ids: string[]) => ({
                data: ids.filter((id) => existingCompanyIds.includes(id)).map((id) => ({ id })),
                error: null,
              })),
            })),
          };
        }

        if (table === 'jobs') {
          return {
            insert: vi.fn((payload: any) => {
              const id = `job-${++jobSeq}`;
              const row = {
                id,
                type: payload.type,
                status: payload.status,
                segment_id: payload.segment_id ?? null,
                segment_version: payload.segment_version ?? null,
                payload: payload.payload ?? {},
                result: {},
                created_at: '2026-03-19T00:00:00Z',
                updated_at: '2026-03-19T00:00:00Z',
              };
              jobs.set(id, row);
              return {
                select: vi.fn(() => ({
                  single: vi.fn(async () => ({ data: row, error: null })),
                })),
              };
            }),
            update: vi.fn((patch: any) => ({
              eq: vi.fn((field: string, id: string) => ({
                select: vi.fn(() => ({
                  single: vi.fn(async () => {
                    const current = jobs.get(id);
                    const updated = {
                      ...current,
                      ...patch,
                      [field]: id,
                    };
                    jobs.set(id, updated);
                    return { data: updated, error: null };
                  }),
                })),
              })),
            })),
            select: vi.fn(() => {
              const filters: Record<string, string> = {};
              const query = {
                eq(field: string, value: string) {
                  filters[field] = value;
                  return query;
                },
                maybeSingle: vi.fn(async () => {
                  const row = Array.from(jobs.values()).find(
                    (job) =>
                      (!filters.id || job.id === filters.id) &&
                      (!filters.type || job.type === filters.type)
                  );
                  return { data: row ?? null, error: null };
                }),
              };
              return query;
            }),
          };
        }

        throw new Error(`unexpected table ${table}`);
      }),
    } as any,
  };
}

describe('companyImportProcessing', () => {
  it('starts async processing jobs and chunks companies by recommended batch size', async () => {
    const companyIds = Array.from({ length: 11 }, (_, index) => `co-${index + 1}`);
    const { client } = createClient(companyIds);
    const trigger = vi
      .fn()
      .mockResolvedValueOnce({
        accepted: true,
        total: 10,
        completed: 10,
        failed: 0,
        skipped: 0,
        results: companyIds.slice(0, 10).map((companyId) => ({ companyId, status: 'completed' as const })),
        errors: [],
      })
      .mockResolvedValueOnce({
        accepted: true,
        total: 1,
        completed: 0,
        failed: 0,
        skipped: 1,
        results: [{ companyId: 'co-11', status: 'skipped' as const, note: 'no website' }],
        errors: [],
      });

    const start = await startCompanyImportProcess(
      client,
      { companyIds, mode: 'full', source: 'xlsx-import' },
      trigger
    );

    expect(start.status).toBe('created');
    expect(start.batchSize).toBe(10);

    await new Promise((resolve) => setTimeout(resolve, 0));

    const status = await getCompanyImportProcessStatus(client, start.jobId);
    expect(trigger).toHaveBeenCalledTimes(2);
    expect(trigger).toHaveBeenNthCalledWith(1, {
      companyIds: companyIds.slice(0, 10),
      mode: 'full',
      source: 'xlsx-import',
    });
    expect(trigger).toHaveBeenNthCalledWith(2, {
      companyIds: ['co-11'],
      mode: 'full',
      source: 'xlsx-import',
    });
    expect(status?.status).toBe('completed');
    expect(status?.processedCompanies).toBe(11);
    expect(status?.completedCompanies).toBe(10);
    expect(status?.skippedCompanies).toBe(1);
  });

  it('rejects unknown company ids before creating a job', async () => {
    const { client, jobs } = createClient(['co-1']);

    await expect(
      startCompanyImportProcess(client, { companyIds: ['co-1', 'co-2'] }, vi.fn())
    ).rejects.toThrow('Unknown companyIds: co-2');

    expect(jobs.size).toBe(0);
  });
});
