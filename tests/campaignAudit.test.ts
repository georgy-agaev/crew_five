import { describe, expect, it, vi } from 'vitest';

import { getCampaignAudit } from '../src/services/campaignAudit';

describe('getCampaignAudit', () => {
  it('builds coverage summary and drill-down issues for a campaign', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-1',
        name: 'Q1 Push',
        status: 'review',
        segment_id: 'seg-1',
        segment_version: 1,
        created_at: '2026-03-15T10:00:00Z',
        updated_at: '2026-03-15T11:00:00Z',
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const membersMatch = vi.fn().mockResolvedValue({
      data: [
        { company_id: 'comp-1', contact_id: 'contact-1', snapshot: { company: { company_name: 'Alpha' } } },
        { company_id: 'comp-1', contact_id: 'contact-2', snapshot: { company: { company_name: 'Alpha' } } },
        { company_id: 'comp-2', contact_id: 'contact-3', snapshot: { company: { company_name: 'Beta' } } },
      ],
      error: null,
    });
    const membersSelect = vi.fn().mockReturnValue({ match: membersMatch });
    const additionsEq = vi.fn().mockResolvedValue({ data: [], error: null });
    const additionsSelect = vi.fn().mockReturnValue({ eq: additionsEq });

    const companiesIn = vi.fn().mockResolvedValue({
      data: [
        { id: 'comp-1', company_name: 'Alpha', website: 'https://alpha.example', company_research: { lastUpdatedAt: '2026-03-10T10:00:00Z' }, updated_at: '2026-03-10T10:00:00Z' },
        { id: 'comp-2', company_name: 'Beta', website: 'https://beta.example', company_research: null, updated_at: '2025-12-01T10:00:00Z' },
      ],
      error: null,
    });
    const companiesSelect = vi.fn().mockReturnValue({ in: companiesIn });

    const employeesIn = vi.fn().mockResolvedValue({
      data: [
        { id: 'contact-1', full_name: 'Alice', position: 'CEO', work_email: null, generic_email: null, company_id: 'comp-1' },
        { id: 'contact-2', full_name: 'Bob', position: 'CTO', work_email: 'bob@alpha.example', generic_email: null, company_id: 'comp-1' },
        { id: 'contact-3', full_name: 'Cara', position: 'CFO', work_email: null, generic_email: 'info@beta.example', company_id: 'comp-2' },
      ],
      error: null,
    });
    const employeesSelect = vi.fn().mockReturnValue({ in: employeesIn });

    const campaignDraftsOrder = vi.fn().mockResolvedValue({
      data: [
        { id: 'draft-1', contact_id: 'contact-1', company_id: 'comp-1', email_type: 'intro', status: 'approved', subject: 'Subject 1' },
        { id: 'draft-2', contact_id: 'contact-2', company_id: 'comp-9', email_type: 'intro', status: 'sent', subject: 'Subject 2' },
        { id: 'draft-3', contact_id: 'contact-2', company_id: 'comp-9', email_type: 'intro', status: 'generated', subject: 'Subject 3' },
      ],
      error: null,
    });
    const campaignDraftsEq = vi.fn().mockReturnValue({ order: campaignDraftsOrder });

    const outboundDraftsIn = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const outboundDraftsSelect = vi.fn().mockReturnValue({ in: outboundDraftsIn });

    const draftsSelect = vi.fn((columns: string) =>
      columns === 'id,contact_id,company_id,email_type,status,subject'
        ? { eq: campaignDraftsEq }
        : { in: outboundDraftsSelect }
    );

    const outboundsOrderSentAt = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'out-1',
          status: 'sent',
          provider: 'imap_mcp',
          provider_message_id: '<msg-1@example.com>',
          sender_identity: 'sales@example.com',
          sent_at: '2026-03-16T10:00:00Z',
          created_at: '2026-03-16T10:00:00Z',
          error: null,
          pattern_mode: 'direct',
          metadata: {},
          draft_id: null,
          contact_id: 'contact-3',
          company_id: 'comp-2',
        },
      ],
      error: null,
    });
    const outboundsEq = vi.fn().mockReturnValue({ order: outboundsOrderSentAt });
    const outboundsSelect = vi.fn().mockReturnValue({ eq: outboundsEq });

    const eventsOrderCreatedAt = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'evt-1',
          outbound_id: 'out-1',
          event_type: 'replied',
          outcome_classification: 'soft_interest',
          provider_event_id: 'provider-evt-1',
          occurred_at: '2026-03-16T11:00:00Z',
          created_at: '2026-03-16T11:00:00Z',
          payload: null,
          pattern_id: 'direct',
          coach_prompt_id: 'draft_intro_v1',
          draft_id: null,
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
        if (table === 'segment_members') return { select: membersSelect };
        if (table === 'campaign_member_additions') return { select: additionsSelect };
        if (table === 'campaign_member_exclusions')
          return { select: () => ({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        if (table === 'companies') return { select: companiesSelect };
        if (table === 'employees') return { select: employeesSelect };
        if (table === 'drafts') return { select: draftsSelect };
        if (table === 'email_outbound') return { select: outboundsSelect };
        if (table === 'email_events') return { select: eventsSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignAudit(supabase, 'camp-1');

    expect(employeesSelect).toHaveBeenCalledWith(
      'id,full_name,position,work_email,work_email_status,generic_email,generic_email_status,company_id'
    );

    expect(result.summary.company_count).toBe(2);
    expect(result.summary.snapshot_contact_count).toBe(3);
    expect(result.summary.contacts_with_any_draft).toBe(2);
    expect(result.summary.contacts_with_intro_draft).toBe(2);
    expect(result.summary.contacts_with_bump_draft).toBe(0);
    expect(result.summary.contacts_with_sent_outbound).toBe(1);
    expect(result.summary.contacts_with_events).toBe(1);
    expect(result.summary.draft_count).toBe(3);
    expect(result.summary.approved_draft_count).toBe(1);
    expect(result.summary.sent_draft_count).toBe(1);
    expect(result.summary.drafts_missing_recipient_email_count).toBe(1);
    expect(result.summary.duplicate_draft_pair_count).toBe(1);
    expect(result.summary.draft_company_mismatch_count).toBe(2);
    expect(result.summary.sent_drafts_without_outbound_count).toBe(1);
    expect(result.summary.outbounds_without_draft_count).toBe(1);
    expect(result.summary.outbound_missing_recipient_email_count).toBe(1);
    expect(result.summary.replied_event_count).toBe(1);

    expect(result.issues.snapshot_contacts_without_draft).toEqual([
      expect.objectContaining({ contact_id: 'contact-3', contact_name: 'Cara', company_name: 'Beta' }),
    ]);
    expect(result.issues.drafts_missing_recipient_email).toEqual([
      expect.objectContaining({ draft_id: 'draft-1', contact_name: 'Alice' }),
    ]);
    expect(result.issues.duplicate_drafts).toEqual([
      expect.objectContaining({ contact_id: 'contact-2', draft_ids: ['draft-2', 'draft-3'] }),
    ]);
    expect(result.issues.sent_drafts_without_outbound).toEqual([
      expect.objectContaining({ draft_id: 'draft-2', contact_name: 'Bob' }),
    ]);
    expect(result.issues.outbounds_without_draft).toEqual([
      expect.objectContaining({ outbound_id: 'out-1', contact_name: 'Cara' }),
    ]);
    expect(result.issues.outbounds_missing_recipient_email).toEqual([
      expect.objectContaining({ outbound_id: 'out-1', contact_name: 'Cara' }),
    ]);
  });
});
