import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/campaignFollowupCandidates.js', () => ({
  listCampaignFollowupCandidates: vi.fn(),
}));

vi.mock('../src/services/campaignSendPolicy.js', () => ({
  getCampaignSendPolicy: vi.fn(),
}));

const { listCampaignFollowupCandidates } = await import('../src/services/campaignFollowupCandidates.js');
const { getCampaignSendPolicy } = await import('../src/services/campaignSendPolicy.js');

import { loadDrafts, updateDraftContent, updateDraftStatus } from '../src/services/draftStore';

describe('draftStore recipient-context updates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-01T10:00:00Z'));
    vi.mocked(getCampaignSendPolicy).mockResolvedValue({
      campaignId: 'camp-1',
      campaignName: 'Campaign 1',
      campaignStatus: 'sending',
      updatedAt: '2026-04-01T09:00:00Z',
      sendTimezone: 'Europe/Paris',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'elapsed_days',
      sendCalendarCountryCode: null,
      sendCalendarSubdivisionCode: null,
    } as any);
    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([] as any);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns enriched draft context after status review updates', async () => {
    const detailSingle = vi.fn().mockResolvedValue({
      data: {
        id: 'draft-1',
        campaign_id: 'camp-1',
        email_type: 'intro',
        status: 'approved',
        contact_id: 'contact-1',
        company_id: 'company-1',
        contact: {
          id: 'contact-1',
          full_name: 'Ivan Petrov',
          position: 'CEO',
          work_email: 'ivan@acme.test',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
          company_name: 'Acme LLC',
        },
        company: {
          id: 'company-1',
          company_name: 'Acme LLC',
          website: 'https://acme.test',
        },
      },
      error: null,
    });
    const updateSingle = vi.fn().mockResolvedValue({
      data: { id: 'draft-1', status: 'approved' },
      error: null,
    });
    const select = vi.fn((query?: string) => {
      if (query === 'metadata') {
        return {
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { metadata: null },
              error: null,
            }),
          }),
        };
      }
      return {
        eq: vi.fn().mockReturnValue({
          single: detailSingle,
        }),
      };
    });
    const update = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: updateSingle,
        }),
      }),
    });
    const from = vi.fn((table: string) => {
      if (table !== 'drafts') throw new Error(`Unexpected table ${table}`);
      return { update, select };
    });

    const result = await updateDraftStatus({ from } as any, {
      draftId: 'draft-1',
      status: 'approved',
      reviewer: 'builder-v2',
    });

    expect(result.contact.full_name).toBe('Ivan Petrov');
    expect(result.company.company_name).toBe('Acme LLC');
    expect(result.recipient_email).toBe('ivan@acme.test');
    expect(result.sendable).toBe(true);
  });

  it('returns enriched draft context after content edits', async () => {
    const single = vi
      .fn()
      .mockResolvedValueOnce({
        data: { id: 'draft-1', subject: 'Updated' },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 'draft-1',
          subject: 'Updated',
          contact_id: 'contact-1',
          company_id: 'company-1',
          contact: {
            id: 'contact-1',
            full_name: 'Anna Smirnova',
            position: 'COO',
            work_email: null,
            work_email_status: null,
            generic_email: 'hello@acme.test',
            generic_email_status: 'valid',
            company_name: 'Acme LLC',
          },
          company: {
            id: 'company-1',
            company_name: 'Acme LLC',
            website: 'https://acme.test',
          },
        },
        error: null,
      });
    const eq = vi.fn().mockReturnThis();
    const update = vi.fn().mockReturnValue({ eq, select: () => ({ single }) });
    const select = vi.fn(() => ({ eq, single }));
    const from = vi.fn((table: string) => {
      if (table !== 'drafts') throw new Error(`Unexpected table ${table}`);
      return { update, select };
    });

    const result = await updateDraftContent({ from } as any, {
      draftId: 'draft-1',
      subject: 'Updated',
      body: 'Updated body',
    });

    expect(result.contact.full_name).toBe('Anna Smirnova');
    expect(result.company.company_name).toBe('Acme LLC');
    expect(result.recipient_email).toBe('hello@acme.test');
    expect(result.sendable).toBe(true);
  });

  it('returns bump review visibility states for generated, approved-today, and approved-sendable drafts', async () => {
    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([
      {
        contact_id: 'contact-approved-today',
        company_id: 'company-2',
        intro_sent: true,
        intro_sent_at: '2026-03-27T08:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: true,
        days_since_intro: 5,
        auto_reply: null,
      },
      {
        contact_id: 'contact-approved-sendable',
        company_id: 'company-3',
        intro_sent: true,
        intro_sent_at: '2026-03-27T08:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: true,
        days_since_intro: 5,
        auto_reply: null,
      },
    ] as any);

    const rows = [
      {
        id: 'draft-generated',
        campaign_id: 'camp-1',
        contact_id: 'contact-generated',
        company_id: 'company-1',
        email_type: 'bump',
        status: 'generated',
        metadata: { auto_generated: true },
        contact: {
          id: 'contact-generated',
          full_name: 'Generated Contact',
          position: 'CEO',
          work_email: 'generated@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
          company_name: 'Acme',
        },
        company: {
          id: 'company-1',
          company_name: 'Acme',
          website: 'https://acme.test',
        },
      },
      {
        id: 'draft-approved-today',
        campaign_id: 'camp-1',
        contact_id: 'contact-approved-today',
        company_id: 'company-2',
        email_type: 'bump',
        status: 'approved',
        metadata: { approved_at: '2026-04-01T08:15:00Z', auto_generated: true },
        contact: {
          id: 'contact-approved-today',
          full_name: 'Approved Today',
          position: 'COO',
          work_email: 'today@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
          company_name: 'Beta',
        },
        company: {
          id: 'company-2',
          company_name: 'Beta',
          website: 'https://beta.test',
        },
      },
      {
        id: 'draft-approved-sendable',
        campaign_id: 'camp-1',
        contact_id: 'contact-approved-sendable',
        company_id: 'company-3',
        email_type: 'bump',
        status: 'approved',
        metadata: { approved_at: '2026-03-31T08:15:00Z', auto_generated: true },
        contact: {
          id: 'contact-approved-sendable',
          full_name: 'Approved Sendable',
          position: 'CFO',
          work_email: 'sendable@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
          company_name: 'Gamma',
        },
        company: {
          id: 'company-3',
          company_name: 'Gamma',
          website: 'https://gamma.test',
        },
      },
    ];

    const order = vi.fn().mockResolvedValue({
      data: rows,
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn((table: string) => {
      if (table !== 'drafts') throw new Error(`Unexpected table ${table}`);
      return { select };
    });

    const result = await loadDrafts({ from } as any, {
      campaignId: 'camp-1',
      includeRecipientContext: true,
    });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'draft-generated',
          bump_lifecycle_state: 'generated_pending_review',
          bump_can_send_now: false,
          bump_send_block_reasons: ['pending_review'],
        }),
        expect.objectContaining({
          id: 'draft-approved-today',
          bump_lifecycle_state: 'approved_waiting_next_day',
          bump_can_send_now: false,
          bump_send_block_reasons: ['approved_today'],
        }),
        expect.objectContaining({
          id: 'draft-approved-sendable',
          bump_lifecycle_state: 'approved_sendable',
          bump_can_send_now: true,
          bump_send_block_reasons: [],
        }),
      ])
    );
  });
});
