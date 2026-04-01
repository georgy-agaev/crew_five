import type { SupabaseClient } from '@supabase/supabase-js';

import { listCampaignAudience } from './campaignAudience.js';
import { resolveRecipientEmail, type EmailDeliverabilityStatus } from './recipientResolver.js';

export interface AttachCompaniesToCampaignInput {
  campaignId: string;
  companyIds: string[];
  attachedBy?: string | null;
  source?: string | null;
}

export interface CampaignAttachCompaniesResult {
  campaignId: string;
  summary: {
    requestedCompanyCount: number;
    attachedCompanyCount: number;
    alreadyPresentCompanyCount: number;
    blockedCompanyCount: number;
    invalidCompanyCount: number;
    insertedContactCount: number;
    alreadyPresentContactCount: number;
  };
  items: Array<{
    companyId: string;
    companyName: string | null;
    status: 'attached' | 'already_present' | 'blocked' | 'invalid';
    insertedContactCount: number;
    alreadyPresentContactCount: number;
    reason: string | null;
  }>;
}

function normalizeCompanyIds(companyIds: string[]): string[] {
  return Array.from(
    new Set(
      companyIds
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0)
    )
  );
}

function buildCompanySnapshot(company: Record<string, any>, employee: Record<string, any>) {
  const recipient = resolveRecipientEmail({
    work_email: typeof employee.work_email === 'string' ? employee.work_email : null,
    work_email_status:
      (employee.work_email_status as EmailDeliverabilityStatus | null | undefined) ?? null,
    generic_email: typeof employee.generic_email === 'string' ? employee.generic_email : null,
    generic_email_status:
      (employee.generic_email_status as EmailDeliverabilityStatus | null | undefined) ?? null,
  });

  return {
    contact: {
      full_name: typeof employee.full_name === 'string' ? employee.full_name : null,
      work_email: typeof employee.work_email === 'string' ? employee.work_email : null,
      generic_email: typeof employee.generic_email === 'string' ? employee.generic_email : null,
      position: typeof employee.position === 'string' ? employee.position : null,
      recipient_email: recipient.recipientEmail,
      recipient_email_source: recipient.recipientEmailSource,
      recipient_email_kind: recipient.recipientEmailKind,
      sendable: recipient.sendable,
    },
    company: {
      id: company.id,
      company_name: typeof company.company_name === 'string' ? company.company_name : null,
      company_description: typeof company.company_description === 'string' ? company.company_description : null,
      website: typeof company.website === 'string' ? company.website : null,
      employee_count: typeof company.employee_count === 'number' ? company.employee_count : null,
      region: typeof company.region === 'string' ? company.region : null,
      office_qualification: typeof company.office_qualification === 'string' ? company.office_qualification : null,
      company_research: company.company_research ?? null,
    },
  };
}

export async function attachCompaniesToCampaign(
  client: SupabaseClient,
  input: AttachCompaniesToCampaignInput
): Promise<CampaignAttachCompaniesResult> {
  const companyIds = normalizeCompanyIds(input.companyIds);
  const audience = await listCampaignAudience(client, input.campaignId);
  const campaignStatus = typeof audience.campaign.status === 'string' ? audience.campaign.status : 'draft';

  if (!['draft', 'review', 'ready'].includes(campaignStatus)) {
    const error: any = new Error(`Campaign status ${campaignStatus} does not allow company attach`);
    error.code = 'ERR_STATUS_INVALID';
    error.statusCode = 409;
    throw error;
  }

  const { data: companyRows, error: companyError } = await client
    .from('companies')
    .select(
      'id,company_name,website,employee_count,region,office_qualification,company_description,company_research'
    )
    .in('id', companyIds);
  if (companyError) {
    throw companyError;
  }

  const companyById = new Map(
    ((companyRows ?? []) as Array<Record<string, any>>).map((row) => [String(row.id), row])
  );

  const { data: employeeRows, error: employeeError } = await client
    .from('employees')
    .select('id,company_id,full_name,position,work_email,work_email_status,generic_email,generic_email_status')
    .in('company_id', companyIds);
  if (employeeError) {
    throw employeeError;
  }

  const employeesByCompanyId = new Map<string, Array<Record<string, any>>>();
  for (const row of (employeeRows ?? []) as Array<Record<string, any>>) {
    const companyId = typeof row.company_id === 'string' ? row.company_id : '';
    if (!companyId) continue;
    const existing = employeesByCompanyId.get(companyId) ?? [];
    existing.push(row);
    employeesByCompanyId.set(companyId, existing);
  }

  const existingContactsByCompanyId = new Map<string, Set<string>>();
  for (const row of audience.rows) {
    const companyId = typeof row.company_id === 'string' ? row.company_id : '';
    const contactId = typeof row.contact_id === 'string' ? row.contact_id : '';
    if (!companyId || !contactId) continue;
    const existing = existingContactsByCompanyId.get(companyId) ?? new Set<string>();
    existing.add(contactId);
    existingContactsByCompanyId.set(companyId, existing);
  }

  const items: CampaignAttachCompaniesResult['items'] = [];
  const insertRows: Array<Record<string, unknown>> = [];

  for (const companyId of companyIds) {
    const company = companyById.get(companyId);
    if (!company) {
      items.push({
        companyId,
        companyName: null,
        status: 'invalid',
        insertedContactCount: 0,
        alreadyPresentContactCount: 0,
        reason: 'company_not_found',
      });
      continue;
    }

    const companyEmployees = employeesByCompanyId.get(companyId) ?? [];
    if (companyEmployees.length === 0) {
      items.push({
        companyId,
        companyName: typeof company.company_name === 'string' ? company.company_name : null,
        status: 'blocked',
        insertedContactCount: 0,
        alreadyPresentContactCount: 0,
        reason: 'company_has_no_employees',
      });
      continue;
    }

    const existingContactIds = existingContactsByCompanyId.get(companyId) ?? new Set<string>();
    let insertedContactCount = 0;
    let alreadyPresentContactCount = 0;

    for (const employee of companyEmployees) {
      const contactId = typeof employee.id === 'string' ? employee.id : '';
      if (!contactId) continue;
      if (existingContactIds.has(contactId)) {
        alreadyPresentContactCount += 1;
        continue;
      }
      insertedContactCount += 1;
      insertRows.push({
        campaign_id: input.campaignId,
        company_id: companyId,
        contact_id: contactId,
        source: input.source ?? 'manual_attach',
        attached_by: input.attachedBy ?? null,
        metadata: null,
        snapshot: buildCompanySnapshot(company, employee),
      });
    }

    items.push({
      companyId,
      companyName: typeof company.company_name === 'string' ? company.company_name : null,
      status: insertedContactCount > 0 ? 'attached' : 'already_present',
      insertedContactCount,
      alreadyPresentContactCount,
      reason: insertedContactCount > 0 ? null : 'all_contacts_already_present',
    });
  }

  if (insertRows.length > 0) {
    const { error } = await client.from('campaign_member_additions').insert(insertRows).select();
    if (error) {
      throw error;
    }
  }

  return {
    campaignId: input.campaignId,
    summary: {
      requestedCompanyCount: companyIds.length,
      attachedCompanyCount: items.filter((item) => item.status === 'attached').length,
      alreadyPresentCompanyCount: items.filter((item) => item.status === 'already_present').length,
      blockedCompanyCount: items.filter((item) => item.status === 'blocked').length,
      invalidCompanyCount: items.filter((item) => item.status === 'invalid').length,
      insertedContactCount: items.reduce((sum, item) => sum + item.insertedContactCount, 0),
      alreadyPresentContactCount: items.reduce((sum, item) => sum + item.alreadyPresentContactCount, 0),
    },
    items,
  };
}
