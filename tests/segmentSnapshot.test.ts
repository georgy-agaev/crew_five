import { describe, expect, it, vi } from 'vitest';

import { createSegmentSnapshot } from '../src/services/segmentSnapshot';

describe('createSegmentSnapshot', () => {
  it('replaces existing membership rows with new snapshot payloads', async () => {
    const match = vi.fn().mockResolvedValue({ error: null });
    const deleteBuilder = { match };
    const insertSelect = vi.fn().mockResolvedValue({ data: [{ id: 'member-1' }], error: null });
    const insert = vi.fn().mockReturnValue({ select: insertSelect });

    const from = vi.fn((table: string) => {
      if (table === 'segment_members') {
        return {
          delete: () => deleteBuilder,
          insert,
        } as any;
      }
      throw new Error('unexpected table');
    });

    const client = { from } as any;

    const result = await createSegmentSnapshot(
      client,
      { id: 'segment-1', version: 2 },
      [
        {
          id: 'contact-1',
          company_id: 'company-1',
          full_name: 'Jane Doe',
          work_email: 'jane@example.com',
        },
      ]
    );

    expect(match).toHaveBeenCalledWith({ segment_id: 'segment-1', segment_version: 2 });
    expect(insert).toHaveBeenCalled();
    expect(insertSelect).toHaveBeenCalled();
    expect(result.inserted).toBe(1);
  });
});
