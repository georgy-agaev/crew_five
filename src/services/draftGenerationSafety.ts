import type { SupabaseClient } from '@supabase/supabase-js';

import { getCampaignReadModel } from './campaignDetailReadModel.js';
import { updateDraftStatus } from './draftStore.js';
import {
  resolveRecipientEmail,
  type EmailDeliverabilityStatus,
} from './recipientResolver.js';

const IN_FILTER_CHUNK_SIZE = 100;
const ACTIVE_DRAFT_STATUSES = new Set(['generated', 'approved', 'sending', 'sent']);

interface DraftRow {
  id: string;
  campaign_id: string;
  company_id: string | null;
  contact_id: string | null;
  email_type: string | null;
  status: string | null;
  subject?: string | null;
  created_at?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface OutboundRow {
  id: string;
  campaign_id: string | null;
  draft_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  status: string | null;
  sent_at?: string | null;
}

interface EmployeeEmailRow {
  id: string;
  work_email: string | null;
  work_email_status: EmailDeliverabilityStatus | null;
  generic_email: string | null;
  generic_email_status: EmailDeliverabilityStatus | null;
}

export interface DraftGenerationSafetyQuarantineItem {
  draftId: string;
  contactId: string;
  companyId: string | null;
  reasons: Array<
    | 'intro_already_sent'
    | 'active_intro_exists'
    | 'active_bump_exists'
    | 'quarantine_email_missing'
  >;
}

export interface DraftGenerationSafetyResult {
  checkedCount: number;
  quarantinedCount: number;
  quarantined: DraftGenerationSafetyQuarantineItem[];
}

export interface DraftGenerationPreflightScope {
  requestedCompanyCount: number;
  safeCompanyIds: string[];
  eligibleContactIds: string[];
  excludedCompanyIds: string[];
  excludedContacts: Array<{
    contactId: string;
    companyId: string;
    reasons: string[];
  }>;
}

function chunkValues<T>(values: T[], size: number = IN_FILTER_CHUNK_SIZE): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function selectInChunks<T>(
  client: SupabaseClient,
  table: string,
  columns: string,
  field: string,
  values: string[]
): Promise<T[]> {
  if (values.length === 0) return [];
  const rows: T[] = [];
  for (const valuesChunk of chunkValues(values)) {
    const { data, error } = await client.from(table).select(columns).in(field, valuesChunk);
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
  }
  return rows;
}

function appendReason<T extends string>(reasons: T[], reason: T) {
  if (!reasons.includes(reason)) {
    reasons.push(reason);
  }
}

function getIntroGenerationBlockReasons(
  employee: Awaited<ReturnType<typeof getCampaignReadModel>>['companies'][number]['employees'][number]
): string[] {
  const reasons = [...employee.block_reasons];
  if (!employee.sendable || !employee.recipient_email) {
    appendReason(reasons, 'no_sendable_email');
  }
  if (!employee.eligible_for_new_intro && reasons.length === 0) {
    appendReason(reasons, 'not_eligible');
  }
  return reasons;
}

export async function planSafeIntroGenerationScope(
  client: SupabaseClient,
  params: { campaignId: string; companyIds?: string[] }
): Promise<DraftGenerationPreflightScope> {
  const detail = await getCampaignReadModel(client, params.campaignId);
  const requestedCompanyIds = new Set(
    Array.isArray(params.companyIds) && params.companyIds.length > 0
      ? params.companyIds
      : detail.companies.map((company) => company.company_id)
  );

  const safeCompanyIds: string[] = [];
  const eligibleContactIds: string[] = [];
  const excludedCompanyIds: string[] = [];
  const excludedContacts: DraftGenerationPreflightScope['excludedContacts'] = [];

  for (const company of detail.companies) {
    if (!requestedCompanyIds.has(company.company_id)) continue;

    const employeesWithReasons = company.employees.map((employee) => ({
      employee,
      reasons: getIntroGenerationBlockReasons(employee),
    }));
    const safeContacts = employeesWithReasons
      .filter(({ employee, reasons }) => employee.eligible_for_new_intro && reasons.length === 0)
      .map(({ employee }) => employee);
    const riskyContacts = employeesWithReasons.filter(({ reasons }) => reasons.length > 0);

    if (safeContacts.length > 0 && riskyContacts.length === 0) {
      safeCompanyIds.push(company.company_id);
      eligibleContactIds.push(...safeContacts.map((employee) => employee.contact_id));
      continue;
    }

    excludedCompanyIds.push(company.company_id);
    excludedContacts.push(
      ...riskyContacts.map(({ employee, reasons }) => ({
        contactId: employee.contact_id,
        companyId: company.company_id,
        reasons,
      }))
    );
  }

  return {
    requestedCompanyCount: requestedCompanyIds.size,
    safeCompanyIds,
    eligibleContactIds,
    excludedCompanyIds,
    excludedContacts,
  };
}

export async function quarantineUnsafeGeneratedIntroDrafts(
  client: SupabaseClient,
  params: { campaignId: string; createdAfter?: string | null }
): Promise<DraftGenerationSafetyResult> {
  let query = client
    .from('drafts')
    .select('id,campaign_id,company_id,contact_id,email_type,status,subject,created_at,metadata')
    .eq('campaign_id', params.campaignId)
    .eq('email_type', 'intro')
    .eq('status', 'generated');

  if (params.createdAfter) {
    query = query.gte('created_at', params.createdAfter);
  }

  const { data: generatedDrafts, error } = await query;
  if (error) throw error;

  const candidates = ((generatedDrafts ?? []) as DraftRow[]).filter((draft) => draft.contact_id);
  const contactIds = uniqueStrings(candidates.map((draft) => draft.contact_id));
  if (contactIds.length === 0) {
    return { checkedCount: 0, quarantinedCount: 0, quarantined: [] };
  }

  const contactDrafts = await selectInChunks<DraftRow>(
    client,
    'drafts',
    'id,campaign_id,company_id,contact_id,email_type,status,subject,created_at,metadata',
    'contact_id',
    contactIds
  );
  const draftIds = uniqueStrings(contactDrafts.map((draft) => draft.id));
  const outbounds = await selectInChunks<OutboundRow>(
    client,
    'email_outbound',
    'id,campaign_id,draft_id,contact_id,company_id,status,sent_at',
    'draft_id',
    draftIds
  );
  const employees = await selectInChunks<EmployeeEmailRow>(
    client,
    'employees',
    'id,work_email,work_email_status,generic_email,generic_email_status',
    'id',
    contactIds
  );

  const draftById = new Map(contactDrafts.map((draft) => [draft.id, draft]));
  const employeeById = new Map(employees.map((employee) => [employee.id, employee]));
  const draftsByContact = new Map<string, DraftRow[]>();
  const outboundsByContact = new Map<string, Array<OutboundRow & { draftEmailType?: string | null }>>();

  for (const draft of contactDrafts) {
    if (!draft.contact_id) continue;
    const existing = draftsByContact.get(draft.contact_id) ?? [];
    existing.push(draft);
    draftsByContact.set(draft.contact_id, existing);
  }

  for (const outbound of outbounds) {
    const draft = outbound.draft_id ? draftById.get(outbound.draft_id) : undefined;
    const contactId = outbound.contact_id ?? draft?.contact_id ?? null;
    if (!contactId) continue;
    const existing = outboundsByContact.get(contactId) ?? [];
    existing.push({ ...outbound, draftEmailType: draft?.email_type });
    outboundsByContact.set(contactId, existing);
  }

  const quarantined: DraftGenerationSafetyQuarantineItem[] = [];

  for (const draft of candidates) {
    const contactId = draft.contact_id;
    if (!contactId) continue;

    const reasons: DraftGenerationSafetyQuarantineItem['reasons'] = [];
    const contactDraftRows = draftsByContact.get(contactId) ?? [];
    const contactOutboundRows = outboundsByContact.get(contactId) ?? [];
    const employee = employeeById.get(contactId);
    const recipient = employee
      ? resolveRecipientEmail({
          work_email: employee.work_email,
          work_email_status: employee.work_email_status,
          generic_email: employee.generic_email,
          generic_email_status: employee.generic_email_status,
        })
      : null;

    if (!recipient?.sendable || !recipient.recipientEmail) {
      appendReason(reasons, 'quarantine_email_missing');
    }

    if (
      contactOutboundRows.some(
        (outbound) => outbound.status === 'sent' && outbound.draftEmailType === 'intro'
      )
    ) {
      appendReason(reasons, 'intro_already_sent');
    }

    if (
      contactDraftRows.some(
        (row) =>
          row.id !== draft.id &&
          row.email_type === 'intro' &&
          ACTIVE_DRAFT_STATUSES.has(String(row.status ?? ''))
      )
    ) {
      appendReason(reasons, 'active_intro_exists');
    }

    if (
      contactDraftRows.some(
        (row) => row.email_type === 'bump' && ACTIVE_DRAFT_STATUSES.has(String(row.status ?? ''))
      )
    ) {
      appendReason(reasons, 'active_bump_exists');
    }

    if (reasons.length === 0) continue;

    await updateDraftStatus(client, {
      draftId: draft.id,
      status: 'rejected',
      reviewer: 'codex-draft-generation-safety',
      metadata: {
        safety_quarantine: true,
        safety_quarantine_reasons: reasons,
        safety_quarantined_at: new Date().toISOString(),
      },
    });

    quarantined.push({
      draftId: draft.id,
      contactId,
      companyId: draft.company_id,
      reasons,
    });
  }

  return {
    checkedCount: candidates.length,
    quarantinedCount: quarantined.length,
    quarantined,
  };
}
