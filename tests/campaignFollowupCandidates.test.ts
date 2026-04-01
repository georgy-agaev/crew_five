import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/campaignSendPolicy', () => ({
  getCampaignSendPolicy: vi.fn(),
}));

vi.mock('date-holidays', () => {
  return {
    default: class MockHolidays {
      private countryCode: string;

      constructor(countryCode: string) {
        this.countryCode = countryCode;
      }

      getHolidays(year: number) {
        if (this.countryCode === 'RU' && year === 2026) {
          return [{ date: '2026-03-04 00:00:00', name: 'Midweek Holiday', type: 'public' }];
        }
        return [];
      }

      isHoliday(date: Date) {
        const isoDate = date.toISOString().slice(0, 10);
        if (this.countryCode === 'RU' && isoDate === '2026-03-04') {
          return [{ date: isoDate, name: 'Midweek Holiday', type: 'public' }];
        }
        return [];
      }
    },
  };
});

const { getCampaignSendPolicy } = await import('../src/services/campaignSendPolicy');
import { listCampaignFollowupCandidates } from '../src/services/campaignFollowupCandidates';

describe('campaignFollowupCandidates', () => {
  it('derives intro follow-up eligibility from drafts, outbounds, and events', async () => {
    vi.mocked(getCampaignSendPolicy).mockResolvedValue({
      campaignId: 'camp-1',
      campaignName: 'Campaign 1',
      campaignStatus: 'sending',
      updatedAt: '2026-03-01T10:00:00Z',
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'elapsed_days',
      sendCalendarCountryCode: null,
      sendCalendarSubdivisionCode: null,
    } as any);

    const drafts = [
      { id: 'draft-intro-1', contact_id: 'contact-1', company_id: 'company-1', email_type: 'intro', status: 'sent' },
      { id: 'draft-bump-1', contact_id: 'contact-1', company_id: 'company-1', email_type: 'bump', status: 'approved' },
      { id: 'draft-intro-2', contact_id: 'contact-2', company_id: 'company-2', email_type: 'intro', status: 'sent' },
      { id: 'draft-bump-2', contact_id: 'contact-2', company_id: 'company-2', email_type: 'bump', status: 'approved' },
      { id: 'draft-intro-3', contact_id: 'contact-3', company_id: 'company-3', email_type: 'intro', status: 'sent' },
      { id: 'draft-bump-3', contact_id: 'contact-3', company_id: 'company-3', email_type: 'bump', status: 'approved' },
      { id: 'draft-intro-4', contact_id: 'contact-4', company_id: 'company-4', email_type: 'intro', status: 'sent' },
      { id: 'draft-bump-4', contact_id: 'contact-4', company_id: 'company-4', email_type: 'bump', status: 'approved' },
    ];
    const outbounds = [
      {
        id: 'out-intro-1',
        campaign_id: 'camp-1',
        contact_id: 'contact-1',
        company_id: 'company-1',
        draft_id: 'draft-intro-1',
        status: 'sent',
        sent_at: '2026-03-10T10:00:00Z',
        sender_identity: 'sales-1@example.com',
      },
      {
        id: 'out-intro-2',
        campaign_id: 'camp-1',
        contact_id: 'contact-2',
        company_id: 'company-2',
        draft_id: 'draft-intro-2',
        status: 'sent',
        sent_at: '2026-03-10T10:00:00Z',
        sender_identity: 'sales-2@example.com',
      },
      {
        id: 'out-intro-3',
        campaign_id: 'camp-1',
        contact_id: 'contact-3',
        company_id: 'company-3',
        draft_id: 'draft-intro-3',
        status: 'sent',
        sent_at: '2026-03-10T10:00:00Z',
        sender_identity: 'sales-3@example.com',
      },
      {
        id: 'out-intro-4',
        campaign_id: 'camp-1',
        contact_id: 'contact-4',
        company_id: 'company-4',
        draft_id: 'draft-intro-4',
        status: 'sent',
        sent_at: '2026-03-10T10:00:00Z',
        sender_identity: 'sales-4@example.com',
      },
      {
        id: 'out-bump-4',
        campaign_id: 'camp-1',
        contact_id: 'contact-4',
        company_id: 'company-4',
        draft_id: 'draft-bump-4',
        status: 'sent',
        sent_at: '2026-03-14T10:00:00Z',
        sender_identity: 'sales-4@example.com',
      },
    ];
    const events = [
      {
        id: 'evt-1',
        outbound_id: 'out-intro-2',
        event_type: 'replied',
        occurred_at: '2026-03-11T10:00:00Z',
        payload: { auto_reply: true, auto_reply_reason: 'vacation' },
      },
      {
        id: 'evt-2',
        outbound_id: 'out-intro-3',
        event_type: 'unsubscribed',
        occurred_at: '2026-03-12T10:00:00Z',
        payload: {},
      },
    ];

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: drafts, error: null }),
            }),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: outbounds, error: null }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: events, error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'company-1', country_code: 'RU' },
                  { id: 'company-2', country_code: 'DE' },
                  { id: 'company-3', country_code: null },
                  { id: 'company-4', country_code: null },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const rows = await listCampaignFollowupCandidates(client, 'camp-1', {
      now: new Date('2026-03-16T10:00:00Z'),
      minDaysSinceIntro: 3,
    });

    expect(rows).toEqual([
      {
        contact_id: 'contact-1',
        company_id: 'company-1',
        company_country_code: 'RU',
        intro_sent: true,
        intro_sent_at: '2026-03-10T10:00:00Z',
        intro_sender_identity: 'sales-1@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: true,
        days_since_intro: 6,
        business_days_since_intro: null,
        auto_reply: null,
      },
      {
        contact_id: 'contact-2',
        company_id: 'company-2',
        company_country_code: 'DE',
        intro_sent: true,
        intro_sent_at: '2026-03-10T10:00:00Z',
        intro_sender_identity: 'sales-2@example.com',
        reply_received: true,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: false,
        days_since_intro: 6,
        business_days_since_intro: null,
        auto_reply: 'vacation',
      },
      {
        contact_id: 'contact-3',
        company_id: 'company-3',
        company_country_code: null,
        intro_sent: true,
        intro_sent_at: '2026-03-10T10:00:00Z',
        intro_sender_identity: 'sales-3@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: true,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: false,
        days_since_intro: 6,
        business_days_since_intro: null,
        auto_reply: null,
      },
      {
        contact_id: 'contact-4',
        company_id: 'company-4',
        company_country_code: null,
        intro_sent: true,
        intro_sent_at: '2026-03-10T10:00:00Z',
        intro_sender_identity: 'sales-4@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: true,
        eligible: false,
        days_since_intro: 6,
        business_days_since_intro: null,
        auto_reply: null,
      },
    ]);
  });

  it('does not mark a candidate eligible when the bump draft exists but is not approved', async () => {
    vi.mocked(getCampaignSendPolicy).mockResolvedValue({
      campaignId: 'camp-1',
      campaignName: 'Campaign 1',
      campaignStatus: 'sending',
      updatedAt: '2026-03-01T10:00:00Z',
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'elapsed_days',
      sendCalendarCountryCode: null,
      sendCalendarSubdivisionCode: null,
    } as any);

    const drafts = [
      { id: 'draft-intro-1', contact_id: 'contact-1', company_id: 'company-1', email_type: 'intro', status: 'sent' },
      { id: 'draft-bump-1', contact_id: 'contact-1', company_id: 'company-1', email_type: 'bump', status: 'generated' },
    ];
    const outbounds = [
      {
        id: 'out-intro-1',
        campaign_id: 'camp-1',
        contact_id: 'contact-1',
        company_id: 'company-1',
        draft_id: 'draft-intro-1',
        status: 'sent',
        sent_at: '2026-03-10T10:00:00Z',
        sender_identity: 'sales-1@example.com',
      },
    ];

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: drafts, error: null }),
            }),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: outbounds, error: null }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [{ id: 'company-1', country_code: 'RU' }], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const rows = await listCampaignFollowupCandidates(client, 'camp-1', {
      now: new Date('2026-03-16T10:00:00Z'),
      minDaysSinceIntro: 3,
    });

    expect(rows).toEqual([
      {
        contact_id: 'contact-1',
        company_id: 'company-1',
        company_country_code: 'RU',
        intro_sent: true,
        intro_sent_at: '2026-03-10T10:00:00Z',
        intro_sender_identity: 'sales-1@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: false,
        bump_sent: false,
        eligible: false,
        days_since_intro: 6,
        business_days_since_intro: null,
        auto_reply: null,
      },
    ]);
  });

  it('uses campaign-country business days when the send policy opts in', async () => {
    vi.mocked(getCampaignSendPolicy).mockResolvedValue({
      campaignId: 'camp-2',
      campaignName: 'Campaign 2',
      campaignStatus: 'sending',
      updatedAt: '2026-03-01T10:00:00Z',
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'business_days_campaign',
      sendCalendarCountryCode: 'RU',
      sendCalendarSubdivisionCode: null,
    } as any);

    const drafts = [
      { id: 'draft-intro-1', contact_id: 'contact-1', company_id: 'company-1', email_type: 'intro', status: 'sent' },
      { id: 'draft-bump-1', contact_id: 'contact-1', company_id: 'company-1', email_type: 'bump', status: 'approved' },
    ];
    const outbounds = [
      {
        id: 'out-intro-1',
        campaign_id: 'camp-2',
        contact_id: 'contact-1',
        company_id: 'company-1',
        draft_id: 'draft-intro-1',
        status: 'sent',
        sent_at: '2026-03-01T10:00:00Z',
        sender_identity: 'sales-1@example.com',
      },
    ];

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: drafts, error: null }),
            }),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: outbounds, error: null }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [{ id: 'company-1', country_code: 'RU' }], error: null }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const rows = await listCampaignFollowupCandidates(client, 'camp-2', {
      now: new Date('2026-03-06T10:00:00Z'),
      minDaysSinceIntro: 4,
    });

    expect(rows).toEqual([
      {
        contact_id: 'contact-1',
        company_id: 'company-1',
        company_country_code: 'RU',
        intro_sent: true,
        intro_sent_at: '2026-03-01T10:00:00Z',
        intro_sender_identity: 'sales-1@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: true,
        bump_sent: false,
        eligible: true,
        days_since_intro: 5,
        business_days_since_intro: 4,
        auto_reply: null,
      },
    ]);
  });

  it('uses recipient-country business days with campaign fallback', async () => {
    vi.mocked(getCampaignSendPolicy).mockResolvedValue({
      campaignId: 'camp-3',
      campaignName: 'Campaign 3',
      campaignStatus: 'sending',
      updatedAt: '2026-03-01T10:00:00Z',
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'business_days_recipient',
      sendCalendarCountryCode: 'DE',
      sendCalendarSubdivisionCode: null,
    } as any);

    const drafts = [
      { id: 'draft-intro-1', contact_id: 'contact-1', company_id: 'company-1', email_type: 'intro', status: 'sent' },
      { id: 'draft-bump-1', contact_id: 'contact-1', company_id: 'company-1', email_type: 'bump', status: 'approved' },
      { id: 'draft-intro-2', contact_id: 'contact-2', company_id: 'company-2', email_type: 'intro', status: 'sent' },
      { id: 'draft-bump-2', contact_id: 'contact-2', company_id: 'company-2', email_type: 'bump', status: 'approved' },
    ];
    const outbounds = [
      {
        id: 'out-intro-1',
        campaign_id: 'camp-3',
        contact_id: 'contact-1',
        company_id: 'company-1',
        draft_id: 'draft-intro-1',
        status: 'sent',
        sent_at: '2026-03-01T10:00:00Z',
        sender_identity: 'sales-1@example.com',
      },
      {
        id: 'out-intro-2',
        campaign_id: 'camp-3',
        contact_id: 'contact-2',
        company_id: 'company-2',
        draft_id: 'draft-intro-2',
        status: 'sent',
        sent_at: '2026-03-01T10:00:00Z',
        sender_identity: 'sales-2@example.com',
      },
    ];

    const client = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'drafts') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: drafts, error: null }),
            }),
          };
        }
        if (table === 'email_outbound') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: outbounds, error: null }),
            }),
          };
        }
        if (table === 'email_events') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'companies') {
          return {
            select: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({
                data: [
                  { id: 'company-1', country_code: 'RU' },
                  { id: 'company-2', country_code: null },
                ],
                error: null,
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    const rows = await listCampaignFollowupCandidates(client, 'camp-3', {
      now: new Date('2026-03-06T10:00:00Z'),
      minDaysSinceIntro: 4,
    });

    expect(rows).toEqual([
      expect.objectContaining({
        contact_id: 'contact-1',
        company_id: 'company-1',
        company_country_code: 'RU',
        business_days_since_intro: 4,
        eligible: true,
      }),
      expect.objectContaining({
        contact_id: 'contact-2',
        company_id: 'company-2',
        company_country_code: null,
        business_days_since_intro: 5,
        eligible: true,
      }),
    ]);
  });
});
