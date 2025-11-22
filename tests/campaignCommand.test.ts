import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/campaigns', () => ({
  createCampaign: vi.fn().mockResolvedValue({ id: 'camp-55' }),
}));

vi.mock('../src/services/segmentSnapshotWorkflow', () => ({
  ensureSegmentSnapshot: vi.fn().mockResolvedValue({ version: 3, count: 120 }),
}));

const { createCampaign } = await import('../src/services/campaigns');
const { ensureSegmentSnapshot } = await import('../src/services/segmentSnapshotWorkflow');

import { campaignCreateHandler } from '../src/commands/campaignCreate';

describe('campaignCreateHandler', () => {
  it('parses schedule/throttle JSON and passes defaults', async () => {
    const client = {} as any;

    const result = await campaignCreateHandler(client, {
      name: 'Q1 Push',
      segmentId: 'seg',
      segmentVersion: 1,
      senderProfileId: 'sender',
      promptPackId: 'prompt',
      schedule: '{"startAt":"2025-11-22"}',
      throttle: '{"perHour":50}',
      createdBy: 'cli-user',
    });

    expect(ensureSegmentSnapshot).toHaveBeenCalledWith(client, {
      segmentId: 'seg',
      segmentVersion: 1,
      mode: 'reuse',
      bumpVersion: undefined,
    });

    expect(createCampaign).toHaveBeenCalledWith(client, {
      name: 'Q1 Push',
      segmentId: 'seg',
      segmentVersion: 3,
      senderProfileId: 'sender',
      promptPackId: 'prompt',
      schedule: { startAt: '2025-11-22' },
      throttle: { perHour: 50 },
      createdBy: 'cli-user',
      metadata: { snapshot: { version: 3, count: 120 } },
    });
    expect(result).toEqual({ id: 'camp-55' });
  });
});
