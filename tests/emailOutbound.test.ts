import { describe, expect, it, vi } from 'vitest';

import { sendQueuedDrafts } from '../src/services/emailOutbound';

describe('sendQueuedDrafts', () => {
  it('sends generated drafts up to throttle and records outbound with summary', async () => {
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
      {
        id: 'd2',
        campaign_id: 'c1',
        contact_id: 'contact-2',
        company_id: 'company-1',
        subject: 'Hi2',
        body: 'Body2',
        metadata: { foo: 'baz' },
      },
    ];

    const limit = vi.fn().mockResolvedValue({ data: drafts, error: null });
    const eqSelect = vi.fn().mockReturnValue({ limit });
    const selectDrafts = vi.fn().mockReturnValue({ eq: eqSelect });

    const updateEq = vi.fn().mockReturnValue({ error: null });
    const updateDrafts = vi.fn().mockReturnValue({ eq: updateEq, in: vi.fn().mockResolvedValue({ error: null }) });

    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: (table: string) => {
        if (table === 'drafts') {
          return {
            select: selectDrafts,
            update: updateDrafts,
          };
        }
        if (table === 'email_outbound') return { insert };
        return { update: updateDrafts };
      },
    } as any;

    const smtpClient = { send: vi.fn().mockResolvedValue({ providerId: 'pid-1' }) };

    const summary = await sendQueuedDrafts(client, smtpClient, {
      throttlePerMinute: 1,
      provider: 'smtp',
      senderIdentity: 'noreply@example.com',
    });

    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.skipped).toBe(1);
    expect(smtpClient.send).toHaveBeenCalledTimes(1);
  });

  it('logs send errors, retries once when enabled, and continues', async () => {
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
    const eqSelect = vi.fn().mockReturnValue({ limit });
    const selectDrafts = vi.fn().mockReturnValue({ eq: eqSelect });

    const updateEq = vi.fn().mockReturnValue({ error: null });
    const updateDrafts = vi.fn().mockReturnValue({ eq: updateEq, in: vi.fn().mockResolvedValue({ error: null }) });

    const insert = vi.fn().mockResolvedValue({ error: null });
    const client = {
      from: (table: string) => {
        if (table === 'drafts') {
          return {
            select: selectDrafts,
            update: updateDrafts,
          };
        }
        if (table === 'email_outbound') return { insert };
        return { update: updateDrafts };
      },
    } as any;

    const sendMock = vi.fn().mockRejectedValueOnce(new Error('fail')).mockResolvedValueOnce({ providerId: 'pid-retry' });
    const smtpClient = { send: sendMock };

    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const summary = await sendQueuedDrafts(client, smtpClient, {
      throttlePerMinute: 10,
      provider: 'smtp',
      senderIdentity: 'noreply@example.com',
      retryOnce: true,
      logJson: true,
    });

    expect(summary.sent).toBe(1);
    expect(summary.failed).toBe(0);
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(logSpy).toHaveBeenCalledTimes(1); // summary log

    logSpy.mockRestore();
  });
});
