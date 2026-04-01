import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/emailEvents.js', () => ({
  ingestEmailEvent: vi.fn(),
}));

const { ingestEmailEvent } = await import('../src/services/emailEvents.js');

import { processReplies } from '../src/services/processReplies.js';

function createQueryBuilder(rows: any[]) {
  const state: Record<string, unknown> = {};

  const builder: any = {
    in: vi.fn((field: string, values: unknown[]) => {
      state[`${field}_in`] = values;
      return builder;
    }),
    eq: vi.fn((field: string, value: unknown) => {
      state[field] = value;
      return builder;
    }),
    order: vi.fn(() => builder),
    limit: vi.fn(async (limit?: number) => {
      let result = rows;
      if (Array.isArray(state.provider_message_id_in)) {
        result = rows.filter((row) => (state.provider_message_id_in as unknown[]).includes(row.provider_message_id));
      }
      if (typeof state.provider_message_id === 'string') {
        result = rows.filter((row) => row.provider_message_id === state.provider_message_id);
      }
      if (typeof state.recipient_email === 'string') {
        result = rows.filter((row) => row.recipient_email === state.recipient_email);
      }
      if (typeof state.provider === 'string') {
        result = result.filter((row) => row.provider === state.provider);
      }
      return { data: typeof limit === 'number' ? result.slice(0, limit) : result, error: null };
    }),
  };

  return builder;
}

function createClient(input: {
  assignments?: any[];
  outbounds?: any[];
}) {
  const outbounds = input.outbounds ?? [];
  return {
    from: vi.fn((table: string) => {
      if (table === 'campaign_mailbox_assignments') {
        return {
          select: vi.fn(async () => ({ data: input.assignments ?? [], error: null })),
        };
      }
      if (table === 'email_outbound') {
        return {
          select: vi.fn(() => createQueryBuilder(outbounds)),
          insert: vi.fn((payload: any) => {
            const row = Array.isArray(payload) ? payload[0] : payload;
            const inserted = {
              ...row,
              id: row.id ?? `out-inbox-${outbounds.length + 1}`,
              draft_id: row.draft_id ?? null,
              contact_id: row.contact_id ?? null,
              company_id: row.company_id ?? null,
              metadata: row.metadata ?? null,
            };
            outbounds.push(inserted);
            return {
              select: vi.fn(() => ({
                single: vi.fn(async () => ({ data: inserted, error: null })),
              })),
            };
          }),
        };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  } as any;
}

describe('processReplies', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(ingestEmailEvent).mockResolvedValue({ inserted: 1 });
  });

  it('ingests matched replies via inReplyTo and marks the inbox item as read', async () => {
    const client = createClient({
      assignments: [{ mailbox_account_id: 'mbox-1', provider: 'imap_mcp' }],
      outbounds: [
        {
          id: 'out-1',
          draft_id: 'draft-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          recipient_email: 'buyer@example.com',
          sender_identity: 'sales@example.com',
          provider_message_id: '<msg-1@example.com>',
          sent_at: '2026-03-24T09:00:00Z',
          metadata: { mailbox_account_id: 'mbox-1' },
          provider: 'imap_mcp',
        },
      ],
    });
    const transport = {
      searchUnread: vi.fn().mockResolvedValue([
        {
          uid: 10,
          date: '2026-03-24T10:00:00Z',
          from: 'Buyer <buyer@example.com>',
          to: ['sales@example.com'],
          subject: 'Re: Hello',
          messageId: '<reply-1@example.com>',
          inReplyTo: '<msg-1@example.com>',
          flags: [],
        },
      ]),
      getEmail: vi.fn().mockResolvedValue({
        uid: 10,
        date: '2026-03-24T10:00:00Z',
        from: 'Buyer <buyer@example.com>',
        to: ['sales@example.com'],
        subject: 'Re: Hello',
        messageId: '<reply-1@example.com>',
        inReplyTo: '<msg-1@example.com>',
        flags: [],
        textContent: 'Да, тема актуальна. Давайте обсудим.',
        htmlContent: null,
      }),
      markAsRead: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processReplies(client, transport);

    expect(transport.searchUnread).toHaveBeenCalledWith({
      accountId: 'mbox-1',
      folder: 'INBOX',
      sinceDate: expect.any(String),
      limit: 100,
    });
    expect(vi.mocked(ingestEmailEvent)).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        provider: 'imap_mcp',
        provider_event_id: 'mbox-1:10',
        event_type: 'replied',
        outcome_classification: 'soft_interest',
        outbound_id: 'out-1',
      })
    );
    expect(transport.markAsRead).toHaveBeenCalledWith({
      accountId: 'mbox-1',
      folder: 'INBOX',
      uid: 10,
    });
    expect(result).toMatchObject({
      accepted: true,
      processed: 1,
      ingested: 1,
      skipped: 0,
      failed: 0,
      polledAccounts: 1,
      source: 'crew_five-process-replies',
    });
  });

  it('ingests unmatched unread emails as reply events and still marks them as read', async () => {
    const client = createClient({
      assignments: [{ mailbox_account_id: 'mbox-1', provider: 'imap_mcp' }],
      outbounds: [],
    });
    const transport = {
      searchUnread: vi.fn().mockResolvedValue([
        {
          uid: 11,
          date: '2026-03-24T10:00:00Z',
          from: 'Unknown <unknown@example.com>',
          to: ['sales@example.com'],
          subject: 'Random email',
          messageId: '<reply-2@example.com>',
          inReplyTo: null,
          flags: [],
        },
      ]),
      getEmail: vi.fn().mockResolvedValue({
        uid: 11,
        date: '2026-03-24T10:00:00Z',
        from: 'Unknown <unknown@example.com>',
        to: ['sales@example.com'],
        subject: 'Random email',
        messageId: '<reply-2@example.com>',
        inReplyTo: null,
        flags: [],
        textContent: 'Не относится к кампании.',
        htmlContent: null,
      }),
      markAsRead: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processReplies(client, transport);

    expect(vi.mocked(ingestEmailEvent)).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        provider: 'imap_mcp',
        provider_event_id: 'mbox-1:11',
        event_type: 'replied',
      })
    );
    expect(transport.markAsRead).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      processed: 1,
      ingested: 1,
      skipped: 0,
      failed: 0,
    });
  });

  it('returns accepted=false when no imap mailbox accounts are configured', async () => {
    const client = createClient({ assignments: [], outbounds: [] });
    const transport = {
      searchUnread: vi.fn(),
      getEmail: vi.fn(),
      markAsRead: vi.fn(),
    };

    const result = await processReplies(client, transport);

    expect(result.accepted).toBe(false);
    expect(result.errors[0]).toMatch(/No imap_mcp mailbox accounts/i);
    expect(transport.searchUnread).not.toHaveBeenCalled();
  });

  it('skips polling accounts during imap-mcp backoff window', async () => {
    const client = createClient({
      assignments: [{ mailbox_account_id: 'mbox-1', provider: 'imap_mcp' }],
      outbounds: [],
    });
    const transport = {
      searchUnread: vi.fn().mockRejectedValue({
        code: 'IMAP_MCP_BACKOFF',
        message: 'imap-mcp account is in backoff',
        accountId: 'mbox-1',
      }),
      getEmail: vi.fn(),
      markAsRead: vi.fn(),
    };

    const result = await processReplies(client, transport);

    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([]);
    expect(result.details).toContainEqual(
      expect.objectContaining({ accountId: 'mbox-1', uid: 0, status: 'skipped' })
    );
  });

  it('treats mid-run imap-mcp backoff as a skip (not a failure)', async () => {
    const client = createClient({
      assignments: [{ mailbox_account_id: 'mbox-1', provider: 'imap_mcp' }],
      outbounds: [],
    });
    const transport = {
      searchUnread: vi.fn().mockResolvedValue([
        {
          uid: 15,
          date: '2026-03-24T10:00:00Z',
          from: 'Buyer <buyer@example.com>',
          to: ['sales@example.com'],
          subject: 'Re: Hello',
          messageId: '<reply-6@example.com>',
          inReplyTo: null,
          flags: [],
        },
      ]),
      getEmail: vi.fn().mockRejectedValue({
        code: 'IMAP_MCP_BACKOFF',
        message: 'imap-mcp account is in backoff',
        accountId: 'mbox-1',
      }),
      markAsRead: vi.fn(),
    };

    const result = await processReplies(client, transport);

    expect(result.processed).toBe(1);
    expect(result.ingested).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(1);
    expect(result.errors).toEqual([]);
    expect(vi.mocked(ingestEmailEvent)).not.toHaveBeenCalled();
  });

  it('surfaces structured per-message errors instead of [object Object]', async () => {
    const client = createClient({
      assignments: [{ mailbox_account_id: 'mbox-1', provider: 'imap_mcp' }],
      outbounds: [],
    });
    const transport = {
      searchUnread: vi.fn().mockResolvedValue([
        {
          uid: 12,
          date: '2026-03-24T10:00:00Z',
          from: 'Buyer <buyer@example.com>',
          to: ['sales@example.com'],
          subject: 'Re: Hello',
          messageId: '<reply-3@example.com>',
          inReplyTo: null,
          flags: [],
        },
      ]),
      getEmail: vi.fn().mockRejectedValue({
        message: 'Mailbox lock failed',
        details: 'another worker holds the lock',
        code: 'IMAP_LOCK',
      }),
      markAsRead: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processReplies(client, transport);

    expect(result.failed).toBe(1);
    expect(result.errors[0]).toContain('Mailbox lock failed');
    expect(result.errors[0]).toContain('another worker holds the lock');
    expect(result.errors[0]).toContain('code=IMAP_LOCK');
  });

  it('matches outbounds by metadata recipient_email when live email_outbound has no direct recipient column', async () => {
    const client = createClient({
      assignments: [{ mailbox_account_id: 'mbox-1', provider: 'imap_mcp' }],
      outbounds: [
        {
          id: 'out-2',
          draft_id: 'draft-2',
          contact_id: 'contact-2',
          company_id: 'company-2',
          sender_identity: 'sales@example.com',
          provider_message_id: '<msg-2@example.com>',
          sent_at: '2026-03-24T09:00:00Z',
          metadata: {
            mailbox_account_id: 'mbox-1',
            recipient_email: 'buyer@example.com',
          },
          provider: 'imap_mcp',
        },
      ],
    });
    const transport = {
      searchUnread: vi.fn().mockResolvedValue([
        {
          uid: 13,
          date: '2026-03-24T10:00:00Z',
          from: 'Buyer <buyer@example.com>',
          to: ['sales@example.com'],
          subject: 'Re: Hello',
          messageId: '<reply-4@example.com>',
          inReplyTo: null,
          flags: [],
        },
      ]),
      getEmail: vi.fn().mockResolvedValue({
        uid: 13,
        date: '2026-03-24T10:00:00Z',
        from: 'Buyer <buyer@example.com>',
        to: ['sales@example.com'],
        subject: 'Re: Hello',
        messageId: '<reply-4@example.com>',
        inReplyTo: null,
        flags: [],
        textContent: 'Да, интересно',
        htmlContent: null,
      }),
      markAsRead: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processReplies(client, transport);

    expect(vi.mocked(ingestEmailEvent)).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        outbound_id: 'out-2',
        provider_event_id: 'mbox-1:13',
      })
    );
    expect(result).toMatchObject({
      processed: 1,
      ingested: 1,
      failed: 0,
    });
  });

  it('does not fall back to sender-email matching when inReplyTo is present but not ours', async () => {
    const client = createClient({
      assignments: [{ mailbox_account_id: 'mbox-1', provider: 'imap_mcp' }],
      outbounds: [
        {
          id: 'out-3',
          draft_id: 'draft-3',
          contact_id: 'contact-3',
          company_id: 'company-3',
          sender_identity: 'sales@example.com',
          provider_message_id: '<msg-3@example.com>',
          sent_at: '2026-03-24T09:00:00Z',
          metadata: {
            mailbox_account_id: 'mbox-1',
            recipient_email: 'buyer@example.com',
          },
          provider: 'imap_mcp',
        },
      ],
    });
    const transport = {
      searchUnread: vi.fn().mockResolvedValue([
        {
          uid: 14,
          date: '2026-03-24T10:00:00Z',
          from: 'Buyer <buyer@example.com>',
          to: ['sales@example.com'],
          subject: 'Re: Something else',
          messageId: '<reply-5@example.com>',
          inReplyTo: '<other-tool@example.com>',
          flags: [],
        },
      ]),
      getEmail: vi.fn().mockResolvedValue({
        uid: 14,
        date: '2026-03-24T10:00:00Z',
        from: 'Buyer <buyer@example.com>',
        to: ['sales@example.com'],
        subject: 'Re: Something else',
        messageId: '<reply-5@example.com>',
        inReplyTo: '<other-tool@example.com>',
        flags: [],
        textContent: 'Ответ на письмо другого инструмента.',
        htmlContent: null,
      }),
      markAsRead: vi.fn().mockResolvedValue(undefined),
    };

    const result = await processReplies(client, transport);

    // Should create an inbox placeholder outbound instead of linking to out-3.
    expect(vi.mocked(ingestEmailEvent)).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        provider: 'imap_mcp',
        provider_event_id: 'mbox-1:14',
        outbound_id: expect.stringMatching(/^out-inbox-/),
      })
    );
    expect(vi.mocked(ingestEmailEvent)).not.toHaveBeenCalledWith(
      client,
      expect.objectContaining({ outbound_id: 'out-3' })
    );
    expect(result).toMatchObject({
      processed: 1,
      ingested: 1,
      failed: 0,
    });
  });
});
