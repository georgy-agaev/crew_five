import { describe, expect, it, vi } from 'vitest';

import { attachIcpToSegment, createIcpHypothesis, createIcpProfile } from '../src/services/icp';

describe('icp service', () => {
  it('icp_profile_create_persists_expected_fields_and_defaults', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'icp-1', name: 'Fintech ICP' },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const client = { from } as any;

    const profile = await createIcpProfile(client, {
      name: 'Fintech ICP',
      description: 'Fintech companies, mid-market, EU/US',
      companyCriteria: { industry: 'fintech' },
      personaCriteria: { roles: ['CTO'] },
      createdBy: 'cli-user',
    });

    expect(from).toHaveBeenCalledWith('icp_profiles');
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Fintech ICP',
        description: 'Fintech companies, mid-market, EU/US',
        company_criteria: { industry: 'fintech' },
        persona_criteria: { roles: ['CTO'] },
        created_by: 'cli-user',
      }),
    ]);
    expect(profile.id).toBe('icp-1');
  });

  it('icp_hypothesis_create_links_to_profile_and_optional_segment', async () => {
    const singleHypo = vi.fn().mockResolvedValue({
      data: { id: 'hypo-1', icp_id: 'icp-1' },
      error: null,
    });
    const selectHypo = vi.fn().mockReturnValue({ single: singleHypo });
    const insertHypo = vi.fn().mockReturnValue({ select: selectHypo });

    const updateSeg = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });

    const from = vi.fn((table: string) => {
      if (table === 'icp_hypotheses') return { insert: insertHypo };
      if (table === 'segments') return { update: updateSeg };
      throw new Error(`Unexpected table ${table}`);
    });
    const client = { from } as any;

    const hypothesis = await createIcpHypothesis(client, {
      icpProfileId: 'icp-1',
      hypothesisLabel: 'Mid-market fintech EU',
      searchConfig: { region: ['EU'] },
      status: 'draft',
      segmentId: 'segment-1',
    });

    expect(from).toHaveBeenCalledWith('icp_hypotheses');
    expect(insertHypo).toHaveBeenCalledWith([
      expect.objectContaining({
        icp_id: 'icp-1',
        hypothesis_label: 'Mid-market fintech EU',
        search_config: { region: ['EU'] },
        status: 'draft',
      }),
    ]);
    expect(from).toHaveBeenCalledWith('segments');
    expect(hypothesis.id).toBe('hypo-1');
  });

  it('attach_icp_to_segment_updates_segment_foreign_keys', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const client = { from } as any;

    await attachIcpToSegment(client, 'segment-1', 'hypo-1', 'icp-1');

    expect(from).toHaveBeenCalledWith('segments');
    expect(update).toHaveBeenCalledWith({
      icp_profile_id: 'icp-1',
      icp_hypothesis_id: 'hypo-1',
    });
    expect(eq).toHaveBeenCalledWith('id', 'segment-1');
  });
});

