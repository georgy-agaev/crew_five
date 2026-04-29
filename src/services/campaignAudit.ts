import type { SupabaseClient } from '@supabase/supabase-js';

import { listCampaignEvents } from './campaignEventReadModels.js';
import { getCampaignDetail, listCampaignOutbounds, type CampaignDetail } from './campaigns.js';
import { listCampaignAudience } from './campaignAudience.js';
import { resolveRecipientEmail } from './recipientResolver.js';

type EmployeeContextRow = {
  id: string;
  full_name?: string | null;
  position?: string | null;
  work_email?: string | null;
  work_email_status?: string | null;
  generic_email?: string | null;
  generic_email_status?: string | null;
  company_id?: string | null;
};

type DraftAuditRow = {
  id: string;
  contact_id: string | null;
  company_id: string | null;
  email_type: string | null;
  status: string | null;
  subject: string | null;
};

type OutboundAuditRow = {
  id: string;
  status: string | null;
  draft_id: string | null;
  contact_id: string | null;
  metadata: Record<string, unknown> | null;
};

export interface CampaignAuditView {
  campaign: CampaignDetail;
  summary: {
    company_count: number;
    snapshot_contact_count: number;
    contacts_with_any_draft: number;
    contacts_with_intro_draft: number;
    contacts_with_bump_draft: number;
    contacts_with_sent_outbound: number;
    contacts_with_events: number;
    draft_count: number;
    generated_draft_count: number;
    approved_draft_count: number;
    rejected_draft_count: number;
    sent_draft_count: number;
    sendable_draft_count: number;
    unsendable_draft_count: number;
    outbound_count: number;
    outbound_sent_count: number;
    outbound_failed_count: number;
    outbound_missing_recipient_email_count: number;
    event_count: number;
    replied_event_count: number;
    bounced_event_count: number;
    unsubscribed_event_count: number;
    snapshot_contacts_without_draft_count: number;
    drafts_missing_recipient_email_count: number;
    duplicate_draft_pair_count: number;
    draft_company_mismatch_count: number;
    sent_drafts_without_outbound_count: number;
    outbounds_without_draft_count: number;
  };
  issues: {
    snapshot_contacts_without_draft: Array<Record<string, unknown>>;
    drafts_missing_recipient_email: Array<Record<string, unknown>>;
    duplicate_drafts: Array<Record<string, unknown>>;
    draft_company_mismatches: Array<Record<string, unknown>>;
    sent_drafts_without_outbound: Array<Record<string, unknown>>;
    outbounds_without_draft: Array<Record<string, unknown>>;
    outbounds_missing_recipient_email: Array<Record<string, unknown>>;
  };
}

export interface CampaignAuditOptions {
  summaryOnly?: boolean;
}

type AuditEventRow = {
  id: string;
  outbound_id: string | null;
  event_type: string | null;
};

function countByStatus(rows: DraftAuditRow[], status: string) {
  return rows.filter((row) => row.status === status).length;
}

function uniqueNonEmpty(values: Array<string | null | undefined>) {
  return new Set(values.filter((value): value is string => typeof value === 'string' && value.length > 0));
}

function chunkValues<T>(values: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

const EMPLOYEE_QUERY_CHUNK_SIZE = 100;
const SUPABASE_IN_FILTER_CHUNK_SIZE = 100;

async function selectInChunks<Row>(
  client: SupabaseClient,
  table: string,
  columns: string,
  field: string,
  values: string[]
): Promise<Row[]> {
  const uniqueValues = Array.from(new Set(values.filter(Boolean)));
  if (uniqueValues.length === 0) {
    return [];
  }

  const rows: Row[] = [];
  for (const valuesChunk of chunkValues(uniqueValues, SUPABASE_IN_FILTER_CHUNK_SIZE)) {
    const res = await (client.from(table) as any).select(columns).in(field, valuesChunk);
    if (res.error) {
      throw res.error;
    }
    rows.push(...((res.data ?? []) as Row[]));
  }
  return rows;
}

async function selectAuditEventsForOutbounds(
  client: SupabaseClient,
  outboundIds: string[]
): Promise<AuditEventRow[]> {
  return selectInChunks<AuditEventRow>(
    client,
    'email_events',
    'id,outbound_id,event_type',
    'outbound_id',
    outboundIds
  );
}

const EMPTY_ISSUES: CampaignAuditView['issues'] = {
  snapshot_contacts_without_draft: [],
  drafts_missing_recipient_email: [],
  duplicate_drafts: [],
  draft_company_mismatches: [],
  sent_drafts_without_outbound: [],
  outbounds_without_draft: [],
  outbounds_missing_recipient_email: [],
};

async function getCampaignAuditSummaryOnly(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignAuditView> {
  const campaignPromise = getCampaignDetail(client, campaignId);
  const audiencePromise = listCampaignAudience(client, campaignId, { includeSnapshot: false });
  const draftsPromise = client
    .from('drafts')
    .select('id,contact_id,company_id,email_type,status,subject')
    .eq('campaign_id', campaignId);
  const outboundsPromise = client
    .from('email_outbound')
    .select('id,status,draft_id,contact_id,metadata')
    .eq('campaign_id', campaignId);

  const [campaign, audience, draftsRes, outboundsRes] = await Promise.all([
    campaignPromise,
    audiencePromise,
    draftsPromise,
    outboundsPromise,
  ]);

  if (draftsRes.error) {
    throw draftsRes.error;
  }
  if (outboundsRes.error) {
    throw outboundsRes.error;
  }

  const audienceMembers = audience.rows;
  const snapshotContactIds = uniqueNonEmpty(audienceMembers.map((row) => row.contact_id));
  const audienceCompanyIds = Array.from(
    new Set(audienceMembers.map((row) => row.company_id).filter((value): value is string => typeof value === 'string'))
  );
  const companyByContact = new Map<string, string | null>();
  for (const row of audienceMembers) {
    if (row.contact_id && !companyByContact.has(row.contact_id)) {
      companyByContact.set(row.contact_id, row.company_id ?? null);
    }
  }

  const rawDrafts = (draftsRes.data ?? []) as DraftAuditRow[];
  const employeeIds = Array.from(snapshotContactIds);
  const employeeById = new Map<string, EmployeeContextRow>();
  if (employeeIds.length > 0) {
    const employeeRows = await selectInChunks<EmployeeContextRow>(
      client,
      'employees',
      'id,work_email,work_email_status,generic_email,generic_email_status',
      'id',
      employeeIds
    );
    for (const row of employeeRows) {
      employeeById.set(String(row.id), row);
    }
  }

  const drafts = rawDrafts.map((row) => {
    const employee = row.contact_id ? employeeById.get(String(row.contact_id)) : null;
    const resolution = resolveRecipientEmail({
      work_email: employee?.work_email ?? null,
      work_email_status: (employee as any)?.work_email_status ?? null,
      generic_email: employee?.generic_email ?? null,
      generic_email_status: (employee as any)?.generic_email_status ?? null,
    });
    return {
      ...row,
      sendable: resolution.sendable,
    };
  });
  const outbounds = ((outboundsRes.data ?? []) as Array<Record<string, any>>).map((row) => ({
    id: String(row.id),
    status: typeof row.status === 'string' ? row.status : null,
    draft_id: typeof row.draft_id === 'string' ? row.draft_id : null,
    contact_id: typeof row.contact_id === 'string' ? row.contact_id : null,
    metadata: row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : null,
  })) satisfies OutboundAuditRow[];

  const events = await selectAuditEventsForOutbounds(client, outbounds.map((row) => row.id));
  const outboundById = new Map(outbounds.map((row) => [row.id, row]));
  const contactsWithAnyDraft = uniqueNonEmpty(
    drafts.filter((row) => row.contact_id && snapshotContactIds.has(row.contact_id)).map((row) => row.contact_id)
  );
  const contactsWithIntroDraft = uniqueNonEmpty(
    drafts
      .filter((row) => row.email_type === 'intro' && row.contact_id && snapshotContactIds.has(row.contact_id))
      .map((row) => row.contact_id)
  );
  const contactsWithBumpDraft = uniqueNonEmpty(
    drafts
      .filter((row) => row.email_type === 'bump' && row.contact_id && snapshotContactIds.has(row.contact_id))
      .map((row) => row.contact_id)
  );
  const contactsWithSentOutbound = uniqueNonEmpty(
    outbounds
      .filter((row) => row.status === 'sent' && row.contact_id && snapshotContactIds.has(row.contact_id))
      .map((row) => row.contact_id)
  );
  const contactsWithEvents = uniqueNonEmpty(
    events
      .map((row) => outboundById.get(String(row.outbound_id ?? ''))?.contact_id ?? null)
      .filter((contactId): contactId is string => Boolean(contactId && snapshotContactIds.has(contactId)))
  );

  const outboundDraftIds = uniqueNonEmpty(outbounds.map((row) => row.draft_id));
  const draftIds = uniqueNonEmpty(drafts.map((row) => row.id));
  const duplicateDraftGroups = new Map<string, number>();
  for (const row of drafts) {
    const key = `${row.contact_id ?? 'unknown'}::${row.email_type ?? 'unknown'}`;
    duplicateDraftGroups.set(key, (duplicateDraftGroups.get(key) ?? 0) + 1);
  }

  return {
    campaign,
    summary: {
      company_count: audienceCompanyIds.length,
      snapshot_contact_count: audienceMembers.length,
      contacts_with_any_draft: contactsWithAnyDraft.size,
      contacts_with_intro_draft: contactsWithIntroDraft.size,
      contacts_with_bump_draft: contactsWithBumpDraft.size,
      contacts_with_sent_outbound: contactsWithSentOutbound.size,
      contacts_with_events: contactsWithEvents.size,
      draft_count: drafts.length,
      generated_draft_count: countByStatus(drafts, 'generated'),
      approved_draft_count: countByStatus(drafts, 'approved'),
      rejected_draft_count: countByStatus(drafts, 'rejected'),
      sent_draft_count: countByStatus(drafts, 'sent'),
      sendable_draft_count: drafts.filter((row) => row.sendable).length,
      unsendable_draft_count: drafts.filter((row) => !row.sendable).length,
      outbound_count: outbounds.length,
      outbound_sent_count: outbounds.filter((row) => row.status === 'sent').length,
      outbound_failed_count: outbounds.filter((row) => row.status === 'failed').length,
      outbound_missing_recipient_email_count: outbounds.filter((row) => !row.metadata?.recipient_email).length,
      event_count: events.length,
      replied_event_count: events.filter((row) => row.event_type === 'replied').length,
      bounced_event_count: events.filter((row) => row.event_type === 'bounced').length,
      unsubscribed_event_count: events.filter((row) => row.event_type === 'unsubscribed').length,
      snapshot_contacts_without_draft_count: Array.from(snapshotContactIds).filter(
        (contactId) => !contactsWithAnyDraft.has(contactId)
      ).length,
      drafts_missing_recipient_email_count: drafts.filter((row) => !row.sendable).length,
      duplicate_draft_pair_count: Array.from(duplicateDraftGroups.values()).filter((count) => count > 1).length,
      draft_company_mismatch_count: drafts.filter((row) => {
        if (!row.contact_id || !row.company_id) return false;
        const snapshotCompanyId = companyByContact.get(row.contact_id) ?? null;
        return Boolean(snapshotCompanyId && snapshotCompanyId !== row.company_id);
      }).length,
      sent_drafts_without_outbound_count: drafts.filter((row) => row.status === 'sent' && !outboundDraftIds.has(row.id)).length,
      outbounds_without_draft_count: outbounds.filter((row) => !row.draft_id || !draftIds.has(row.draft_id)).length,
    },
    issues: EMPTY_ISSUES,
  };
}

export async function getCampaignAudit(
  client: SupabaseClient,
  campaignId: string,
  options: CampaignAuditOptions = {}
): Promise<CampaignAuditView> {
  const includeIssues = options.summaryOnly !== true;
  if (!includeIssues) {
    return getCampaignAuditSummaryOnly(client, campaignId);
  }

  const campaign = await getCampaignDetail(client, campaignId);
  const outboundsView = await listCampaignOutbounds(client, campaignId);
  const eventsPromise = includeIssues
    ? listCampaignEvents(client, campaignId).then((view) => view.events)
    : selectAuditEventsForOutbounds(client, outboundsView.outbounds.map((row) => row.id));

  const audience = await listCampaignAudience(client, campaignId, { includeSnapshot: false });
  const audienceMembers = audience.rows;
  const snapshotContactIds = uniqueNonEmpty(audienceMembers.map((row) => row.contact_id));

  // Resolve company names from the companies table (not snapshot) to avoid huge payload
  const audienceCompanyIds = Array.from(
    new Set(audienceMembers.map((row) => row.company_id).filter((v): v is string => typeof v === 'string'))
  );
  const companyNameById = new Map<string, string | null>();
  if (includeIssues && audienceCompanyIds.length > 0) {
    const companyNameRows = await selectInChunks<{ id: string; company_name: string | null }>(
      client,
      'companies',
      'id,company_name',
      'id',
      audienceCompanyIds
    );
    for (const row of companyNameRows) {
      companyNameById.set(row.id, row.company_name ?? null);
    }
  }

  const companyByContact = new Map<string, { company_id: string | null; company_name: string | null }>();
  for (const row of audienceMembers) {
    const contactId = row.contact_id;
    if (!contactId || companyByContact.has(contactId)) continue;
    companyByContact.set(contactId, {
      company_id: row.company_id ?? null,
      company_name: row.company_id ? (companyNameById.get(row.company_id) ?? null) : null,
    });
  }

  const employeeById = new Map<string, EmployeeContextRow>();
  if (snapshotContactIds.size > 0) {
    for (const contactIdsChunk of chunkValues(Array.from(snapshotContactIds), EMPLOYEE_QUERY_CHUNK_SIZE)) {
      const { data: employeeRows, error: employeeError } = await client
        .from('employees')
        .select('id,full_name,position,work_email,work_email_status,generic_email,generic_email_status,company_id')
        .in('id', contactIdsChunk);

      if (employeeError) {
        throw employeeError;
      }

      for (const row of (employeeRows ?? []) as EmployeeContextRow[]) {
        employeeById.set(String(row.id), row);
      }
    }
  }

  const { data: draftRows, error: draftError } = await client
    .from('drafts')
    .select('id,contact_id,company_id,email_type,status,subject')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: false });

  if (draftError) {
    throw draftError;
  }

  const drafts = ((draftRows ?? []) as DraftAuditRow[]).map((row) => {
    const employee = row.contact_id ? employeeById.get(String(row.contact_id)) : null;
    const resolution = resolveRecipientEmail({
      work_email: employee?.work_email ?? null,
      work_email_status: (employee as any)?.work_email_status ?? null,
      generic_email: employee?.generic_email ?? null,
      generic_email_status: (employee as any)?.generic_email_status ?? null,
    });
    return {
      ...row,
      recipient_email: resolution.recipientEmail,
      sendable: resolution.sendable,
      employee,
    };
  });

  const contactsWithAnyDraft = uniqueNonEmpty(
    drafts.filter((row) => row.contact_id && snapshotContactIds.has(row.contact_id)).map((row) => row.contact_id)
  );
  const contactsWithIntroDraft = uniqueNonEmpty(
    drafts
      .filter((row) => row.email_type === 'intro' && row.contact_id && snapshotContactIds.has(row.contact_id))
      .map((row) => row.contact_id)
  );
  const contactsWithBumpDraft = uniqueNonEmpty(
    drafts
      .filter((row) => row.email_type === 'bump' && row.contact_id && snapshotContactIds.has(row.contact_id))
      .map((row) => row.contact_id)
  );
  const contactsWithSentOutbound = uniqueNonEmpty(
    outboundsView.outbounds
      .filter((row) => row.status === 'sent' && row.contact_id && snapshotContactIds.has(row.contact_id))
      .map((row) => row.contact_id)
  );

  const events = await eventsPromise;
  const outboundById = new Map(outboundsView.outbounds.map((row) => [row.id, row]));
  const contactsWithEvents = uniqueNonEmpty(
    events
      .map((row) => outboundById.get(String(row.outbound_id ?? ''))?.contact_id ?? null)
      .filter((contactId): contactId is string => Boolean(contactId && snapshotContactIds.has(contactId)))
  );
  const outboundDraftIds = uniqueNonEmpty(outboundsView.outbounds.map((row) => row.draft_id));

  const snapshotContactIdsWithoutDraft = Array.from(snapshotContactIds)
    .filter((contactId) => !contactsWithAnyDraft.has(contactId));
  const snapshotContactsWithoutDraft = includeIssues
    ? snapshotContactIdsWithoutDraft
    .map((contactId) => {
      const employee = employeeById.get(contactId);
      const snapshotCompany = companyByContact.get(contactId);
      return {
        contact_id: contactId,
        contact_name: employee?.full_name ?? null,
        contact_position: employee?.position ?? null,
        company_id: snapshotCompany?.company_id ?? employee?.company_id ?? null,
        company_name: snapshotCompany?.company_name ?? null,
      };
    })
    : [];

  const draftsMissingRecipientEmailRows = drafts.filter((row) => !row.sendable);
  const draftsMissingRecipientEmail = includeIssues
    ? draftsMissingRecipientEmailRows
    .map((row) => ({
      draft_id: row.id,
      contact_id: row.contact_id,
      contact_name: row.employee?.full_name ?? null,
      company_id: row.company_id,
      company_name: companyByContact.get(String(row.contact_id ?? ''))?.company_name ?? null,
      email_type: row.email_type,
      status: row.status,
    }))
    : [];

  const duplicateDraftGroups = new Map<string, DraftAuditRow[]>();
  for (const row of drafts) {
    const key = `${row.contact_id ?? 'unknown'}::${row.email_type ?? 'unknown'}`;
    duplicateDraftGroups.set(key, [...(duplicateDraftGroups.get(key) ?? []), row]);
  }
  const duplicateDraftRows = Array.from(duplicateDraftGroups.values()).filter((rows) => rows.length > 1);
  const duplicateDrafts = includeIssues
    ? duplicateDraftRows
    .map((rows) => {
      const first = rows[0];
      const employee = first.contact_id ? employeeById.get(String(first.contact_id)) : null;
      return {
        contact_id: first.contact_id,
        contact_name: employee?.full_name ?? null,
        company_id: first.company_id,
        company_name: companyByContact.get(String(first.contact_id ?? ''))?.company_name ?? null,
        email_type: first.email_type,
        draft_ids: rows.map((row) => row.id),
        duplicate_count: rows.length,
      };
    })
    : [];

  const draftCompanyMismatchRows = drafts.filter((row) => {
      if (!row.contact_id || !row.company_id) return false;
      const snapshotCompanyId = companyByContact.get(String(row.contact_id))?.company_id ?? null;
      return Boolean(snapshotCompanyId && snapshotCompanyId !== row.company_id);
    });
  const draftCompanyMismatches = includeIssues
    ? draftCompanyMismatchRows
    .map((row) => ({
      draft_id: row.id,
      contact_id: row.contact_id,
      contact_name: row.employee?.full_name ?? null,
      draft_company_id: row.company_id,
      snapshot_company_id: companyByContact.get(String(row.contact_id))?.company_id ?? null,
      draft_company_name: companyByContact.get(String(row.contact_id))?.company_name ?? null,
      snapshot_company_name: companyByContact.get(String(row.contact_id))?.company_name ?? null,
      email_type: row.email_type,
    }))
    : [];

  const sentDraftRowsWithoutOutbound = drafts.filter((row) => row.status === 'sent' && !outboundDraftIds.has(row.id));
  const sentDraftsWithoutOutbound = includeIssues
    ? sentDraftRowsWithoutOutbound
    .map((row) => ({
      draft_id: row.id,
      contact_id: row.contact_id,
      contact_name: row.employee?.full_name ?? null,
      company_id: row.company_id,
      company_name: companyByContact.get(String(row.contact_id ?? ''))?.company_name ?? null,
      email_type: row.email_type,
      subject: row.subject,
    }))
    : [];

  const draftIds = uniqueNonEmpty(drafts.map((row) => row.id));
  const outboundRowsWithoutDraft = outboundsView.outbounds.filter((row) => !row.draft_id || !draftIds.has(row.draft_id));
  const outboundsWithoutDraft = includeIssues
    ? outboundRowsWithoutDraft
    .map((row) => ({
      outbound_id: row.id,
      draft_id: row.draft_id,
      provider: row.provider,
      status: row.status,
      recipient_email: row.recipient_email,
      contact_id: row.contact_id,
      contact_name: row.contact_name,
      company_id: row.company_id,
      company_name: row.company_name,
    }))
    : [];

  const outboundRowsMissingRecipientEmail = outboundsView.outbounds.filter((row) => !row.recipient_email);
  const outboundsMissingRecipientEmail = includeIssues
    ? outboundRowsMissingRecipientEmail
    .map((row) => ({
      outbound_id: row.id,
      draft_id: row.draft_id,
      provider: row.provider,
      status: row.status,
      contact_id: row.contact_id,
      contact_name: row.contact_name,
      company_id: row.company_id,
      company_name: row.company_name,
    }))
    : [];

  return {
    campaign,
    summary: {
      company_count: audienceCompanyIds.length,
      snapshot_contact_count: audienceMembers.length,
      contacts_with_any_draft: contactsWithAnyDraft.size,
      contacts_with_intro_draft: contactsWithIntroDraft.size,
      contacts_with_bump_draft: contactsWithBumpDraft.size,
      contacts_with_sent_outbound: contactsWithSentOutbound.size,
      contacts_with_events: contactsWithEvents.size,
      draft_count: drafts.length,
      generated_draft_count: countByStatus(drafts, 'generated'),
      approved_draft_count: countByStatus(drafts, 'approved'),
      rejected_draft_count: countByStatus(drafts, 'rejected'),
      sent_draft_count: countByStatus(drafts, 'sent'),
      sendable_draft_count: drafts.filter((row) => row.sendable).length,
      unsendable_draft_count: drafts.filter((row) => !row.sendable).length,
      outbound_count: outboundsView.outbounds.length,
      outbound_sent_count: outboundsView.outbounds.filter((row) => row.status === 'sent').length,
      outbound_failed_count: outboundsView.outbounds.filter((row) => row.status === 'failed').length,
      outbound_missing_recipient_email_count: outboundRowsMissingRecipientEmail.length,
      event_count: events.length,
      replied_event_count: events.filter((row) => row.event_type === 'replied').length,
      bounced_event_count: events.filter((row) => row.event_type === 'bounced').length,
      unsubscribed_event_count: events.filter((row) => row.event_type === 'unsubscribed').length,
      snapshot_contacts_without_draft_count: snapshotContactIdsWithoutDraft.length,
      drafts_missing_recipient_email_count: draftsMissingRecipientEmailRows.length,
      duplicate_draft_pair_count: duplicateDraftRows.length,
      draft_company_mismatch_count: draftCompanyMismatchRows.length,
      sent_drafts_without_outbound_count: sentDraftRowsWithoutOutbound.length,
      outbounds_without_draft_count: outboundRowsWithoutDraft.length,
    },
    issues: includeIssues ? {
      snapshot_contacts_without_draft: snapshotContactsWithoutDraft,
      drafts_missing_recipient_email: draftsMissingRecipientEmail,
      duplicate_drafts: duplicateDrafts,
      draft_company_mismatches: draftCompanyMismatches,
      sent_drafts_without_outbound: sentDraftsWithoutOutbound,
      outbounds_without_draft: outboundsWithoutDraft,
      outbounds_missing_recipient_email: outboundsMissingRecipientEmail,
    } : EMPTY_ISSUES,
  };
}
