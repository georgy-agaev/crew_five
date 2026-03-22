import { describe, expect, it, vi } from 'vitest';

import { getCampaignSendPreflight } from '../src/services/campaignSendPreflight';

describe('getCampaignSendPreflight', () => {
  it('builds a blocked preflight summary from sender plan, draft approval, and recipient resolution', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-1',
        name: 'Spring Push',
        status: 'ready',
        segment_id: 'seg-1',
        segment_version: 1,
        created_at: '2026-03-20T10:00:00Z',
        updated_at: '2026-03-20T11:00:00Z',
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const mailboxOrder = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const mailboxEq = vi.fn().mockReturnValue({ order: mailboxOrder });
    const mailboxSelect = vi.fn().mockReturnValue({ eq: mailboxEq });

    const draftsEq = vi.fn().mockResolvedValue({
      data: [
        { id: 'draft-1', status: 'approved', contact_id: 'contact-1' },
        { id: 'draft-2', status: 'approved', contact_id: 'contact-2' },
        { id: 'draft-3', status: 'generated', contact_id: 'contact-3' },
        { id: 'draft-4', status: 'rejected', contact_id: 'contact-4' },
      ],
      error: null,
    });
    const draftsSelect = vi.fn().mockReturnValue({ eq: draftsEq });

    const employeesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'contact-1',
          work_email: 'anna@acme.ai',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
        },
        {
          id: 'contact-2',
          work_email: null,
          work_email_status: null,
          generic_email: null,
          generic_email_status: null,
        },
        {
          id: 'contact-3',
          work_email: 'ceo@beta.ai',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
        },
      ],
      error: null,
    });
    const employeesSelect = vi.fn().mockReturnValue({ in: employeesIn });

    const outboundsEq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const outboundsSelect = vi.fn().mockReturnValue({ eq: outboundsEq });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') return { select: campaignSelect };
        if (table === 'campaign_mailbox_assignments') return { select: mailboxSelect };
        if (table === 'drafts') return { select: draftsSelect };
        if (table === 'employees') return { select: employeesSelect };
        if (table === 'email_outbound') return { select: outboundsSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignSendPreflight(supabase, 'camp-1');

    expect(result.campaign.id).toBe('camp-1');
    expect(result.readyToSend).toBe(false);
    expect(result.blockers.map((row) => row.code)).toEqual([
      'no_sender_assignment',
      'draft_not_approved',
      'missing_recipient_email',
    ]);
    expect(result.summary).toEqual({
      mailboxAssignmentCount: 0,
      draftCount: 4,
      approvedDraftCount: 2,
      generatedDraftCount: 1,
      rejectedDraftCount: 1,
      sentDraftCount: 0,
      sendableApprovedDraftCount: 1,
      approvedMissingRecipientEmailCount: 1,
      approvedSuppressedContactCount: 0,
    });
    expect(result.senderPlan).toEqual({
      assignmentCount: 0,
      mailboxAccountCount: 0,
      senderIdentityCount: 0,
      domainCount: 0,
      domains: [],
    });
  });

  it('marks campaign paused and no-sendable-drafts blockers when applicable', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-2',
        name: 'Paused Campaign',
        status: 'paused',
        segment_id: 'seg-2',
        segment_version: 2,
        created_at: '2026-03-20T10:00:00Z',
        updated_at: '2026-03-20T11:00:00Z',
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const mailboxOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'assign-1',
          campaign_id: 'camp-2',
          mailbox_account_id: 'mbox-1',
          sender_identity: 'sales@acme.ai',
          provider: 'imap_mcp',
          source: 'outreacher',
          assigned_at: '2026-03-20T12:00:00Z',
          metadata: null,
        },
      ],
      error: null,
    });
    const mailboxEq = vi.fn().mockReturnValue({ order: mailboxOrder });
    const mailboxSelect = vi.fn().mockReturnValue({ eq: mailboxEq });

    const draftsEq = vi.fn().mockResolvedValue({
      data: [
        { id: 'draft-10', status: 'approved', contact_id: 'contact-10' },
        { id: 'draft-11', status: 'rejected', contact_id: 'contact-11' },
      ],
      error: null,
    });
    const draftsSelect = vi.fn().mockReturnValue({ eq: draftsEq });

    const employeesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'contact-10',
          work_email: null,
          work_email_status: null,
          generic_email: null,
          generic_email_status: null,
        },
      ],
      error: null,
    });
    const employeesSelect = vi.fn().mockReturnValue({ in: employeesIn });

    const outboundsEq = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const outboundsSelect = vi.fn().mockReturnValue({ eq: outboundsEq });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') return { select: campaignSelect };
        if (table === 'campaign_mailbox_assignments') return { select: mailboxSelect };
        if (table === 'drafts') return { select: draftsSelect };
        if (table === 'employees') return { select: employeesSelect };
        if (table === 'email_outbound') return { select: outboundsSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignSendPreflight(supabase, 'camp-2');

    expect(result.readyToSend).toBe(false);
    expect(result.blockers.map((row) => row.code)).toEqual([
      'campaign_paused',
      'missing_recipient_email',
      'no_sendable_drafts',
    ]);
    expect(result.summary.sendableApprovedDraftCount).toBe(0);
    expect(result.summary.approvedSuppressedContactCount).toBe(0);
    expect(result.senderPlan.assignmentCount).toBe(1);
    expect(result.senderPlan.domains).toEqual(['acme.ai']);
  });

  it('blocks approved drafts for suppressed contacts even when recipient email is present', async () => {
    const campaignSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'camp-3',
        name: 'Suppressed Campaign',
        status: 'ready',
        segment_id: 'seg-3',
        segment_version: 1,
        created_at: '2026-03-20T10:00:00Z',
        updated_at: '2026-03-20T11:00:00Z',
      },
      error: null,
    });
    const campaignEq = vi.fn().mockReturnValue({ single: campaignSingle });
    const campaignSelect = vi.fn().mockReturnValue({ eq: campaignEq });

    const mailboxOrder = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'assign-3',
          campaign_id: 'camp-3',
          mailbox_account_id: 'mbox-3',
          sender_identity: 'sales@acme.ai',
          provider: 'imap_mcp',
          source: 'outreacher',
          assigned_at: '2026-03-20T12:00:00Z',
          metadata: null,
        },
      ],
      error: null,
    });
    const mailboxEq = vi.fn().mockReturnValue({ order: mailboxOrder });
    const mailboxSelect = vi.fn().mockReturnValue({ eq: mailboxEq });

    const draftsEq = vi.fn().mockResolvedValue({
      data: [
        { id: 'draft-20', status: 'approved', contact_id: 'contact-20', email_type: 'intro' },
      ],
      error: null,
    });
    const draftsSelect = vi.fn().mockReturnValue({ eq: draftsEq });

    const employeesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'contact-20',
          work_email: 'anna@acme.ai',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
        },
      ],
      error: null,
    });
    const employeesSelect = vi.fn().mockReturnValue({ in: employeesIn });

    const outboundsEq = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'out-20',
          contact_id: 'contact-20',
          draft_id: 'draft-older',
          status: 'sent',
        },
      ],
      error: null,
    });
    const outboundsSelect = vi.fn().mockReturnValue({ eq: outboundsEq });

    const eventsIn = vi.fn().mockResolvedValue({
      data: [{ outbound_id: 'out-20', event_type: 'unsubscribed' }],
      error: null,
    });
    const eventsSelect = vi.fn().mockReturnValue({ in: eventsIn });

    const supabase = {
      from: vi.fn((table: string) => {
        if (table === 'campaigns') return { select: campaignSelect };
        if (table === 'campaign_mailbox_assignments') return { select: mailboxSelect };
        if (table === 'drafts') return { select: draftsSelect };
        if (table === 'employees') return { select: employeesSelect };
        if (table === 'email_outbound') return { select: outboundsSelect };
        if (table === 'email_events') return { select: eventsSelect };
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignSendPreflight(supabase, 'camp-3');

    expect(result.readyToSend).toBe(false);
    expect(result.blockers.map((row) => row.code)).toEqual([
      'suppressed_contact',
      'no_sendable_drafts',
    ]);
    expect(result.summary.sendableApprovedDraftCount).toBe(0);
    expect(result.summary.approvedSuppressedContactCount).toBe(1);
  });
});
