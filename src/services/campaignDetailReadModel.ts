import type { SupabaseClient } from '@supabase/supabase-js';

import { getCampaignDetail, listCampaignCompanies, type CampaignCompanyRecord } from './campaigns.js';
import { listCampaignAudience } from './campaignAudience.js';
import { deriveContactSuppressionState } from './contactSuppression.js';
import {
  buildExposureSummary,
  listExecutionExposureByContact,
  type ExecutionExposure,
  type ExecutionExposureSummary,
} from './executionExposure.js';
import {
  resolveRecipientEmail,
  type EmailDeliverabilityStatus,
  type RecipientEmailSource,
} from './recipientResolver.js';
import type { OfferRecord } from './offers.js';

interface SegmentContext {
  id: string;
  name: string | null;
  icp_profile_id: string | null;
  icp_hypothesis_id: string | null;
}

interface IcpProfileContext {
  id: string;
  name: string | null;
  offering_domain: string | null;
}

interface IcpHypothesisContext {
  id: string;
  name: string | null;
  offer_id: string | null;
  status: string | null;
  messaging_angle: string | null;
}

interface EmployeeRow {
  id: string;
  company_id: string | null;
  full_name: string | null;
  position: string | null;
  work_email: string | null;
  work_email_status: EmailDeliverabilityStatus | null;
  generic_email: string | null;
  generic_email_status: EmailDeliverabilityStatus | null;
}

interface DraftRow {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  email_type: string | null;
  status: string | null;
}

interface OutboundRow {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  draft_id: string | null;
  status: string | null;
}

interface EventRow {
  outbound_id: string | null;
  event_type: string | null;
}

const EMPLOYEE_QUERY_CHUNK_SIZE = 100;

export interface CampaignDetailEmployeeView {
  contact_id: string;
  full_name: string | null;
  position: string | null;
  work_email: string | null;
  generic_email: string | null;
  recipient_email: string | null;
  recipient_email_source: RecipientEmailSource;
  sendable: boolean;
  block_reasons: Array<'no_sendable_email' | 'bounced' | 'unsubscribed' | 'already_used'>;
  eligible_for_new_intro: boolean;
  draft_counts: {
    total: number;
    intro: number;
    bump: number;
    generated: number;
    approved: number;
    rejected: number;
    sent: number;
  };
  outbound_count: number;
  sent_count: number;
  replied: boolean;
  reply_count: number;
  exposure_summary: ExecutionExposureSummary;
  execution_exposures: ExecutionExposure[];
}

export interface CampaignDetailCompanyView extends CampaignCompanyRecord {
  composition_summary: {
    total_contacts: number;
    sendable_contacts: number;
    eligible_for_new_intro_contacts: number;
    blocked_no_sendable_email_contacts: number;
    blocked_bounced_contacts: number;
    blocked_unsubscribed_contacts: number;
    blocked_already_used_contacts: number;
    contacts_with_drafts: number;
    contacts_with_sent_outbound: number;
  };
  employees: CampaignDetailEmployeeView[];
}

export interface CampaignReadModel {
  campaign: Awaited<ReturnType<typeof getCampaignDetail>>;
  segment: SegmentContext | null;
  icp_profile: IcpProfileContext | null;
  icp_hypothesis: IcpHypothesisContext | null;
  offer: OfferRecord | null;
  companies: CampaignDetailCompanyView[];
}

async function loadOptionalSingle<T>(
  query: PromiseLike<{ data: T | null; error: unknown }>
): Promise<T | null> {
  const { data, error } = await query;
  if (error || !data) {
    return null;
  }
  return data;
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function sortByName<T extends { full_name?: string | null; company_name?: string | null }>(rows: T[]) {
  return [...rows].sort((left, right) =>
    String(left.full_name ?? left.company_name ?? '').localeCompare(
      String(right.full_name ?? right.company_name ?? ''),
      'ru',
      { sensitivity: 'base' }
    )
  );
}

export async function getCampaignReadModel(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignReadModel> {
  const companiesView = await listCampaignCompanies(client, campaignId);
  const campaign = companiesView.campaign;

  const segment = await loadOptionalSingle<SegmentContext>(
    client
      .from('segments')
      .select('id,name,icp_profile_id,icp_hypothesis_id')
      .eq('id', campaign.segment_id)
      .single()
  );

  const audience = await listCampaignAudience(client, campaignId, { includeSnapshot: false });
  const members = audience.rows;
  const contactIds = Array.from(
    new Set(members.map((row) => String(row.contact_id ?? '')).filter(Boolean))
  );

  const employeeById = new Map<string, EmployeeRow>();
  if (contactIds.length > 0) {
    for (const contactIdsChunk of chunkValues(contactIds, EMPLOYEE_QUERY_CHUNK_SIZE)) {
      const employeesRes = await client
        .from('employees')
        .select('id,company_id,full_name,position,work_email,work_email_status,generic_email,generic_email_status')
        .in('id', contactIdsChunk);
      if (employeesRes.error) {
        throw employeesRes.error;
      }
      for (const row of (employeesRes.data ?? []) as EmployeeRow[]) {
        employeeById.set(String(row.id), row);
      }
    }
  }
  const executionExposureByContact = await listExecutionExposureByContact(client, contactIds);

  let icpProfile: IcpProfileContext | null = null;
  if (segment?.icp_profile_id) {
    icpProfile = await loadOptionalSingle<IcpProfileContext>(
      client
        .from('icp_profiles')
        .select('id,name,offering_domain')
        .eq('id', segment.icp_profile_id)
        .single()
    );
  }

  let icpHypothesis: IcpHypothesisContext | null = null;
  if (campaign.icp_hypothesis_id) {
    const hypothesis = await loadOptionalSingle<Record<string, unknown>>(
      client
        .from('icp_hypotheses')
        .select('id,hypothesis_label,offer_id,status,messaging_angle')
        .eq('id', campaign.icp_hypothesis_id)
        .single()
    );
    if (hypothesis) {
      icpHypothesis = {
        id: String(hypothesis.id),
        name: typeof hypothesis.hypothesis_label === 'string' ? hypothesis.hypothesis_label : null,
        offer_id: typeof hypothesis.offer_id === 'string' ? hypothesis.offer_id : null,
        status: typeof hypothesis.status === 'string' ? hypothesis.status : null,
        messaging_angle: typeof hypothesis.messaging_angle === 'string' ? hypothesis.messaging_angle : null,
      };
    }
  }

  let offer: OfferRecord | null = null;
  if (campaign.offer_id) {
    offer = await loadOptionalSingle<OfferRecord>(
      client
        .from('offers')
        .select('id,title,project_name,description,status,created_at,updated_at')
        .eq('id', campaign.offer_id)
        .single()
    );
  }

  const draftsRes = await client
    .from('drafts')
    .select('id,contact_id,company_id,email_type,status')
    .eq('campaign_id', campaignId);
  if (draftsRes.error) {
    throw draftsRes.error;
  }
  const drafts = (draftsRes.data ?? []) as DraftRow[];

  const outboundsRes = await client
    .from('email_outbound')
    .select('id,contact_id,company_id,draft_id,status')
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

  const draftsByContact = new Map<string, DraftRow[]>();
  for (const row of drafts) {
    if (!row.contact_id) continue;
    const existing = draftsByContact.get(row.contact_id) ?? [];
    existing.push(row);
    draftsByContact.set(row.contact_id, existing);
  }

  const companyEmployees = new Map<string, CampaignDetailEmployeeView[]>();

  for (const member of members) {
    const contactId = String(member.contact_id ?? '');
    const companyId = String(member.company_id ?? '');
    if (!contactId || !companyId) {
      continue;
    }

    const snapshotContact =
      member.snapshot && typeof member.snapshot === 'object'
        ? ((member.snapshot as Record<string, unknown>).contact as Record<string, unknown> | undefined)
        : undefined;
    const employee = employeeById.get(contactId);
    const employeeDrafts = draftsByContact.get(contactId) ?? [];
    const employeeOutbounds = outboundsByContact.get(contactId) ?? [];
    const employeeEvents = employeeOutbounds.flatMap((row) => eventsByOutbound.get(row.id) ?? []);
    const recipient = resolveRecipientEmail({
      work_email: employee?.work_email ?? null,
      work_email_status: employee?.work_email_status ?? null,
      generic_email: employee?.generic_email ?? null,
      generic_email_status: employee?.generic_email_status ?? null,
    });
    const sentCount = employeeOutbounds.filter((row) => row.status === 'sent').length;
    const suppression = deriveContactSuppressionState(employeeEvents);
    const alreadyUsed = sentCount > 0;
    const blockReasons: CampaignDetailEmployeeView['block_reasons'] = [];
    if (!recipient.sendable) blockReasons.push('no_sendable_email');
    if (suppression.bounced) blockReasons.push('bounced');
    if (suppression.unsubscribed) blockReasons.push('unsubscribed');
    if (alreadyUsed) blockReasons.push('already_used');

    const row: CampaignDetailEmployeeView = {
      contact_id: contactId,
      full_name:
        employee?.full_name ??
        (typeof snapshotContact?.full_name === 'string' ? snapshotContact.full_name : null),
      position:
        employee?.position ??
        (typeof snapshotContact?.position === 'string' ? snapshotContact.position : null),
      work_email:
        employee?.work_email ??
        (typeof snapshotContact?.work_email === 'string' ? snapshotContact.work_email : null),
      generic_email: employee?.generic_email ?? null,
      recipient_email: recipient.recipientEmail,
      recipient_email_source: recipient.recipientEmailSource,
      sendable: recipient.sendable,
      block_reasons: blockReasons,
      eligible_for_new_intro: blockReasons.length === 0,
      draft_counts: {
        total: employeeDrafts.length,
        intro: employeeDrafts.filter((draft) => draft.email_type === 'intro').length,
        bump: employeeDrafts.filter((draft) => draft.email_type === 'bump').length,
        generated: employeeDrafts.filter((draft) => draft.status === 'generated').length,
        approved: employeeDrafts.filter((draft) => draft.status === 'approved').length,
        rejected: employeeDrafts.filter((draft) => draft.status === 'rejected').length,
        sent: employeeDrafts.filter((draft) => draft.status === 'sent').length,
      },
      outbound_count: employeeOutbounds.length,
      sent_count: sentCount,
      replied: suppression.replyReceived,
      reply_count: employeeEvents.filter(
        (event) => event.event_type === 'reply' || event.event_type === 'replied'
      ).length,
      exposure_summary: buildExposureSummary(executionExposureByContact.get(contactId) ?? []),
      execution_exposures: executionExposureByContact.get(contactId) ?? [],
    };

    const existing = companyEmployees.get(companyId) ?? [];
    existing.push(row);
    companyEmployees.set(companyId, existing);
  }

  return {
    campaign,
    segment,
    icp_profile: icpProfile,
    icp_hypothesis: icpHypothesis,
    offer,
    companies: companiesView.companies.map((company) => ({
      ...company,
      employees: sortByName(companyEmployees.get(company.company_id) ?? []),
      composition_summary: (() => {
        const employees = companyEmployees.get(company.company_id) ?? [];
        return {
          total_contacts: employees.length,
          sendable_contacts: employees.filter((employee) => employee.sendable).length,
          eligible_for_new_intro_contacts: employees.filter((employee) => employee.eligible_for_new_intro).length,
          blocked_no_sendable_email_contacts: employees.filter((employee) =>
            employee.block_reasons.includes('no_sendable_email')
          ).length,
          blocked_bounced_contacts: employees.filter((employee) => employee.block_reasons.includes('bounced')).length,
          blocked_unsubscribed_contacts: employees.filter((employee) =>
            employee.block_reasons.includes('unsubscribed')
          ).length,
          blocked_already_used_contacts: employees.filter((employee) =>
            employee.block_reasons.includes('already_used')
          ).length,
          contacts_with_drafts: employees.filter((employee) => employee.draft_counts.total > 0).length,
          contacts_with_sent_outbound: employees.filter((employee) => employee.sent_count > 0).length,
        };
      })(),
    })),
  };
}
