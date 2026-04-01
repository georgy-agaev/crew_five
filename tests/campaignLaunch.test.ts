import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/campaigns', () => ({
  createCampaign: vi.fn(),
}));

vi.mock('../src/services/segmentSnapshotWorkflow', () => ({
  ensureSegmentSnapshot: vi.fn(),
}));

vi.mock('../src/services/campaignMailboxAssignments', () => ({
  replaceCampaignMailboxAssignment: vi.fn(),
  summarizeCampaignMailboxAssignmentInputs: vi.fn(),
}));

const { createCampaign } = await import('../src/services/campaigns');
const { ensureSegmentSnapshot } = await import('../src/services/segmentSnapshotWorkflow');
const { replaceCampaignMailboxAssignment, summarizeCampaignMailboxAssignmentInputs } = await import(
  '../src/services/campaignMailboxAssignments'
);

import { launchCampaign } from '../src/services/campaignLaunch';

describe('launchCampaign', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ensures a snapshot, creates the campaign, and persists the initial sender plan', async () => {
    vi.mocked(ensureSegmentSnapshot).mockResolvedValue({
      version: 3,
      count: 120,
    } as any);
    vi.mocked(createCampaign).mockResolvedValue({
      id: 'camp-1',
      name: 'Launch Q2',
      status: 'draft',
      segment_id: 'seg-1',
      segment_version: 3,
    } as any);
    vi.mocked(replaceCampaignMailboxAssignment).mockResolvedValue({
      campaignId: 'camp-1',
      assignments: [
        {
          id: 'assign-1',
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@voicexpertout.ru',
          user: 'sales',
          domain: 'voicexpertout.ru',
          provider: 'imap_mcp',
          source: 'outreacher',
          assignedAt: '2026-03-20T22:00:00Z',
          metadata: null,
        },
      ],
      summary: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['voicexpertout.ru'],
      },
    } as any);

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'icp_hypotheses') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'hyp-1',
                    icp_id: 'icp-1',
                    hypothesis_label: 'Operational audit hypothesis',
                    offer_id: 'offer-1',
                    search_config: {},
                    targeting_defaults: null,
                    messaging_angle: 'Negotiation room refresh',
                    pattern_defaults: null,
                    notes: null,
                    status: 'active',
                    created_at: '2026-03-21T10:00:00Z',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'offer-1',
                    project_id: 'project-1',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'icp_profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'icp-1',
                    project_id: 'project-1',
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;
    const result = await launchCampaign(client, {
      name: 'Launch Q2',
      segmentId: 'seg-1',
      segmentVersion: 1,
      offerId: 'offer-1',
      icpHypothesisId: 'hyp-1',
      snapshotMode: 'reuse',
      createdBy: 'outreacher',
      sendDayCountMode: 'business_days_campaign',
      sendCalendarCountryCode: 'RU',
      senderPlan: {
        source: 'outreacher',
        assignments: [
          {
            mailboxAccountId: 'mbox-1',
            senderIdentity: 'sales@voicexpertout.ru',
            provider: 'imap_mcp',
          },
        ],
      },
      sendTimezone: 'America/New_York',
      sendWindowStartHour: 8,
      sendWindowEndHour: 16,
      sendWeekdaysOnly: false,
    });

    expect(ensureSegmentSnapshot).toHaveBeenCalledWith(client, {
      segmentId: 'seg-1',
      segmentVersion: 1,
      mode: 'reuse',
      bumpVersion: undefined,
      allowEmpty: undefined,
      maxContacts: undefined,
      forceVersion: undefined,
    });
    expect(createCampaign).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        name: 'Launch Q2',
        segmentId: 'seg-1',
        segmentVersion: 3,
        projectId: 'project-1',
        offerId: 'offer-1',
        icpHypothesisId: 'hyp-1',
        createdBy: 'outreacher',
        sendTimezone: 'America/New_York',
        sendWindowStartHour: 8,
        sendWindowEndHour: 16,
        sendWeekdaysOnly: false,
        sendDayCountMode: 'business_days_campaign',
        sendCalendarCountryCode: 'RU',
        metadata: {
          snapshot: {
            version: 3,
            count: 120,
          },
          send_policy: {
            send_day_count_mode: 'business_days_campaign',
            send_calendar_country_code: 'RU',
            send_calendar_subdivision_code: null,
          },
        },
      })
    );
    expect(replaceCampaignMailboxAssignment).toHaveBeenCalledWith(client, {
      campaignId: 'camp-1',
      assignments: [
        {
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@voicexpertout.ru',
          provider: 'imap_mcp',
        },
      ],
      source: 'outreacher',
    });
    expect(result.senderPlan.summary.assignmentCount).toBe(1);
    expect(result.segment.version).toBe(3);
    expect(result.sendPolicy).toEqual({
      sendTimezone: 'America/New_York',
      sendWindowStartHour: 8,
      sendWindowEndHour: 16,
      sendWeekdaysOnly: false,
      sendDayCountMode: 'business_days_campaign',
      sendCalendarCountryCode: 'RU',
      sendCalendarSubdivisionCode: null,
    });
  });

  it('creates the campaign without sender persistence when no assignments are provided', async () => {
    vi.mocked(ensureSegmentSnapshot).mockResolvedValue({
      version: 2,
      count: 12,
    } as any);
    vi.mocked(createCampaign).mockResolvedValue({
      id: 'camp-2',
      name: 'Launch Empty',
      status: 'draft',
      segment_id: 'seg-2',
      segment_version: 2,
    } as any);
    vi.mocked(summarizeCampaignMailboxAssignmentInputs).mockReturnValue({
      assignmentCount: 0,
      mailboxAccountCount: 0,
      senderIdentityCount: 0,
      domainCount: 0,
      domains: [],
    });

    const client = {} as any;
    const result = await launchCampaign(client, {
      name: 'Launch Empty',
      segmentId: 'seg-2',
      snapshotMode: 'refresh',
      senderPlan: {
        assignments: [],
      },
    });

    expect(replaceCampaignMailboxAssignment).not.toHaveBeenCalled();
    expect(result.senderPlan.summary).toEqual({
      assignmentCount: 0,
      mailboxAccountCount: 0,
      senderIdentityCount: 0,
      domainCount: 0,
      domains: [],
    });
    expect(result.campaign.id).toBe('camp-2');
    expect(result.sendPolicy).toEqual({
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
      sendDayCountMode: 'elapsed_days',
      sendCalendarCountryCode: null,
      sendCalendarSubdivisionCode: null,
    });
  });

  it('rejects launch when explicit project and resolved offer/hypothesis project mismatch', async () => {
    vi.mocked(ensureSegmentSnapshot).mockResolvedValue({
      version: 3,
      count: 20,
    } as any);

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'offers') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: 'offer-1', project_id: 'project-2' },
                  error: null,
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    } as any;

    await expect(
      launchCampaign(client, {
        name: 'Launch mismatch',
        segmentId: 'seg-1',
        offerId: 'offer-1',
        projectId: 'project-1',
      } as any)
    ).rejects.toMatchObject({ code: 'CAMPAIGN_PROJECT_MISMATCH' });
  });
});
