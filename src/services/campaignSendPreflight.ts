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

interface DraftRow {
  id: string;
  status: string | null;
  contact_id: string | null;
  email_type: string | null;
}

interface OutboundRow {
  id: string;
  contact_id: string | null;
  draft_id: string | null;
  status: string | null;
}

interface EventRow {
  outbound_id: string | null;
  event_type: string | null;
}

interface EmployeeRow {
  id: string;
  work_email: string | null;
  work_email_status: EmailDeliverabilityStatus | null;
  generic_email: string | null;
  generic_email_status: EmailDeliverabilityStatus | null;
}

export interface CampaignSendPreflightBlocker {
  code: CampaignSendPreflightBlockerCode;
  message: string;
}

export interface CampaignSendPreflightView {
  campaign: CampaignDetail;
  readyToSend: boolean;
  blockers: CampaignSendPreflightBlocker[];
  summary: {
    mailboxAssignmentCount: number;
    draftCount: number;
    approvedDraftCount: number;
    generatedDraftCount: number;
    rejectedDraftCount: number;
    sentDraftCount: number;
    sendableApprovedDraftCount: number;
    approvedMissingRecipientEmailCount: number;
    approvedSuppressedContactCount: number;
  };
  senderPlan: CampaignMailboxAssignmentView['summary'];
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
    .select('id,status,contact_id,email_type')
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
    const employeesRes = await client
      .from('employees')
      .select('id,work_email,work_email_status,generic_email,generic_email_status')
      .in('id', contactIds);
    if (employeesRes.error) {
      throw employeesRes.error;
    }
    for (const row of (employeesRes.data ?? []) as EmployeeRow[]) {
      employeeById.set(row.id, row);
    }
  }

  const outboundsRes = await client
    .from('email_outbound')
    .select('id,contact_id,draft_id,status')
    .eq('campaign_id', campaignId);
  if (outboundsRes.error) {
    throw outboundsRes.error;
  }

  const outbounds = (outboundsRes.data ?? []) as OutboundRow[];
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

  const approvedDrafts = drafts.filter((row) => row.status === 'approved');
  const generatedDraftCount = drafts.filter((row) => row.status === 'generated').length;
  const rejectedDraftCount = drafts.filter((row) => row.status === 'rejected').length;
  const sentDraftCount = drafts.filter((row) => row.status === 'sent').length;
  const draftById = new Map(drafts.map((row) => [row.id, row]));
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
  let approvedMissingRecipientEmailCount = 0;
  let approvedSuppressedContactCount = 0;

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
      continue;
    }

    const contactOutbounds = draft.contact_id ? outboundsByContact.get(draft.contact_id) ?? [] : [];
    const contactEvents = contactOutbounds.flatMap((row) => eventsByOutbound.get(row.id) ?? []);
    const suppression = deriveContactSuppressionState(contactEvents);
    const introAlreadySent = draft.email_type === 'intro' && contactOutbounds.some((row) => {
      if (row.status !== 'sent' || !row.draft_id) {
        return false;
      }
      return draftById.get(row.draft_id)?.email_type === 'intro';
    });

    if (suppression.suppressed || introAlreadySent) {
      approvedSuppressedContactCount += 1;
      continue;
    }

    sendableApprovedDraftCount += 1;
  }

  const summary = {
    mailboxAssignmentCount: mailboxAssignment.summary.assignmentCount,
    draftCount: drafts.length,
    approvedDraftCount: approvedDrafts.length,
    generatedDraftCount,
    rejectedDraftCount,
    sentDraftCount,
    sendableApprovedDraftCount,
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
    summary,
    senderPlan: mailboxAssignment.summary,
  };
}
