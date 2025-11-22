import { describe, expect, it, vi } from 'vitest';

import { createSegment } from '../src/services/segments';

describe('createSegment', () => {
  it('inserts a segment with defaults and returns the row', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'segment-1' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });

    const supabase = { from } as any;

    const result = await createSegment(supabase, {
      name: 'Fintech CTOs',
      locale: 'en',
      filterDefinition: { title: 'CTO' },
      description: 'Segment of CTOs in fintech',
      createdBy: 'cli-user',
    });

    expect(from).toHaveBeenCalledWith('segments');
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Fintech CTOs',
        locale: 'en',
        filter_definition: { title: 'CTO' },
        description: 'Segment of CTOs in fintech',
        created_by: 'cli-user',
      }),
    ]);
    expect(select).toHaveBeenCalled();
    expect(single).toHaveBeenCalled();
    expect(result).toEqual({ id: 'segment-1' });
  });
});
