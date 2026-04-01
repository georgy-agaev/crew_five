import type { SupabaseClient } from '@supabase/supabase-js';

import { getCampaignMailboxAssignment } from './campaignMailboxAssignments.js';
import {
  isBusinessDayForCampaignRecipient,
  type CampaignBusinessCalendarOverride,
} from './campaignSendCalendar.js';
import { listCampaignFollowupCandidates, type CampaignFollowupCandidate } from './campaignFollowupCandidates.js';
import { getCampaignSendPolicy } from './campaignSendPolicy.js';
import { deriveContactSuppressionState } from './contactSuppression.js';
import { recordEmailOutbound } from './emailOutboundRecorder.js';
import { resolveRecipientEmail } from './recipientResolver.js';

export type CampaignSendExecutionReason =
  | 'auto_send_intro'
  | 'auto_send_bump'
  | 'auto_send_mixed';

interface DraftRow {
  id: string;
  campaign_id: string;
  contact_id: string | null;
  company_id: string | null;
  email_type: string | null;
  status: string | null;
  subject: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
}

interface EmployeeRow {
  id: string;
  work_email: string | null;
  work_email_status: string | null;
  generic_email: string | null;
  generic_email_status: string | null;
}

interface CompanyRow {
  id: string;
  country_code: string | null;
}

interface OutboundRow {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  draft_id: string | null;
  status: string | null;
  sent_at?: string | null;
}

interface EventRow {
  outbound_id: string | null;
  event_type: string | null;
}

export interface CampaignSendTransportRequest {
  campaignId: string;
  draftId: string;
  contactId: string | null;
  companyId: string | null;
  to: string;
  subject: string;
  body: string;
  provider: string;
  senderIdentity: string;
  mailboxAccountId: string | null;
  metadata: Record<string, unknown>;
}

export interface CampaignSendTransportResult {
  provider?: string;
  providerMessageId?: string | null;
  sentAt?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface CampaignSendTransport {
  send: (request: CampaignSendTransportRequest) => Promise<CampaignSendTransportResult>;
}

export interface ExecuteCampaignSendRunRequest {
  campaignId: string;
  reason: CampaignSendExecutionReason;
  batchLimit?: number;
  provider?: string;
  now?: Date;
}

export interface CampaignSendExecutionResultItem {
  draftId: string;
  contactId: string | null;
  companyId: string | null;
  emailType: string | null;
  senderIdentity: string;
  mailboxAccountId: string | null;
  recipientEmail: string;
  status: 'sent' | 'failed';
  provider: string;
  providerMessageId?: string | null;
  error?: string;
}

export interface CampaignSendExecutionResult {
  accepted: true;
  source: 'crew_five-send-execution';
  requestedAt: string;
  campaignId: string;
  reason: CampaignSendExecutionReason;
  provider: string;
  selectedCount: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;
  results: CampaignSendExecutionResultItem[];
}

interface EligibleDraft {
  draft: DraftRow;
  recipientEmail: string;
  recipientEmailSource: 'work' | 'generic' | 'missing';
  recipientEmailKind: 'corporate' | 'personal' | 'generic' | 'missing';
}

function formatErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const candidate = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error?: unknown;
    };
    const parts = [
      typeof candidate.message === 'string' ? candidate.message : null,
      typeof candidate.details === 'string' ? candidate.details : null,
      typeof candidate.hint === 'string' ? candidate.hint : null,
      typeof candidate.code === 'string' ? `code=${candidate.code}` : null,
      typeof candidate.error === 'string' ? candidate.error : null,
    ].filter((value): value is string => Boolean(value && value.trim()));

    if (parts.length > 0) {
      return parts.join(' | ');
    }

    try {
      return JSON.stringify(error);
    } catch {
      return 'send execution failed';
    }
  }

  return 'send execution failed';
}

function isApprovedDraft(row: DraftRow, emailType: 'intro' | 'bump') {
  return row.status === 'approved' && row.email_type === emailType;
}

function buildEventsByOutbound(events: EventRow[]) {
  const map = new Map<string, EventRow[]>();
  for (const row of events) {
    if (!row.outbound_id) continue;
    const existing = map.get(row.outbound_id) ?? [];
    existing.push(row);
    map.set(row.outbound_id, existing);
  }
  return map;
}

function buildOutboundsByContact(rows: OutboundRow[]) {
  const map = new Map<string, OutboundRow[]>();
  for (const row of rows) {
    if (!row.contact_id) continue;
    const existing = map.get(row.contact_id) ?? [];
    existing.push(row);
    map.set(row.contact_id, existing);
  }
  return map;
}

function filterIntroDrafts(params: {
  drafts: DraftRow[];
  employeesById: Map<string, EmployeeRow>;
  outboundsByContact: Map<string, OutboundRow[]>;
  eventsByOutbound: Map<string, EventRow[]>;
  draftEmailTypeById: Map<string, string>;
  now: Date;
  companyCountriesById: Map<string, string | null>;
  sendPolicyMode: 'elapsed_days' | 'business_days_campaign' | 'business_days_recipient';
  campaignCalendarCountryCode: string | null;
  campaignCalendarSubdivisionCode: string | null;
  sendTimezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  sendWeekdaysOnly: boolean;
}): EligibleDraft[] {
  const eligible: EligibleDraft[] = [];

  for (const draft of params.drafts) {
    if (!isApprovedDraft(draft, 'intro') || !draft.contact_id) {
      continue;
    }

    const employee = params.employeesById.get(draft.contact_id);
    const recipient = resolveRecipientEmail({
      work_email: employee?.work_email ?? null,
      work_email_status: (employee?.work_email_status as any) ?? null,
      generic_email: employee?.generic_email ?? null,
      generic_email_status: (employee?.generic_email_status as any) ?? null,
    });
    if (!recipient.sendable || !recipient.recipientEmail) {
      continue;
    }

    const contactOutbounds = params.outboundsByContact.get(draft.contact_id) ?? [];
    const contactEvents = contactOutbounds.flatMap((row) => params.eventsByOutbound.get(row.id) ?? []);
    const suppression = deriveContactSuppressionState(contactEvents);
    const introAlreadySent = contactOutbounds.some((row) => {
      if (row.status !== 'sent' || !row.draft_id) {
        return false;
      }
      return params.draftEmailTypeById.get(row.draft_id) === 'intro';
    });

    if (suppression.suppressed || introAlreadySent) {
      continue;
    }

    const recipientCountryCode = draft.company_id
      ? params.companyCountriesById.get(draft.company_id) ?? null
      : null;
    const override: CampaignBusinessCalendarOverride | null =
      params.sendPolicyMode === 'business_days_recipient' && recipientCountryCode
        ? { countryCode: recipientCountryCode }
        : null;
    const recipientBusinessDayAllowed =
      params.sendPolicyMode === 'elapsed_days'
        ? true
        : isBusinessDayForCampaignRecipient(
            {
              sendTimezone: params.sendTimezone,
              sendWindowStartHour: params.sendWindowStartHour,
              sendWindowEndHour: params.sendWindowEndHour,
              sendWeekdaysOnly: params.sendWeekdaysOnly,
              sendDayCountMode: params.sendPolicyMode,
              sendCalendarCountryCode: params.campaignCalendarCountryCode,
              sendCalendarSubdivisionCode: params.campaignCalendarSubdivisionCode,
            },
            params.now,
            override
          );
    if (!recipientBusinessDayAllowed) {
      continue;
    }

    eligible.push({
      draft,
      recipientEmail: recipient.recipientEmail,
      recipientEmailSource: recipient.recipientEmailSource,
      recipientEmailKind: recipient.recipientEmailKind,
    });
  }

  return eligible;
}

function filterBumpDrafts(params: {
  drafts: DraftRow[];
  employeesById: Map<string, EmployeeRow>;
  eligibleFollowups: CampaignFollowupCandidate[];
  now: Date;
  companyCountriesById: Map<string, string | null>;
  sendPolicyMode: 'elapsed_days' | 'business_days_campaign' | 'business_days_recipient';
  campaignCalendarCountryCode: string | null;
  campaignCalendarSubdivisionCode: string | null;
  sendTimezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  sendWeekdaysOnly: boolean;
}): EligibleDraft[] {
  const eligibleContacts = new Set(
    params.eligibleFollowups.filter((row) => row.eligible).map((row) => row.contact_id)
  );
  const eligible: EligibleDraft[] = [];

  for (const draft of params.drafts) {
    if (!isApprovedDraft(draft, 'bump') || !draft.contact_id || !eligibleContacts.has(draft.contact_id)) {
      continue;
    }

    const employee = params.employeesById.get(draft.contact_id);
    const recipient = resolveRecipientEmail({
      work_email: employee?.work_email ?? null,
      work_email_status: (employee?.work_email_status as any) ?? null,
      generic_email: employee?.generic_email ?? null,
      generic_email_status: (employee?.generic_email_status as any) ?? null,
    });
    if (!recipient.sendable || !recipient.recipientEmail) {
      continue;
    }

    const recipientCountryCode = draft.company_id
      ? params.companyCountriesById.get(draft.company_id) ?? null
      : null;
    const override: CampaignBusinessCalendarOverride | null =
      params.sendPolicyMode === 'business_days_recipient' && recipientCountryCode
        ? { countryCode: recipientCountryCode }
        : null;
    const recipientBusinessDayAllowed =
      params.sendPolicyMode === 'elapsed_days'
        ? true
        : isBusinessDayForCampaignRecipient(
            {
              sendTimezone: params.sendTimezone,
              sendWindowStartHour: params.sendWindowStartHour,
              sendWindowEndHour: params.sendWindowEndHour,
              sendWeekdaysOnly: params.sendWeekdaysOnly,
              sendDayCountMode: params.sendPolicyMode,
              sendCalendarCountryCode: params.campaignCalendarCountryCode,
              sendCalendarSubdivisionCode: params.campaignCalendarSubdivisionCode,
            },
            params.now,
            override
          );
    if (!recipientBusinessDayAllowed) {
      continue;
    }

    eligible.push({
      draft,
      recipientEmail: recipient.recipientEmail,
      recipientEmailSource: recipient.recipientEmailSource,
      recipientEmailKind: recipient.recipientEmailKind,
    });
  }

  return eligible;
}

export async function executeCampaignSendRun(
  client: SupabaseClient,
  transport: CampaignSendTransport,
  request: ExecuteCampaignSendRunRequest
): Promise<CampaignSendExecutionResult> {
  const provider = request.provider ?? 'imap_mcp';
  const requestedAt = (request.now ?? new Date()).toISOString();
  const evaluationNow = request.now ?? new Date();
  const sendPolicy = await getCampaignSendPolicy(client, request.campaignId);

  const mailboxAssignment = await getCampaignMailboxAssignment(client, request.campaignId);
  if (mailboxAssignment.assignments.length < 1) {
    throw new Error('Assign at least one mailbox sender identity before sending');
  }

  const draftsRes = await client
    .from('drafts')
    .select('id,campaign_id,contact_id,company_id,email_type,status,subject,body,metadata')
    .eq('campaign_id', request.campaignId);
  if (draftsRes.error) {
    throw draftsRes.error;
  }
  const drafts = (draftsRes.data ?? []) as DraftRow[];

  const contactIds = Array.from(
    new Set(drafts.map((row) => row.contact_id).filter((value): value is string => typeof value === 'string'))
  );
  const companyIds = Array.from(
    new Set(drafts.map((row) => row.company_id).filter((value): value is string => typeof value === 'string'))
  );

  const employeesById = new Map<string, EmployeeRow>();
  if (contactIds.length > 0) {
    const employeesRes = await client
      .from('employees')
      .select('id,work_email,work_email_status,generic_email,generic_email_status')
      .in('id', contactIds);
    if (employeesRes.error) {
      throw employeesRes.error;
    }
    for (const row of (employeesRes.data ?? []) as EmployeeRow[]) {
      employeesById.set(row.id, row);
    }
  }

  const companyCountriesById = new Map<string, string | null>();
  if (companyIds.length > 0) {
    const companiesRes = await client.from('companies').select('id,country_code').in('id', companyIds);
    if (companiesRes.error) {
      throw companiesRes.error;
    }
    for (const row of (companiesRes.data ?? []) as CompanyRow[]) {
      companyCountriesById.set(row.id, typeof row.country_code === 'string' ? row.country_code : null);
    }
  }

  const outbounds: OutboundRow[] = [];
  if (contactIds.length > 0) {
    const outboundsRes = await client
      .from('email_outbound')
      .select('id,contact_id,company_id,draft_id,status,sent_at')
      .in('contact_id', contactIds);
    if (outboundsRes.error) {
      throw outboundsRes.error;
    }
    outbounds.push(...((outboundsRes.data ?? []) as OutboundRow[]));
  }
  const outboundIds = outbounds.map((row) => row.id).filter((value): value is string => typeof value === 'string');

  const events: EventRow[] = [];
  if (outboundIds.length > 0) {
    const eventsRes = await client
      .from('email_events')
      .select('outbound_id,event_type')
      .in('outbound_id', outboundIds);
    if (eventsRes.error) {
      throw eventsRes.error;
    }
    events.push(...((eventsRes.data ?? []) as EventRow[]));
  }

  const outboundDraftIds = Array.from(
    new Set(outbounds.map((row) => row.draft_id).filter((value): value is string => typeof value === 'string'))
  );
  const draftEmailTypeById = new Map<string, string>();
  if (outboundDraftIds.length > 0) {
    const draftTypesRes = await client.from('drafts').select('id,email_type').in('id', outboundDraftIds);
    if (draftTypesRes.error) {
      throw draftTypesRes.error;
    }
    for (const row of (draftTypesRes.data ?? []) as Array<Record<string, unknown>>) {
      const id = typeof row.id === 'string' ? row.id : null;
      if (!id) continue;
      draftEmailTypeById.set(id, typeof row.email_type === 'string' ? row.email_type : '');
    }
  }

  const eligibleFollowups =
    request.reason === 'auto_send_intro'
      ? []
      : await listCampaignFollowupCandidates(client, request.campaignId, {
          ...(request.now ? { now: request.now } : {}),
        });

  const introDrafts =
    request.reason === 'auto_send_bump'
        ? []
        : filterIntroDrafts({
          drafts,
          employeesById,
          outboundsByContact: buildOutboundsByContact(outbounds),
          eventsByOutbound: buildEventsByOutbound(events),
          draftEmailTypeById,
          now: evaluationNow,
          companyCountriesById,
          sendPolicyMode: sendPolicy.sendDayCountMode,
          campaignCalendarCountryCode: sendPolicy.sendCalendarCountryCode,
          campaignCalendarSubdivisionCode: sendPolicy.sendCalendarSubdivisionCode,
          sendTimezone: sendPolicy.sendTimezone,
          sendWindowStartHour: sendPolicy.sendWindowStartHour,
          sendWindowEndHour: sendPolicy.sendWindowEndHour,
          sendWeekdaysOnly: sendPolicy.sendWeekdaysOnly,
        });
  const bumpDrafts =
    request.reason === 'auto_send_intro'
      ? []
      : filterBumpDrafts({
          drafts,
          employeesById,
          eligibleFollowups,
          now: evaluationNow,
          companyCountriesById,
          sendPolicyMode: sendPolicy.sendDayCountMode,
          campaignCalendarCountryCode: sendPolicy.sendCalendarCountryCode,
          campaignCalendarSubdivisionCode: sendPolicy.sendCalendarSubdivisionCode,
          sendTimezone: sendPolicy.sendTimezone,
          sendWindowStartHour: sendPolicy.sendWindowStartHour,
          sendWindowEndHour: sendPolicy.sendWindowEndHour,
          sendWeekdaysOnly: sendPolicy.sendWeekdaysOnly,
        });

  const maxMessagesPerRun = Math.max(1, mailboxAssignment.assignments.length);
  const effectiveBatchLimit = Math.max(
    0,
    Math.min(request.batchLimit ?? maxMessagesPerRun, maxMessagesPerRun)
  );
  const selected = [...introDrafts, ...bumpDrafts]
    .sort((left, right) => left.draft.id.localeCompare(right.draft.id))
    .slice(0, effectiveBatchLimit);
  const skippedCount = introDrafts.length + bumpDrafts.length - selected.length;

  const results: CampaignSendExecutionResultItem[] = [];
  let sentCount = 0;
  let failedCount = 0;

  for (let index = 0; index < selected.length; index += 1) {
    const candidate = selected[index];
    const assignment = mailboxAssignment.assignments[index % mailboxAssignment.assignments.length];

    try {
      const transportResult = await transport.send({
        campaignId: request.campaignId,
        draftId: candidate.draft.id,
        contactId: candidate.draft.contact_id,
        companyId: candidate.draft.company_id,
        to: candidate.recipientEmail,
        subject: candidate.draft.subject ?? '',
        body: candidate.draft.body ?? '',
        provider,
        senderIdentity: assignment.senderIdentity,
        mailboxAccountId: assignment.mailboxAccountId,
        metadata: {
          ...(candidate.draft.metadata ?? {}),
          execution_reason: request.reason,
          mailbox_account_id: assignment.mailboxAccountId,
        },
      });

      await recordEmailOutbound(client, {
        draftId: candidate.draft.id,
        provider: transportResult.provider ?? provider,
        providerMessageId: transportResult.providerMessageId ?? null,
        senderIdentity: assignment.senderIdentity,
        recipientEmail: candidate.recipientEmail,
        recipientEmailSource: candidate.recipientEmailSource,
        recipientEmailKind: candidate.recipientEmailKind,
        sentAt: transportResult.sentAt ?? requestedAt,
        metadata: {
          execution_reason: request.reason,
          mailbox_account_id: assignment.mailboxAccountId,
          ...(transportResult.metadata ?? {}),
        },
      });

      sentCount += 1;
      results.push({
        draftId: candidate.draft.id,
        contactId: candidate.draft.contact_id,
        companyId: candidate.draft.company_id,
        emailType: candidate.draft.email_type,
        senderIdentity: assignment.senderIdentity,
        mailboxAccountId: assignment.mailboxAccountId,
        recipientEmail: candidate.recipientEmail,
        status: 'sent',
        provider: transportResult.provider ?? provider,
        providerMessageId: transportResult.providerMessageId ?? null,
      });
    } catch (error) {
      failedCount += 1;
      const errorMessage = formatErrorMessage(error);

      try {
        await recordEmailOutbound(client, {
          draftId: candidate.draft.id,
          provider,
          senderIdentity: assignment.senderIdentity,
          recipientEmail: candidate.recipientEmail,
          recipientEmailSource: candidate.recipientEmailSource,
          recipientEmailKind: candidate.recipientEmailKind,
          status: 'failed',
          sentAt: requestedAt,
          error: errorMessage,
          metadata: {
            execution_reason: request.reason,
            mailbox_account_id: assignment.mailboxAccountId,
          },
        });
      } catch {
        // Preserve the original send failure in the result; DB failure is secondary here.
      }

      results.push({
        draftId: candidate.draft.id,
        contactId: candidate.draft.contact_id,
        companyId: candidate.draft.company_id,
        emailType: candidate.draft.email_type,
        senderIdentity: assignment.senderIdentity,
        mailboxAccountId: assignment.mailboxAccountId,
        recipientEmail: candidate.recipientEmail,
        status: 'failed',
        provider,
        error: errorMessage,
      });
    }
  }

  return {
    accepted: true,
    source: 'crew_five-send-execution',
    requestedAt,
    campaignId: request.campaignId,
    reason: request.reason,
    provider,
    selectedCount: selected.length,
    sentCount,
    failedCount,
    skippedCount,
    results,
  };
}
