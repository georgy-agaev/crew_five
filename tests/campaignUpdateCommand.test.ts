import { describe, expect, it, vi } from 'vitest';

import { campaignUpdateHandler } from '../src/commands/campaignUpdate';

describe('campaignUpdateHandler', () => {
  it('updates only allowed fields and parses JSON inputs', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'camp-1' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const client = {
      from: vi.fn().mockReturnValue({ update }),
    } as any;

    await campaignUpdateHandler(client, {
      campaignId: 'camp-1',
      promptPackId: 'prompt-2',
      schedule: '{"cron":"0 9 * * *"}',
      throttle: '{"per_hour":50}',
    });

    expect(client.from).toHaveBeenCalledWith('campaigns');
    expect(update).toHaveBeenCalledWith({
      prompt_pack_id: 'prompt-2',
      schedule: { cron: '0 9 * * *' },
      throttle: { per_hour: 50 },
    });
    expect(eq).toHaveBeenCalledWith('id', 'camp-1');
    expect(single).toHaveBeenCalled();
  });
});
