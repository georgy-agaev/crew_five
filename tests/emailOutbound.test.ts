import { describe, expect, it, vi } from 'vitest';

import { sendQueuedDrafts } from '../src/services/emailOutbound';

describe('sendQueuedDrafts', () => {
  it('sends generated drafts up to throttle and records outbound', async () => {
    const drafts = [
      {
        id: 'd1',
        campaign_id: 'c1',
        contact_id: 'contact-1',
        company_id: 'company-1',
        subject: 'Hi',
        body: 'Body',
        metadata: { foo: 'bar' },
      },
    ];

    const limit = vi.fn().mockResolvedValue({ data: drafts, error: null });
    const eq = vi.fn().mockReturnValue({ limit });
    const selectDrafts = vi.fn().mockReturnValue({ eq });

    const insert = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const client = {
      from: (table: string) => {
        if (table === 'drafts') {
          return {
            select: selectDrafts,
            update,
          };
        }
        if (table === 'email_outbound') return { insert };
        return { update };
      },
    } as any;

    const smtpClient = { send: vi.fn().mockResolvedValue({ providerId: 'pid-1' }) };

    const sent = await sendQueuedDrafts(client, smtpClient, { throttlePerMinute: 10, provider: 'smtp', senderIdentity: 'noreply@example.com' });

    expect(smtpClient.send).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Hi', body: 'Body' }));
    expect(insert).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ provider_message_id: 'pid-1', status: 'sent' })]));
    expect(update).toHaveBeenCalled();
    expect(sent).toHaveLength(1);
  });
});
