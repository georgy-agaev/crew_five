import { describe, expect, it, vi } from 'vitest';

import { updateDraftStatuses } from './draftStore.js';

describe('updateDraftStatuses', () => {
  it('merges shared metadata into each draft and returns batch summary', async () => {
    const selectSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { metadata: { review_surface: 'builder-v2' } }, error: null })
      .mockResolvedValueOnce({ data: { metadata: { review_surface: 'builder-v2', existing: true } }, error: null });
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
          eq: vi.fn(() => ({
            single: selectSingle,
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

    const result = await updateDraftStatuses(client, {
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
