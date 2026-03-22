import { describe, expect, it, vi } from 'vitest';

import { listCampaignEvents } from '../src/services/campaignEventReadModels';

describe('campaign event read models', () => {
  it('lists campaign events with outbound context', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'review',
        segment_id: 'segment-1',
        segment_version: 2,
        created_at: '2026-03-15T10:00:00Z',
        updated_at: '2026-03-15T11:00:00Z',
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const outboundsOrderSentAt = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'out-1',
          status: 'sent',
          provider: 'imap_mcp',
          provider_message_id: '<msg-1@example.com>',
          sender_identity: 'sales-1@example.com',
          sent_at: '2026-03-15T10:00:00Z',
          created_at: '2026-03-15T10:00:00Z',
          error: null,
          pattern_mode: 'direct',
          metadata: {
            recipient_email: 'alice@example.com',
            recipient_email_source: 'work',
            recipient_email_kind: 'corporate',
          },
          draft_id: 'draft-1',
          contact_id: 'contact-1',
          company_id: 'comp-1',
        },
      ],
      error: null,
    });
    const outboundsEq = vi.fn().mockReturnValue({ order: outboundsOrderSentAt });
    const outboundsSelect = vi.fn().mockReturnValue({ eq: outboundsEq });

    const draftsIn = vi.fn().mockResolvedValue({
      data: [{ id: 'draft-1', email_type: 'intro', status: 'sent', subject: 'Hello there' }],
      error: null,
    });
    const draftsSelect = vi.fn().mockReturnValue({ in: draftsIn });

    const contactsIn = vi.fn().mockResolvedValue({
      data: [{ id: 'contact-1', full_name: 'Alice Doe', position: 'CEO' }],
      error: null,
    });
    const contactsSelect = vi.fn().mockReturnValue({ in: contactsIn });

    const companiesIn = vi.fn().mockResolvedValue({
      data: [{ id: 'comp-1', company_name: 'Example Co', website: 'https://example.com' }],
      error: null,
    });
    const companiesSelect = vi.fn().mockReturnValue({ in: companiesIn });

    const eventsOrderCreatedAt = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'evt-1',
          outbound_id: 'out-1',
          event_type: 'replied',
          outcome_classification: 'soft_interest',
          provider_event_id: 'provider-evt-1',
          occurred_at: '2026-03-15T12:00:00Z',
          created_at: '2026-03-15T12:00:00Z',
          payload: { snippet: 'Interested' },
          pattern_id: 'direct',
          coach_prompt_id: 'draft_intro_v1',
          draft_id: 'draft-1',
        },
      ],
      error: null,
    });
    const eventsOrderOccurredAt = vi.fn().mockReturnValue({ order: eventsOrderCreatedAt });
    const eventsIn = vi.fn().mockReturnValue({ order: eventsOrderOccurredAt });
    const eventsSelect = vi.fn().mockReturnValue({ in: eventsIn });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') return { select: campaignSelect };
        if (table === 'email_outbound') return { select: outboundsSelect };
        if (table === 'email_events') return { select: eventsSelect };
        if (table === 'drafts') return { select: draftsSelect };
        if (table === 'employees') return { select: contactsSelect };
        if (table === 'companies') return { select: companiesSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await listCampaignEvents(supabase, 'camp-1');

    expect(result.campaign.id).toBe('camp-1');
    expect(eventsIn).toHaveBeenCalledWith('outbound_id', ['out-1']);
    expect(result.events[0]).toMatchObject({
      id: 'evt-1',
      event_type: 'replied',
      outcome_classification: 'soft_interest',
      subject: 'Hello there',
      contact_name: 'Alice Doe',
      company_name: 'Example Co',
      recipient_email: 'alice@example.com',
      provider: 'imap_mcp',
    });
  });
});
