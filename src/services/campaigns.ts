import type { SupabaseClient } from '@supabase/supabase-js';

import { CampaignStatus, getAllowedTransitions } from '../status.js';
import { listCampaignAudience } from './campaignAudience.js';

export interface CampaignInput {
  name: string;
  segmentId: string;
  segmentVersion: number;
  projectId?: string;
  offerId?: string;
  icpHypothesisId?: string;
  senderProfileId?: string;
  promptPackId?: string;
  schedule?: Record<string, unknown>;
  throttle?: Record<string, unknown>;
  createdBy?: string;
  interactionMode?: 'express' | 'coach';
  dataQualityMode?: 'strict' | 'graceful';
  sendTimezone?: string;
  sendWindowStartHour?: number;
  sendWindowEndHour?: number;
  sendWeekdaysOnly?: boolean;
  sendDayCountMode?: 'elapsed_days' | 'business_days_campaign' | 'business_days_recipient';
  sendCalendarCountryCode?: string | null;
  sendCalendarSubdivisionCode?: string | null;
  metadata?: Record<string, unknown>;
}

export async function createCampaign(
  client: SupabaseClient,
  input: CampaignInput
): Promise<Record<string, any>> {
  const interactionMode = input.interactionMode ?? 'express';
  const dataQualityMode = input.dataQualityMode ?? 'strict';

  const { data, error } = await client
    .from('campaigns')
    .insert([
      {
        name: input.name,
        segment_id: input.segmentId,
        segment_version: input.segmentVersion,
        project_id: input.projectId,
        offer_id: input.offerId,
        icp_hypothesis_id: input.icpHypothesisId,
        sender_profile_id: input.senderProfileId,
        prompt_pack_id: input.promptPackId,
        schedule: input.schedule,
        throttle: input.throttle,
        created_by: input.createdBy,
        interaction_mode: interactionMode,
        data_quality_mode: dataQualityMode,
        send_timezone: input.sendTimezone,
        send_window_start_hour: input.sendWindowStartHour,
        send_window_end_hour: input.sendWindowEndHour,
        send_weekdays_only: input.sendWeekdaysOnly,
        status: 'draft',
        metadata: input.metadata,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Record<string, any>;
}

export interface CampaignUpdateInput {
  promptPackId?: string;
  schedule?: Record<string, unknown>;
  throttle?: Record<string, unknown>;
}

export interface CampaignStatusTransitionsView {
  campaignId: string;
  currentStatus: CampaignStatus;
  allowedTransitions: CampaignStatus[];
}

export async function updateCampaign(
  client: SupabaseClient,
  campaignId: string,
  input: CampaignUpdateInput
) {
  const { data: statusRow, error: statusError } = await client
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .single();

  if (statusError || !statusRow) {
    throw statusError ?? new Error('Campaign not found');
  }

  const allowedStatuses: CampaignStatus[] = ['draft', 'ready', 'review'];
  if (!allowedStatuses.includes(statusRow.status as CampaignStatus)) {
    const err = new Error(`ERR_STATUS_INVALID: Cannot update campaign in status ${statusRow.status}`);
    (err as any).code = 'ERR_STATUS_INVALID';
    (err as any).details = { allowedStatuses, transitions: getAllowedTransitions()[statusRow.status as CampaignStatus] ?? [] };
    throw err;
  }

  const patch: Record<string, unknown> = {};

  if (input.promptPackId !== undefined) {
    patch.prompt_pack_id = input.promptPackId;
  }
  if (input.schedule !== undefined) {
    patch.schedule = input.schedule;
  }
  if (input.throttle !== undefined) {
    patch.throttle = input.throttle;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No updatable fields provided');
  }

  const { data, error } = await client
    .from('campaigns')
    .update(patch)
    .eq('id', campaignId)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update campaign');
  }

  return data;
}

export async function getCampaignStatusTransitions(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignStatusTransitionsView> {
  const { data, error } = await client
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .single();

  if (error || !data?.status) {
    throw error ?? new Error('Campaign not found');
  }

  const currentStatus = data.status as CampaignStatus;

  return {
    campaignId,
    currentStatus,
    allowedTransitions: getAllowedTransitions()[currentStatus] ?? [],
  };
}

export interface CampaignSpineContext {
  id: string;
  segment_id: string;
  segment_version: number;
}

export interface CampaignDetail {
  id: string;
  name: string;
  status?: string;
  segment_id: string;
  segment_version: number;
  project_id?: string | null;
  offer_id?: string | null;
  icp_hypothesis_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CampaignCompanyRecord {
  company_id: string;
  company_name: string | null;
  website: string | null;
  employee_count: number | null;
  region: string | null;
  office_qualification: string | null;
  company_description: string | null;
  company_research: unknown;
  contact_count: number;
  enrichment: {
    status: 'fresh' | 'stale' | 'missing';
    last_updated_at: string | null;
    provider_hint: string | null;
  };
}

export interface CampaignOutboundRecord {
  id: string;
  status: string | null;
  provider: string;
  provider_message_id: string | null;
  sender_identity: string | null;
  sent_at: string | null;
  created_at: string | null;
  error: string | null;
  pattern_mode: string | null;
  draft_id: string | null;
  draft_email_type: string | null;
  draft_status: string | null;
  subject: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_position: string | null;
  company_id: string | null;
  company_name: string | null;
  company_website: string | null;
  recipient_email: string | null;
  recipient_email_source: string | null;
  recipient_email_kind: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ListCampaignsOptions {
  status?: string;
  segmentId?: string;
  icpProfileId?: string;
}

function parseIsoDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function deriveEnrichmentState(
  companyResearch: unknown,
  companyUpdatedAt: string | null | undefined,
  maxAgeDays = 90
): CampaignCompanyRecord['enrichment'] {
  if (!companyResearch) {
    return {
      status: 'missing',
      last_updated_at: null,
      provider_hint: null,
    };
  }

  const research = companyResearch as any;
  const lastUpdatedAt =
    (typeof research?.lastUpdatedAt === 'string' && research.lastUpdatedAt) || companyUpdatedAt || null;
  const updatedAtDate = parseIsoDate(lastUpdatedAt);
  const providerHint =
    research?.providers && typeof research.providers === 'object' && !Array.isArray(research.providers)
      ? Object.keys(research.providers)
          .filter((key) => key.trim().length > 0)
          .sort()
          .join('/')
      : null;

  if (!updatedAtDate) {
    return {
      status: 'stale',
      last_updated_at: lastUpdatedAt,
      provider_hint: providerHint,
    };
  }

  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const ageMs = now - updatedAtDate.getTime();

  return {
    status: ageMs > maxAgeMs ? 'stale' : 'fresh',
    last_updated_at: updatedAtDate.toISOString(),
    provider_hint: providerHint,
  };
}

export async function getCampaignSpineContext(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignSpineContext> {
  const { data, error } = await client
    .from('campaigns')
    .select('id, segment_id, segment_version')
    .eq('id', campaignId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Campaign not found');
  }

  if (typeof data.segment_version !== 'number') {
    throw new Error('Campaign missing segment_version');
  }

  return data as CampaignSpineContext;
}

export async function getCampaignDetail(
  client: SupabaseClient,
  campaignId: string
): Promise<CampaignDetail> {
  const { data, error } = await client
    .from('campaigns')
    .select('id,name,status,segment_id,segment_version,project_id,offer_id,icp_hypothesis_id,created_at,updated_at')
    .eq('id', campaignId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Campaign not found');
  }

  if (typeof data.segment_version !== 'number') {
    throw new Error('Campaign missing segment_version');
  }

  return data as CampaignDetail;
}

export async function listCampaignCompanies(client: SupabaseClient, campaignId: string) {
  const audience = await listCampaignAudience(client, campaignId, { includeSnapshot: false });
  const campaign = audience.campaign;
  const data = audience.rows;

  const companyIds = Array.from(
    new Set((data ?? []).map((row: any) => String(row.company_id ?? '')).filter(Boolean))
  );
  const companyStateById = new Map<
    string,
    {
      company_name: string | null;
      website: string | null;
      employee_count: number | null;
      region: string | null;
      office_qualification: string | null;
      company_description: string | null;
      company_research: unknown;
      updated_at: string | null;
    }
  >();

  if (companyIds.length > 0) {
    const { data: companyRows, error: companyError } = await client
      .from('companies')
      .select(
        'id, company_name, website, employee_count, region, office_qualification, company_description, company_research, updated_at'
      )
      .in('id', companyIds);

    if (companyError) {
      throw companyError;
    }

    for (const row of (companyRows ?? []) as Array<{
      id: string;
      company_name?: string | null;
      website?: string | null;
      employee_count?: number | null;
      region?: string | null;
      office_qualification?: string | null;
      company_description?: string | null;
      company_research: unknown;
      updated_at?: string | null;
    }>) {
      companyStateById.set(String(row.id), {
        company_name: row.company_name ?? null,
        website: row.website ?? null,
        employee_count: typeof row.employee_count === 'number' ? row.employee_count : null,
        region: row.region ?? null,
        office_qualification: row.office_qualification ?? null,
        company_description: row.company_description ?? null,
        company_research: row.company_research,
        updated_at: row.updated_at ?? null,
      });
    }
  }

  const grouped = new Map<string, CampaignCompanyRecord>();

  for (const row of data ?? []) {
    const companyId = String((row as any).company_id ?? '');
    if (!companyId) continue;
    const snapshotCompany = ((row as any).snapshot as any)?.company ?? {};
    const existing = grouped.get(companyId);
    if (existing) {
      existing.contact_count += 1;
      continue;
    }

    grouped.set(companyId, {
      company_id: companyId,
      company_name:
        typeof snapshotCompany.company_name === 'string' ? snapshotCompany.company_name
        : companyStateById.get(companyId)?.company_name ?? null,
      website:
        typeof snapshotCompany.website === 'string'
          ? snapshotCompany.website
          : companyStateById.get(companyId)?.website ?? null,
      employee_count:
        typeof snapshotCompany.employee_count === 'number'
          ? snapshotCompany.employee_count
          : companyStateById.get(companyId)?.employee_count ?? null,
      region:
        typeof snapshotCompany.region === 'string'
          ? snapshotCompany.region
          : companyStateById.get(companyId)?.region ?? null,
      office_qualification:
        typeof snapshotCompany.office_qualification === 'string'
          ? snapshotCompany.office_qualification
          : companyStateById.get(companyId)?.office_qualification ?? null,
      company_description:
        typeof snapshotCompany.company_description === 'string'
          ? snapshotCompany.company_description
          : companyStateById.get(companyId)?.company_description ?? null,
      company_research: companyStateById.get(companyId)?.company_research ?? snapshotCompany.company_research ?? null,
      contact_count: 1,
      enrichment: deriveEnrichmentState(
        companyStateById.get(companyId)?.company_research ?? snapshotCompany.company_research ?? null,
        companyStateById.get(companyId)?.updated_at ?? null
      ),
    });
  }

  const companies = Array.from(grouped.values()).sort((left, right) =>
    (left.company_name ?? '').localeCompare(right.company_name ?? '', 'en', { sensitivity: 'base' })
  );

  return {
    campaign,
    companies,
  };
}

export async function listCampaignOutbounds(client: SupabaseClient, campaignId: string) {
  const campaign = await getCampaignDetail(client, campaignId);

  const { data, error } = await client
    .from('email_outbound')
    .select(
      [
        'id',
        'status',
        'provider',
        'provider_message_id',
        'sender_identity',
        'sent_at',
        'error',
        'pattern_mode',
        'metadata',
        'draft_id',
        'contact_id',
        'company_id',
      ].join(',')
    )
    .eq('campaign_id', campaignId)
    .order('sent_at', { ascending: false });

  if (error) {
    throw error;
  }

  const outboundRows = (data ?? []) as Array<Record<string, any>>;
  const draftIds = Array.from(
    new Set(outboundRows.map((row) => String(row.draft_id ?? '')).filter(Boolean))
  );
  const contactIds = Array.from(
    new Set(outboundRows.map((row) => String(row.contact_id ?? '')).filter(Boolean))
  );
  const companyIds = Array.from(
    new Set(outboundRows.map((row) => String(row.company_id ?? '')).filter(Boolean))
  );

  const draftsById = new Map<string, { id: string; email_type?: string | null; status?: string | null; subject?: string | null }>();
  if (draftIds.length > 0) {
    const { data: draftRows, error: draftError } = await client
      .from('drafts')
      .select('id,email_type,status,subject')
      .in('id', draftIds);

    if (draftError) {
      throw draftError;
    }

    for (const draft of (draftRows ?? []) as Array<Record<string, any>>) {
      draftsById.set(String(draft.id), {
        id: String(draft.id),
        email_type: typeof draft.email_type === 'string' ? draft.email_type : null,
        status: typeof draft.status === 'string' ? draft.status : null,
        subject: typeof draft.subject === 'string' ? draft.subject : null,
      });
    }
  }

  const contactsById = new Map<string, { id: string; full_name?: string | null; position?: string | null }>();
  if (contactIds.length > 0) {
    const { data: contactRows, error: contactError } = await client
      .from('employees')
      .select('id,full_name,position')
      .in('id', contactIds);

    if (contactError) {
      throw contactError;
    }

    for (const contact of (contactRows ?? []) as Array<Record<string, any>>) {
      contactsById.set(String(contact.id), {
        id: String(contact.id),
        full_name: typeof contact.full_name === 'string' ? contact.full_name : null,
        position: typeof contact.position === 'string' ? contact.position : null,
      });
    }
  }

  const companiesById = new Map<string, { id: string; company_name?: string | null; website?: string | null }>();
  if (companyIds.length > 0) {
    const { data: companyRows, error: companyError } = await client
      .from('companies')
      .select('id,company_name,website')
      .in('id', companyIds);

    if (companyError) {
      throw companyError;
    }

    for (const company of (companyRows ?? []) as Array<Record<string, any>>) {
      companiesById.set(String(company.id), {
        id: String(company.id),
        company_name: typeof company.company_name === 'string' ? company.company_name : null,
        website: typeof company.website === 'string' ? company.website : null,
      });
    }
  }

  const outbounds = outboundRows.map((row) => {
    const draft = typeof row.draft_id === 'string' ? draftsById.get(row.draft_id) ?? null : null;
    const contact =
      typeof row.contact_id === 'string' ? contactsById.get(row.contact_id) ?? null : null;
    const company =
      typeof row.company_id === 'string' ? companiesById.get(row.company_id) ?? null : null;
    const metadata = row.metadata && typeof row.metadata === 'object' ? (row.metadata as Record<string, unknown>) : null;

    return {
      id: String(row.id),
      status: typeof row.status === 'string' ? row.status : null,
      provider: String(row.provider ?? ''),
      provider_message_id: typeof row.provider_message_id === 'string' ? row.provider_message_id : null,
      sender_identity: typeof row.sender_identity === 'string' ? row.sender_identity : null,
      sent_at: typeof row.sent_at === 'string' ? row.sent_at : null,
      created_at: typeof row.sent_at === 'string' ? row.sent_at : null,
      error: typeof row.error === 'string' ? row.error : null,
      pattern_mode: typeof row.pattern_mode === 'string' ? row.pattern_mode : null,
      draft_id: typeof row.draft_id === 'string' ? row.draft_id : null,
      draft_email_type: typeof draft?.email_type === 'string' ? draft.email_type : null,
      draft_status: typeof draft?.status === 'string' ? draft.status : null,
      subject: typeof draft?.subject === 'string' ? draft.subject : null,
      contact_id: typeof row.contact_id === 'string' ? row.contact_id : contact?.id ?? null,
      contact_name: typeof contact?.full_name === 'string' ? contact.full_name : null,
      contact_position: typeof contact?.position === 'string' ? contact.position : null,
      company_id: typeof row.company_id === 'string' ? row.company_id : company?.id ?? null,
      company_name: typeof company?.company_name === 'string' ? company.company_name : null,
      company_website: typeof company?.website === 'string' ? company.website : null,
      recipient_email: typeof metadata?.recipient_email === 'string' ? String(metadata.recipient_email) : null,
      recipient_email_source:
        typeof metadata?.recipient_email_source === 'string' ? String(metadata.recipient_email_source) : null,
      recipient_email_kind:
        typeof metadata?.recipient_email_kind === 'string' ? String(metadata.recipient_email_kind) : null,
      metadata,
    } satisfies CampaignOutboundRecord;
  });

  return {
    campaign,
    outbounds,
  };
}

export async function listCampaigns(client: SupabaseClient, options: ListCampaignsOptions = {}) {
  let allowedSegmentIds: string[] | null = null;
  if (options.icpProfileId) {
    const { data: segments, error: segmentsError } = await client
      .from('segments')
      .select('id')
      .eq('icp_profile_id', options.icpProfileId);

    if (segmentsError) {
      throw segmentsError;
    }

    allowedSegmentIds = (segments ?? []).map((row: any) => String(row.id)).filter(Boolean);
    if (allowedSegmentIds.length === 0) {
      return [];
    }
  }

  let query: any = client
    .from('campaigns')
    .select('id,name,status,segment_id,segment_version,offer_id,created_by,metadata,created_at,updated_at')
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.segmentId) {
    query = query.eq('segment_id', options.segmentId);
  }

  if (allowedSegmentIds) {
    query = query.in('segment_id', allowedSegmentIds);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data ?? [];
}
