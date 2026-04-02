import { describe, expect, it, vi } from 'vitest';

import { listInboxReplies } from './campaignEventReadModels.js';

describe('campaignEventReadModels', () => {
  it('maps inbox replies with handled state and forwards handled filter', async () => {
    const emailEventsQuery = {
      select: vi.fn(() => emailEventsQuery),
      in: vi.fn(() => emailEventsQuery),
      order: vi.fn(() => emailEventsQuery),
      is: vi.fn(() => emailEventsQuery),
      not: vi.fn(() => emailEventsQuery),
      limit: vi.fn(async () => ({
        data: [
          {
            id: 'evt-1',
            outbound_id: 'out-1',
            event_type: 'replied',
            reply_label: 'positive',
            handled_at: '2026-03-18T22:00:00Z',
            handled_by: 'operator',
            occurred_at: '2026-03-18T21:00:00Z',
            outcome_classification: 'soft_interest',
            payload: { reply_text: 'Interested' },
            draft_id: 'draft-1',
          },
        ],
        error: null,
      })),
    };

    const outboundRowsResult = {
      data: [
        {
          id: 'out-1',
          campaign_id: 'camp-1',
          draft_id: 'draft-1',
          contact_id: 'contact-1',
          company_id: 'company-1',
          sender_identity: 'sales@acme.ai',
          metadata: { recipient_email: 'buyer@acme.ai' },
        },
      ],
      error: null,
    };

    const emailOutboundQuery: any = {
      select: vi.fn(() => emailOutboundQuery),
      in: vi.fn(() => emailOutboundQuery),
      eq: vi.fn(() => emailOutboundQuery),
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve(outboundRowsResult).then(onFulfilled, onRejected),
    };

    const campaignsQuery = {
      select: vi.fn(() => campaignsQuery),
      in: vi.fn(async () => ({
        data: [{ id: 'camp-1', name: 'Alpha' }],
        error: null,
      })),
    };

    const draftsQuery = {
      select: vi.fn(() => draftsQuery),
      in: vi.fn(async () => ({
        data: [{ id: 'draft-1', email_type: 'intro', status: 'sent', subject: 'Hello' }],
        error: null,
      })),
    };

    const employeesQuery = {
      select: vi.fn(() => employeesQuery),
      in: vi.fn(async () => ({
        data: [{ id: 'contact-1', full_name: 'Alice Doe', position: 'CTO' }],
        error: null,
      })),
    };

    const companiesQuery = {
      select: vi.fn(() => companiesQuery),
      in: vi.fn(async () => ({
        data: [{ id: 'company-1', company_name: 'Acme AI' }],
        error: null,
      })),
    };

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'email_events') return emailEventsQuery;
        if (table === 'email_outbound') return emailOutboundQuery;
        if (table === 'campaigns') return campaignsQuery;
        if (table === 'drafts') return draftsQuery;
        if (table === 'employees') return employeesQuery;
        if (table === 'companies') return companiesQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await listInboxReplies(client, { handled: false, limit: 10 });

    expect(emailEventsQuery.is).toHaveBeenCalledWith('handled_at', null);
    expect(result.total).toBe(1);
    expect(result.replies[0]).toMatchObject({
      id: 'evt-1',
      reply_label: 'positive',
      handled: true,
      handled_at: '2026-03-18T22:00:00Z',
      handled_by: 'operator',
      campaign_name: 'Alpha',
      contact_name: 'Alice Doe',
      company_name: 'Acme AI',
    });
  });

  it('supports linkage filter to hide unlinked mailbox events', async () => {
    const emailEventsQuery = {
      select: vi.fn(() => emailEventsQuery),
      in: vi.fn(() => emailEventsQuery),
      order: vi.fn(() => emailEventsQuery),
      is: vi.fn(() => emailEventsQuery),
      not: vi.fn(() => emailEventsQuery),
      limit: vi.fn(async () => ({
        data: [
          {
            id: 'evt-linked',
            outbound_id: 'out-1',
            event_type: 'replied',
            reply_label: 'positive',
            handled_at: null,
            handled_by: null,
            occurred_at: '2026-03-18T21:00:00Z',
            outcome_classification: 'soft_interest',
            payload: { reply_text: 'Interested' },
            draft_id: null,
          },
          {
            id: 'evt-unlinked',
            outbound_id: 'out-2',
            event_type: 'reply',
            reply_label: null,
            handled_at: null,
            handled_by: null,
            occurred_at: '2026-03-18T20:00:00Z',
            outcome_classification: null,
            payload: { subject: 'Newsletter', from: 'noreply@example.com', reply_text: '...' },
            draft_id: null,
          },
        ],
        error: null,
      })),
    };

    const baseOutboundRows: any[] = [
      {
        id: 'out-1',
        campaign_id: 'camp-1',
        draft_id: null,
        contact_id: null,
        company_id: null,
        sender_identity: 'sales@acme.ai',
        metadata: { recipient_email: 'buyer@acme.ai' },
      },
      {
        id: 'out-2',
        campaign_id: null,
        draft_id: null,
        contact_id: null,
        company_id: null,
        sender_identity: 'inbox@acme.ai',
        metadata: { recipient_email: 'someone@acme.ai' },
      },
    ];

    let mode: 'all' | 'linked' | 'unlinked' = 'all';
    const outboundRowsResult = { data: baseOutboundRows, error: null };

    const emailOutboundQuery: any = {
      select: vi.fn(() => emailOutboundQuery),
      in: vi.fn(() => emailOutboundQuery),
      eq: vi.fn(() => emailOutboundQuery),
      is: vi.fn((col: string, value: any) => {
        if (col === 'campaign_id' && value === null) {
          mode = 'unlinked';
        }
        return emailOutboundQuery;
      }),
      not: vi.fn((col: string, op: string, value: any) => {
        if (col === 'campaign_id' && op === 'is' && value === null) {
          mode = 'linked';
        }
        return emailOutboundQuery;
      }),
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve({
          ...outboundRowsResult,
          data:
            mode === 'linked'
              ? baseOutboundRows.filter((row) => row.campaign_id !== null)
              : mode === 'unlinked'
                ? baseOutboundRows.filter((row) => row.campaign_id === null)
                : baseOutboundRows,
        }).then(onFulfilled, onRejected),
    };

    const campaignsQuery = {
      select: vi.fn(() => campaignsQuery),
      in: vi.fn(async () => ({
        data: [{ id: 'camp-1', name: 'Alpha' }],
        error: null,
      })),
    };

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'email_events') return emailEventsQuery;
        if (table === 'email_outbound') return emailOutboundQuery;
        if (table === 'campaigns') return campaignsQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const linked = await listInboxReplies(client, { linkage: 'linked', limit: 10 });
    expect(emailOutboundQuery.not).toHaveBeenCalledWith('campaign_id', 'is', null);
    expect(linked.total).toBe(1);
    expect(linked.replies[0].id).toBe('evt-linked');

    const unlinked = await listInboxReplies(client, { linkage: 'unlinked', limit: 10 });
    expect(emailOutboundQuery.is).toHaveBeenCalledWith('campaign_id', null);
    expect(unlinked.total).toBe(1);
    expect(unlinked.replies[0].id).toBe('evt-unlinked');
  });

  it('supports mapped inbox category filter server-side', async () => {
    const emailEventsQuery = {
      select: vi.fn(() => emailEventsQuery),
      in: vi.fn(() => emailEventsQuery),
      order: vi.fn(() => emailEventsQuery),
      is: vi.fn(() => emailEventsQuery),
      not: vi.fn(() => emailEventsQuery),
      limit: vi.fn(async () => ({
        data: [
          {
            id: 'evt-positive',
            outbound_id: 'out-1',
            event_type: 'replied',
            reply_label: 'positive',
            handled_at: null,
            handled_by: null,
            occurred_at: '2026-03-18T21:00:00Z',
            outcome_classification: 'soft_interest',
            payload: { reply_text: 'Interested' },
            draft_id: null,
          },
          {
            id: 'evt-bounce',
            outbound_id: 'out-2',
            event_type: 'bounced',
            reply_label: null,
            handled_at: null,
            handled_by: null,
            occurred_at: '2026-03-18T20:00:00Z',
            outcome_classification: null,
            payload: { reply_text: 'Delivery failed' },
            draft_id: null,
          },
          {
            id: 'evt-unclassified',
            outbound_id: 'out-3',
            event_type: 'replied',
            reply_label: null,
            handled_at: null,
            handled_by: null,
            occurred_at: '2026-03-18T19:00:00Z',
            outcome_classification: null,
            payload: { reply_text: 'Please send details' },
            draft_id: null,
          },
        ],
        error: null,
      })),
    };

    const emailOutboundQuery: any = {
      select: vi.fn(() => emailOutboundQuery),
      in: vi.fn(() => emailOutboundQuery),
      eq: vi.fn(() => emailOutboundQuery),
      is: vi.fn(() => emailOutboundQuery),
      not: vi.fn(() => emailOutboundQuery),
      then: (onFulfilled: any, onRejected: any) =>
        Promise.resolve({
          data: [
            { id: 'out-1', campaign_id: 'camp-1', draft_id: null, contact_id: null, company_id: null, sender_identity: null, metadata: null },
            { id: 'out-2', campaign_id: 'camp-1', draft_id: null, contact_id: null, company_id: null, sender_identity: null, metadata: null },
            { id: 'out-3', campaign_id: 'camp-1', draft_id: null, contact_id: null, company_id: null, sender_identity: null, metadata: null },
          ],
          error: null,
        }).then(onFulfilled, onRejected),
    };

    const campaignsQuery = {
      select: vi.fn(() => campaignsQuery),
      in: vi.fn(async () => ({
        data: [{ id: 'camp-1', name: 'Alpha' }],
        error: null,
      })),
    };

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'email_events') return emailEventsQuery;
        if (table === 'email_outbound') return emailOutboundQuery;
        if (table === 'campaigns') return campaignsQuery;
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const bounced = await listInboxReplies(client, { category: 'bounce', limit: 10 });
    expect(bounced.total).toBe(1);
    expect(bounced.replies[0].id).toBe('evt-bounce');

    const unclassified = await listInboxReplies(client, { category: 'unclassified', limit: 10 });
    expect(unclassified.total).toBe(1);
    expect(unclassified.replies[0].id).toBe('evt-unclassified');

    const positive = await listInboxReplies(client, { category: 'positive', limit: 10 });
    expect(positive.total).toBe(1);
    expect(positive.replies[0].id).toBe('evt-positive');
  });
});
