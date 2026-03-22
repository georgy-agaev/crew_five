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

    const emailOutboundQuery = {
      select: vi.fn(() => emailOutboundQuery),
      in: vi.fn(async () => ({
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
      })),
      eq: vi.fn(() => emailOutboundQuery),
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
});
