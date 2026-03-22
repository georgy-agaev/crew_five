import type { SupabaseClient } from '@supabase/supabase-js';

import { getCampaignReadModel, type CampaignDetailEmployeeView } from './campaignDetailReadModel.js';
import type { RecipientEmailSource } from './recipientResolver.js';

export type CampaignRotationGlobalBlockedReason =
  | 'reply_received_stop'
  | 'suppressed_contact'
  | 'cooldown_active'
  | 'no_sendable_email';

export type CampaignRotationCandidateBlockedReason = 'already_received_candidate_offer';

export type CampaignRotationBlockedReason =
  | CampaignRotationGlobalBlockedReason
  | CampaignRotationCandidateBlockedReason;

export interface CampaignRotationPreviewInput {
  sourceCampaignId: string;
  now?: Date;
  cooldownDays?: number;
}

interface RotationHypothesisRow {
  id: string;
  hypothesis_label: string | null;
  offer_id: string | null;
  status: string | null;
  messaging_angle: string | null;
}

interface RotationOfferRow {
  id: string;
  title: string | null;
  project_name: string | null;
}

export interface CampaignRotationCandidateEvaluation {
  icpHypothesisId: string;
  offerId: string;
  eligible: boolean;
  blockedReasons: CampaignRotationBlockedReason[];
}

export interface CampaignRotationContactPreviewItem {
  contactId: string;
  companyId: string | null;
  companyName: string | null;
  fullName: string | null;
  position: string | null;
  recipientEmail: string | null;
  recipientEmailSource: RecipientEmailSource;
  sendable: boolean;
  exposureSummary: CampaignDetailEmployeeView['exposure_summary'];
  globalBlockedReasons: CampaignRotationGlobalBlockedReason[];
  candidateEvaluations: CampaignRotationCandidateEvaluation[];
}

export interface CampaignRotationCandidateView {
  icpHypothesisId: string;
  hypothesisLabel: string | null;
  messagingAngle: string | null;
  offerId: string;
  offerTitle: string | null;
  projectName: string | null;
  eligibleContactCount: number;
  blockedContactCount: number;
  blockedBreakdown: Record<CampaignRotationBlockedReason, number>;
}

export interface CampaignRotationPreviewResult {
  sourceCampaign: {
    campaignId: string;
    campaignName: string;
    offerId: string | null;
    offerTitle: string | null;
    icpHypothesisId: string | null;
    icpHypothesisLabel: string | null;
    icpProfileId: string;
    icpProfileName: string | null;
  };
  summary: {
    sourceContactCount: number;
    candidateCount: number;
    eligibleCandidateContactCount: number;
    blockedCandidateContactCount: number;
  };
  candidates: CampaignRotationCandidateView[];
  contacts: CampaignRotationContactPreviewItem[];
}

const DEFAULT_ROTATION_COOLDOWN_DAYS = 21;
const ROTATION_SOURCE_STATUSES = new Set(['sending', 'paused', 'complete']);

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isWithinCooldown(value: string | null | undefined, now: Date, cooldownDays: number) {
  const sentAt = parseIsoDate(value);
  if (!sentAt) {
    return false;
  }
  const diffMs = now.getTime() - sentAt.getTime();
  return diffMs >= 0 && diffMs < cooldownDays * 24 * 60 * 60 * 1000;
}

function buildBlockedBreakdown() {
  return {
    reply_received_stop: 0,
    suppressed_contact: 0,
    cooldown_active: 0,
    no_sendable_email: 0,
    already_received_candidate_offer: 0,
  } satisfies Record<CampaignRotationBlockedReason, number>;
}

function listGlobalBlockedReasons(
  employee: CampaignDetailEmployeeView,
  now: Date,
  cooldownDays: number
): CampaignRotationGlobalBlockedReason[] {
  const reasons: CampaignRotationGlobalBlockedReason[] = [];
  if (employee.execution_exposures.some((row) => row.replied)) {
    reasons.push('reply_received_stop');
  }
  if (employee.execution_exposures.some((row) => row.bounced || row.unsubscribed)) {
    reasons.push('suppressed_contact');
  }
  if (isWithinCooldown(employee.exposure_summary.last_sent_at, now, cooldownDays)) {
    reasons.push('cooldown_active');
  }
  if (!employee.sendable) {
    reasons.push('no_sendable_email');
  }
  return reasons;
}

async function loadCandidateHypotheses(
  client: SupabaseClient,
  icpProfileId: string,
  sourceOfferId: string | null
): Promise<CampaignRotationCandidateView[]> {
  const { data, error } = await client
    .from('icp_hypotheses')
    .select('id,hypothesis_label,offer_id,status,messaging_angle')
    .eq('icp_id', icpProfileId)
    .in('status', ['active']);

  if (error) {
    throw error;
  }

  const hypotheses = ((data ?? []) as RotationHypothesisRow[]).filter(
    (row) => row.status === 'active' && row.offer_id && row.offer_id !== sourceOfferId
  );
  const offerIds = Array.from(new Set(hypotheses.map((row) => row.offer_id).filter((value): value is string => Boolean(value))));

  const offersById = new Map<string, RotationOfferRow>();
  if (offerIds.length > 0) {
    const { data: offerRows, error: offerError } = await client
      .from('offers')
      .select('id,title,project_name')
      .in('id', offerIds);
    if (offerError) {
      throw offerError;
    }
    for (const offer of (offerRows ?? []) as RotationOfferRow[]) {
      offersById.set(offer.id, offer);
    }
  }

  return hypotheses
    .map((row) => {
      const offer = row.offer_id ? offersById.get(row.offer_id) : null;
      return {
        icpHypothesisId: row.id,
        hypothesisLabel: row.hypothesis_label,
        messagingAngle: row.messaging_angle,
        offerId: row.offer_id!,
        offerTitle: offer?.title ?? null,
        projectName: offer?.project_name ?? null,
        eligibleContactCount: 0,
        blockedContactCount: 0,
        blockedBreakdown: buildBlockedBreakdown(),
      };
    })
    .sort((left, right) =>
      String(left.hypothesisLabel ?? left.offerTitle ?? '').localeCompare(String(right.hypothesisLabel ?? right.offerTitle ?? ''))
    );
}

export async function getCampaignRotationPreview(
  client: SupabaseClient,
  input: CampaignRotationPreviewInput
): Promise<CampaignRotationPreviewResult> {
  const campaign = await getCampaignReadModel(client, input.sourceCampaignId);
  const hasSentSourceActivity = campaign.companies.some((company) =>
    company.employees.some(
      (employee) =>
        employee.execution_exposures.length > 0 || employee.sent_count > 0 || employee.draft_counts.sent > 0
    )
  );
  if (!ROTATION_SOURCE_STATUSES.has(String(campaign.campaign.status ?? '')) || !hasSentSourceActivity) {
    const error: any = new Error('Campaign rotation preview requires a sent source wave');
    error.code = 'CAMPAIGN_ROTATION_REQUIRES_SENT_SOURCE_WAVE';
    throw error;
  }
  const icpProfileId = campaign.icp_profile?.id ?? campaign.segment?.icp_profile_id ?? null;
  if (!icpProfileId) {
    const error: any = new Error('Campaign rotation preview requires source ICP profile');
    error.code = 'CAMPAIGN_ROTATION_REQUIRES_ICP_PROFILE';
    throw error;
  }

  const candidates = await loadCandidateHypotheses(client, icpProfileId, campaign.offer?.id ?? campaign.campaign.offer_id ?? null);
  const contacts = campaign.companies.flatMap((company) =>
    company.employees.map((employee) => ({
      companyId: company.company_id,
      companyName: company.company_name,
      employee,
    }))
  );

  const now = input.now ?? new Date();
  const cooldownDays = input.cooldownDays ?? DEFAULT_ROTATION_COOLDOWN_DAYS;
  let eligibleCandidateContactCount = 0;
  let blockedCandidateContactCount = 0;

  const contactItems: CampaignRotationContactPreviewItem[] = contacts
    .map(({ companyId, companyName, employee }) => {
      const globalBlockedReasons = listGlobalBlockedReasons(employee, now, cooldownDays);
      const candidateEvaluations = candidates.map((candidate) => {
        const blockedReasons: CampaignRotationBlockedReason[] = [...globalBlockedReasons];
        const alreadyReceivedCandidateOffer = employee.execution_exposures.some(
          (row) => row.offer_id === candidate.offerId
        );
        if (alreadyReceivedCandidateOffer) {
          blockedReasons.push('already_received_candidate_offer');
        }
        const eligible = blockedReasons.length === 0;
        if (eligible) {
          candidate.eligibleContactCount += 1;
          eligibleCandidateContactCount += 1;
        } else {
          candidate.blockedContactCount += 1;
          blockedCandidateContactCount += 1;
          for (const reason of blockedReasons) {
            candidate.blockedBreakdown[reason] += 1;
          }
        }
        return {
          icpHypothesisId: candidate.icpHypothesisId,
          offerId: candidate.offerId,
          eligible,
          blockedReasons,
        };
      });

      return {
        contactId: employee.contact_id,
        companyId,
        companyName,
        fullName: employee.full_name,
        position: employee.position,
        recipientEmail: employee.recipient_email,
        recipientEmailSource: employee.recipient_email_source,
        sendable: employee.sendable,
        exposureSummary: employee.exposure_summary,
        globalBlockedReasons,
        candidateEvaluations,
      };
    })
    .sort((left, right) => String(left.fullName ?? '').localeCompare(String(right.fullName ?? '')));

  return {
    sourceCampaign: {
      campaignId: campaign.campaign.id,
      campaignName: campaign.campaign.name,
      offerId: campaign.offer?.id ?? campaign.campaign.offer_id ?? null,
      offerTitle: campaign.offer?.title ?? null,
      icpHypothesisId: campaign.icp_hypothesis?.id ?? campaign.campaign.icp_hypothesis_id ?? null,
      icpHypothesisLabel: campaign.icp_hypothesis?.name ?? null,
      icpProfileId,
      icpProfileName: campaign.icp_profile?.name ?? null,
    },
    summary: {
      sourceContactCount: contactItems.length,
      candidateCount: candidates.length,
      eligibleCandidateContactCount,
      blockedCandidateContactCount,
    },
    candidates,
    contacts: contactItems,
  };
}
