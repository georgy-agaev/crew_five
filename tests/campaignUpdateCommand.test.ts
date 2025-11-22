import { describe, expect, it, vi } from 'vitest';

import { campaignUpdateHandler } from '../src/commands/campaignUpdate';

describe('campaignUpdateHandler', () => {
  it('updates only allowed fields and parses JSON inputs', async () => {
    const statusSingle = vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null });
    const statusEq = vi.fn().mockReturnValue({ single: statusSingle });
    const statusSelect = vi.fn().mockReturnValue({ eq: statusEq });
    const statusFrom = { select: statusSelect };

    const single = vi.fn().mockResolvedValue({ data: { id: 'camp-1' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const client = {
      from: vi
        .fn()
        .mockReturnValueOnce(statusFrom)
        .mockReturnValueOnce({ update }),
    } as any;

    await campaignUpdateHandler(client, {
      campaignId: 'camp-1',
      promptPackId: 'prompt-2',
      schedule: '{"cron":"0 9 * * *"}',
      throttle: '{"per_hour":50}',
    });

    expect(client.from).toHaveBeenCalledWith('campaigns');
    expect(statusSelect).toHaveBeenCalledWith('status');
    expect(statusEq).toHaveBeenCalledWith('id', 'camp-1');
    expect(statusSingle).toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith({
      prompt_pack_id: 'prompt-2',
      schedule: { cron: '0 9 * * *' },
      throttle: { per_hour: 50 },
    });
    expect(eq).toHaveBeenCalledWith('id', 'camp-1');
    expect(single).toHaveBeenCalled();
  });

  it('rejects updates when status is not draft/ready/review', async () => {
    const statusSingle = vi.fn().mockResolvedValue({ data: { status: 'sending' }, error: null });
    const statusEq = vi.fn().mockReturnValue({ single: statusSingle });
    const statusSelect = vi.fn().mockReturnValue({ eq: statusEq });
    const statusFrom = { select: statusSelect };
    const client = {
      from: vi.fn().mockReturnValue(statusFrom),
    } as any;

    await expect(
      campaignUpdateHandler(client, {
        campaignId: 'camp-1',
        promptPackId: 'prompt-2',
      })
    ).rejects.toThrow(/Cannot update campaign in status sending/);
  });
});
