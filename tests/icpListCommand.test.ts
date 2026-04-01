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
    const hypothesisEqById = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'hyp-1',
          icp_id: 'icp-1',
          status: 'active',
          hypothesis_label: 'ICP A',
          search_config: {},
          created_at: '2026-03-13T10:00:00.000Z',
        },
      ],
      error: null,
    });
    const hypothesisEqByProfile = vi.fn().mockReturnValue({ eq: hypothesisEqById });
    const hypothesisSelect = vi.fn().mockReturnValue({ eq: hypothesisEqByProfile });

    const segmentMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'seg-1', icp_hypothesis_id: 'hyp-1' },
      error: null,
    });
    const segmentEq = vi.fn().mockReturnValue({ maybeSingle: segmentMaybeSingle });
    const segmentIn = vi.fn().mockResolvedValue({
      data: [{ id: 'seg-1', icp_hypothesis_id: 'hyp-1' }],
      error: null,
    });
    const segmentSelect = vi.fn().mockReturnValue({ eq: segmentEq, in: segmentIn });

    const from = vi.fn((table: string) => {
      if (table === 'icp_hypotheses') return { select: hypothesisSelect };
      if (table === 'segments') return { select: segmentSelect };
      throw new Error(`Unexpected table ${table}`);
    });
    const client = { from } as any;

    const rows = await icpHypothesisListCommand(client, {
      columns: ['id', 'icp_profile_id', 'segment_id'],
      icpProfileId: 'icp-1',
      segmentId: 'seg-1',
    });

    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    expect(hypothesisSelect).toHaveBeenCalledWith(
      'id, icp_id, offer_id, status, hypothesis_label, search_config, targeting_defaults, messaging_angle, pattern_defaults, notes, created_at'
    );
    expect(rows).toEqual([{ id: 'hyp-1', icp_profile_id: 'icp-1', segment_id: 'seg-1' }]);
  });

  it('rejects unknown columns', async () => {
    const client = { from: vi.fn() } as any;
    await expect(icpListCommand(client, { columns: ['bad_col'] })).rejects.toThrow(/Unknown columns/);
  });
});
