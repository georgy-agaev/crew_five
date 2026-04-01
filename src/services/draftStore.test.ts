import { describe, expect, it, vi } from 'vitest';

import { updateDraftStatuses } from './draftStore.js';

describe('updateDraftStatuses', () => {
  it('merges shared metadata into each draft and returns batch summary', async () => {
    const draftRows = {
      'draft-1': {
        id: 'draft-1',
        status: 'approved',
        reviewer: 'outreacher',
        metadata: { review_surface: 'builder-v2', reason: 'ready_to_send' },
        contact: {
          id: 'contact-1',
          full_name: 'Ivan Petrov',
          position: 'CEO',
          work_email: 'ivan@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
          company_name: 'Acme',
        },
        company: {
          id: 'company-1',
          company_name: 'Acme',
          website: 'https://acme.test',
        },
      },
      'draft-2': {
        id: 'draft-2',
        status: 'approved',
        reviewer: 'outreacher',
        metadata: { review_surface: 'builder-v2', existing: true, reason: 'ready_to_send' },
        contact: {
          id: 'contact-2',
          full_name: 'Anna Smirnova',
          position: 'COO',
          work_email: 'anna@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
          company_name: 'Beta',
        },
        company: {
          id: 'company-2',
          company_name: 'Beta',
          website: 'https://beta.test',
        },
      },
    } as const;
    const selectCounts = new Map<string, number>();
    const updateSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { id: 'draft-1', status: 'approved', reviewer: 'outreacher', metadata: { review_surface: 'builder-v2', reason: 'ready_to_send' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { id: 'draft-2', status: 'approved', reviewer: 'outreacher', metadata: { review_surface: 'builder-v2', existing: true, reason: 'ready_to_send' } },
        error: null,
      });
    const client = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn((_field: string, draftId: string) => ({
            single: vi.fn().mockImplementation(async () => {
              const count = selectCounts.get(draftId) ?? 0;
              selectCounts.set(draftId, count + 1);
              if (draftId === 'draft-1' && count === 0) {
                return { data: { metadata: { review_surface: 'builder-v2' } }, error: null };
              }
              if (draftId === 'draft-2' && count === 0) {
                return {
                  data: { metadata: { review_surface: 'builder-v2', existing: true } },
                  error: null,
                };
              }
              return {
                data: draftRows[draftId as keyof typeof draftRows] ?? null,
                error: null,
              };
            }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            select: vi.fn(() => ({
              single: updateSingle,
            })),
          })),
        })),
      })),
    } as any;

    const result: any = await updateDraftStatuses(client, {
      draftIds: ['draft-1', 'draft-2'],
      status: 'approved',
      reviewer: 'outreacher',
      metadata: { reason: 'ready_to_send' },
    });

    expect(result.summary).toEqual({
      totalRequested: 2,
      updatedCount: 2,
      status: 'approved',
    });
    expect(result.updated).toHaveLength(2);
    expect(result.updated[1].metadata).toEqual({
      review_surface: 'builder-v2',
      existing: true,
      reason: 'ready_to_send',
    });
  });
});
