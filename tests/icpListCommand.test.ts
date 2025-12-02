import { describe, expect, it, vi } from 'vitest';

import { icpHypothesisListCommand, icpListCommand } from '../src/commands/icpList';

describe('icp list commands', () => {
  it('lists icp profiles with selected columns', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ id: 'icp-1', name: 'ICP A' }],
      error: null,
    });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as any;

    const rows = await icpListCommand(client, { columns: ['id', 'name'] });
    expect(from).toHaveBeenCalledWith('icp_profiles');
    expect(select).toHaveBeenCalledWith('id, name');
    expect(rows).toEqual([{ id: 'icp-1', name: 'ICP A' }]);
  });

  it('filters hypotheses by profile and segment when provided', async () => {
    const eq = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({
        data: [{ id: 'hyp-1', icp_profile_id: 'icp-1', segment_id: 'seg-1' }],
        error: null,
      }),
    });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = { from } as any;

    const rows = await icpHypothesisListCommand(client, {
      columns: ['id', 'icp_profile_id', 'segment_id'],
      icpProfileId: 'icp-1',
      segmentId: 'seg-1',
    });

    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    expect(select).toHaveBeenCalledWith('id, icp_profile_id, segment_id');
    expect(rows).toEqual([{ id: 'hyp-1', icp_profile_id: 'icp-1', segment_id: 'seg-1' }]);
  });

  it('rejects unknown columns', async () => {
    const client = { from: vi.fn() } as any;
    await expect(icpListCommand(client, { columns: ['bad_col'] })).rejects.toThrow(/Unknown columns/);
  });
});
