import { describe, expect, it, vi } from 'vitest';

import { dispatch } from '../src/web/server';

describe('web campaign ops endpoints', () => {
  it('routes campaign companies detail endpoint', async () => {
    const listCampaignCompanies = vi.fn(async () => ({
      campaign: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'draft',
        segment_id: 'seg-1',
        segment_version: 2,
      },
      companies: [
        {
          company_id: 'comp-1',
          company_name: 'Example Co',
          website: 'https://example.com',
          employee_count: 42,
          region: 'Paris',
          office_qualification: 'Less',
          company_description: 'Example description',
          company_research: { facts: ['x'] },
          contact_count: 2,
          enrichment: {
            status: 'fresh',
            last_updated_at: '2026-03-15T10:00:00Z',
            provider_hint: 'exa',
          },
        },
      ],
    }));

    const response = await dispatch(
      {
        listCampaigns: vi.fn(async () => []),
        listCampaignCompanies,
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
      { method: 'GET', pathname: '/api/campaigns/camp-1/companies' }
    );

    expect(listCampaignCompanies).toHaveBeenCalledWith('camp-1');
    expect(response.status).toBe(200);
    expect((response.body as any).campaign.id).toBe('camp-1');
    expect((response.body as any).companies[0].company_id).toBe('comp-1');
  });

  it('routes draft review status updates', async () => {
    const updateDraftStatus = vi.fn(async () => ({
      id: 'draft-1',
      status: 'rejected',
      reviewer: 'campaigns-ui',
      metadata: {
        review_surface: 'campaigns',
        review_reason_code: 'marketing_tone',
        review_reason_codes: ['marketing_tone', 'too_generic'],
        review_reason_text: 'Feels too promotional.',
      },
    }));

    const response = await dispatch(
      {
        listCampaigns: vi.fn(async () => []),
        listDrafts: vi.fn(async () => []),
        updateDraftStatus,
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
      {
        method: 'POST',
        pathname: '/api/drafts/draft-1/status',
        body: {
          status: 'rejected',
          reviewer: 'campaigns-ui',
          metadata: {
            review_surface: 'campaigns',
            review_reason_code: 'marketing_tone',
            review_reason_codes: ['marketing_tone', 'too_generic'],
            review_reason_text: 'Feels too promotional.',
          },
        },
      }
    );

    expect(updateDraftStatus).toHaveBeenCalledWith({
      draftId: 'draft-1',
      status: 'rejected',
      reviewer: 'campaigns-ui',
      metadata: {
        review_surface: 'campaigns',
        review_reason_code: 'marketing_tone',
        review_reason_codes: ['marketing_tone', 'too_generic'],
        review_reason_text: 'Feels too promotional.',
      },
    });
    expect(response.status).toBe(200);
    expect((response.body as any).status).toBe('rejected');
  });

  it('routes draft content updates', async () => {
    const updateDraftContent = vi.fn(async () => ({
      id: 'draft-1',
      subject: 'Updated subject',
      body: 'Updated body',
      status: 'generated',
    }));

    const response = await dispatch(
      {
        listCampaigns: vi.fn(async () => []),
        listDrafts: vi.fn(async () => []),
        updateDraftContent,
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
      {
        method: 'POST',
        pathname: '/api/drafts/draft-1/content',
        body: {
          subject: 'Updated subject',
          body: 'Updated body',
        },
      }
    );

    expect(updateDraftContent).toHaveBeenCalledWith({
      draftId: 'draft-1',
      subject: 'Updated subject',
      body: 'Updated body',
    });
    expect(response.status).toBe(200);
    expect((response.body as any).subject).toBe('Updated subject');
  });

  it('routes campaign outbounds endpoint', async () => {
    const listCampaignOutbounds = vi.fn(async () => ({
      campaign: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'review',
        segment_id: 'seg-1',
        segment_version: 2,
      },
      outbounds: [
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
          draft_id: 'draft-1',
          draft_email_type: 'intro',
          draft_status: 'sent',
          subject: 'Hello there',
          contact_id: 'contact-1',
          contact_name: 'Alice Doe',
          contact_position: 'CEO',
          company_id: 'comp-1',
          company_name: 'Example Co',
          company_website: 'https://example.com',
          recipient_email: 'alice@example.com',
          recipient_email_source: 'work',
          recipient_email_kind: 'corporate',
          metadata: null,
        },
      ],
    }));

    const response = await dispatch(
      {
        listCampaigns: vi.fn(async () => []),
        listCampaignOutbounds,
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
      { method: 'GET', pathname: '/api/campaigns/camp-1/outbounds' }
    );

    expect(listCampaignOutbounds).toHaveBeenCalledWith('camp-1');
    expect(response.status).toBe(200);
    expect((response.body as any).outbounds[0].id).toBe('out-1');
  });

  it('routes campaign audit endpoint', async () => {
    const getCampaignAudit = vi.fn(async () => ({
      campaign: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'review',
        segment_id: 'seg-1',
        segment_version: 2,
      },
      summary: {
        company_count: 3,
        snapshot_contact_count: 7,
        contacts_with_any_draft: 6,
        contacts_with_intro_draft: 5,
        contacts_with_bump_draft: 1,
        contacts_with_sent_outbound: 4,
        contacts_with_events: 2,
        draft_count: 7,
        generated_draft_count: 1,
        approved_draft_count: 5,
        rejected_draft_count: 1,
        sent_draft_count: 1,
        sendable_draft_count: 6,
        unsendable_draft_count: 1,
        outbound_count: 4,
        outbound_sent_count: 4,
        outbound_failed_count: 0,
        outbound_missing_recipient_email_count: 0,
        event_count: 2,
        replied_event_count: 1,
        bounced_event_count: 1,
        unsubscribed_event_count: 0,
        snapshot_contacts_without_draft_count: 1,
        drafts_missing_recipient_email_count: 1,
        duplicate_draft_pair_count: 0,
        draft_company_mismatch_count: 0,
        sent_drafts_without_outbound_count: 0,
        outbounds_without_draft_count: 0,
      },
      issues: {
        snapshot_contacts_without_draft: [{ contact_id: 'contact-7' }],
        drafts_missing_recipient_email: [{ draft_id: 'draft-7' }],
        duplicate_drafts: [],
        draft_company_mismatches: [],
        sent_drafts_without_outbound: [],
        outbounds_without_draft: [],
        outbounds_missing_recipient_email: [],
      },
    }));

    const response = await dispatch(
      {
        listCampaigns: vi.fn(async () => []),
        getCampaignAudit,
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
      { method: 'GET', pathname: '/api/campaigns/camp-1/audit' }
    );

    expect(getCampaignAudit).toHaveBeenCalledWith('camp-1');
    expect(response.status).toBe(200);
    expect((response.body as any).summary.snapshot_contact_count).toBe(7);
    expect((response.body as any).issues.drafts_missing_recipient_email[0].draft_id).toBe('draft-7');
  });
});
