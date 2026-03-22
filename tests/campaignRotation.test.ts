import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/services/campaignDetailReadModel', () => ({
  getCampaignReadModel: vi.fn(),
}));

const { getCampaignReadModel } = await import('../src/services/campaignDetailReadModel');
const { getCampaignRotationPreview } = await import('../src/services/campaignRotation');

describe('campaignRotation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects source campaigns that are not real sent waves', async () => {
    vi.mocked(getCampaignReadModel).mockResolvedValue({
      campaign: {
        id: 'camp-draft',
        name: 'Draft campaign',
        status: 'draft',
        offer_id: null,
        icp_hypothesis_id: null,
      },
      segment: {
        id: 'segment-1',
        name: 'Segment',
        icp_profile_id: null,
        icp_hypothesis_id: null,
      },
      icp_profile: null,
      icp_hypothesis: null,
      offer: null,
      companies: [
        {
          company_id: 'company-1',
          company_name: 'Acme',
          website: null,
          employee_count: null,
          region: null,
          office_qualification: null,
          company_description: null,
          company_research: null,
          contact_count: 1,
          enrichment: { status: 'missing', last_updated_at: null, provider_hint: null },
          composition_summary: {
            total_contacts: 1,
            sendable_contacts: 1,
            eligible_for_new_intro_contacts: 1,
            blocked_no_sendable_email_contacts: 0,
            blocked_bounced_contacts: 0,
            blocked_unsubscribed_contacts: 0,
            blocked_already_used_contacts: 0,
            contacts_with_drafts: 1,
            contacts_with_sent_outbound: 0,
          },
          employees: [
            {
              contact_id: 'contact-1',
              full_name: 'Alice',
              position: 'CTO',
              work_email: 'alice@acme.com',
              generic_email: null,
              recipient_email: 'alice@acme.com',
              recipient_email_source: 'work',
              sendable: true,
              block_reasons: [],
              eligible_for_new_intro: true,
              draft_counts: { total: 1, intro: 1, bump: 0, generated: 1, approved: 0, rejected: 0, sent: 0 },
              outbound_count: 0,
              sent_count: 0,
              replied: false,
              reply_count: 0,
              exposure_summary: {
                total_exposures: 0,
                last_icp_hypothesis_id: null,
                last_offer_id: null,
                last_offer_title: null,
                last_sent_at: null,
              },
              execution_exposures: [],
            },
          ],
        },
      ],
    } as any);

    await expect(
      getCampaignRotationPreview({} as any, {
        sourceCampaignId: 'camp-draft',
      })
    ).rejects.toMatchObject({
      code: 'CAMPAIGN_ROTATION_REQUIRES_SENT_SOURCE_WAVE',
      message: 'Campaign rotation preview requires a sent source wave',
    });
  });

  it('accepts source waves with sent campaign activity even when execution exposures are empty', async () => {
    vi.mocked(getCampaignReadModel).mockResolvedValue({
      campaign: {
        id: 'camp-sending',
        name: 'Sending campaign',
        status: 'sending',
        offer_id: 'offer-source',
        icp_hypothesis_id: 'hyp-source',
      },
      segment: {
        id: 'segment-1',
        name: 'Segment',
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hyp-source',
      },
      icp_profile: {
        id: 'icp-1',
        name: 'ICP',
        offering_domain: 'example.com',
      },
      icp_hypothesis: {
        id: 'hyp-source',
        name: 'Source hypothesis',
        offer_id: 'offer-source',
        status: 'active',
        messaging_angle: 'Angle',
      },
      offer: {
        id: 'offer-source',
        title: 'Source offer',
        project_name: 'Project',
        description: null,
        status: 'active',
        created_at: '2026-03-20T00:00:00Z',
        updated_at: '2026-03-20T00:00:00Z',
      },
      companies: [
        {
          company_id: 'company-1',
          company_name: 'Acme',
          website: null,
          employee_count: null,
          region: null,
          office_qualification: null,
          company_description: null,
          company_research: null,
          contact_count: 1,
          enrichment: { status: 'fresh', last_updated_at: null, provider_hint: null },
          composition_summary: {
            total_contacts: 1,
            sendable_contacts: 1,
            eligible_for_new_intro_contacts: 0,
            blocked_no_sendable_email_contacts: 0,
            blocked_bounced_contacts: 0,
            blocked_unsubscribed_contacts: 0,
            blocked_already_used_contacts: 1,
            contacts_with_drafts: 1,
            contacts_with_sent_outbound: 1,
          },
          employees: [
            {
              contact_id: 'contact-1',
              full_name: 'Alice',
              position: 'CEO',
              work_email: 'alice@example.com',
              generic_email: null,
              recipient_email: 'alice@example.com',
              recipient_email_source: 'work',
              sendable: true,
              block_reasons: ['already_used'],
              eligible_for_new_intro: false,
              draft_counts: { total: 1, intro: 1, bump: 0, generated: 0, approved: 0, rejected: 0, sent: 1 },
              outbound_count: 1,
              sent_count: 1,
              replied: false,
              reply_count: 0,
              exposure_summary: {
                total_exposures: 0,
                last_icp_hypothesis_id: null,
                last_offer_id: null,
                last_offer_title: null,
                last_sent_at: null,
              },
              execution_exposures: [],
            },
          ],
        },
      ],
    } as any);

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'icp_hypotheses') {
          return {
            select: () => ({
              eq: () => ({
                in: vi.fn().mockResolvedValue({ data: [], error: null }),
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
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignRotationPreview(client, {
      sourceCampaignId: 'camp-sending',
    });

    expect(result.sourceCampaign.campaignId).toBe('camp-sending');
    expect(result.summary.sourceContactCount).toBe(1);
  });

  it('builds rotation preview from same-ICP active hypotheses with global and candidate-specific blockers', async () => {
    vi.mocked(getCampaignReadModel).mockResolvedValue({
      campaign: {
        id: 'camp-source',
        name: 'Wave 1',
        status: 'sending',
        offer_id: 'offer-source',
        icp_hypothesis_id: 'hyp-source',
      },
      segment: {
        id: 'segment-1',
        name: 'Audit teams',
        icp_profile_id: 'icp-1',
        icp_hypothesis_id: 'hyp-source',
      },
      icp_profile: {
        id: 'icp-1',
        name: 'Audit ICP',
        offering_domain: 'voicexpert.ru',
      },
      icp_hypothesis: {
        id: 'hyp-source',
        name: 'Source hypothesis',
        offer_id: 'offer-source',
        status: 'active',
        messaging_angle: 'Source angle',
      },
      offer: {
        id: 'offer-source',
        title: 'Source offer',
        project_name: 'VoiceXpert',
        description: null,
        status: 'active',
        created_at: '2026-03-20T00:00:00Z',
        updated_at: '2026-03-20T00:00:00Z',
      },
      companies: [
        {
          company_id: 'company-1',
          company_name: 'Acme',
          website: null,
          employee_count: null,
          region: null,
          office_qualification: null,
          company_description: null,
          company_research: null,
          contact_count: 1,
          enrichment: {
            status: 'missing',
            last_updated_at: null,
            provider_hint: null,
          },
          composition_summary: {
            total_contacts: 1,
            sendable_contacts: 1,
            eligible_for_new_intro_contacts: 1,
            blocked_no_sendable_email_contacts: 0,
            blocked_bounced_contacts: 0,
            blocked_unsubscribed_contacts: 0,
            blocked_already_used_contacts: 0,
            contacts_with_drafts: 0,
            contacts_with_sent_outbound: 1,
          },
          employees: [
            {
              contact_id: 'contact-1',
              full_name: 'Alice',
              position: 'CFO',
              work_email: 'alice@acme.com',
              generic_email: null,
              recipient_email: 'alice@acme.com',
              recipient_email_source: 'work',
              sendable: true,
              block_reasons: [],
              eligible_for_new_intro: true,
              draft_counts: { total: 0, intro: 0, bump: 0, generated: 0, approved: 0, rejected: 0, sent: 0 },
              outbound_count: 1,
              sent_count: 1,
              replied: false,
              reply_count: 0,
              exposure_summary: {
                total_exposures: 1,
                last_icp_hypothesis_id: 'hyp-other',
                last_offer_id: 'offer-other',
                last_offer_title: 'Older offer',
                last_sent_at: '2026-03-01T12:00:00Z',
              },
              execution_exposures: [
                {
                  contact_id: 'contact-1',
                  campaign_id: 'camp-old',
                  icp_profile_id: 'icp-1',
                  icp_hypothesis_id: 'hyp-other',
                  offer_id: 'offer-other',
                  offer_title: 'Older offer',
                  project_name: 'VoiceXpert',
                  offering_domain: 'voicexpert.ru',
                  offering_hash: 'hash-1',
                  offering_summary: 'Older summary',
                  first_sent_at: '2026-03-01T12:00:00Z',
                  last_sent_at: '2026-03-01T12:00:00Z',
                  sent_count: 1,
                  replied: false,
                  bounced: false,
                  unsubscribed: false,
                },
              ],
            },
          ],
        },
        {
          company_id: 'company-2',
          company_name: 'Beta',
          website: null,
          employee_count: null,
          region: null,
          office_qualification: null,
          company_description: null,
          company_research: null,
          contact_count: 1,
          enrichment: { status: 'missing', last_updated_at: null, provider_hint: null },
          composition_summary: {
            total_contacts: 1,
            sendable_contacts: 1,
            eligible_for_new_intro_contacts: 0,
            blocked_no_sendable_email_contacts: 0,
            blocked_bounced_contacts: 0,
            blocked_unsubscribed_contacts: 0,
            blocked_already_used_contacts: 1,
            contacts_with_drafts: 1,
            contacts_with_sent_outbound: 1,
          },
          employees: [
            {
              contact_id: 'contact-2',
              full_name: 'Bob',
              position: 'COO',
              work_email: 'bob@beta.com',
              generic_email: null,
              recipient_email: 'bob@beta.com',
              recipient_email_source: 'work',
              sendable: true,
              block_reasons: ['already_used'],
              eligible_for_new_intro: false,
              draft_counts: { total: 1, intro: 1, bump: 0, generated: 0, approved: 0, rejected: 0, sent: 1 },
              outbound_count: 1,
              sent_count: 1,
              replied: true,
              reply_count: 1,
              exposure_summary: {
                total_exposures: 1,
                last_icp_hypothesis_id: 'hyp-source',
                last_offer_id: 'offer-source',
                last_offer_title: 'Source offer',
                last_sent_at: '2026-03-18T12:00:00Z',
              },
              execution_exposures: [
                {
                  contact_id: 'contact-2',
                  campaign_id: 'camp-source',
                  icp_profile_id: 'icp-1',
                  icp_hypothesis_id: 'hyp-source',
                  offer_id: 'offer-source',
                  offer_title: 'Source offer',
                  project_name: 'VoiceXpert',
                  offering_domain: 'voicexpert.ru',
                  offering_hash: 'hash-source',
                  offering_summary: 'Source summary',
                  first_sent_at: '2026-03-18T12:00:00Z',
                  last_sent_at: '2026-03-18T12:00:00Z',
                  sent_count: 1,
                  replied: true,
                  bounced: false,
                  unsubscribed: false,
                },
              ],
            },
          ],
        },
        {
          company_id: 'company-3',
          company_name: 'Gamma',
          website: null,
          employee_count: null,
          region: null,
          office_qualification: null,
          company_description: null,
          company_research: null,
          contact_count: 1,
          enrichment: { status: 'missing', last_updated_at: null, provider_hint: null },
          composition_summary: {
            total_contacts: 1,
            sendable_contacts: 1,
            eligible_for_new_intro_contacts: 0,
            blocked_no_sendable_email_contacts: 0,
            blocked_bounced_contacts: 1,
            blocked_unsubscribed_contacts: 0,
            blocked_already_used_contacts: 0,
            contacts_with_drafts: 0,
            contacts_with_sent_outbound: 1,
          },
          employees: [
            {
              contact_id: 'contact-3',
              full_name: 'Cara',
              position: 'CEO',
              work_email: 'cara@gamma.com',
              generic_email: null,
              recipient_email: 'cara@gamma.com',
              recipient_email_source: 'work',
              sendable: true,
              block_reasons: ['bounced'],
              eligible_for_new_intro: false,
              draft_counts: { total: 0, intro: 0, bump: 0, generated: 0, approved: 0, rejected: 0, sent: 0 },
              outbound_count: 1,
              sent_count: 1,
              replied: false,
              reply_count: 0,
              exposure_summary: {
                total_exposures: 1,
                last_icp_hypothesis_id: 'hyp-old',
                last_offer_id: 'offer-2',
                last_offer_title: 'Offer Two',
                last_sent_at: '2026-03-05T12:00:00Z',
              },
              execution_exposures: [
                {
                  contact_id: 'contact-3',
                  campaign_id: 'camp-old',
                  icp_profile_id: 'icp-1',
                  icp_hypothesis_id: 'hyp-old',
                  offer_id: 'offer-2',
                  offer_title: 'Offer Two',
                  project_name: 'VoiceXpert',
                  offering_domain: 'voicexpert.ru',
                  offering_hash: 'hash-2',
                  offering_summary: 'Offer two summary',
                  first_sent_at: '2026-03-05T12:00:00Z',
                  last_sent_at: '2026-03-05T12:00:00Z',
                  sent_count: 1,
                  replied: false,
                  bounced: true,
                  unsubscribed: false,
                },
              ],
            },
          ],
        },
        {
          company_id: 'company-4',
          company_name: 'Delta',
          website: null,
          employee_count: null,
          region: null,
          office_qualification: null,
          company_description: null,
          company_research: null,
          contact_count: 1,
          enrichment: { status: 'missing', last_updated_at: null, provider_hint: null },
          composition_summary: {
            total_contacts: 1,
            sendable_contacts: 0,
            eligible_for_new_intro_contacts: 0,
            blocked_no_sendable_email_contacts: 1,
            blocked_bounced_contacts: 0,
            blocked_unsubscribed_contacts: 0,
            blocked_already_used_contacts: 0,
            contacts_with_drafts: 0,
            contacts_with_sent_outbound: 0,
          },
          employees: [
            {
              contact_id: 'contact-4',
              full_name: 'Dan',
              position: 'Head of Ops',
              work_email: null,
              generic_email: null,
              recipient_email: null,
              recipient_email_source: 'missing',
              sendable: false,
              block_reasons: ['no_sendable_email'],
              eligible_for_new_intro: false,
              draft_counts: { total: 0, intro: 0, bump: 0, generated: 0, approved: 0, rejected: 0, sent: 0 },
              outbound_count: 0,
              sent_count: 0,
              replied: false,
              reply_count: 0,
              exposure_summary: {
                total_exposures: 0,
                last_icp_hypothesis_id: null,
                last_offer_id: null,
                last_offer_title: null,
                last_sent_at: null,
              },
              execution_exposures: [],
            },
          ],
        },
        {
          company_id: 'company-5',
          company_name: 'Epsilon',
          website: null,
          employee_count: null,
          region: null,
          office_qualification: null,
          company_description: null,
          company_research: null,
          contact_count: 1,
          enrichment: { status: 'missing', last_updated_at: null, provider_hint: null },
          composition_summary: {
            total_contacts: 1,
            sendable_contacts: 1,
            eligible_for_new_intro_contacts: 0,
            blocked_no_sendable_email_contacts: 0,
            blocked_bounced_contacts: 0,
            blocked_unsubscribed_contacts: 0,
            blocked_already_used_contacts: 1,
            contacts_with_drafts: 1,
            contacts_with_sent_outbound: 1,
          },
          employees: [
            {
              contact_id: 'contact-5',
              full_name: 'Eva',
              position: 'VP Sales',
              work_email: 'eva@epsilon.com',
              generic_email: null,
              recipient_email: 'eva@epsilon.com',
              recipient_email_source: 'work',
              sendable: true,
              block_reasons: ['already_used'],
              eligible_for_new_intro: false,
              draft_counts: { total: 1, intro: 1, bump: 0, generated: 0, approved: 0, rejected: 0, sent: 1 },
              outbound_count: 1,
              sent_count: 1,
              replied: false,
              reply_count: 0,
              exposure_summary: {
                total_exposures: 1,
                last_icp_hypothesis_id: 'hyp-old',
                last_offer_id: 'offer-2',
                last_offer_title: 'Offer Two',
                last_sent_at: '2026-03-21T12:00:00Z',
              },
              execution_exposures: [
                {
                  contact_id: 'contact-5',
                  campaign_id: 'camp-old-2',
                  icp_profile_id: 'icp-1',
                  icp_hypothesis_id: 'hyp-old',
                  offer_id: 'offer-2',
                  offer_title: 'Offer Two',
                  project_name: 'VoiceXpert',
                  offering_domain: 'voicexpert.ru',
                  offering_hash: 'hash-3',
                  offering_summary: 'Offer two summary',
                  first_sent_at: '2026-03-21T12:00:00Z',
                  last_sent_at: '2026-03-21T12:00:00Z',
                  sent_count: 1,
                  replied: false,
                  bounced: false,
                  unsubscribed: false,
                },
              ],
            },
          ],
        },
      ],
    } as any);

    const hypothesisIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'hyp-source',
          hypothesis_label: 'Source hypothesis',
          offer_id: 'offer-source',
          status: 'active',
          messaging_angle: 'Source angle',
        },
        {
          id: 'hyp-2',
          hypothesis_label: 'Rotation hypothesis A',
          offer_id: 'offer-2',
          status: 'active',
          messaging_angle: 'Rotate to use case A',
        },
        {
          id: 'hyp-3',
          hypothesis_label: 'Rotation hypothesis B',
          offer_id: 'offer-3',
          status: 'active',
          messaging_angle: 'Rotate to use case B',
        },
        {
          id: 'hyp-4',
          hypothesis_label: 'Draft hypothesis',
          offer_id: 'offer-4',
          status: 'draft',
          messaging_angle: 'Ignore draft',
        },
        {
          id: 'hyp-5',
          hypothesis_label: 'No offer hypothesis',
          offer_id: null,
          status: 'active',
          messaging_angle: 'Ignore no offer',
        },
      ],
      error: null,
    });
    const offersIn = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'offer-2',
          title: 'Offer Two',
          project_name: 'VoiceXpert',
        },
        {
          id: 'offer-3',
          title: 'Offer Three',
          project_name: 'VoiceXpert',
        },
      ],
      error: null,
    });

    const client = {
      from: vi.fn((table: string) => {
        if (table === 'icp_hypotheses') {
          return {
            select: () => ({
              eq: () => ({
                in: hypothesisIn,
              }),
            }),
          };
        }
        if (table === 'offers') {
          return {
            select: () => ({
              in: offersIn,
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    } as any;

    const result = await getCampaignRotationPreview(client, {
      sourceCampaignId: 'camp-source',
      now: new Date('2026-03-22T12:00:00Z'),
      cooldownDays: 7,
    });

    expect(result.sourceCampaign).toEqual({
      campaignId: 'camp-source',
      campaignName: 'Wave 1',
      offerId: 'offer-source',
      offerTitle: 'Source offer',
      icpHypothesisId: 'hyp-source',
      icpHypothesisLabel: 'Source hypothesis',
      icpProfileId: 'icp-1',
      icpProfileName: 'Audit ICP',
    });
    expect(result.summary).toEqual({
      sourceContactCount: 5,
      candidateCount: 2,
      eligibleCandidateContactCount: 2,
      blockedCandidateContactCount: 8,
    });
    expect(result.candidates.map((candidate) => candidate.icpHypothesisId)).toEqual(['hyp-2', 'hyp-3']);
    expect(result.candidates[0]).toMatchObject({
      icpHypothesisId: 'hyp-2',
      offerId: 'offer-2',
      offerTitle: 'Offer Two',
      eligibleContactCount: 1,
      blockedContactCount: 4,
      blockedBreakdown: {
        reply_received_stop: 1,
        suppressed_contact: 1,
        cooldown_active: 2,
        no_sendable_email: 1,
        already_received_candidate_offer: 2,
      },
    });
    expect(result.candidates[1]).toMatchObject({
      icpHypothesisId: 'hyp-3',
      offerId: 'offer-3',
      eligibleContactCount: 1,
      blockedContactCount: 4,
    });

    const recentContact = result.contacts.find((item) => item.contactId === 'contact-5');
    expect(recentContact?.globalBlockedReasons).toEqual(['cooldown_active']);
    expect(recentContact?.candidateEvaluations).toContainEqual({
      icpHypothesisId: 'hyp-2',
      offerId: 'offer-2',
      eligible: false,
      blockedReasons: ['cooldown_active', 'already_received_candidate_offer'],
    });

    const repliedContact = result.contacts.find((item) => item.contactId === 'contact-2');
    expect(repliedContact?.globalBlockedReasons).toEqual(['reply_received_stop', 'cooldown_active']);
  });
});
