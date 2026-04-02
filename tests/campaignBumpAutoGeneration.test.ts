import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/campaignFollowupCandidates.js', () => ({
  listCampaignFollowupCandidates: vi.fn(),
}));

vi.mock('../src/services/campaignSendPolicy.js', () => ({
  getCampaignSendPolicy: vi.fn(),
}));

const { listCampaignFollowupCandidates } = await import('../src/services/campaignFollowupCandidates.js');
const { getCampaignSendPolicy } = await import('../src/services/campaignSendPolicy.js');

import {
  listCampaignBumpGenerationCandidates,
  runCampaignBumpAutoGeneration,
} from '../src/services/campaignBumpAutoGeneration.js';

function createClient(drafts: any[]) {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'drafts') {
        throw new Error(`Unexpected table ${table}`);
      }
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: drafts,
            error: null,
          }),
        }),
      };
    }),
  } as any;
}

describe('campaignBumpAutoGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  it('treats rejected bumps as re-generatable when canonical follow-up safety still passes', async () => {
    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([
      {
        contact_id: 'contact-1',
        company_id: 'company-1',
        intro_sent: true,
        intro_sent_at: '2026-03-28T08:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: false,
        bump_sent: false,
        eligible: false,
        days_since_intro: 4,
        auto_reply: null,
      },
    ] as any);

    const rows = await listCampaignBumpGenerationCandidates(createClient([
      {
        id: 'draft-rejected',
        campaign_id: 'camp-1',
        contact_id: 'contact-1',
        company_id: 'company-1',
        email_type: 'bump',
        status: 'rejected',
      },
    ]), 'camp-1', {
      minDaysSinceIntro: 3,
      now: new Date('2026-04-01T10:00:00Z'),
    });

    expect(rows).toEqual([
      expect.objectContaining({
        contact_id: 'contact-1',
        active_bump_draft_exists: false,
        eligible_for_generation: true,
      }),
    ]);
  });

  it('blocks duplicate generation when an active bump draft already exists', async () => {
    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([
      {
        contact_id: 'contact-dup',
        company_id: 'company-dup',
        intro_sent: true,
        intro_sent_at: '2026-03-28T08:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_draft_approved: false,
        bump_sent: false,
        eligible: false,
        days_since_intro: 4,
        auto_reply: null,
      },
    ] as any);

    const triggerGenerateBumps = vi.fn().mockResolvedValue({ generated: 1, skipped: 0 });

    const result = await runCampaignBumpAutoGeneration(createClient([
      {
        id: 'draft-generated',
        campaign_id: 'camp-1',
        contact_id: 'contact-dup',
        company_id: 'company-dup',
        email_type: 'bump',
        status: 'generated',
      },
    ]), {
      campaignId: 'camp-1',
      minDaysSinceIntro: 3,
      limit: 10,
      now: new Date('2026-04-01T10:00:00Z'),
      triggerGenerateBumps,
    });

    expect(triggerGenerateBumps).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      triggered: false,
      candidateCount: 1,
      eligibleCount: 0,
      requestedContactCount: 0,
      requestedContactIds: [],
    });
  });

  it('passes exact canonical contact ids to the bump-generation bridge', async () => {
    vi.mocked(listCampaignFollowupCandidates).mockResolvedValue([
      {
        contact_id: 'contact-gen-1',
        company_id: 'company-1',
        intro_sent: true,
        intro_sent_at: '2026-03-28T08:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: false,
        bump_draft_approved: false,
        bump_sent: false,
        eligible: false,
        days_since_intro: 4,
        auto_reply: null,
      },
      {
        contact_id: 'contact-gen-2',
        company_id: 'company-2',
        intro_sent: true,
        intro_sent_at: '2026-03-30T08:00:00Z',
        intro_sender_identity: 'sales@example.com',
        reply_received: false,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: false,
        bump_draft_approved: false,
        bump_sent: false,
        eligible: false,
        days_since_intro: 2,
        auto_reply: null,
      },
    ] as any);

    const triggerGenerateBumps = vi.fn().mockResolvedValue({ generated: 1, skipped: 0, failed: 0 });

    const result = await runCampaignBumpAutoGeneration(createClient([]), {
      campaignId: 'camp-1',
      minDaysSinceIntro: 3,
      limit: 10,
      now: new Date('2026-04-01T10:00:00Z'),
      triggerGenerateBumps,
    });

    expect(triggerGenerateBumps).toHaveBeenCalledWith({
      campaignId: 'camp-1',
      contactIds: ['contact-gen-1'],
      limit: 10,
    });
    expect(result).toMatchObject({
      triggered: true,
      candidateCount: 2,
      eligibleCount: 1,
      requestedContactCount: 1,
      requestedContactIds: ['contact-gen-1'],
      triggerResult: { generated: 1, skipped: 0, failed: 0 },
    });
  });
});
