import { describe, expect, it, vi } from 'vitest';

import { smartleadSendCommand } from '../src/commands/smartleadSend';

describe('smartleadSendCommand', () => {
  it('sends_and_logs_summary', async () => {
    const drafts = [
      {
        id: 'd1',
        campaign_id: 'c1',
        contact_id: 'lead1@example.com',
        company_id: 'co1',
        subject: 'Hi',
        body: 'Hello',
        metadata: {
          enrichment_provider: { company: 'firecrawl', employee: 'exa' },
          enrichment_by_provider: { exa: { mode: 'primary', primaryFor: ['employee'] } },
        },
      },
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

    const outboundPayload = insert.mock.calls[0]?.[0] as any[];
    expect(outboundPayload[0]?.metadata?.enrichment_provider).toEqual({ company: 'firecrawl', employee: 'exa' });
    expect(outboundPayload[0]?.metadata?.enrichment_by_provider?.exa?.mode).toBe('primary');
    expect(outboundPayload[0]?.metadata?.sendPayload?.to).toBe('lead1@example.com');
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

  it('continues_on_send_errors_and_counts_failures', async () => {
    const drafts = [
      { id: 'd1', campaign_id: 'c1', contact_id: 'lead1@example.com', company_id: 'co1', subject: 'Hi', body: 'Hello', metadata: {} },
    ];

    const select = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: drafts, error: null }),
      }),
    });
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null }),
      in: vi.fn().mockResolvedValue({ error: null }),
    });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'drafts') return { select, update };
        if (table === 'email_outbound') return { insert };
        return { insert, update };
      },
    } as any;

    const sendEmail = vi.fn().mockRejectedValue(new Error('remote 500'));
    const mcp = { sendEmail } as any;

    const summary = await smartleadSendCommand(mcp, supabaseClient, { dryRun: false, batchSize: 10 });

    expect(sendEmail).toHaveBeenCalledTimes(1);
    expect(summary.failed).toBe(1);
    expect(summary.sent).toBe(0);
    expect(insert).not.toHaveBeenCalled();
  });
});
