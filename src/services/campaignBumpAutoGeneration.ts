import type { SupabaseClient } from '@supabase/supabase-js';

import {
  listCampaignFollowupCandidates,
  type CampaignFollowupCandidate,
  type CampaignFollowupCandidatesOptions,
} from './campaignFollowupCandidates.js';
import { getCampaignSendPolicy } from './campaignSendPolicy.js';
import {
  resolveRecipientEmail,
  type EmailDeliverabilityStatus,
  type RecipientEmailSource,
} from './recipientResolver.js';

const DEFAULT_MIN_DAYS_SINCE_INTRO = 3;
const SUPABASE_IN_FILTER_CHUNK_SIZE = 100;

interface DraftRow {
  contact_id: string | null;
  email_type: string | null;
  status: string | null;
}

interface EmployeeRow {
  id: string;
  work_email: string | null;
  work_email_status: EmailDeliverabilityStatus | null;
  generic_email: string | null;
  generic_email_status: EmailDeliverabilityStatus | null;
}

export interface CampaignBumpGenerationCandidate extends CampaignFollowupCandidate {
  recipient_email: string | null;
  recipient_email_source: RecipientEmailSource;
  sendable: boolean;
  active_bump_draft_exists: boolean;
  eligible_for_generation: boolean;
}

export interface CampaignGenerateBumpsTriggerRequest {
  campaignId: string;
  contactIds: string[];
  limit?: number;
  dryRun?: boolean;
}

export interface CampaignBumpAutoGenerationOptions extends CampaignFollowupCandidatesOptions {
  campaignId: string;
  limit?: number;
  dryRun?: boolean;
  executeGenerateBumps?: (
    request: CampaignGenerateBumpsTriggerRequest
  ) => Promise<Record<string, unknown>>;
  triggerGenerateBumps?: (
    request: CampaignGenerateBumpsTriggerRequest
  ) => Promise<Record<string, unknown>>;
}

export interface CampaignBumpAutoGenerationResult {
  triggered: boolean;
  candidateCount: number;
  eligibleCount: number;
  requestedContactCount: number;
  requestedContactIds: string[];
  triggerResult?: Record<string, unknown>;
}

function isActiveBumpDraft(row: DraftRow): boolean {
  return (
    row.email_type === 'bump' &&
    row.status !== 'rejected' &&
    row.status !== 'sent'
  );
}

function isDelayReached(
  candidate: CampaignFollowupCandidate,
  sendDayCountMode: 'elapsed_days' | 'business_days_campaign' | 'business_days_recipient',
  minDaysSinceIntro: number
): boolean {
  if (sendDayCountMode === 'business_days_campaign' || sendDayCountMode === 'business_days_recipient') {
    return (
      typeof candidate.business_days_since_intro === 'number' &&
      candidate.business_days_since_intro >= minDaysSinceIntro
    );
  }

  return typeof candidate.days_since_intro === 'number' && candidate.days_since_intro >= minDaysSinceIntro;
}

function chunkValues<T>(values: T[], size: number = SUPABASE_IN_FILTER_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function loadEmployeesById(
  client: SupabaseClient,
  contactIds: string[]
): Promise<Map<string, EmployeeRow>> {
  const uniqueContactIds = Array.from(new Set(contactIds.filter(Boolean)));
  const employeesById = new Map<string, EmployeeRow>();
  for (const contactIdsChunk of chunkValues(uniqueContactIds)) {
    const { data, error } = await client
      .from('employees')
      .select('id,work_email,work_email_status,generic_email,generic_email_status')
      .in('id', contactIdsChunk);
    if (error) {
      throw error;
    }
    for (const row of (data ?? []) as EmployeeRow[]) {
      employeesById.set(row.id, row);
    }
  }
  return employeesById;
}

export async function listCampaignBumpGenerationCandidates(
  client: SupabaseClient,
  campaignId: string,
  options: CampaignFollowupCandidatesOptions = {}
): Promise<CampaignBumpGenerationCandidate[]> {
  const minDaysSinceIntro = options.minDaysSinceIntro ?? DEFAULT_MIN_DAYS_SINCE_INTRO;
  const [sendPolicy, followupCandidates, draftsRes] = await Promise.all([
    getCampaignSendPolicy(client, campaignId),
    listCampaignFollowupCandidates(client, campaignId, options),
    client.from('drafts').select('contact_id,email_type,status').eq('campaign_id', campaignId),
  ]);

  if (draftsRes.error) {
    throw draftsRes.error;
  }

  const activeDraftContacts = new Set(
    ((draftsRes.data ?? []) as DraftRow[])
      .filter((row) => row.contact_id && isActiveBumpDraft(row))
      .map((row) => row.contact_id as string)
  );
  const employeesById = await loadEmployeesById(
    client,
    followupCandidates.map((candidate) => candidate.contact_id)
  );

  return followupCandidates.map((candidate) => {
    const employee = employeesById.get(candidate.contact_id) ?? null;
    const recipient = resolveRecipientEmail({
      work_email: employee?.work_email,
      work_email_status: employee?.work_email_status,
      generic_email: employee?.generic_email,
      generic_email_status: employee?.generic_email_status,
    });
    const activeBumpDraftExists = activeDraftContacts.has(candidate.contact_id);
    const eligibleForGeneration =
      candidate.intro_sent &&
      recipient.sendable &&
      Boolean(recipient.recipientEmail) &&
      isDelayReached(candidate, sendPolicy.sendDayCountMode, minDaysSinceIntro) &&
      !candidate.reply_received &&
      !candidate.bounce &&
      !candidate.unsubscribed &&
      !candidate.bump_sent &&
      !activeBumpDraftExists;

    return {
      ...candidate,
      recipient_email: recipient.recipientEmail,
      recipient_email_source: recipient.recipientEmailSource,
      sendable: recipient.sendable,
      active_bump_draft_exists: activeBumpDraftExists,
      eligible_for_generation: eligibleForGeneration,
    };
  });
}

export async function runCampaignBumpAutoGeneration(
  client: SupabaseClient,
  options: CampaignBumpAutoGenerationOptions
): Promise<CampaignBumpAutoGenerationResult> {
  const candidates = await listCampaignBumpGenerationCandidates(client, options.campaignId, options);
  const eligibleContactIds = candidates
    .filter((candidate) => candidate.eligible_for_generation)
    .map((candidate) => candidate.contact_id)
    .sort((left, right) => left.localeCompare(right));
  const requestedContactIds =
    typeof options.limit === 'number' && Number.isFinite(options.limit)
      ? eligibleContactIds.slice(0, Math.max(0, Math.trunc(options.limit)))
      : eligibleContactIds;

  const executeGenerateBumps = options.executeGenerateBumps ?? options.triggerGenerateBumps;
  if (requestedContactIds.length < 1 || !executeGenerateBumps) {
    return {
      triggered: false,
      candidateCount: candidates.length,
      eligibleCount: eligibleContactIds.length,
      requestedContactCount: 0,
      requestedContactIds: [],
    };
  }

  const triggerResult = await executeGenerateBumps({
    campaignId: options.campaignId,
    contactIds: requestedContactIds,
    limit: options.limit,
    dryRun: options.dryRun,
  });

  return {
    triggered: true,
    candidateCount: candidates.length,
    eligibleCount: eligibleContactIds.length,
    requestedContactCount: requestedContactIds.length,
    requestedContactIds,
    triggerResult,
  };
}
