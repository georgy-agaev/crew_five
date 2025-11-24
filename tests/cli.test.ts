import { describe, expect, it, vi } from 'vitest';

import { createProgram } from '../src/cli';

describe('createProgram', () => {
  it('wires the email:send command', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ eq });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }) });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'drafts') {
          return { select };
        }
        if (table === 'email_outbound') {
          return { insert };
        }
        return { update };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'email:send',
      '--provider',
      'smtp',
      '--sender-identity',
      'noreply@example.com',
      '--throttle-per-minute',
      '25',
      '--summary-format',
      'text',
      '--fail-on-error',
    ]);

    // No error thrown means command is wired; smtpClient is stubbed internally.
  });

  it('wires the campaign:status command', async () => {
    const singleUpdate = vi.fn().mockResolvedValue({ data: { id: 'c', status: 'ready' }, error: null });
    const eqUpdate = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: singleUpdate }) });
    const update = vi.fn().mockReturnValue({ eq: eqUpdate });

    const singleSelect = vi.fn().mockResolvedValue({ data: { status: 'draft' }, error: null });
    const eqSelect = vi.fn().mockReturnValue({ single: singleSelect });
    const select = vi.fn().mockReturnValue({ eq: eqSelect });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'campaigns') {
          return { select, update };
        }
        return { update };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'campaign:status',
      '--campaign-id',
      'camp-1',
      '--status',
      'ready',
    ]);
  });

  it('wires the event:ingest command with JSON payload and dry-run', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq2 = vi.fn().mockReturnValue({ limit });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const selectDedup = vi.fn().mockReturnValue({ eq: eq1 });

    const single = vi.fn().mockResolvedValue({ data: { id: 'evt-1' }, error: null });
    const selectInsert = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select: selectInsert });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'email_events') {
          return { select: selectDedup, insert };
        }
        return { select: selectDedup };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'event:ingest',
      '--payload',
      '{"provider":"stub","event_type":"delivered"}',
      '--dry-run',
    ]);
  });

  it('wires smartlead:campaigns:list with injected client', async () => {
    const listCampaigns = vi.fn().mockResolvedValue({ campaigns: [{ id: 'c1', name: 'C' }] });
    const client = { listCampaigns } as any;
    const supabaseClient = { from: vi.fn() } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await program.parseAsync(['node', 'gtm', 'smartlead:campaigns:list', '--dry-run']);

    expect(listCampaigns).toHaveBeenCalledWith({ dryRun: true, format: 'json' });
  });

  it('wires smartlead:events:pull and calls ingest', async () => {
    const events = [
      {
        provider: 'smartlead',
        provider_event_id: 'evt-1',
        event_type: 'delivered',
        outcome_classification: null,
        contact_id: null,
        outbound_id: null,
        occurred_at: '2025-01-01T00:00:00Z',
        payload: {},
      },
    ];
    const pullEvents = vi.fn().mockResolvedValue({ events });
    const client = { pullEvents } as any;

    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn() }) });
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn() }) });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'email_events') {
          return { insert, select };
        }
        return { insert, select };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:events:pull',
      '--dry-run',
      '--since',
      '2025-01-01T00:00:00Z',
      '--limit',
      '25',
    ]);

    expect(pullEvents).toHaveBeenCalledWith(
      expect.objectContaining({
        dryRun: true,
        format: 'json',
        since: '2025-01-01T00:00:00Z',
        limit: 25,
      })
    );
  });

  it('smartlead:events:pull rejects bad since/limit', async () => {
    const pullEvents = vi.fn();
    const client = { pullEvents } as any;
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await expect(
      program.parseAsync(['node', 'gtm', 'smartlead:events:pull', '--since', 'invalid', '--limit', '-1'])
    ).rejects.toThrow();
  });

  it('smartlead:events:pull wires retry cap and assume-now flag', async () => {
    const pullEvents = vi.fn().mockResolvedValue({ events: [] });
    const client = { pullEvents } as any;
    const supabaseClient = { from: vi.fn() } as any;
    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await program.parseAsync([
      'node',
      'gtm',
      'smartlead:events:pull',
      '--retry-after-cap-ms',
      '250',
      '--assume-now-occurred-at',
    ]);

    expect(pullEvents).toHaveBeenCalledWith({
      dryRun: false,
      format: 'json',
      since: undefined,
      limit: undefined,
      retryAfterCapMs: 250,
      assumeNowOccurredAt: true,
    });
  });

  it('wires smartlead:send', async () => {
    const listDrafts = [{ id: 'd1', campaign_id: 'c1', contact_id: 'lead@example.com', company_id: 'co', subject: 's', body: 'b', metadata: {} }];
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: listDrafts, error: null }) }) });
    const update = vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ error: null }), eq: vi.fn().mockResolvedValue({ error: null }) });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'drafts') return { select, update };
        if (table === 'email_outbound') return { insert };
        return { insert, update };
      },
    } as any;
    const sendEmail = vi.fn().mockResolvedValue({ provider_message_id: 'm1' });
    const client = { sendEmail } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: client,
    });

    await program.parseAsync(['node', 'gtm', 'smartlead:send', '--batch-size', '10']);

    expect(sendEmail).toHaveBeenCalled();
    expect(insert).toHaveBeenCalled();
  });

  it('wires enrich command', async () => {
    const members = [{ contact_id: 'lead@example.com', company_id: 'co1' }];
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: members, error: null }) }) });
    const from = (table: string) => {
      if (table === 'segment_members') {
        return { select };
      }
      return { select };
    };
    const supabaseClient = { from } as any;
    const smartleadClient = { sendEmail: vi.fn() } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient,
    });

    await program.parseAsync(['node', 'gtm', 'enrich:run', '--segment-id', 'seg-1', '--limit', '5']);

    expect(select).toHaveBeenCalled();
  });

  it('wires judge:drafts with dry-run', async () => {
    const drafts = [{ id: 'd1', subject: 's', body: 'b' }];
    const select = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: drafts, error: null }) }) });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    const supabaseClient = {
      from: (table: string) => {
        if (table === 'drafts') return { select, update };
        return { select, update };
      },
    } as any;

    const program = createProgram({
      supabaseClient,
      aiClient: {} as any,
      smartleadClient: {} as any,
    });

    await program.parseAsync(['node', 'gtm', 'judge:drafts', '--campaign-id', 'c1', '--dry-run', '--limit', '5']);
    expect(select).toHaveBeenCalled();
  });
});
