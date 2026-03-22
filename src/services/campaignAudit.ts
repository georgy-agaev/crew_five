import type { SupabaseClient } from '@supabase/supabase-js';

import { listCampaignEvents } from './campaignEventReadModels.js';
import { getCampaignDetail, listCampaignCompanies, listCampaignOutbounds, type CampaignDetail } from './campaigns.js';
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

export async function getCampaignAudit(client: SupabaseClient, campaignId: string): Promise<CampaignAuditView> {
  const campaign = await getCampaignDetail(client, campaignId);
  const companiesView = await listCampaignCompanies(client, campaignId);
  const outboundsView = await listCampaignOutbounds(client, campaignId);
  const eventsView = await listCampaignEvents(client, campaignId);

  const audience = await listCampaignAudience(client, campaignId, { includeSnapshot: false });
  const audienceMembers = audience.rows;
  const snapshotContactIds = uniqueNonEmpty(audienceMembers.map((row) => row.contact_id));

  // Resolve company names from the companies table (not snapshot) to avoid huge payload
  const audienceCompanyIds = Array.from(
    new Set(audienceMembers.map((row) => row.company_id).filter((v): v is string => typeof v === 'string'))
  );
  const companyNameById = new Map<string, string | null>();
  if (audienceCompanyIds.length > 0) {
    const { data: companyNameRows } = await client
      .from('companies')
      .select('id,company_name')
      .in('id', audienceCompanyIds);
    for (const row of (companyNameRows ?? []) as Array<{ id: string; company_name: string | null }>) {
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
  const contactsWithEvents = uniqueNonEmpty(
    eventsView.events
      .filter((row) => row.contact_id && snapshotContactIds.has(row.contact_id))
      .map((row) => row.contact_id)
  );
  const outboundDraftIds = uniqueNonEmpty(outboundsView.outbounds.map((row) => row.draft_id));

  const snapshotContactsWithoutDraft = Array.from(snapshotContactIds)
    .filter((contactId) => !contactsWithAnyDraft.has(contactId))
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
    });

  const draftsMissingRecipientEmail = drafts
    .filter((row) => !row.sendable)
    .map((row) => ({
      draft_id: row.id,
      contact_id: row.contact_id,
      contact_name: row.employee?.full_name ?? null,
      company_id: row.company_id,
      company_name: companyByContact.get(String(row.contact_id ?? ''))?.company_name ?? null,
      email_type: row.email_type,
      status: row.status,
    }));

  const duplicateDraftGroups = new Map<string, DraftAuditRow[]>();
  for (const row of drafts) {
    const key = `${row.contact_id ?? 'unknown'}::${row.email_type ?? 'unknown'}`;
    duplicateDraftGroups.set(key, [...(duplicateDraftGroups.get(key) ?? []), row]);
  }
  const duplicateDrafts = Array.from(duplicateDraftGroups.values())
    .filter((rows) => rows.length > 1)
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
    });

  const draftCompanyMismatches = drafts
    .filter((row) => {
      if (!row.contact_id || !row.company_id) return false;
      const snapshotCompanyId = companyByContact.get(String(row.contact_id))?.company_id ?? null;
      return Boolean(snapshotCompanyId && snapshotCompanyId !== row.company_id);
    })
    .map((row) => ({
      draft_id: row.id,
      contact_id: row.contact_id,
      contact_name: row.employee?.full_name ?? null,
      draft_company_id: row.company_id,
      snapshot_company_id: companyByContact.get(String(row.contact_id))?.company_id ?? null,
      draft_company_name: companyByContact.get(String(row.contact_id))?.company_name ?? null,
      snapshot_company_name: companyByContact.get(String(row.contact_id))?.company_name ?? null,
      email_type: row.email_type,
    }));

  const sentDraftsWithoutOutbound = drafts
    .filter((row) => row.status === 'sent' && !outboundDraftIds.has(row.id))
    .map((row) => ({
      draft_id: row.id,
      contact_id: row.contact_id,
      contact_name: row.employee?.full_name ?? null,
      company_id: row.company_id,
      company_name: companyByContact.get(String(row.contact_id ?? ''))?.company_name ?? null,
      email_type: row.email_type,
      subject: row.subject,
    }));

  const draftIds = uniqueNonEmpty(drafts.map((row) => row.id));
  const outboundsWithoutDraft = outboundsView.outbounds
    .filter((row) => !row.draft_id || !draftIds.has(row.draft_id))
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
    }));

  const outboundsMissingRecipientEmail = outboundsView.outbounds
    .filter((row) => !row.recipient_email)
    .map((row) => ({
      outbound_id: row.id,
      draft_id: row.draft_id,
      provider: row.provider,
      status: row.status,
      contact_id: row.contact_id,
      contact_name: row.contact_name,
      company_id: row.company_id,
      company_name: row.company_name,
    }));

  return {
    campaign,
    summary: {
      company_count: companiesView.companies.length,
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
      outbound_missing_recipient_email_count: outboundsMissingRecipientEmail.length,
      event_count: eventsView.events.length,
      replied_event_count: eventsView.events.filter((row) => row.event_type === 'replied').length,
      bounced_event_count: eventsView.events.filter((row) => row.event_type === 'bounced').length,
      unsubscribed_event_count: eventsView.events.filter((row) => row.event_type === 'unsubscribed').length,
      snapshot_contacts_without_draft_count: snapshotContactsWithoutDraft.length,
      drafts_missing_recipient_email_count: draftsMissingRecipientEmail.length,
      duplicate_draft_pair_count: duplicateDrafts.length,
      draft_company_mismatch_count: draftCompanyMismatches.length,
      sent_drafts_without_outbound_count: sentDraftsWithoutOutbound.length,
      outbounds_without_draft_count: outboundsWithoutDraft.length,
    },
    issues: {
      snapshot_contacts_without_draft: snapshotContactsWithoutDraft,
      drafts_missing_recipient_email: draftsMissingRecipientEmail,
      duplicate_drafts: duplicateDrafts,
      draft_company_mismatches: draftCompanyMismatches,
      sent_drafts_without_outbound: sentDraftsWithoutOutbound,
      outbounds_without_draft: outboundsWithoutDraft,
      outbounds_missing_recipient_email: outboundsMissingRecipientEmail,
    },
  };
}
