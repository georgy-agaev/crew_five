import type { SupabaseClient } from '@supabase/supabase-js';

import { listCampaignAudience, type CampaignAudienceRow } from './campaignAudience.js';
import {
  getCampaignMailboxAssignment,
  type CampaignMailboxAssignmentInput,
  type CampaignMailboxAssignmentView,
} from './campaignMailboxAssignments.js';
import { launchCampaign } from './campaignLaunch.js';
import { getCampaignDetail } from './campaigns.js';
import { deriveContactSuppressionState } from './contactSuppression.js';
import { buildExposureSummary, listExecutionExposureByContact, type ExecutionExposureSummary } from './executionExposure.js';
import {
  resolveRecipientEmail,
  type EmailDeliverabilityStatus,
  type RecipientEmailSource,
} from './recipientResolver.js';
import {
  getCampaignSendPolicy,
  type CampaignSendPolicy,
  type CampaignSendPolicyInput,
} from './campaignSendPolicy.js';

export type CampaignNextWaveBlockedReason =
  | 'suppressed_contact'
  | 'already_contacted_recently'
  | 'no_sendable_email'
  | 'already_in_target_wave'
  | 'already_used_in_source_wave';

export interface CampaignNextWavePreviewInput {
  sourceCampaignId: string;
  targetSegmentId?: string;
  targetSegmentVersion?: number;
  now?: Date;
  recentContactWindowDays?: number;
}

export interface CampaignNextWaveCreateInput extends CampaignSendPolicyInput {
  sourceCampaignId: string;
  name: string;
  createdBy?: string;
  targetSegmentId?: string;
  targetSegmentVersion?: number;
  offerId?: string;
  icpHypothesisId?: string;
  snapshotMode?: 'reuse' | 'refresh';
  senderPlan?: {
    source?: string | null;
    assignments?: CampaignMailboxAssignmentInput[];
  };
  now?: Date;
  recentContactWindowDays?: number;
}

interface EmployeeRow {
  id: string;
  work_email: string | null;
  work_email_status: EmailDeliverabilityStatus | null;
  generic_email: string | null;
  generic_email_status: EmailDeliverabilityStatus | null;
}

interface OutboundRow {
  id: string;
  campaign_id: string | null;
  contact_id: string | null;
  draft_id: string | null;
  status: string | null;
  sent_at: string | null;
}

interface EventRow {
  outbound_id: string | null;
  event_type: string | null;
}

export interface CampaignNextWavePreviewItem {
  contactId: string;
  companyId: string | null;
  source: 'target_segment' | 'source_manual_attach';
  eligible: boolean;
  blockedReason: CampaignNextWaveBlockedReason | null;
  recipientEmail: string | null;
  recipientEmailSource: RecipientEmailSource;
  exposure_summary: ExecutionExposureSummary;
}

export interface CampaignNextWavePreviewResult {
  sourceCampaign: {
    id: string;
    name: string;
  };
  defaults: {
    targetSegmentId: string;
    targetSegmentVersion: number;
    offerId: string | null;
    icpHypothesisId: string | null;
    sendPolicy: CampaignSendPolicy;
    senderPlanSummary: CampaignMailboxAssignmentView['summary'];
  };
  summary: {
    candidateContactCount: number;
    eligibleContactCount: number;
    blockedContactCount: number;
  };
  blockedBreakdown: Record<CampaignNextWaveBlockedReason, number>;
  items: CampaignNextWavePreviewItem[];
}

export interface CampaignNextWaveCreateResult extends CampaignNextWavePreviewResult {
  campaign: Record<string, any>;
  senderPlan: {
    assignments: CampaignMailboxAssignmentView['assignments'];
    summary: CampaignMailboxAssignmentView['summary'];
  };
  sendPolicy: CampaignSendPolicy;
}

interface TargetCandidateSeed {
  companyId: string | null;
  contactId: string;
  source: 'target_segment' | 'source_manual_attach';
  snapshot: unknown;
}

interface NextWaveContext {
  sourceCampaign: Record<string, any>;
  sourceSendPolicy: CampaignSendPolicy;
  sourceMailboxAssignment: CampaignMailboxAssignmentView;
  sourceAudienceRows: CampaignAudienceRow[];
}

const DEFAULT_RECENT_CONTACT_WINDOW_DAYS = 30;
const CONTACT_QUERY_CHUNK_SIZE = 100;

function buildBlockedBreakdown() {
  return {
    suppressed_contact: 0,
    already_contacted_recently: 0,
    no_sendable_email: 0,
    already_in_target_wave: 0,
    already_used_in_source_wave: 0,
  } satisfies Record<CampaignNextWaveBlockedReason, number>;
}

function toAssignmentInputs(
  assignment: CampaignMailboxAssignmentView
): CampaignMailboxAssignmentInput[] {
  return assignment.assignments.map((row) => ({
    mailboxAccountId: row.mailboxAccountId,
    senderIdentity: row.senderIdentity,
    provider: row.provider,
    metadata: row.metadata,
  }));
}

function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function isSentRecently(value: string | null, now: Date, recentWindowDays: number) {
  const sentAt = parseIsoDate(value);
  if (!sentAt) {
    return false;
  }
  const diffMs = now.getTime() - sentAt.getTime();
  return diffMs >= 0 && diffMs < recentWindowDays * 24 * 60 * 60 * 1000;
}

async function loadNextWaveContext(
  client: SupabaseClient,
  sourceCampaignId: string
): Promise<NextWaveContext> {
  const [sourceCampaign, sourceSendPolicy, sourceMailboxAssignment, sourceAudience] = await Promise.all([
    getCampaignDetail(client, sourceCampaignId),
    getCampaignSendPolicy(client, sourceCampaignId),
    getCampaignMailboxAssignment(client, sourceCampaignId),
    listCampaignAudience(client, sourceCampaignId, { includeSnapshot: false }),
  ]);

  return {
    sourceCampaign,
    sourceSendPolicy,
    sourceMailboxAssignment,
    sourceAudienceRows: sourceAudience.rows,
  };
}

async function loadTargetSegmentSeeds(
  client: SupabaseClient,
  segmentId: string,
  segmentVersion: number
): Promise<TargetCandidateSeed[]> {
  const { data, error } = await client
    .from('segment_members')
    .select('company_id,contact_id')
    .match({
      segment_id: segmentId,
      segment_version: segmentVersion,
    });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<Record<string, unknown>>)
    .map((row) => ({
      companyId: typeof row.company_id === 'string' ? row.company_id : null,
      contactId: typeof row.contact_id === 'string' ? row.contact_id : '',
      source: 'target_segment' as const,
      snapshot: row.snapshot ?? null,
    }))
    .filter((row) => row.contactId.length > 0);
}

async function loadEmployeesById(
  client: SupabaseClient,
  contactIds: string[]
): Promise<Map<string, EmployeeRow>> {
  if (contactIds.length === 0) {
    return new Map();
  }

  const employeesById = new Map<string, EmployeeRow>();
  for (const contactIdsChunk of chunkValues(contactIds, CONTACT_QUERY_CHUNK_SIZE)) {
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

async function loadOutboundsByContact(
  client: SupabaseClient,
  contactIds: string[]
): Promise<{ outboundsByContact: Map<string, OutboundRow[]>; eventsByOutbound: Map<string, EventRow[]> }> {
  if (contactIds.length === 0) {
    return { outboundsByContact: new Map(), eventsByOutbound: new Map() };
  }

  const outbounds: OutboundRow[] = [];
  for (const contactIdsChunk of chunkValues(contactIds, CONTACT_QUERY_CHUNK_SIZE)) {
    const { data: outboundRows, error: outboundError } = await client
      .from('email_outbound')
      .select('id,campaign_id,contact_id,draft_id,status,sent_at')
      .in('contact_id', contactIdsChunk);

    if (outboundError) {
      throw outboundError;
    }

    outbounds.push(...((outboundRows ?? []) as OutboundRow[]));
  }
  const outboundsByContact = new Map<string, OutboundRow[]>();
  for (const outbound of outbounds) {
    if (!outbound.contact_id) {
      continue;
    }
    const existing = outboundsByContact.get(outbound.contact_id) ?? [];
    existing.push(outbound);
    outboundsByContact.set(outbound.contact_id, existing);
  }

  const outboundIds = outbounds.map((row) => row.id).filter((value): value is string => typeof value === 'string');
  if (outboundIds.length === 0) {
    return { outboundsByContact, eventsByOutbound: new Map() };
  }

  const { data: eventRows, error: eventError } = await client
    .from('email_events')
    .select('outbound_id,event_type')
    .in('outbound_id', outboundIds);

  if (eventError) {
    throw eventError;
  }

  const eventsByOutbound = new Map<string, EventRow[]>();
  for (const event of (eventRows ?? []) as EventRow[]) {
    if (!event.outbound_id) {
      continue;
    }
    const existing = eventsByOutbound.get(event.outbound_id) ?? [];
    existing.push(event);
    eventsByOutbound.set(event.outbound_id, existing);
  }

  return { outboundsByContact, eventsByOutbound };
}

async function loadSourceUsedContactIds(
  client: SupabaseClient,
  sourceCampaignId: string
): Promise<Set<string>> {
  const { data, error } = await client
    .from('drafts')
    .select('contact_id')
    .eq('campaign_id', sourceCampaignId);

  if (error) {
    throw error;
  }

  return new Set(
    ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => (typeof row.contact_id === 'string' ? row.contact_id : null))
      .filter((value): value is string => Boolean(value))
  );
}

function buildCandidateSeeds(
  targetRows: TargetCandidateSeed[],
  sourceAudienceRows: CampaignAudienceRow[]
): { rows: TargetCandidateSeed[]; targetSegmentContactIds: Set<string> } {
  const byContactId = new Map<string, TargetCandidateSeed>();
  const targetSegmentContactIds = new Set<string>();

  for (const row of targetRows) {
    byContactId.set(row.contactId, row);
    targetSegmentContactIds.add(row.contactId);
  }

  for (const row of sourceAudienceRows) {
    if (row.source !== 'manual_attach' || !row.contact_id || byContactId.has(row.contact_id)) {
      continue;
    }
    byContactId.set(row.contact_id, {
      companyId: row.company_id,
      contactId: row.contact_id,
      source: 'source_manual_attach',
      snapshot: row.snapshot,
    });
  }

  return {
    rows: Array.from(byContactId.values()).sort((left, right) => left.contactId.localeCompare(right.contactId)),
    targetSegmentContactIds,
  };
}

async function evaluateNextWaveCandidates(
  client: SupabaseClient,
  input: {
    sourceCampaignId: string;
    sourceAudienceRows: CampaignAudienceRow[];
    targetSegmentId: string;
    targetSegmentVersion: number;
    now: Date;
    recentContactWindowDays: number;
  }
): Promise<{
  previewItems: CampaignNextWavePreviewItem[];
  summary: CampaignNextWavePreviewResult['summary'];
  blockedBreakdown: CampaignNextWavePreviewResult['blockedBreakdown'];
  eligibleManualAdditions: TargetCandidateSeed[];
  blockedTargetSegmentRows: Array<TargetCandidateSeed & { blockedReason: CampaignNextWaveBlockedReason }>;
}> {
  const targetRows = await loadTargetSegmentSeeds(client, input.targetSegmentId, input.targetSegmentVersion);
  const { rows: candidateSeeds, targetSegmentContactIds } = buildCandidateSeeds(targetRows, input.sourceAudienceRows);
  const contactIds = candidateSeeds.map((row) => row.contactId);
  const [employeesById, outboundState, sourceUsedContactIds] = await Promise.all([
    loadEmployeesById(client, contactIds),
    loadOutboundsByContact(client, contactIds),
    loadSourceUsedContactIds(client, input.sourceCampaignId),
  ]);
  const executionExposureByContact = await listExecutionExposureByContact(client, contactIds);

  const blockedBreakdown = buildBlockedBreakdown();
  const previewItems: CampaignNextWavePreviewItem[] = [];
  const eligibleManualAdditions: TargetCandidateSeed[] = [];
  const blockedTargetSegmentRows: Array<TargetCandidateSeed & { blockedReason: CampaignNextWaveBlockedReason }> = [];

  for (const seed of candidateSeeds) {
    const employee = employeesById.get(seed.contactId);
    const recipient = resolveRecipientEmail({
      work_email: employee?.work_email ?? null,
      work_email_status: employee?.work_email_status ?? null,
      generic_email: employee?.generic_email ?? null,
      generic_email_status: employee?.generic_email_status ?? null,
    });
    const contactOutbounds = outboundState.outboundsByContact.get(seed.contactId) ?? [];
    const suppression = deriveContactSuppressionState(
      contactOutbounds.flatMap((row) => outboundState.eventsByOutbound.get(row.id) ?? [])
    );
    const hasRecentContact = contactOutbounds.some(
      (row) =>
        row.status === 'sent' &&
        row.campaign_id !== input.sourceCampaignId &&
        isSentRecently(row.sent_at, input.now, input.recentContactWindowDays)
    );

    let blockedReason: CampaignNextWaveBlockedReason | null = null;
    if (sourceUsedContactIds.has(seed.contactId)) {
      blockedReason = 'already_used_in_source_wave';
    } else if (suppression.suppressed || suppression.replyReceived) {
      blockedReason = 'suppressed_contact';
    } else if (hasRecentContact) {
      blockedReason = 'already_contacted_recently';
    } else if (!recipient.sendable) {
      blockedReason = 'no_sendable_email';
    }

    if (blockedReason) {
      blockedBreakdown[blockedReason] += 1;
      if (targetSegmentContactIds.has(seed.contactId)) {
        blockedTargetSegmentRows.push({ ...seed, blockedReason });
      }
    } else if (seed.source === 'source_manual_attach' && !targetSegmentContactIds.has(seed.contactId)) {
      eligibleManualAdditions.push(seed);
    }

    previewItems.push({
      contactId: seed.contactId,
      companyId: seed.companyId,
      source: seed.source,
      eligible: blockedReason === null,
      blockedReason,
      recipientEmail: recipient.recipientEmail,
      recipientEmailSource: recipient.recipientEmailSource,
      exposure_summary: buildExposureSummary(executionExposureByContact.get(seed.contactId) ?? []),
    });
  }

  const eligibleContactCount = previewItems.filter((item) => item.eligible).length;

  return {
    previewItems,
    summary: {
      candidateContactCount: previewItems.length,
      eligibleContactCount,
      blockedContactCount: previewItems.length - eligibleContactCount,
    },
    blockedBreakdown,
    eligibleManualAdditions,
    blockedTargetSegmentRows,
  };
}

function resolveDefaults(context: NextWaveContext) {
  return {
    targetSegmentId: context.sourceCampaign.segment_id,
    targetSegmentVersion: context.sourceCampaign.segment_version,
    offerId: context.sourceCampaign.offer_id ?? null,
    icpHypothesisId: context.sourceCampaign.icp_hypothesis_id ?? null,
    sendPolicy: {
      sendTimezone: context.sourceSendPolicy.sendTimezone,
      sendWindowStartHour: context.sourceSendPolicy.sendWindowStartHour,
      sendWindowEndHour: context.sourceSendPolicy.sendWindowEndHour,
      sendWeekdaysOnly: context.sourceSendPolicy.sendWeekdaysOnly,
    },
    senderPlanSummary: context.sourceMailboxAssignment.summary,
  } as const;
}

export async function getCampaignNextWavePreview(
  client: SupabaseClient,
  input: CampaignNextWavePreviewInput
): Promise<CampaignNextWavePreviewResult> {
  const context = await loadNextWaveContext(client, input.sourceCampaignId);
  const defaults = resolveDefaults(context);
  const evaluation = await evaluateNextWaveCandidates(client, {
    sourceCampaignId: input.sourceCampaignId,
    sourceAudienceRows: context.sourceAudienceRows,
    targetSegmentId: input.targetSegmentId ?? defaults.targetSegmentId,
    targetSegmentVersion: input.targetSegmentVersion ?? defaults.targetSegmentVersion,
    now: input.now ?? new Date(),
    recentContactWindowDays: input.recentContactWindowDays ?? DEFAULT_RECENT_CONTACT_WINDOW_DAYS,
  });

  return {
    sourceCampaign: {
      id: context.sourceCampaign.id,
      name: context.sourceCampaign.name,
    },
    defaults: {
      ...defaults,
      targetSegmentId: input.targetSegmentId ?? defaults.targetSegmentId,
      targetSegmentVersion: input.targetSegmentVersion ?? defaults.targetSegmentVersion,
    },
    summary: evaluation.summary,
    blockedBreakdown: evaluation.blockedBreakdown,
    items: evaluation.previewItems,
  };
}

export async function createCampaignNextWave(
  client: SupabaseClient,
  input: CampaignNextWaveCreateInput
): Promise<CampaignNextWaveCreateResult> {
  const context = await loadNextWaveContext(client, input.sourceCampaignId);
  const defaults = resolveDefaults(context);
  const senderPlanAssignments =
    input.senderPlan?.assignments ?? toAssignmentInputs(context.sourceMailboxAssignment);
  const senderPlanSource = input.senderPlan?.source ?? 'next_wave_reuse';

  const launched = await launchCampaign(client, {
    name: input.name,
    segmentId: input.targetSegmentId ?? defaults.targetSegmentId,
    segmentVersion: input.targetSegmentVersion ?? defaults.targetSegmentVersion,
    snapshotMode: input.snapshotMode ?? 'reuse',
    createdBy: input.createdBy,
    offerId: input.offerId ?? defaults.offerId ?? undefined,
    icpHypothesisId: input.icpHypothesisId ?? defaults.icpHypothesisId ?? undefined,
    sendTimezone: input.sendTimezone ?? defaults.sendPolicy.sendTimezone,
    sendWindowStartHour: input.sendWindowStartHour ?? defaults.sendPolicy.sendWindowStartHour,
    sendWindowEndHour: input.sendWindowEndHour ?? defaults.sendPolicy.sendWindowEndHour,
    sendWeekdaysOnly: input.sendWeekdaysOnly ?? defaults.sendPolicy.sendWeekdaysOnly,
    senderPlan: {
      source: senderPlanSource,
      assignments: senderPlanAssignments,
    },
  });

  const evaluation = await evaluateNextWaveCandidates(client, {
    sourceCampaignId: input.sourceCampaignId,
    sourceAudienceRows: context.sourceAudienceRows,
    targetSegmentId: launched.segment.id,
    targetSegmentVersion: launched.segment.version,
    now: input.now ?? new Date(),
    recentContactWindowDays: input.recentContactWindowDays ?? DEFAULT_RECENT_CONTACT_WINDOW_DAYS,
  });

  if (evaluation.blockedTargetSegmentRows.length > 0) {
    const exclusionRows = evaluation.blockedTargetSegmentRows.map((row) => ({
      campaign_id: String(launched.campaign.id),
      company_id: row.companyId,
      contact_id: row.contactId,
      source: 'next_wave_create',
      reason: row.blockedReason,
      excluded_by: input.createdBy ?? null,
      metadata: { sourceCampaignId: input.sourceCampaignId },
    }));
    const { error } = await client.from('campaign_member_exclusions').insert(exclusionRows);
    if (error) {
      throw error;
    }
  }

  if (evaluation.eligibleManualAdditions.length > 0) {
    const additionRows = evaluation.eligibleManualAdditions.map((row) => ({
      campaign_id: String(launched.campaign.id),
      company_id: row.companyId,
      contact_id: row.contactId,
      source: 'next_wave_copy',
      attached_by: input.createdBy ?? null,
      metadata: { sourceCampaignId: input.sourceCampaignId },
      snapshot: row.snapshot ?? null,
    }));
    const { error } = await client.from('campaign_member_additions').insert(additionRows);
    if (error) {
      throw error;
    }
  }

  return {
    sourceCampaign: {
      id: context.sourceCampaign.id,
      name: context.sourceCampaign.name,
    },
    defaults: {
      ...defaults,
      targetSegmentId: launched.segment.id,
      targetSegmentVersion: launched.segment.version,
      offerId: launched.campaign.offer_id ?? defaults.offerId,
      icpHypothesisId: launched.campaign.icp_hypothesis_id ?? defaults.icpHypothesisId,
      sendPolicy: launched.sendPolicy,
      senderPlanSummary: launched.senderPlan.summary,
    },
    campaign: launched.campaign,
    senderPlan: launched.senderPlan,
    sendPolicy: launched.sendPolicy,
    summary: evaluation.summary,
    blockedBreakdown: evaluation.blockedBreakdown,
    items: evaluation.previewItems,
  };
}
