import type { SupabaseClient } from '@supabase/supabase-js';
import {
  resolveRecipientEmail,
  type EmailDeliverabilityStatus,
  type RecipientEmailKind,
  type RecipientEmailSource,
} from './recipientResolver.js';

export interface SegmentRecord {
  id: string;
  version: number;
}

export interface ContactRow {
  id: string;
  company_id: string;
  full_name?: string;
  work_email?: string;
  work_email_status?: EmailDeliverabilityStatus | null;
  generic_email?: string | null;
  generic_email_status?: EmailDeliverabilityStatus | null;
  position?: string;
  company?: {
    id: string;
    company_name?: string;
    company_description?: string;
    website?: string;
    employee_count?: number;
    region?: string;
    office_qualification?: string;
    segment?: string;
    company_research?: unknown;
  };
}

export interface SnapshotResult {
  inserted: number;
  segmentId: string;
  segmentVersion: number;
}

export async function createSegmentSnapshot(
  client: SupabaseClient,
  segment: SegmentRecord,
  contacts: ContactRow[],
  filtersHash?: string
): Promise<SnapshotResult> {
  await client
    .from('segment_members')
    .delete()
    .match({ segment_id: segment.id, segment_version: segment.version });

  if (contacts.length === 0) {
    return { inserted: 0, segmentId: segment.id, segmentVersion: segment.version };
  }

  const rows = contacts.map((contact) => ({
    segment_id: segment.id,
    segment_version: segment.version,
    contact_id: contact.id,
    company_id: contact.company_id,
    snapshot: {
      contact: normalizeContactSnapshot(contact),
      company: normalizeCompanySnapshot(contact.company),
      filters_hash: filtersHash ?? null,
    },
  }));

  const { data, error } = await client.from('segment_members').insert(rows).select();

  if (error) {
    throw error;
  }

  return {
    inserted: data?.length ?? rows.length,
    segmentId: segment.id,
    segmentVersion: segment.version,
  };
}

function normalizeContactSnapshot(contact: ContactRow) {
  const recipient = resolveRecipientEmail({
    work_email: contact.work_email ?? null,
    work_email_status: contact.work_email_status ?? null,
    generic_email: contact.generic_email ?? null,
    generic_email_status: contact.generic_email_status ?? null,
  });

  return {
    full_name: contact.full_name ?? null,
    work_email: contact.work_email ?? null,
    generic_email: contact.generic_email ?? null,
    position: contact.position ?? null,
    recipient_email: recipient.recipientEmail,
    recipient_email_source: recipient.recipientEmailSource as RecipientEmailSource,
    recipient_email_kind: recipient.recipientEmailKind as RecipientEmailKind,
    sendable: recipient.sendable,
  };
}

function normalizeCompanySnapshot(company: ContactRow['company']) {
  if (!company) {
    return null;
  }

  return {
    id: company.id,
    company_name: company.company_name ?? null,
    company_description: company.company_description ?? null,
    website: company.website ?? null,
    employee_count: company.employee_count ?? null,
    region: company.region ?? null,
    office_qualification: company.office_qualification ?? null,
    company_research: company.company_research ?? null,
  };
}
