import { describe, expect, it, vi } from 'vitest';

import { assertCampaignStatusTransition, createCampaign } from '../src/services/campaigns';

describe('createCampaign', () => {
  it('stores campaign with default modes', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'camp-1', interaction_mode: 'express' } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const supabase = { from } as any;

    const payload = {
      name: 'Q1 Fintech Push',
      segmentId: 'segment-1',
      segmentVersion: 1,
      senderProfileId: 'sender-1',
      promptPackId: 'prompt-1',
      schedule: { startAt: '2025-11-22' },
      throttle: { perHour: 50 },
      createdBy: 'cli-user',
    };

    const result = await createCampaign(supabase, payload);

    expect(from).toHaveBeenCalledWith('campaigns');
    expect(insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: 'Q1 Fintech Push',
        segment_id: 'segment-1',
        segment_version: 1,
        interaction_mode: 'express',
        data_quality_mode: 'strict',
        status: 'draft',
      }),
    ]);
    expect(result).toEqual({ id: 'camp-1', interaction_mode: 'express' });
  });

  it('validates campaign status transitions (table-driven)', () => {
    const valid: Array<[string, string]> = [
      ['draft', 'ready'],
      ['draft', 'review'],
      ['ready', 'generating'],
      ['generating', 'review'],
      ['generating', 'sending'],
      ['sending', 'paused'],
      ['paused', 'sending'],
      ['sending', 'complete'],
      ['paused', 'complete'],
    ];

    valid.forEach(([from, to]) => {
      expect(() => assertCampaignStatusTransition(from, to)).not.toThrow();
    });

    const invalid: Array<[string, string]> = [
      ['sending', 'draft'],
      ['complete', 'draft'],
      ['ready', 'draft'],
      ['review', 'draft'],
      ['review', 'complete'],
    ];

    invalid.forEach(([from, to]) => {
      expect(() => assertCampaignStatusTransition(from, to)).toThrow(/Invalid status transition/);
    });
  });
});
