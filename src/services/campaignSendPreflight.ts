import type { SupabaseClient } from '@supabase/supabase-js';

import { getCampaignDetail, type CampaignDetail } from './campaigns.js';
import {
  getCampaignMailboxAssignment,
  type CampaignMailboxAssignmentView,
} from './campaignMailboxAssignments.js';
import { deriveContactSuppressionState } from './contactSuppression.js';
import {
  resolveRecipientEmail,
  type EmailDeliverabilityStatus,
} from './recipientResolver.js';

export type CampaignSendPreflightBlockerCode =
  | 'no_sender_assignment'
  | 'draft_not_approved'
  | 'missing_recipient_email'
  | 'suppressed_contact'
  | 'no_sendable_drafts'
  | 'campaign_paused';

export type CampaignSendPreflightIssueCode =
  | 'generated_not_reviewed'
  | 'missing_recipient_email'
  | 'suppressed_contact'
  | 'intro_already_sent';

const SUPABASE_IN_FILTER_CHUNK_SIZE = 100;

interface DraftRow {
  id: string;
  status: string | null;
  contact_id: string | null;
  email_type: string | null;
  subject: string | null;
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

interface EmployeeRow {
  id: string;
  full_name: string | null;
  position: string | null;
  work_email: string | null;
  work_email_status: EmailDeliverabilityStatus | null;
  generic_email: string | null;
  generic_email_status: EmailDeliverabilityStatus | null;
}

interface CampaignNameRow {
  id: string;
  name: string | null;
}

export interface CampaignSendPreflightBlocker {
  code: CampaignSendPreflightBlockerCode;
  message: string;
}

export interface CampaignSendPreflightIssue {
  code: CampaignSendPreflightIssueCode;
  message: string;
  draftId: string;
  draftStatus: string | null;
  emailType: string | null;
  subject: string | null;
  contactId: string | null;
  contactName: string | null;
  contactPosition: string | null;
  workEmail: string | null;
  workEmailStatus: EmailDeliverabilityStatus | null;
  genericEmail: string | null;
  genericEmailStatus: EmailDeliverabilityStatus | null;
  relatedOutboundId?: string | null;
  relatedDraftId?: string | null;
  relatedCampaignId?: string | null;
  relatedCampaignName?: string | null;
  relatedSentAt?: string | null;
}

export interface CampaignSendPreflightView {
  campaign: CampaignDetail;
  readyToSend: boolean;
  blockers: CampaignSendPreflightBlocker[];
  issues: CampaignSendPreflightIssue[];
  summary: {
    mailboxAssignmentCount: number;
    draftCount: number;
    approvedDraftCount: number;
    generatedDraftCount: number;
    rejectedDraftCount: number;
    sentDraftCount: number;
    sendableApprovedDraftCount: number;
    sendableApprovedIntroDraftCount: number;
    sendableApprovedBumpDraftCount: number;
    approvedMissingRecipientEmailCount: number;
    approvedSuppressedContactCount: number;
  };
  senderPlan: CampaignMailboxAssignmentView['summary'];
}

function chunkValues<T>(values: T[], size: number = SUPABASE_IN_FILTER_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function selectInChunks<Row>(
  client: SupabaseClient,
  table: string,
  columns: string,
  field: string,
  values: string[]
): Promise<Row[]> {
  if (values.length < 1) {
    return [];
  }

  const rows: Row[] = [];
  for (const chunk of chunkValues(values)) {
    const res = await (client.from(table) as any).select(columns).in(field, chunk);
    if (res.error) {
      throw res.error;
    }
    rows.push(...((res.data ?? []) as Row[]));
  }
  return rows;
}

function buildIssue(
  code: CampaignSendPreflightIssueCode,
  message: string,
  draft: DraftRow,
  employee: EmployeeRow | null,
  related?: {
    outbound?: OutboundRow | null;
    campaignName?: string | null;
  }
): CampaignSendPreflightIssue {
  return {
    code,
    message,
    draftId: draft.id,
    draftStatus: draft.status,
    emailType: draft.email_type,
    subject: draft.subject,
    contactId: draft.contact_id,
    contactName: employee?.full_name ?? null,
    contactPosition: employee?.position ?? null,
    workEmail: employee?.work_email ?? null,
    workEmailStatus: employee?.work_email_status ?? null,
    genericEmail: employee?.generic_email ?? null,
    genericEmailStatus: employee?.generic_email_status ?? null,
    relatedOutboundId: related?.outbound?.id ?? null,
    relatedDraftId: related?.outbound?.draft_id ?? null,
    relatedCampaignId: related?.outbound?.campaign_id ?? null,
    relatedCampaignName: related?.campaignName ?? null,
    relatedSentAt: related?.outbound?.sent_at ?? null,
  };
}

function buildBlockers(input: {
  campaignStatus: string | undefined;
  mailboxAssignmentCount: number;
  generatedDraftCount: number;
  approvedMissingRecipientEmailCount: number;
  approvedSuppressedContactCount: number;
  sendableApprovedDraftCount: number;
}): CampaignSendPreflightBlocker[] {
  const blockers: CampaignSendPreflightBlocker[] = [];

  if (input.campaignStatus === 'paused') {
    blockers.push({
      code: 'campaign_paused',
      message: 'Campaign is paused and cannot start a send run',
    });
  }

  if (input.mailboxAssignmentCount < 1) {
    blockers.push({
      code: 'no_sender_assignment',
      message: 'Assign at least one sender before sending',
    });
  }

  if (input.generatedDraftCount > 0) {
    blockers.push({
      code: 'draft_not_approved',
      message: 'Approve or reject all generated drafts before sending',
    });
  }

  if (input.approvedMissingRecipientEmailCount > 0) {
    blockers.push({
      code: 'missing_recipient_email',
      message: 'Some approved drafts are missing a sendable recipient email',
    });
  }

  if (input.approvedSuppressedContactCount > 0) {
    blockers.push({
      code: 'suppressed_contact',
      message: 'Some approved drafts target suppressed or already-used contacts',
    });
  }

  if (input.sendableApprovedDraftCount < 1) {
    blockers.push({
      code: 'no_sendable_drafts',
      message: 'No approved drafts are currently sendable',
    });
  }

  return blockers;
}

export async function getCampaignSendPreflight(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignSendPreflightView> {
  const campaign = await getCampaignDetail(client, campaignId);
  const mailboxAssignment = await getCampaignMailboxAssignment(client, campaignId);

  const draftsRes = await client
    .from('drafts')
    .select('id,status,contact_id,email_type,subject')
    .eq('campaign_id', campaignId);
  if (draftsRes.error) {
    throw draftsRes.error;
  }

  const drafts = (draftsRes.data ?? []) as DraftRow[];
  const contactIds = Array.from(
    new Set(drafts.map((row) => row.contact_id).filter((value): value is string => typeof value === 'string'))
  );

  const employeeById = new Map<string, EmployeeRow>();
  if (contactIds.length > 0) {
    const employeeRows = await selectInChunks<EmployeeRow>(
      client,
      'employees',
      'id,full_name,position,work_email,work_email_status,generic_email,generic_email_status',
      'id',
      contactIds
    );
    for (const row of employeeRows) {
      employeeById.set(row.id, row);
    }
  }

  const outbounds =
    contactIds.length > 0
      ? await selectInChunks<OutboundRow>(
          client,
          'email_outbound',
          'id,campaign_id,contact_id,draft_id,status,sent_at',
          'contact_id',
          contactIds
        )
      : [];
  const outboundIds = outbounds.map((row) => row.id).filter((value): value is string => typeof value === 'string');
  const events: EventRow[] = [];
  if (outboundIds.length > 0) {
    events.push(
      ...(await selectInChunks<EventRow>(
        client,
        'email_events',
        'outbound_id,event_type',
        'outbound_id',
        outboundIds
      ))
    );
  }

  const approvedDrafts = drafts.filter((row) => row.status === 'approved');
  const generatedDraftCount = drafts.filter((row) => row.status === 'generated').length;
  const rejectedDraftCount = drafts.filter((row) => row.status === 'rejected').length;
  const sentDraftCount = drafts.filter((row) => row.status === 'sent').length;
  const outboundDraftIds = Array.from(
    new Set(outbounds.map((row) => row.draft_id).filter((value): value is string => typeof value === 'string'))
  );
  const draftEmailTypeById = new Map<string, string | null>();
  for (const draft of drafts) {
    draftEmailTypeById.set(draft.id, draft.email_type);
  }
  const missingOutboundDraftIds = outboundDraftIds.filter((draftId) => !draftEmailTypeById.has(draftId));
  if (missingOutboundDraftIds.length > 0) {
    const outboundDraftRows = await selectInChunks<Record<string, unknown>>(
      client,
      'drafts',
      'id,email_type',
      'id',
      missingOutboundDraftIds
    );
    for (const row of outboundDraftRows) {
      const id = typeof row.id === 'string' ? row.id : null;
      if (!id) continue;
      draftEmailTypeById.set(id, typeof row.email_type === 'string' ? row.email_type : null);
    }
  }
  const outboundCampaignIds = Array.from(
    new Set(outbounds.map((row) => row.campaign_id).filter((value): value is string => typeof value === 'string'))
  );
  const campaignNameById = new Map<string, string | null>();
  if (outboundCampaignIds.length > 0) {
    const campaignRows = await selectInChunks<CampaignNameRow>(
      client,
      'campaigns',
      'id,name',
      'id',
      outboundCampaignIds
    );
    for (const row of campaignRows) {
      campaignNameById.set(row.id, row.name);
    }
  }
  const outboundsByContact = new Map<string, OutboundRow[]>();
  for (const row of outbounds) {
    if (!row.contact_id) continue;
    const existing = outboundsByContact.get(row.contact_id) ?? [];
    existing.push(row);
    outboundsByContact.set(row.contact_id, existing);
  }
  const eventsByOutbound = new Map<string, EventRow[]>();
  for (const row of events) {
    if (!row.outbound_id) continue;
    const existing = eventsByOutbound.get(row.outbound_id) ?? [];
    existing.push(row);
    eventsByOutbound.set(row.outbound_id, existing);
  }

  let sendableApprovedDraftCount = 0;
  let sendableApprovedIntroDraftCount = 0;
  let sendableApprovedBumpDraftCount = 0;
  let approvedMissingRecipientEmailCount = 0;
  let approvedSuppressedContactCount = 0;
  const issues: CampaignSendPreflightIssue[] = drafts
    .filter((row) => row.status === 'generated')
    .map((draft) =>
      buildIssue(
        'generated_not_reviewed',
        'Generated draft must be approved or rejected before sending',
        draft,
        draft.contact_id ? employeeById.get(draft.contact_id) ?? null : null
      )
    );

  for (const draft of approvedDrafts) {
    const employee = draft.contact_id ? employeeById.get(draft.contact_id) : null;
    const recipient = resolveRecipientEmail({
      work_email: employee?.work_email ?? null,
      work_email_status: employee?.work_email_status ?? null,
      generic_email: employee?.generic_email ?? null,
      generic_email_status: employee?.generic_email_status ?? null,
    });

    if (!recipient.sendable) {
      approvedMissingRecipientEmailCount += 1;
      issues.push(
        buildIssue(
          'missing_recipient_email',
          'Approved draft is missing a sendable recipient email',
          draft,
          employee ?? null
        )
      );
      continue;
    }

    const contactOutbounds = draft.contact_id ? outboundsByContact.get(draft.contact_id) ?? [] : [];
    const contactEvents = contactOutbounds.flatMap((row) => eventsByOutbound.get(row.id) ?? []);
    const suppression = deriveContactSuppressionState(contactEvents);
    const alreadySentIntroOutbound = draft.email_type === 'intro' ? contactOutbounds.find((row) => {
      if (row.status !== 'sent' || !row.draft_id) {
        return false;
      }
      return draftEmailTypeById.get(row.draft_id) === 'intro';
    }) ?? null : null;

    if (suppression.suppressed || alreadySentIntroOutbound) {
      approvedSuppressedContactCount += 1;
      issues.push(
        buildIssue(
          suppression.suppressed ? 'suppressed_contact' : 'intro_already_sent',
          suppression.suppressed
            ? 'Approved draft targets a suppressed contact'
            : 'Approved intro draft targets a contact that already received an intro',
          draft,
          employee ?? null,
          alreadySentIntroOutbound
            ? {
                outbound: alreadySentIntroOutbound,
                campaignName: alreadySentIntroOutbound.campaign_id
                  ? campaignNameById.get(alreadySentIntroOutbound.campaign_id) ?? null
                  : null,
              }
            : undefined
        )
      );
      continue;
    }

    sendableApprovedDraftCount += 1;
    if (draft.email_type === 'intro') sendableApprovedIntroDraftCount += 1;
    if (draft.email_type === 'bump') sendableApprovedBumpDraftCount += 1;
  }

  const summary = {
    mailboxAssignmentCount: mailboxAssignment.summary.assignmentCount,
    draftCount: drafts.length,
    approvedDraftCount: approvedDrafts.length,
    generatedDraftCount,
    rejectedDraftCount,
    sentDraftCount,
    sendableApprovedDraftCount,
    sendableApprovedIntroDraftCount,
    sendableApprovedBumpDraftCount,
    approvedMissingRecipientEmailCount,
    approvedSuppressedContactCount,
  };

  const blockers = buildBlockers({
    campaignStatus: campaign.status,
    mailboxAssignmentCount: summary.mailboxAssignmentCount,
    generatedDraftCount: summary.generatedDraftCount,
    approvedMissingRecipientEmailCount: summary.approvedMissingRecipientEmailCount,
    approvedSuppressedContactCount: summary.approvedSuppressedContactCount,
    sendableApprovedDraftCount: summary.sendableApprovedDraftCount,
  });

  return {
    campaign,
    readyToSend: blockers.length === 0,
    blockers,
    issues,
    summary,
    senderPlan: mailboxAssignment.summary,
  };
}
