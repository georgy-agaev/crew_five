import type { SupabaseClient } from '@supabase/supabase-js';

import { resolveRecipientEmail } from './recipientResolver';

export type DraftStatus = 'generated' | 'approved' | 'rejected' | 'sent';

export interface DraftSaveInput {
  id?: string;
  campaignId?: string;
  campaign_id?: string;
  contactId?: string;
  contact_id?: string;
  companyId?: string;
  company_id?: string;
  emailType?: string;
  email_type?: string;
  language?: string;
  patternMode?: string | null;
  pattern_mode?: string | null;
  variantLabel?: string | null;
  variant_label?: string | null;
  subject?: string | null;
  body?: string | null;
  aiScore?: number | null;
  ai_score?: number | null;
  aiSdkRequestId?: string | null;
  ai_sdk_request_id?: string | null;
  status?: DraftStatus;
  reviewer?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DraftLoadOptions {
  campaignId: string;
  status?: DraftStatus;
  limit?: number;
  includeRecipientContext?: boolean;
}

export interface DraftUpdateStatusOptions {
  draftId: string;
  status: DraftStatus;
  reviewer?: string;
  metadata?: Record<string, unknown>;
}

export interface DraftBatchUpdateStatusOptions {
  draftIds: string[];
  status: DraftStatus;
  reviewer?: string;
  metadata?: Record<string, unknown>;
}

function pickFirst<T>(...values: Array<T | undefined>): T | undefined {
  for (const value of values) {
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function normalizeDraftInput(input: DraftSaveInput) {
  const campaignId = pickFirst(input.campaignId, input.campaign_id);
  const contactId = pickFirst(input.contactId, input.contact_id);
  const companyId = pickFirst(input.companyId, input.company_id);
  const emailType = pickFirst(input.emailType, input.email_type) ?? 'intro';
  const language = input.language ?? 'en';

  if (!campaignId) {
    throw new Error('draft payload is missing campaignId');
  }
  if (!contactId) {
    throw new Error('draft payload is missing contactId');
  }
  if (!companyId) {
    throw new Error('draft payload is missing companyId');
  }

  return {
    ...(input.id ? { id: input.id } : {}),
    campaign_id: campaignId,
    contact_id: contactId,
    company_id: companyId,
    email_type: emailType,
    language,
    pattern_mode: pickFirst(input.patternMode, input.pattern_mode) ?? null,
    variant_label: pickFirst(input.variantLabel, input.variant_label) ?? null,
    subject: input.subject ?? null,
    body: input.body ?? null,
    ai_score: pickFirst(input.aiScore, input.ai_score) ?? null,
    ai_sdk_request_id: pickFirst(input.aiSdkRequestId, input.ai_sdk_request_id) ?? null,
    status: input.status ?? 'generated',
    reviewer: input.reviewer ?? null,
    metadata: input.metadata ?? null,
  };
}

export async function saveDrafts(client: SupabaseClient, payload: DraftSaveInput | DraftSaveInput[]) {
  const items = Array.isArray(payload) ? payload : [payload];
  if (items.length === 0) {
    throw new Error('draft payload must contain at least one item');
  }

  const rows = items.map(normalizeDraftInput);
  const { data, error } = await client.from('drafts').insert(rows).select();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function loadDrafts(client: SupabaseClient, options: DraftLoadOptions) {
  if (options.includeRecipientContext) {
    return loadDraftsWithRecipientContext(client, options);
  }

  let query: any = client
    .from('drafts')
    .select('*')
    .eq('campaign_id', options.campaignId)
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data ?? [];
}

async function loadDraftByIdWithRecipientContext(client: SupabaseClient, draftId: string) {
  const { data, error } = await client
    .from('drafts')
    .select(
      [
        '*',
        'contact:employees(id,full_name,position,work_email,work_email_status,generic_email,generic_email_status,company_name)',
        'company:companies(id,company_name,website)',
      ].join(',')
    )
    .eq('id', draftId)
    .single();

  if (error || !data) {
    throw error ?? new Error('Draft not found');
  }

  const row = data as Record<string, any>;
  const contact = row.contact ?? null;
  const resolution = resolveRecipientEmail({
    work_email: contact?.work_email,
    work_email_status: contact?.work_email_status,
    generic_email: contact?.generic_email,
    generic_email_status: contact?.generic_email_status,
  });

  return {
    ...row,
    recipient_email: resolution.recipientEmail,
    recipient_email_source: resolution.recipientEmailSource,
    recipient_email_kind: resolution.recipientEmailKind,
    sendable: resolution.sendable,
  };
}

async function loadDraftsWithRecipientContext(client: SupabaseClient, options: DraftLoadOptions) {
  let query: any = client
    .from('drafts')
    .select(
      [
        '*',
        'contact:employees(id,full_name,position,work_email,work_email_status,generic_email,generic_email_status,company_name)',
        'company:companies(id,company_name,website)',
      ].join(',')
    )
    .eq('campaign_id', options.campaignId)
    .order('created_at', { ascending: false });

  if (options.status) {
    query = query.eq('status', options.status);
  }

  if (options.limit !== undefined) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const rows = (data ?? []) as Array<Record<string, any>>;
  return rows.map((row) => {
    const contact = row.contact ?? null;
    const resolution = resolveRecipientEmail({
      work_email: contact?.work_email,
      work_email_status: contact?.work_email_status,
      generic_email: contact?.generic_email,
      generic_email_status: contact?.generic_email_status,
    });

    return {
      ...row,
      recipient_email: resolution.recipientEmail,
      recipient_email_source: resolution.recipientEmailSource,
      recipient_email_kind: resolution.recipientEmailKind,
      sendable: resolution.sendable,
    };
  });
}

export async function updateDraftStatus(client: SupabaseClient, options: DraftUpdateStatusOptions) {
  let mergedMetadata: Record<string, unknown> | undefined;

  if (options.metadata) {
    const { data: current, error: currentError } = await client
      .from('drafts')
      .select('metadata')
      .eq('id', options.draftId)
      .single();

    if (currentError || !current) {
      throw currentError ?? new Error('Draft not found');
    }

    mergedMetadata = {
      ...((current.metadata as Record<string, unknown> | null) ?? {}),
      ...options.metadata,
    };
  }

  const patch: Record<string, unknown> = {
    status: options.status,
  };

  if (options.reviewer !== undefined) {
    patch.reviewer = options.reviewer;
  }

  if (mergedMetadata !== undefined) {
    patch.metadata = mergedMetadata;
  }

  const { data, error } = await client
    .from('drafts')
    .update(patch)
    .eq('id', options.draftId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update draft status');
  }

  return loadDraftByIdWithRecipientContext(client, String(data.id));
}

export async function updateDraftStatuses(
  client: SupabaseClient,
  options: DraftBatchUpdateStatusOptions
) {
  const draftIds = Array.from(new Set(options.draftIds.map((draftId) => draftId.trim()).filter(Boolean)));
  if (draftIds.length === 0) {
    throw new Error('draftIds must contain at least one draft id');
  }

  const updated = [];
  for (const draftId of draftIds) {
    updated.push(
      await updateDraftStatus(client, {
        draftId,
        status: options.status,
        reviewer: options.reviewer,
        metadata: options.metadata,
      })
    );
  }

  return {
    updated,
    summary: {
      totalRequested: draftIds.length,
      updatedCount: updated.length,
      status: options.status,
    },
  };
}

export interface DraftUpdateContentOptions {
  draftId: string;
  subject: string;
  body: string;
}

export async function updateDraftContent(client: SupabaseClient, options: DraftUpdateContentOptions) {
  const { data, error } = await client
    .from('drafts')
    .update({ subject: options.subject, body: options.body })
    .eq('id', options.draftId)
    .select('*')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update draft content');
  }

  return loadDraftByIdWithRecipientContext(client, String(data.id));
}
