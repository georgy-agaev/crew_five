import { randomUUID } from 'node:crypto';

import type { AdapterDeps, Campaign, DraftRow } from './types.js';
import type {
  DirectoryCompaniesView,
  DirectoryContactsView,
} from '../services/directoryReadModels.js';
import type { OfferRecord } from '../services/offers.js';
import type { ProjectRecord } from '../services/projects.js';

export function createMockDeps(): AdapterDeps {
  const mockCampaigns: Campaign[] = [
    { id: 'camp-1', name: 'Mock Campaign', status: 'draft', project_id: 'project-1', offer_id: 'offer-1' },
  ];
  const mockDrafts: DraftRow[] = [
    { id: 'draft-1', status: 'generated', contact_name: 'Alex Mock', recipient_email: 'a@example.com' },
    { id: 'draft-2', status: 'approved', contact_name: 'Bianca Mock', recipient_email: 'b@example.com' },
  ];
  const mockCompanies = [
    { id: 'co-1', name: 'Mock Co', segment: 'AI', office_quantification: 'remote' },
    { id: 'co-2', name: 'Other Co', segment: 'Industrial', office_quantification: 'hq-heavy' },
  ];
  const mockContacts = [
    { id: 'ct-1', company_id: 'co-1', email: 'a@mock.com', email_status: 'verified' },
    { id: 'ct-2', company_id: 'co-2', email: null, email_status: 'missing' },
  ];
  const mockSegments = [{ id: 'seg-1', name: 'Mock Segment', version: 1 }];
  const mockProjects: ProjectRecord[] = [
    {
      id: 'project-1',
      key: 'voicexpert',
      name: 'VoiceXpert',
      description: 'Core workspace',
      status: 'active',
    },
  ];
  const mockOffers: OfferRecord[] = [
    {
      id: 'offer-1',
      project_id: 'project-1',
      title: 'Negotiation room audit',
      project_name: 'VoiceXpert',
      description: 'Audit offer',
      status: 'active',
    },
  ];
  const mockImportProcessJobs = new Map<string, any>();
  const mockPromptRegistry = [
    { id: 'draft_intro_v1', step: 'draft', version: 'v1', rollout_status: 'active' },
    { id: 'icp_v1', step: 'icp', version: 'v1', rollout_status: 'active' },
    { id: 'hypo_v1', step: 'hypothesis', version: 'v1', rollout_status: 'active' },
  ];
  const mockIcpProfiles: Array<{
    id: string;
    name: string;
    offering_domain: string | null;
    learnings: string[];
    updated_at: string;
  }> = [
    {
      id: 'p1',
      name: 'ICP Mock',
      offering_domain: 'voicexpert.ru',
      learnings: ['Use negotiation-room language', 'Keep topic internal, not marketing'],
      updated_at: '2026-03-17T10:00:00Z',
    },
  ];
  const mockHypotheses = [{ id: 'h1', hypothesis_label: 'Hypothesis Mock' }];
  const buildMockSendPolicy = (overrides: Partial<{
    sendTimezone: string;
    sendWindowStartHour: number;
    sendWindowEndHour: number;
    sendWeekdaysOnly: boolean;
    sendDayCountMode: 'elapsed_days' | 'business_days_campaign' | 'business_days_recipient';
    sendCalendarCountryCode: string | null;
    sendCalendarSubdivisionCode: string | null;
  }> = {}) => ({
    sendTimezone: overrides.sendTimezone ?? 'Europe/Moscow',
    sendWindowStartHour: overrides.sendWindowStartHour ?? 9,
    sendWindowEndHour: overrides.sendWindowEndHour ?? 17,
    sendWeekdaysOnly: overrides.sendWeekdaysOnly ?? true,
    sendDayCountMode: overrides.sendDayCountMode ?? 'elapsed_days',
    sendCalendarCountryCode: overrides.sendCalendarCountryCode ?? null,
    sendCalendarSubdivisionCode: overrides.sendCalendarSubdivisionCode ?? null,
  });
  const buildMockSendPolicyView = (
    campaignId: string,
    overrides: Partial<{
      campaignName: string;
      campaignStatus: string | null;
      updatedAt: string | null;
      metadata: Record<string, unknown> | null;
      sendTimezone: string;
      sendWindowStartHour: number;
      sendWindowEndHour: number;
      sendWeekdaysOnly: boolean;
      sendDayCountMode: 'elapsed_days' | 'business_days_campaign' | 'business_days_recipient';
      sendCalendarCountryCode: string | null;
      sendCalendarSubdivisionCode: string | null;
    }> = {}
  ) => ({
    campaignId,
    campaignName: overrides.campaignName ?? 'Mock Campaign',
    campaignStatus: overrides.campaignStatus ?? 'review',
    updatedAt: overrides.updatedAt ?? '2026-03-21T10:02:00Z',
    metadata: overrides.metadata ?? null,
    ...buildMockSendPolicy(overrides),
  });

  return {
    listProjects: async ({ status } = {}) =>
      status ? mockProjects.filter((project) => project.status === status) : mockProjects,
    createProject: async ({ key, name, description, status }) => {
      const row = {
        id: randomUUID(),
        key,
        name,
        description: description ?? null,
        status: status ?? 'active',
      } as const;
      mockProjects.unshift(row);
      return row;
    },
    updateProject: async (projectId, input) => {
      const row = mockProjects.find((project) => project.id === projectId);
      if (!row) {
        throw new Error('Project not found');
      }
      const updated = {
        ...row,
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      };
      const index = mockProjects.findIndex((project) => project.id === projectId);
      mockProjects[index] = updated;
      return updated;
    },
    listOffers: async ({ status } = {}) =>
      status ? mockOffers.filter((offer) => offer.status === status) : mockOffers,
    createOffer: async ({ projectId, title, projectName, description, status }) => {
      const row = {
        id: randomUUID(),
        project_id: projectId ?? null,
        title,
        project_name: projectName ?? null,
        description: description ?? null,
        status: status ?? 'active',
      } as const;
      mockOffers.unshift(row);
      return row;
    },
    updateOffer: async (offerId, input) => {
      const row = mockOffers.find((offer) => offer.id === offerId);
      if (!row) {
        throw new Error('Offer not found');
      }
      const updated = {
        ...row,
        ...(input.projectId !== undefined ? { project_id: input.projectId } : {}),
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.projectName !== undefined ? { project_name: input.projectName } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      };
      const index = mockOffers.findIndex((offer) => offer.id === offerId);
      mockOffers[index] = updated;
      return updated;
    },
    listCampaigns: async () => mockCampaigns,
    getCampaignStatusTransitions: async (campaignId) => {
      const campaign = mockCampaigns.find((row) => row.id === campaignId);
      return {
        campaignId,
        currentStatus: (campaign?.status ?? 'draft') as any,
        allowedTransitions:
          campaign?.status === 'ready'
            ? ['generating']
            : campaign?.status === 'review'
              ? ['ready', 'generating']
              : ['ready', 'review'],
      };
    },
    updateCampaignStatus: async ({ campaignId, status }) => {
      const campaign = mockCampaigns.find((row) => row.id === campaignId);
      if (!campaign) {
        throw new Error('Campaign not found');
      }
      campaign.status = status;
      return campaign;
    },
    listCampaignFollowupCandidates: async () => [
      {
        contact_id: 'contact-1',
        company_id: 'company-1',
        intro_sent: true,
        intro_sent_at: '2026-03-14T12:00:00Z',
        intro_sender_identity: 'rep@example.com',
        reply_received: true,
        bounce: false,
        unsubscribed: false,
        bump_draft_exists: true,
        bump_sent: false,
        eligible: false,
        days_since_intro: 2,
        auto_reply: null,
      },
    ],
    listCampaignCompanies: async (campaignId) => ({
      campaign: { id: campaignId, name: 'Mock Campaign', status: 'draft', segment_id: 'seg-1', segment_version: 1 },
      companies: [{
        company_id: 'company-1',
        company_name: 'Mock Co',
        website: 'https://mock.example',
        employee_count: 42,
        region: 'Paris',
        office_qualification: 'Less',
        company_description: 'Mock description',
        company_research: { providers: { mock: {} }, lastUpdatedAt: '2026-03-15T10:00:00Z' },
        contact_count: 2,
        enrichment: { status: 'fresh', last_updated_at: '2026-03-15T10:00:00Z', provider_hint: 'mock' },
      }],
    }),
    getCampaignReadModel: async (campaignId) => ({
      campaign: { id: campaignId, name: 'Mock Campaign', status: 'draft', segment_id: 'seg-1', segment_version: 1 },
      segment: null,
      icp_profile: null,
      icp_hypothesis: null,
      offer: mockOffers[0] ?? null,
      project: null,
      companies: [{
        company_id: 'company-1',
        company_name: 'Mock Co',
        website: 'https://mock.example',
        employee_count: 42,
        region: 'Paris',
        office_qualification: 'Less',
        company_description: 'Mock description',
        company_research: { providers: { mock: {} }, lastUpdatedAt: '2026-03-15T10:00:00Z' },
        contact_count: 2,
        enrichment: { status: 'fresh', last_updated_at: '2026-03-15T10:00:00Z', provider_hint: 'mock' },
        composition_summary: {
          total_contacts: 1,
          segment_snapshot_contacts: 1,
          manual_attach_contacts: 0,
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
            audience_source: 'segment_snapshot',
            attached_at: null,
            full_name: 'Alex Mock',
            position: 'CEO',
            work_email: 'a@example.com',
            generic_email: null,
            recipient_email: 'a@example.com',
            recipient_email_source: 'work',
            sendable: true,
            block_reasons: [],
            eligible_for_new_intro: true,
            draft_counts: {
              total: 1,
              intro: 1,
              bump: 0,
              generated: 1,
              approved: 0,
              rejected: 0,
              sent: 0,
            },
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
      }],
    }),
    getCampaignAudit: async (campaignId) => ({
      campaign: { id: campaignId, name: 'Mock Campaign', status: 'draft', segment_id: 'seg-1', segment_version: 1 },
      summary: {
        company_count: 1,
        snapshot_contact_count: 2,
        contacts_with_any_draft: 2,
        contacts_with_intro_draft: 1,
        contacts_with_bump_draft: 1,
        contacts_with_sent_outbound: 1,
        contacts_with_events: 1,
        draft_count: 2,
        generated_draft_count: 1,
        approved_draft_count: 1,
        rejected_draft_count: 0,
        sent_draft_count: 0,
        sendable_draft_count: 2,
        unsendable_draft_count: 0,
        outbound_count: 1,
        outbound_sent_count: 1,
        outbound_failed_count: 0,
        outbound_missing_recipient_email_count: 0,
        event_count: 1,
        replied_event_count: 1,
        bounced_event_count: 0,
        unsubscribed_event_count: 0,
        snapshot_contacts_without_draft_count: 0,
        drafts_missing_recipient_email_count: 0,
        duplicate_draft_pair_count: 0,
        draft_company_mismatch_count: 0,
        sent_drafts_without_outbound_count: 0,
        outbounds_without_draft_count: 0,
      },
      issues: {
        snapshot_contacts_without_draft: [],
        drafts_missing_recipient_email: [],
        duplicate_drafts: [],
        draft_company_mismatches: [],
        sent_drafts_without_outbound: [],
        outbounds_without_draft: [],
        outbounds_missing_recipient_email: [],
      },
    }),
    getCampaignSendPreflight: async (campaignId) => ({
      campaign: {
        id: campaignId,
        name: 'Mock Campaign',
        status: 'ready',
        segment_id: 'seg-1',
        segment_version: 1,
      },
      readyToSend: false,
      blockers: [
        {
          code: 'missing_recipient_email',
          message: 'Some approved drafts are missing a sendable recipient email',
        },
      ],
      summary: {
        mailboxAssignmentCount: 1,
        draftCount: 2,
        approvedDraftCount: 1,
        generatedDraftCount: 1,
        rejectedDraftCount: 0,
        sentDraftCount: 0,
        sendableApprovedDraftCount: 0,
        approvedMissingRecipientEmailCount: 1,
        approvedSuppressedContactCount: 0,
      },
      senderPlan: {
        assignmentCount: 1,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        domainCount: 1,
        domains: ['example.com'],
      },
    }),
    executeCampaignSend: async ({ campaignId, reason = 'auto_send_mixed', batchLimit }) => ({
      accepted: true,
      source: 'crew_five-send-execution',
      requestedAt: '2026-03-24T09:00:00.000Z',
      campaignId,
      reason,
      provider: 'imap_mcp',
      selectedCount: Math.min(batchLimit ?? 25, 3),
      sentCount: Math.min(batchLimit ?? 25, 3),
      failedCount: 0,
      skippedCount: 0,
      results: Array.from({ length: Math.min(batchLimit ?? 25, 3) }, (_, index) => ({
        draftId: `draft-${index + 1}`,
        contactId: `contact-${index + 1}`,
        companyId: `company-${index + 1}`,
        emailType: index === 0 ? 'intro' : 'bump',
        senderIdentity: 'sales-1@example.com',
        mailboxAccountId: 'mbox-1',
        recipientEmail: `buyer-${index + 1}@mock.example`,
        status: 'sent',
        provider: 'imap_mcp',
        providerMessageId: `<mock-${index + 1}@example.com>`,
      })),
    }),
    getCampaignNextWavePreview: async ({ sourceCampaignId }) => ({
      sourceCampaign: {
        id: sourceCampaignId,
        name: 'Mock Wave 1',
      },
      defaults: {
        targetSegmentId: 'seg-1',
        targetSegmentVersion: 1,
        offerId: null,
        icpHypothesisId: null,
        sendPolicy: buildMockSendPolicy(),
        senderPlanSummary: {
          assignmentCount: 1,
          mailboxAccountCount: 1,
          senderIdentityCount: 1,
          domainCount: 1,
          domains: ['example.com'],
        },
      },
      summary: {
        candidateContactCount: 4,
        eligibleContactCount: 2,
        blockedContactCount: 2,
      },
      blockedBreakdown: {
        suppressed_contact: 1,
        already_contacted_recently: 0,
        no_sendable_email: 1,
        already_in_target_wave: 0,
        already_used_in_source_wave: 0,
      },
      items: [],
    }),
    createCampaignNextWave: async (input) => ({
      campaign: {
        id: randomUUID(),
        name: input.name,
        status: 'draft',
      },
      sourceCampaign: {
        id: input.sourceCampaignId,
        name: 'Mock Wave 1',
      },
      defaults: {
        targetSegmentId: input.targetSegmentId ?? 'seg-1',
        targetSegmentVersion: input.targetSegmentVersion ?? 1,
        offerId: input.offerId ?? null,
        icpHypothesisId: input.icpHypothesisId ?? null,
        sendPolicy: buildMockSendPolicy({
          sendTimezone: input.sendTimezone,
          sendWindowStartHour: input.sendWindowStartHour,
          sendWindowEndHour: input.sendWindowEndHour,
          sendWeekdaysOnly: input.sendWeekdaysOnly,
          sendDayCountMode: input.sendDayCountMode,
          sendCalendarCountryCode: input.sendCalendarCountryCode,
          sendCalendarSubdivisionCode: input.sendCalendarSubdivisionCode,
        }),
        senderPlanSummary: {
          assignmentCount: input.senderPlan?.assignments?.length ?? 0,
          mailboxAccountCount: input.senderPlan?.assignments?.length ?? 0,
          senderIdentityCount: input.senderPlan?.assignments?.length ?? 0,
          domainCount: 0,
          domains: [],
        },
      },
      senderPlan: {
        assignments: [],
        summary: {
          assignmentCount: input.senderPlan?.assignments?.length ?? 0,
          mailboxAccountCount: input.senderPlan?.assignments?.length ?? 0,
          senderIdentityCount: input.senderPlan?.assignments?.length ?? 0,
          domainCount: 0,
          domains: [],
        },
      },
      sendPolicy: buildMockSendPolicy({
        sendTimezone: input.sendTimezone,
        sendWindowStartHour: input.sendWindowStartHour,
        sendWindowEndHour: input.sendWindowEndHour,
        sendWeekdaysOnly: input.sendWeekdaysOnly,
        sendDayCountMode: input.sendDayCountMode,
        sendCalendarCountryCode: input.sendCalendarCountryCode,
        sendCalendarSubdivisionCode: input.sendCalendarSubdivisionCode,
      }),
      summary: {
        candidateContactCount: 4,
        eligibleContactCount: 2,
        blockedContactCount: 2,
      },
      blockedBreakdown: {
        suppressed_contact: 1,
        already_contacted_recently: 0,
        no_sendable_email: 1,
        already_in_target_wave: 0,
        already_used_in_source_wave: 0,
      },
      items: [],
    }),
    getCampaignRotationPreview: async ({ sourceCampaignId }) => ({
      sourceCampaign: {
        campaignId: sourceCampaignId,
        campaignName: 'Mock Campaign',
        offerId: 'offer-1',
        offerTitle: 'Negotiation room audit',
        icpHypothesisId: 'h1',
        icpHypothesisLabel: 'Hypothesis Mock',
        icpProfileId: 'p1',
        icpProfileName: 'ICP Mock',
      },
      summary: {
        sourceContactCount: 1,
        candidateCount: 1,
        eligibleCandidateContactCount: 1,
        blockedCandidateContactCount: 0,
      },
      candidates: [
        {
          icpHypothesisId: 'h2',
          hypothesisLabel: 'Rotation Hypothesis',
          messagingAngle: 'Alternative execution angle',
          offerId: 'offer-2',
          offerTitle: 'Alternative offer',
          projectName: 'VoiceXpert',
          eligibleContactCount: 1,
          blockedContactCount: 0,
          blockedBreakdown: {
            reply_received_stop: 0,
            suppressed_contact: 0,
            cooldown_active: 0,
            no_sendable_email: 0,
            already_received_candidate_offer: 0,
          },
        },
      ],
      contacts: [
        {
          contactId: 'contact-1',
          companyId: 'company-1',
          companyName: 'Mock Co',
          fullName: 'Alex Mock',
          position: 'CEO',
          recipientEmail: 'a@example.com',
          recipientEmailSource: 'work',
          sendable: true,
          exposureSummary: {
            total_exposures: 0,
            last_icp_hypothesis_id: null,
            last_offer_id: null,
            last_offer_title: null,
            last_sent_at: null,
          },
          globalBlockedReasons: [],
          candidateEvaluations: [
            {
              icpHypothesisId: 'h2',
              offerId: 'offer-2',
              eligible: true,
              blockedReasons: [],
            },
          ],
        },
      ],
    }),
    attachCompaniesToCampaign: async ({ campaignId, companyIds, attachedBy, source }) => ({
      campaignId,
      summary: {
        requestedCompanyCount: companyIds.length,
        attachedCompanyCount: companyIds.length,
        alreadyPresentCompanyCount: 0,
        blockedCompanyCount: 0,
        invalidCompanyCount: 0,
        insertedContactCount: companyIds.length,
        alreadyPresentContactCount: 0,
      },
      items: companyIds.map((companyId) => ({
        companyId,
        companyName: `Company ${companyId}`,
        status: 'attached' as const,
        insertedContactCount: 1,
        alreadyPresentContactCount: 0,
        reason: null,
        attachedBy,
        source,
      })),
    }),
    getCampaignLaunchPreview: async (input) => ({
      ok: true,
      campaign: {
        name: input.name,
        status: 'draft',
      },
      segment: {
        id: input.segmentId,
        version: input.segmentVersion ?? 1,
        snapshotStatus: 'existing',
      },
      summary: {
        companyCount: 1,
        contactCount: 2,
        sendableContactCount: 1,
        freshCompanyCount: 1,
        staleCompanyCount: 0,
        missingCompanyCount: 0,
        senderAssignmentCount: input.senderPlan?.assignments?.length ?? 0,
      },
      senderPlan: {
        assignmentCount: input.senderPlan?.assignments?.length ?? 0,
        mailboxAccountCount: input.senderPlan?.assignments?.length ?? 0,
        senderIdentityCount: input.senderPlan?.assignments?.length ?? 0,
        domainCount: 1,
        domains: ['example.com'],
      },
      sendPolicy: buildMockSendPolicy({
        sendTimezone: input.sendTimezone,
        sendWindowStartHour: input.sendWindowStartHour,
        sendWindowEndHour: input.sendWindowEndHour,
        sendWeekdaysOnly: input.sendWeekdaysOnly,
        sendDayCountMode: input.sendDayCountMode,
        sendCalendarCountryCode: input.sendCalendarCountryCode,
        sendCalendarSubdivisionCode: input.sendCalendarSubdivisionCode,
      }),
      warnings: [],
    }),
    launchCampaign: async (input) => ({
      campaign: {
        id: randomUUID(),
        name: input.name,
        status: 'draft',
      },
      segment: {
        id: input.segmentId,
        version: input.segmentVersion ?? 1,
        snapshot: {
          version: input.segmentVersion ?? 1,
          count: 2,
        },
      },
      senderPlan: {
        assignments: [],
        summary: {
          assignmentCount: input.senderPlan?.assignments?.length ?? 0,
          mailboxAccountCount: input.senderPlan?.assignments?.length ?? 0,
          senderIdentityCount: input.senderPlan?.assignments?.length ?? 0,
          domainCount: 0,
          domains: [],
        },
      },
      sendPolicy: buildMockSendPolicy({
        sendTimezone: input.sendTimezone,
        sendWindowStartHour: input.sendWindowStartHour,
        sendWindowEndHour: input.sendWindowEndHour,
        sendWeekdaysOnly: input.sendWeekdaysOnly,
        sendDayCountMode: input.sendDayCountMode,
        sendCalendarCountryCode: input.sendCalendarCountryCode,
        sendCalendarSubdivisionCode: input.sendCalendarSubdivisionCode,
      }),
    }),
    runCampaignAutoSendSweep: async ({ batchLimit }) => ({
      summary: {
        checkedCount: 1,
        triggeredCount: 0,
        introTriggeredCount: 0,
        bumpTriggeredCount: 0,
        mixedTriggeredCount: 0,
        skippedCount: 1,
        errorCount: 0,
      },
      campaigns: [
        {
          campaignId: 'camp-1',
          campaignName: 'Mock Campaign',
          campaignStatus: 'ready',
          triggered: false,
          triggerReason: null,
          skipReason: 'calendar_outside_send_window',
          intro: {
            enabled: true,
            shouldTrigger: false,
            blockers: ['no_sender_assignment'],
          },
          bump: {
            enabled: false,
            shouldTrigger: false,
            eligibleCandidateCount: 0,
            totalCandidateCount: 0,
          },
          generation: {
            enabled: false,
            triggered: false,
            candidateCount: 0,
            eligibleCount: 0,
            requestedContactCount: 0,
            requestedContactIds: [],
          },
          calendar: {
            allowed: false,
            campaignLocalTime: '2026-03-21T08:00:00',
            reason: 'outside_send_window',
          },
          triggerResult: batchLimit ? { batchLimit } : undefined,
        },
      ],
    }),
    listCampaignOutbounds: async (campaignId) => ({
      campaign: { id: campaignId, name: 'Mock Campaign', status: 'draft', segment_id: 'seg-1', segment_version: 1 },
      outbounds: [{
        id: 'out-1',
        status: 'sent',
        provider: 'imap_mcp',
        provider_message_id: '<mock-1@example.com>',
        sender_identity: 'sales-1@example.com',
        sent_at: '2026-03-15T12:00:00Z',
        created_at: '2026-03-15T12:00:00Z',
        error: null,
        pattern_mode: 'direct',
        draft_id: 'draft-2',
        draft_email_type: 'intro',
        draft_status: 'sent',
        subject: 'Mock intro',
        contact_id: 'contact-1',
        contact_name: 'Bianca Mock',
        contact_position: 'CEO',
        company_id: 'company-1',
        company_name: 'Mock Co',
        company_website: 'https://mock.example',
        recipient_email: 'buyer@mock.example',
        recipient_email_source: 'work',
        recipient_email_kind: 'corporate',
        metadata: null,
      }],
    }),
    listCampaignEvents: async (campaignId) => ({
      campaign: { id: campaignId, name: 'Mock Campaign', status: 'draft', segment_id: 'seg-1', segment_version: 1 },
      events: [{
        id: 'evt-1',
        outbound_id: 'out-1',
        event_type: 'replied',
        outcome_classification: 'soft_interest',
        provider_event_id: 'provider-evt-1',
        occurred_at: '2026-03-15T13:30:00Z',
        created_at: '2026-03-15T13:30:00Z',
        pattern_id: 'direct',
        coach_prompt_id: 'draft_intro_v1',
        payload: null,
        draft_id: 'draft-2',
        draft_email_type: 'intro',
        draft_status: 'sent',
        subject: 'Mock intro',
        provider: 'imap_mcp',
        provider_message_id: '<mock-1@example.com>',
        sender_identity: 'sales-1@example.com',
        sent_at: '2026-03-15T12:00:00Z',
        recipient_email: 'buyer@mock.example',
        recipient_email_source: 'work',
        recipient_email_kind: 'corporate',
        contact_id: 'contact-1',
        contact_name: 'Bianca Mock',
        contact_position: 'CEO',
        company_id: 'company-1',
        company_name: 'Mock Co',
        company_website: 'https://mock.example',
      }],
    }),
    listInboxReplies: async () => ({
      replies: [
        {
          id: 'evt-1',
          campaign_id: 'camp-1',
          campaign_name: 'Mock Campaign',
          reply_label: 'positive',
          handled: false,
          handled_at: null,
          handled_by: null,
          event_type: 'replied',
          occurred_at: '2026-03-15T13:30:00Z',
          outcome_classification: 'positive',
          reply_text: 'Sounds interesting.',
          draft_id: 'draft-2',
          draft_email_type: 'intro',
          draft_status: 'sent',
          subject: 'Mock intro',
          sender_identity: 'sales-1@example.com',
          recipient_email: 'buyer@mock.example',
          contact_id: 'contact-1',
          contact_name: 'Bianca Mock',
          contact_position: 'CEO',
          company_id: 'company-1',
          company_name: 'Mock Co',
        },
      ],
      total: 1,
    }),
    markInboxReplyHandled: async ({ replyId, handledBy }) => ({
      id: replyId,
      handled: true,
      handled_at: new Date().toISOString(),
      handled_by: handledBy ?? 'web-ui',
    }),
    markInboxReplyUnhandled: async (replyId) => ({
      id: replyId,
      handled: false,
      handled_at: null,
      handled_by: null,
    }),
    triggerInboxPoll: async ({ mailboxAccountId }) => ({
      source: 'crew_five-process-replies',
      requestedAt: '2026-03-17T10:00:00.000Z',
      upstreamStatus: 202,
      accepted: true,
      processed: 1,
      mailboxAccountId: mailboxAccountId ?? null,
    }),
    listMailboxes: async () => [
      {
        mailboxAccountId: 'mbox-1',
        senderIdentity: 'sales-1@example.com',
        user: 'sales-1',
        domain: 'example.com',
        provider: 'imap_mcp',
        campaignCount: 1,
        outboundCount: 1,
        lastSentAt: '2026-03-15T12:00:00Z',
      },
    ],
    getCampaignMailboxSummary: async (campaignId) => ({
      campaignId,
      mailboxes: [
        {
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales-1@example.com',
          user: 'sales-1',
          domain: 'example.com',
          provider: 'imap_mcp',
          campaignCount: 1,
          outboundCount: 1,
          lastSentAt: '2026-03-15T12:00:00Z',
        },
      ],
      consistency: {
        consistent: true,
        mailboxAccountCount: 1,
        senderIdentityCount: 1,
        recommendedMailboxAccountId: 'mbox-1',
        recommendedSenderIdentity: 'sales-1@example.com',
      },
    }),
    getCampaignMailboxAssignment: async (campaignId) => ({
      campaignId,
      assignments: [
        {
          id: 'assign-1',
          mailboxAccountId: 'mbox-1',
          senderIdentity: 'sales-1@example.com',
          user: 'sales-1',
          domain: 'example.com',
          provider: 'imap_mcp',
          source: 'outreacher',
          assignedAt: '2026-03-18T20:00:00Z',
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
    }),
    getCampaignAutoSendSettings: async (campaignId) => ({
      campaignId,
      campaignName: 'Mock Campaign',
      campaignStatus: 'review',
      autoSendIntro: false,
      autoSendBump: true,
      bumpMinDaysSinceIntro: 3,
      updatedAt: '2026-03-21T10:00:00Z',
    }),
    updateCampaignAutoSendSettings: async ({ campaignId, autoSendIntro, autoSendBump, bumpMinDaysSinceIntro }) => ({
      campaignId,
      campaignName: 'Mock Campaign',
      campaignStatus: 'review',
      autoSendIntro: autoSendIntro ?? false,
      autoSendBump: autoSendBump ?? false,
      bumpMinDaysSinceIntro: bumpMinDaysSinceIntro ?? 3,
      updatedAt: '2026-03-21T10:01:00Z',
    }),
    getCampaignSendPolicy: async (campaignId) => buildMockSendPolicyView(campaignId),
    updateCampaignSendPolicy: async ({
      campaignId,
      sendTimezone,
      sendWindowStartHour,
      sendWindowEndHour,
      sendWeekdaysOnly,
      sendDayCountMode,
      sendCalendarCountryCode,
      sendCalendarSubdivisionCode,
    }) => buildMockSendPolicyView(campaignId, {
      updatedAt: '2026-03-21T10:03:00Z',
      sendTimezone,
      sendWindowStartHour,
      sendWindowEndHour,
      sendWeekdaysOnly,
      sendDayCountMode,
      sendCalendarCountryCode,
      sendCalendarSubdivisionCode,
    }),
    replaceCampaignMailboxAssignment: async ({ campaignId, assignments, source }) => ({
      campaignId,
      assignments: assignments.map((assignment, index) => ({
        id: `assign-${index + 1}`,
        mailboxAccountId: assignment.mailboxAccountId ?? null,
        senderIdentity: assignment.senderIdentity,
        user: assignment.senderIdentity.split('@')[0] ?? null,
        domain: assignment.senderIdentity.split('@')[1] ?? null,
        provider: assignment.provider ?? 'imap_mcp',
        source: assignment.source ?? source ?? 'outreacher',
        assignedAt: '2026-03-18T20:00:00Z',
        metadata: assignment.metadata ?? null,
      })),
      summary: {
        assignmentCount: assignments.length,
        mailboxAccountCount: new Set(assignments.map((assignment) => assignment.mailboxAccountId ?? assignment.senderIdentity)).size,
        senderIdentityCount: new Set(assignments.map((assignment) => assignment.senderIdentity)).size,
        domainCount: new Set(assignments.map((assignment) => assignment.senderIdentity.split('@')[1]).filter(Boolean)).size,
        domains: Array.from(new Set(assignments.map((assignment) => assignment.senderIdentity.split('@')[1]).filter(Boolean) as string[])).sort(),
      },
    }),
    previewCompanyImport: async (records) => ({
      mode: 'dry-run',
      summary: {
        total_count: records.length,
        created_count: records.length,
        updated_count: 0,
        skipped_count: 0,
        employee_created_count: 0,
        employee_updated_count: 0,
      },
      items: records.map((record) => ({
        company_name: typeof record.company_name === 'string' ? record.company_name : 'Unknown',
        tin: typeof record.tin === 'string' ? record.tin : null,
        action: 'create' as const,
        match_field: null,
        office_qualification: 'Less' as const,
        warnings: [],
      })),
    }),
    applyCompanyImport: async (records) => ({
      mode: 'apply',
      summary: {
        total_count: records.length,
        created_count: records.length,
        updated_count: 0,
        skipped_count: 0,
        employee_created_count: records.reduce((sum, record) => {
          const rawEmployees = (record as { employees?: unknown[] }).employees;
          const employees = Array.isArray(rawEmployees) ? rawEmployees : [];
          return sum + employees.length;
        }, 0),
        employee_updated_count: 0,
      },
      items: records.map((record) => ({
        company_name: typeof record.company_name === 'string' ? record.company_name : 'Unknown',
        tin: typeof record.tin === 'string' ? record.tin : null,
        action: 'create' as const,
        match_field: null,
        office_qualification: 'Less' as const,
        warnings: [],
      })),
      applied: records.map((_, index) => ({
        index,
        company_id: `co-import-${index + 1}`,
        action: 'create' as const,
      })),
    }),
    startCompanyImportProcess: async ({ companyIds, mode, source }) => {
      const jobId = `job-${randomUUID().slice(0, 8)}`;
      const job = {
        jobId,
        status: 'completed',
        mode: mode ?? 'full',
        totalCompanies: companyIds.length,
        batchSize: Math.min(companyIds.length, 10),
        source: source ?? null,
        processedCompanies: companyIds.length,
        completedCompanies: companyIds.length,
        failedCompanies: 0,
        skippedCompanies: 0,
        results: companyIds.map((companyId) => ({ companyId, status: 'completed' })),
        errors: [],
      };
      mockImportProcessJobs.set(jobId, job);
      return {
        jobId,
        status: 'created',
        mode: mode ?? 'full',
        totalCompanies: companyIds.length,
        batchSize: Math.min(companyIds.length, 10),
        source: source ?? null,
      };
    },
    getCompanyImportProcessStatus: async (jobId) => mockImportProcessJobs.get(jobId) ?? null,
    createCampaign: async ({ name, segmentId, segmentVersion, projectId, offerId, icpHypothesisId }) => {
      const created: Campaign = {
        id: `camp-${randomUUID().substring(0, 8)}`,
        name,
        status: 'draft',
        project_id: projectId ?? null,
        offer_id: offerId ?? null,
        icp_hypothesis_id: icpHypothesisId ?? null,
        segment_id: segmentId,
        segment_version: segmentVersion,
      };
      mockCampaigns.push(created);
      return created;
    },
    listDrafts: async ({ status }) => (status ? mockDrafts.filter((draft) => draft.status === status) : mockDrafts),
    updateDraftStatus: async ({ draftId, status, reviewer, metadata }) => {
      const current = mockDrafts.find((draft) => draft.id === draftId);
      return { id: draftId, status, reviewer: reviewer ?? null, metadata: { ...(current?.metadata ?? {}), ...(metadata ?? {}) } };
    },
    updateDraftStatuses: async ({ draftIds, status, reviewer, metadata }) => ({
      updated: draftIds.map((draftId) => {
        const current = mockDrafts.find((draft) => draft.id === draftId);
        return {
          id: draftId,
          status,
          reviewer: reviewer ?? null,
          metadata: { ...(current?.metadata ?? {}), ...(metadata ?? {}) },
        };
      }),
      summary: {
        totalRequested: draftIds.length,
        updatedCount: draftIds.length,
        status,
      },
    }),
    updateDraftContent: async ({ draftId, subject, body }) => {
      return { id: draftId, subject, body, status: 'generated' };
    },
    getEnrichmentSettings: async () => ({ version: 2, defaultProviders: ['mock'], primaryCompanyProvider: 'mock', primaryEmployeeProvider: 'mock' }),
    setEnrichmentSettings: async (payload) => ({
      version: 2,
      defaultProviders: payload?.defaultProviders ?? ['mock'],
      primaryCompanyProvider: payload?.primaryCompanyProvider ?? 'mock',
      primaryEmployeeProvider: payload?.primaryEmployeeProvider ?? 'mock',
    }),
    listCompanies: async ({ segment }) => (segment ? mockCompanies.filter((company) => company.segment === segment) : mockCompanies),
    listContacts: async ({ companyIds }) => (companyIds ? mockContacts.filter((contact) => companyIds.includes(contact.company_id)) : mockContacts),
    listDirectoryCompanies: async ({ segment, enrichmentStatus, query, limit }) => {
      const items: DirectoryCompaniesView['items'] = [
        {
          companyId: 'co-1',
          companyName: 'Mock Co',
          segment: 'AI',
          status: 'active',
          website: 'https://mock.example',
          employeeCount: 12,
          officeQualification: 'More',
          registrationDate: '2024-01-01',
          updatedAt: '2026-03-17T10:00:00Z',
          enrichment: { status: 'fresh' as const, lastUpdatedAt: '2026-03-17T10:00:00Z', providerHint: 'mock' },
          contacts: { total: 1, withWorkEmail: 1, withAnyEmail: 1, missingEmail: 0 },
          flags: { hasWebsite: true, hasResearch: true },
        },
        {
          companyId: 'co-2',
          companyName: 'Other Co',
          segment: 'Industrial',
          status: 'pending',
          website: null,
          employeeCount: 4,
          officeQualification: null,
          registrationDate: null,
          updatedAt: '2026-03-01T10:00:00Z',
          enrichment: { status: 'missing' as const, lastUpdatedAt: null, providerHint: null },
          contacts: { total: 1, withWorkEmail: 0, withAnyEmail: 0, missingEmail: 1 },
          flags: { hasWebsite: false, hasResearch: false },
        },
      ]
        .filter((item) => (segment ? item.segment === segment : true))
        .filter((item) => (enrichmentStatus ? item.enrichment.status === enrichmentStatus : true))
        .filter((item) => {
          if (!query) return true;
          const needle = query.toLowerCase();
          return [item.companyName, item.segment, item.website].some((value) => value?.toLowerCase().includes(needle));
        });
      return {
        items: limit ? items.slice(0, limit) : items,
        summary: {
          total: items.length,
          enrichment: {
            fresh: items.filter((item) => item.enrichment.status === 'fresh').length,
            stale: items.filter((item) => item.enrichment.status === 'stale').length,
            missing: items.filter((item) => item.enrichment.status === 'missing').length,
          },
          segments: Array.from(
            items.reduce((map, item) => {
              const key = item.segment ?? 'Unassigned';
              map.set(key, (map.get(key) ?? 0) + 1);
              return map;
            }, new Map<string, number>())
          ).map(([segmentName, count]) => ({ segment: segmentName, count })),
        },
      };
    },
    listDirectoryContacts: async ({ companyIds, segment, emailStatus, enrichmentStatus, query, limit }) => {
      const items: DirectoryContactsView['items'] = [
        {
          contactId: 'ct-1',
          companyId: 'co-1',
          companyName: 'Mock Co',
          companySegment: 'AI',
          companyStatus: 'active',
          fullName: 'Alex Mock',
          position: 'CTO',
          workEmail: 'a@mock.com',
          genericEmail: null,
          emailStatus: 'work' as const,
          workEmailStatus: 'unknown' as const,
          genericEmailStatus: 'unknown' as const,
          processingStatus: 'completed',
          updatedAt: '2026-03-17T10:00:00Z',
          enrichment: { status: 'fresh' as const, lastUpdatedAt: '2026-03-17T10:00:00Z', providerHint: 'mock' },
        },
        {
          contactId: 'ct-2',
          companyId: 'co-2',
          companyName: 'Other Co',
          companySegment: 'Industrial',
          companyStatus: 'pending',
          fullName: 'Bianca Mock',
          position: 'COO',
          workEmail: null,
          genericEmail: null,
          emailStatus: 'missing' as const,
          workEmailStatus: 'unknown' as const,
          genericEmailStatus: 'unknown' as const,
          processingStatus: 'pending',
          updatedAt: '2026-03-10T10:00:00Z',
          enrichment: { status: 'missing' as const, lastUpdatedAt: null, providerHint: null },
        },
      ]
        .filter((item) => (companyIds?.length ? companyIds.includes(item.companyId ?? '') : true))
        .filter((item) => (segment ? item.companySegment === segment : true))
        .filter((item) => (emailStatus ? item.emailStatus === emailStatus : true))
        .filter((item) => (enrichmentStatus ? item.enrichment.status === enrichmentStatus : true))
        .filter((item) => {
          if (!query) return true;
          const needle = query.toLowerCase();
          return [item.fullName, item.position, item.companyName, item.workEmail, item.genericEmail].some((value) =>
            value?.toLowerCase().includes(needle)
          );
        });
      return {
        items: limit ? items.slice(0, limit) : items,
        summary: {
          total: items.length,
          emailStatus: {
            work: items.filter((item) => item.emailStatus === 'work').length,
            generic: items.filter((item) => item.emailStatus === 'generic').length,
            missing: items.filter((item) => item.emailStatus === 'missing').length,
          },
          enrichment: {
            fresh: items.filter((item) => item.enrichment.status === 'fresh').length,
            stale: items.filter((item) => item.enrichment.status === 'stale').length,
            missing: items.filter((item) => item.enrichment.status === 'missing').length,
          },
        },
      };
    },
    previewEmployeeNameRepairs: async ({ confidence }) => ({
      mode: 'dry-run',
      summary: {
        scanned_count: 2,
        candidate_count: confidence === 'low' ? 0 : 1,
        fixable_count:
          confidence === 'all' || confidence === 'high' || confidence === undefined ? 1 : 0,
        skipped_count: 0,
        updated_count: 0,
      },
      candidates:
        confidence === 'low'
          ? []
          : [
              {
                employee_id: 'ct-1',
                company_id: 'co-1',
                full_name: 'Alex Mock',
                current_first_name: 'Mock',
                current_last_name: 'Alex',
                proposed_first_name: 'Alex',
                proposed_last_name: 'Mock',
                confidence: 'high',
              },
            ],
    }),
    applyEmployeeNameRepairs: async ({ confidence }) => ({
      mode: 'apply',
      summary: {
        scanned_count: 2,
        candidate_count: confidence === 'low' ? 0 : 1,
        fixable_count:
          confidence === 'all' || confidence === 'high' || confidence === undefined ? 1 : 0,
        skipped_count: 0,
        updated_count: confidence === 'low' ? 0 : 1,
      },
      candidates:
        confidence === 'low'
          ? []
          : [
              {
                employee_id: 'ct-1',
                company_id: 'co-1',
                full_name: 'Alex Mock',
                current_first_name: 'Mock',
                current_last_name: 'Alex',
                proposed_first_name: 'Alex',
                proposed_last_name: 'Mock',
                confidence: 'high',
              },
            ],
    }),
    markDirectoryContactInvalid: async (contactId) => ({
      contactId,
      processingStatus: 'invalid',
      updatedAt: '2026-03-18T10:00:00Z',
    }),
    deleteDirectoryContact: async (contactId) => ({
      contactId,
      deleted: true as const,
    }),
    markDirectoryCompanyInvalid: async (companyId) => ({
      companyId,
      processingStatus: 'invalid',
      updatedAt: '2026-03-18T11:00:00Z',
    }),
    deleteDirectoryCompany: async (companyId) => ({
      companyId,
      deleted: true as const,
    }),
    updateDirectoryContact: async (contactId, patch) => ({
      contactId,
      fullName: typeof patch.full_name === 'string' ? patch.full_name : 'Alex Mock',
      position: typeof patch.position === 'string' ? patch.position : 'CTO',
      workEmail: typeof patch.work_email === 'string' ? patch.work_email.toLowerCase() : 'a@mock.com',
      genericEmail:
        typeof patch.generic_email === 'string' ? patch.generic_email.toLowerCase() : null,
      processingStatus:
        typeof patch.processing_status === 'string' ? patch.processing_status : 'completed',
      updatedAt: '2026-03-18T12:00:00Z',
    }),
    updateDirectoryCompany: async (companyId, patch) => ({
      companyId,
      companyName:
        typeof patch.company_name === 'string' ? patch.company_name : 'Mock Co',
      website: typeof patch.website === 'string' ? patch.website : 'https://mock.example',
      segment: typeof patch.segment === 'string' ? patch.segment : 'AI',
      status: typeof patch.status === 'string' ? patch.status : 'Active',
      officeQualification:
        typeof patch.office_qualification === 'string' ? patch.office_qualification : 'More',
      employeeCount:
        typeof patch.employee_count === 'number' ? patch.employee_count : 12,
      primaryEmail:
        typeof patch.primary_email === 'string' ? patch.primary_email.toLowerCase() : 'hello@mock.example',
      companyDescription:
        typeof patch.company_description === 'string' ? patch.company_description : 'Mock company',
      region: typeof patch.region === 'string' ? patch.region : 'Paris',
      processingStatus:
        typeof patch.processing_status === 'string' ? patch.processing_status : 'completed',
      updatedAt: '2026-03-18T12:30:00Z',
    }),
    listSegments: async () => mockSegments,
    createSegment: async (input) => ({
      id: `seg-${randomUUID().substring(0, 8)}`,
      ...input,
      filter_definition: input.filterDefinition,
      created_by: input.createdBy,
      created_at: new Date().toISOString(),
      version: 0,
    }),
    snapshotSegment: async ({ segmentId }) => ({ version: mockSegments.find((segment) => segment.id === segmentId)?.version ?? 1, count: mockContacts.length }),
    enqueueSegmentEnrichment: async () => ({ id: 'job-1', status: 'queued' }),
    runSegmentEnrichmentOnce: async () => ({ processed: 1, dryRun: false, jobId: 'job-1' }),
    getSegmentEnrichmentStatus: async () => ({ jobId: 'job-1', status: 'completed' }),
    listIcpProfiles: async () => mockIcpProfiles,
    createIcpProfile: async ({ name }) => {
      const created = {
        id: `p-${mockIcpProfiles.length + 1}`,
        name,
        offering_domain: null,
        learnings: [],
        updated_at: new Date().toISOString(),
      };
      mockIcpProfiles.push(created);
      return created;
    },
    getIcpProfileLearnings: async (profileId) => {
      const profile = mockIcpProfiles.find((row) => row.id === profileId);
      if (!profile) throw new Error('ICP profile not found');
      return {
        profileId: profile.id,
        profileName: profile.name,
        offeringDomain: profile.offering_domain ?? null,
        learnings: Array.isArray(profile.learnings) ? profile.learnings : [],
        updatedAt: profile.updated_at ?? null,
      };
    },
    updateIcpProfileLearnings: async ({ profileId, learnings }) => {
      const profile = mockIcpProfiles.find((row) => row.id === profileId);
      if (!profile) throw new Error('ICP profile not found');
      const normalized = Array.from(new Set(learnings.map((value) => value.trim()).filter(Boolean)));
      profile.learnings = normalized;
      profile.updated_at = '2026-03-17T11:00:00Z';
      return {
        profileId: profile.id,
        profileName: profile.name,
        offeringDomain: profile.offering_domain ?? null,
        learnings: normalized,
        updatedAt: profile.updated_at,
      };
    },
    listIcpOfferingMappings: async () =>
      mockIcpProfiles.map((profile) => ({
        profileId: profile.id,
        profileName: profile.name,
        offeringDomain: profile.offering_domain ?? null,
        learningsCount: Array.isArray(profile.learnings) ? profile.learnings.length : 0,
      })),
    listIcpHypotheses: async () => mockHypotheses,
    createIcpHypothesis: async ({ hypothesisLabel, offerId, targetingDefaults, messagingAngle, patternDefaults, notes }) => {
      const created = {
        id: `h-${mockHypotheses.length + 1}`,
        hypothesis_label: hypothesisLabel,
        offer_id: offerId ?? null,
        targeting_defaults: targetingDefaults ?? null,
        messaging_angle: messagingAngle ?? null,
        pattern_defaults: patternDefaults ?? null,
        notes: notes ?? null,
      };
      mockHypotheses.push(created);
      return created;
    },
    generateIcpProfile: async (payload) => ({ id: `p-${mockIcpProfiles.length + 1}`, ...payload }),
    generateIcpHypothesis: async (payload) => ({ id: `h-${mockHypotheses.length + 1}`, ...payload }),
    listPromptRegistry: async () => mockPromptRegistry,
    getActivePromptForStep: async (step: string) => mockPromptRegistry.find((entry) => entry.step === step && entry.rollout_status === 'active')?.id ?? null,
    setActivePromptForStep: async (step: string, coachPromptId: string) => {
      mockPromptRegistry.forEach((entry) => {
        if (entry.step === step) {
          (entry as any).rollout_status = entry.id === coachPromptId ? 'active' : 'pilot';
        }
      });
    },
    createPromptRegistryEntry: async (payload) => {
      const created = { id: payload.id ?? `pr-${mockPromptRegistry.length + 1}`, ...payload };
      mockPromptRegistry.push(created as any);
      return created;
    },
    generateDrafts: async ({ dryRun }) => ({ generated: dryRun ? 0 : mockDrafts.length, dryRun: Boolean(dryRun), gracefulUsed: 0 }),
    sendSmartlead: async ({ dryRun, campaignId, smartleadCampaignId, batchSize }) => ({
      dryRun: Boolean(dryRun),
      campaignId,
      smartleadCampaignId,
      leadsPrepared: batchSize ?? 0,
      leadsPushed: dryRun ? 0 : batchSize ?? 0,
      sequencesPrepared: 1,
      sequencesSynced: dryRun ? 0 : 1,
      skippedContactsNoEmail: 0,
      timestamp: new Date().toISOString(),
    }),
    listEvents: async () => [],
    listReplyPatterns: async () => [],
    dashboardOverview: async () => ({
      campaigns: {
        total: 1,
        active: 1,
        byStatus: [{ status: 'draft', count: 1 }],
      },
      pending: {
        draftsOnReview: 1,
        inboxReplies: 1,
        staleEnrichment: 0,
        missingEnrichment: 1,
      },
      recentActivity: [
        {
          kind: 'reply',
          id: 'evt-1',
          timestamp: '2026-03-18T13:30:00Z',
          title: 'Reply positive',
          subtitle: 'draft draft-2',
          campaignId: null,
        },
      ],
    }),
    analyticsSummary: async ({ groupBy }) => [{ groupBy, delivered: 1, opened: 1, replied: 0, positive_replies: 0 }],
    analyticsRejectionReasons: async () => ({
      total_rejected: 2,
      by_reason: [{ review_reason_code: 'marketing_tone', count: 2 }],
      by_pattern: [{ draft_pattern: 'problem-led', count: 2 }],
      by_pattern_and_reason: [
        { draft_pattern: 'problem-led', review_reason_code: 'marketing_tone', count: 2 },
      ],
      by_campaign: [{ campaign_id: 'camp-1', count: 2 }],
      by_email_type: [{ email_type: 'intro', count: 2 }],
      by_icp_profile: [{ icp_profile_id: 'p1', count: 2 }],
      by_icp_hypothesis: [{ icp_hypothesis_id: 'h1', count: 2 }],
    }),
    analyticsOptimize: async () => ({ suggestions: [], simSummary: [] }),
    runIcpDiscovery: async () => ({ jobId: 'job-mock', runId: 'run-mock', provider: 'exa', status: 'running' }),
    listIcpDiscoveryCandidates: async () => [],
    promoteIcpDiscoveryCandidates: async ({ candidateIds }) => ({ promotedCount: candidateIds.length }),
    getFilterPreview: async () => ({ companyCount: 5, employeeCount: 12, totalCount: 17 }),
    aiSuggestFilters: async () => [{ filters: [{ field: 'employees.role', operator: 'eq', value: 'CTO' }], rationale: 'Mock suggestion for testing', targetAudience: 'Technology decision makers' }],
    searchExaWebset: async () => ({
      companies: [{ name: 'Mock Company', domain: 'mock.com', confidenceScore: 0.9 }],
      employees: [{ name: 'John Doe', role: 'CTO', companyName: 'Mock Company', confidenceScore: 0.85 }],
      totalResults: 2,
      query: 'Mock query',
    }),
  };
}
