import { describe, expect, it, vi } from 'vitest';

import { dispatch } from '../src/web/server';

describe('web campaign events endpoint', () => {
  it('routes campaign events endpoint', async () => {
    const listCampaignEvents = vi.fn(async () => ({
      campaign: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'review',
        segment_id: 'seg-1',
        segment_version: 2,
      },
      events: [
        {
          id: 'evt-1',
          outbound_id: 'out-1',
          event_type: 'replied',
          outcome_classification: 'soft_interest',
          provider_event_id: 'provider-evt-1',
          occurred_at: '2026-03-15T12:00:00Z',
          created_at: '2026-03-15T12:00:00Z',
          pattern_id: 'direct',
          coach_prompt_id: 'draft_intro_v1',
          payload: null,
          draft_id: 'draft-1',
          draft_email_type: 'intro',
          draft_status: 'sent',
          subject: 'Hello there',
          provider: 'imap_mcp',
          provider_message_id: '<msg-1@example.com>',
          sender_identity: 'sales-1@example.com',
          sent_at: '2026-03-15T10:00:00Z',
          recipient_email: 'alice@example.com',
          recipient_email_source: 'work',
          recipient_email_kind: 'corporate',
          contact_id: 'contact-1',
          contact_name: 'Alice Doe',
          contact_position: 'CEO',
          company_id: 'comp-1',
          company_name: 'Example Co',
          company_website: 'https://example.com',
        },
      ],
    }));

    const response = await dispatch(
      {
        listCampaigns: vi.fn(async () => []),
        listCampaignEvents,
        listDrafts: vi.fn(async () => []),
        generateDrafts: vi.fn(async () => ({ generated: 0, dryRun: true })),
        sendSmartlead: vi.fn(async () => ({
          dryRun: true,
          campaignId: 'camp-1',
          smartleadCampaignId: 'sl-1',
          leadsPrepared: 0,
          leadsPushed: 0,
          sequencesPrepared: 0,
          sequencesSynced: 0,
          skippedContactsNoEmail: 0,
        })),
        listEvents: vi.fn(async () => []),
        listReplyPatterns: vi.fn(async () => []),
      },
      { method: 'GET', pathname: '/api/campaigns/camp-1/events' }
    );

    expect(listCampaignEvents).toHaveBeenCalledWith('camp-1');
    expect(response.status).toBe(200);
    expect((response.body as any).events[0].id).toBe('evt-1');
  });
});
