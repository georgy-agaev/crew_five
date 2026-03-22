import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/campaigns', () => ({
  getCampaignDetail: vi.fn(),
}));

vi.mock('../src/services/campaignAudience', () => ({
  listCampaignAudience: vi.fn(),
}));

vi.mock('../src/services/campaignSendPolicy', () => ({
  getCampaignSendPolicy: vi.fn(),
}));

vi.mock('../src/services/campaignMailboxAssignments', () => ({
  getCampaignMailboxAssignment: vi.fn(),
}));

vi.mock('../src/services/campaignLaunch', () => ({
  launchCampaign: vi.fn(),
}));

const { getCampaignDetail } = await import('../src/services/campaigns');
const { listCampaignAudience } = await import('../src/services/campaignAudience');
const { getCampaignSendPolicy } = await import('../src/services/campaignSendPolicy');
const { getCampaignMailboxAssignment } = await import('../src/services/campaignMailboxAssignments');
const { launchCampaign } = await import('../src/services/campaignLaunch');

const { getCampaignNextWavePreview, createCampaignNextWave } = await import(
  '../src/services/campaignNextWave'
);

describe('campaignNextWave', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds next-wave preview with reused defaults and canonical blocked reasons', async () => {
    vi.mocked(getCampaignDetail).mockResolvedValue({
      id: 'camp-source',
      name: 'Wave 1',
      status: 'complete',
      segment_id: 'seg-1',
      segment_version: 1,
      offer_id: 'offer-1',
      icp_hypothesis_id: 'hyp-1',
      interaction_mode: 'express',
      data_quality_mode: 'strict',
    } as any);
    vi.mocked(getCampaignSendPolicy).mockResolvedValue({
      campaignId: 'camp-source',
      campaignName: 'Wave 1',
      campaignStatus: 'complete',
      updatedAt: '2026-03-22T00:00:00Z',
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
    });
    vi.mocked(getCampaignMailboxAssignment).mockResolvedValue({
      campaignId: 'camp-source',
      assignments: [
        {
          id: 'assign-1',
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@example.com',
          user: 'sales',
          domain: 'example.com',
          provider: 'imap_mcp',
          source: 'outreacher',
          assignedAt: '2026-03-22T00:00:00Z',
          metadata: null,
        },
      ],
      summary: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['example.com'],
      },
    });
    vi.mocked(listCampaignAudience).mockResolvedValue({
      campaign: {
        id: 'camp-source',
        name: 'Wave 1',
        status: 'complete',
        segment_id: 'seg-1',
        segment_version: 1,
      },
      rows: [
        {
          campaign_id: 'camp-source',
          company_id: 'company-4',
          contact_id: 'contact-4',
          source: 'manual_attach',
          snapshot: {
            contact: { full_name: 'Manual Attach' },
            company: { company_name: 'Delta' },
          },
          attached_at: '2026-03-20T12:00:00Z',
        },
      ],
    } as any);

    const sourceDraftsEq = vi.fn().mockResolvedValue({
      data: [{ contact_id: 'contact-1' }],
      error: null,
    });
    const targetMembersMatch = vi.fn().mockResolvedValue({
      data: [
        {
          company_id: 'company-1',
          contact_id: 'contact-1',
          snapshot: {},
        },
        {
          company_id: 'company-2',
          contact_id: 'contact-2',
          snapshot: {},
        },
        {
          company_id: 'company-3',
          contact_id: 'contact-3',
          snapshot: {},
        },
        {
          company_id: 'company-5',
          contact_id: 'contact-5',
          snapshot: {},
        },
      ],
      error: null,
    });
    const employeesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'contact-1',
          work_email: 'used@example.com',
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
          work_email: 'recent@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
        },
        {
          id: 'contact-4',
          work_email: null,
          work_email_status: null,
          generic_email: 'manual@example.com',
          generic_email_status: 'valid',
        },
        {
          id: 'contact-5',
          work_email: 'suppressed@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
        },
      ],
      error: null,
    });
    const outboundsIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'out-recent',
          campaign_id: 'camp-other',
          contact_id: 'contact-3',
          draft_id: 'draft-other',
          status: 'sent',
          sent_at: '2026-03-20T12:00:00Z',
        },
        {
          id: 'out-suppressed',
          campaign_id: 'camp-other',
          contact_id: 'contact-5',
          draft_id: 'draft-bounce',
          status: 'sent',
          sent_at: '2026-03-01T12:00:00Z',
        },
      ],
      error: null,
    });
    const eventsIn = vi.fn().mockResolvedValue({
      data: [
        {
          outbound_id: 'out-suppressed',
          event_type: 'bounced',
        },
      ],
      error: null,
    });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'segment_members') {
          return { select: () => ({ match: targetMembersMatch }) };
        }
        if (table === 'employees') {
          return { select: () => ({ in: employeesIn }) };
        }
        if (table === 'email_outbound') {
          return { select: () => ({ in: outboundsIn }) };
        }
        if (table === 'campaigns') {
          return {
            select: () => ({
              in: vi.fn().mockResolvedValue({
                data: [{ id: 'camp-other', offer_id: null, icp_hypothesis_id: null }],
                error: null,
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: () => ({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'icp_hypotheses') {
          return {
            select: () => ({
              in: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        if (table === 'email_events') {
          return { select: () => ({ in: eventsIn }) };
        }
        if (table === 'drafts') {
          return { select: () => ({ eq: sourceDraftsEq }) };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignNextWavePreview(client, {
      sourceCampaignId: 'camp-source',
      now: new Date('2026-03-22T12:00:00Z'),
      recentContactWindowDays: 7,
    });

    expect(listCampaignAudience).toHaveBeenCalledWith(client, 'camp-source', {
      includeSnapshot: false,
    });
    expect(targetMembersMatch).toHaveBeenCalledWith({
      segment_id: 'seg-1',
      segment_version: 1,
    });

    expect(result.defaults).toEqual({
      targetSegmentId: 'seg-1',
      targetSegmentVersion: 1,
      offerId: 'offer-1',
      icpHypothesisId: 'hyp-1',
      sendPolicy: {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
      },
      senderPlanSummary: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['example.com'],
      },
    });
    expect(result.summary).toEqual({
      candidateContactCount: 5,
      eligibleContactCount: 1,
      blockedContactCount: 4,
    });
    expect(result.blockedBreakdown).toEqual({
      suppressed_contact: 1,
      already_contacted_recently: 1,
      no_sendable_email: 1,
      already_in_target_wave: 0,
      already_used_in_source_wave: 1,
    });
    expect(result.items.filter((item) => item.eligible).map((item) => item.contactId)).toEqual(['contact-4']);
    expect(result.items.find((item) => item.contactId === 'contact-3')).toMatchObject({
      exposure_summary: {
        total_exposures: 1,
        last_offer_id: null,
        last_icp_hypothesis_id: null,
        last_sent_at: '2026-03-20T12:00:00Z',
      },
    });
    expect(result.items.find((item) => item.contactId === 'contact-5')).toMatchObject({
      exposure_summary: {
        total_exposures: 1,
        last_sent_at: '2026-03-01T12:00:00Z',
      },
    });
  });

  it('creates a fresh next wave and materializes exclusions plus eligible manual additions', async () => {
    vi.mocked(getCampaignDetail).mockResolvedValue({
      id: 'camp-source',
      name: 'Wave 1',
      status: 'complete',
      segment_id: 'seg-1',
      segment_version: 1,
      offer_id: 'offer-1',
      icp_hypothesis_id: 'hyp-1',
      interaction_mode: 'express',
      data_quality_mode: 'strict',
    } as any);
    vi.mocked(getCampaignSendPolicy).mockResolvedValue({
      campaignId: 'camp-source',
      campaignName: 'Wave 1',
      campaignStatus: 'complete',
      updatedAt: '2026-03-22T00:00:00Z',
      sendTimezone: 'Europe/Moscow',
      sendWindowStartHour: 9,
      sendWindowEndHour: 17,
      sendWeekdaysOnly: true,
    });
    vi.mocked(getCampaignMailboxAssignment).mockResolvedValue({
      campaignId: 'camp-source',
      assignments: [
        {
          id: 'assign-1',
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales@example.com',
          user: 'sales',
          domain: 'example.com',
          provider: 'imap_mcp',
          source: 'outreacher',
          assignedAt: '2026-03-22T00:00:00Z',
          metadata: null,
        },
      ],
      summary: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['example.com'],
      },
    });
    vi.mocked(listCampaignAudience).mockResolvedValue({
      campaign: {
        id: 'camp-source',
        name: 'Wave 1',
        status: 'complete',
        segment_id: 'seg-1',
        segment_version: 1,
      },
      rows: [
        {
          campaign_id: 'camp-source',
          company_id: 'company-3',
          contact_id: 'contact-3',
          source: 'manual_attach',
          snapshot: {
            contact: { full_name: 'Manual Eligible' },
            company: { company_name: 'Gamma' },
          },
          attached_at: '2026-03-20T12:00:00Z',
        },
        {
          campaign_id: 'camp-source',
          company_id: 'company-4',
          contact_id: 'contact-4',
          source: 'manual_attach',
          snapshot: {
            contact: { full_name: 'Manual Blocked' },
            company: { company_name: 'Delta' },
          },
          attached_at: '2026-03-20T12:05:00Z',
        },
      ],
    } as any);
    vi.mocked(launchCampaign).mockResolvedValue({
      campaign: {
        id: 'camp-next',
        name: 'Wave 2',
        segment_id: 'seg-1',
        segment_version: 1,
        offer_id: 'offer-1',
        icp_hypothesis_id: 'hyp-1',
      },
      segment: {
        id: 'seg-1',
        version: 1,
        snapshot: { version: 1, count: 2 },
      },
      senderPlan: {
        assignments: [
          {
            id: 'assign-next',
            mailboxAccountId: 'mbox-1',
            senderIdentity: 'sales@example.com',
            user: 'sales',
            domain: 'example.com',
            provider: 'imap_mcp',
            source: 'outreacher',
            assignedAt: '2026-03-22T00:00:00Z',
            metadata: null,
          },
        ],
        summary: {
          assignmentCount: 1,
          mailboxAccountCount: 1,
          senderIdentityCount: 1,
          domainCount: 1,
          domains: ['example.com'],
        },
      },
      sendPolicy: {
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
      },
    } as any);

    const sourceDraftsEq = vi.fn().mockResolvedValue({
      data: [{ contact_id: 'contact-1' }],
      error: null,
    });
    const targetMembersMatch = vi.fn().mockResolvedValue({
      data: [
        {
          company_id: 'company-1',
          contact_id: 'contact-1',
          snapshot: {},
        },
        {
          company_id: 'company-2',
          contact_id: 'contact-2',
          snapshot: {},
        },
      ],
      error: null,
    });
    const employeesIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'contact-1',
          work_email: 'used@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
        },
        {
          id: 'contact-2',
          work_email: 'eligible@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
        },
        {
          id: 'contact-3',
          work_email: 'manual@example.com',
          work_email_status: 'valid',
          generic_email: null,
          generic_email_status: null,
        },
        {
          id: 'contact-4',
          work_email: null,
          work_email_status: null,
          generic_email: null,
          generic_email_status: null,
        },
      ],
      error: null,
    });
    const outboundsIn = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const exclusionsInsert = vi.fn().mockResolvedValue({ data: [{ id: 'excl-1' }], error: null });
    const additionsInsert = vi.fn().mockResolvedValue({ data: [{ id: 'add-1' }], error: null });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'segment_members') {
          return { select: () => ({ match: targetMembersMatch }) };
        }
        if (table === 'employees') {
          return { select: () => ({ in: employeesIn }) };
        }
        if (table === 'email_outbound') {
          return { select: () => ({ in: outboundsIn }) };
        }
        if (table === 'email_events') {
          return { select: () => ({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
        }
        if (table === 'drafts') {
          return { select: () => ({ eq: sourceDraftsEq }) };
        }
        if (table === 'campaign_member_exclusions') {
          return { insert: exclusionsInsert };
        }
        if (table === 'campaign_member_additions') {
          return { insert: additionsInsert };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await createCampaignNextWave(client, {
      sourceCampaignId: 'camp-source',
      name: 'Wave 2',
      createdBy: 'codex',
      now: new Date('2026-03-22T12:00:00Z'),
    });

    expect(launchCampaign).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        name: 'Wave 2',
        segmentId: 'seg-1',
        segmentVersion: 1,
        offerId: 'offer-1',
        icpHypothesisId: 'hyp-1',
        senderPlan: {
          source: 'next_wave_reuse',
          assignments: [
            {
              mailboxAccountId: 'mbox-1',
              senderIdentity: 'sales@example.com',
              provider: 'imap_mcp',
              metadata: null,
            },
          ],
        },
        sendTimezone: 'Europe/Moscow',
        sendWindowStartHour: 9,
        sendWindowEndHour: 17,
        sendWeekdaysOnly: true,
      })
    );
    expect(exclusionsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        campaign_id: 'camp-next',
        company_id: 'company-1',
        contact_id: 'contact-1',
        source: 'next_wave_create',
        reason: 'already_used_in_source_wave',
        excluded_by: 'codex',
      }),
    ]);
    expect(additionsInsert).toHaveBeenCalledWith([
      expect.objectContaining({
        campaign_id: 'camp-next',
        company_id: 'company-3',
        contact_id: 'contact-3',
        source: 'next_wave_copy',
        attached_by: 'codex',
      }),
    ]);
    expect(result.summary).toEqual({
      candidateContactCount: 4,
      eligibleContactCount: 2,
      blockedContactCount: 2,
    });
  });
});
