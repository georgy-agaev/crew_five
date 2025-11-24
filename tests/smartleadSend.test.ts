import { describe, expect, it, vi } from 'vitest';

import { smartleadSendCommand } from '../src/commands/smartleadSend';

describe('smartleadSendCommand', () => {
  it('sends_and_logs_summary', async () => {
    const drafts = [
      { id: 'd1', campaign_id: 'c1', contact_id: 'lead1@example.com', company_id: 'co1', subject: 'Hi', body: 'Hello', metadata: {} },
    ];

    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: drafts, error: null }) }) });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }), in: vi.fn().mockResolvedValue({ error: null }) });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === 'drafts') {
        return { select, update };
      }
      if (table === 'email_outbound') {
        return { insert };
      }
      return { insert, update };
    });
    const supabaseClient = { from } as any;

    const sendEmail = vi.fn().mockResolvedValue({ provider_message_id: 'msg-1' });
    const mcp = { sendEmail } as any;

    const summary = await smartleadSendCommand(mcp, supabaseClient, { dryRun: false, batchSize: 10, dedupe: true });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(summary.sent).toBe(1);
    expect(summary.fetched).toBe(1);
    expect(insert).toHaveBeenCalled();
    expect(update).toHaveBeenCalled();
  });

  it('respects_dry_run', async () => {
    const drafts = [
      { id: 'd1', campaign_id: 'c1', contact_id: 'lead1@example.com', company_id: 'co1', subject: 'Hi', body: 'Hello', metadata: {} },
    ];

    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: drafts, error: null }) }) });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }), in: vi.fn().mockResolvedValue({ error: null }) });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === 'drafts') {
        return { select, update };
      }
      if (table === 'email_outbound') {
        return { insert };
      }
      return { insert, update };
    });
    const supabaseClient = { from } as any;

    const sendEmail = vi.fn();
    const mcp = { sendEmail } as any;

    const summary = await smartleadSendCommand(mcp, supabaseClient, { dryRun: true, batchSize: 10 });

    expect(sendEmail).not.toHaveBeenCalled();
    expect(summary.skipped).toBe(1);
    expect(insert).not.toHaveBeenCalled();
  });
});
