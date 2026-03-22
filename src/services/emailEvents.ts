import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeEmailAddress } from './recipientResolver.js';

export interface IngestOptions {
  dryRun?: boolean;
}

export interface ProviderEventPayload {
  provider: string;
  provider_event_id?: string;
  event_type: string;
  outcome_classification?: string | null;
  reply_text?: string;
  contact_id?: string;
  outbound_id?: string;
  draft_id?: string;
  send_job_id?: string;
  segment_id?: string;
  segment_version?: number;
  employee_id?: string;
  icp_profile_id?: string;
  icp_hypothesis_id?: string;
  pattern_id?: string;
  coach_prompt_id?: string;
  occurred_at?: string;
  payload?: Record<string, unknown>;
}

export function mapProviderEvent(payload: ProviderEventPayload) {
  if (!payload.provider || !payload.event_type) {
    throw new Error('provider and event_type are required');
  }
  const occurredAtForKey = String(
    payload.occurred_at ?? (payload.payload as any)?.occurred_at ?? 'missing_occurred_at'
  );
  const occurred_at = payload.occurred_at ?? new Date().toISOString();
  const normalizedOutcome = normalizeOutcome(payload.outcome_classification);
  const idempotency_key = buildIdempotencyKey(payload, occurredAtForKey);
  const reply_label = classifyReply(payload.event_type, normalizedOutcome);
  return {
    provider: payload.provider,
    provider_event_id: payload.provider_event_id ?? null,
    event_type: payload.event_type,
    outcome_classification: normalizedOutcome,
    reply_label,
    outbound_id: payload.outbound_id ?? null,
    draft_id: payload.draft_id ?? null,
    send_job_id: payload.send_job_id ?? null,
    segment_id: payload.segment_id ?? null,
    segment_version: payload.segment_version ?? null,
    employee_id: payload.employee_id ?? payload.contact_id ?? null,
    icp_profile_id: payload.icp_profile_id ?? null,
    icp_hypothesis_id: payload.icp_hypothesis_id ?? null,
    pattern_id: payload.pattern_id ?? null,
    coach_prompt_id: payload.coach_prompt_id ?? null,
    occurred_at,
    payload: payload.payload ?? {},
    idempotency_key,
  };
}

function normalizeOutcome(outcome?: string | null | undefined) {
  if (!outcome) return null;
  const allowed = ['meeting', 'soft_interest', 'decline', 'angry', 'neutral'];
  return allowed.includes(outcome) ? outcome : null;
}

function buildIdempotencyKey(payload: ProviderEventPayload, occurred_at: string) {
  if (payload.provider_event_id) {
    const base = `${payload.provider}:${payload.provider_event_id}`;
    return crypto.createHash('sha256').update(base).digest('hex');
  }
  const base = `${payload.provider}:${payload.event_type}:${payload.outbound_id ?? 'none'}:${
    payload.contact_id ?? 'none'
  }:${occurred_at}`;
  return crypto.createHash('sha256').update(base).digest('hex');
}

export function classifyReply(eventType: string, outcome?: string | null) {
  if (eventType === 'reply') return 'replied';
  if (outcome === 'angry') return 'negative';
  if (outcome === 'decline') return 'negative';
  if (outcome === 'meeting' || outcome === 'soft_interest') return 'positive';
  return null;
}

export async function ingestEmailEvent(
  client: SupabaseClient,
  payload: ProviderEventPayload,
  options: IngestOptions = {}
) {
  const normalized = mapProviderEvent(payload);

  if (options.dryRun) {
    return { inserted: 0, dryRun: true };
  }

  const existing = await findExistingEvent(client, normalized);
  if (existing.found) {
    return { inserted: 0, deduped: true };
  }

  const enriched = await maybeEnrichWithOutboundContext(client, normalized);

  const { data, error } = await client.from('email_events').insert(enriched).select().single();

  if (error) {
    throw error;
  }

  await maybeMaterializeEmailDeliverability(client, enriched);
  await maybeMaterializeEmployeeSuppressionFlags(client, enriched);

  return { inserted: 1, event: data };
}

async function findExistingEvent(
  client: SupabaseClient,
  normalized: ReturnType<typeof mapProviderEvent>
): Promise<{ found: boolean }> {
  let query = client.from('email_events').select('id');

  if (normalized.provider_event_id) {
    query = (query as any).eq('provider', normalized.provider).eq('provider_event_id', normalized.provider_event_id);
  } else {
    query = (query as any).eq('idempotency_key', normalized.idempotency_key);
  }

  const { data, error } = await (query as any).limit(1);
  if (error) {
    throw error;
  }

  return { found: Array.isArray(data) && data.length > 0 };
}

async function maybeEnrichWithOutboundContext(
  client: SupabaseClient,
  evt: ReturnType<typeof mapProviderEvent>
) {
  const enriched = { ...evt };

  if (!enriched.outbound_id) {
    return enriched;
  }

  const outboundRes = await client
    .from('email_outbound')
    .select('id, draft_id, campaign_id, contact_id, metadata')
    .eq('id', enriched.outbound_id)
    .single();
  if (outboundRes.error) {
    throw outboundRes.error;
  }

  const outbound = outboundRes.data as any;
  enriched.draft_id = enriched.draft_id ?? outbound?.draft_id ?? null;
  enriched.employee_id = enriched.employee_id ?? outbound?.contact_id ?? null;

  if (outbound?.draft_id) {
    const draftRes = await client
      .from('drafts')
      .select('metadata, campaign_id')
      .eq('id', outbound.draft_id)
      .single();
    if (draftRes.error) {
      throw draftRes.error;
    }
    const metadata = (draftRes.data?.metadata ?? {}) as any;
    enriched.pattern_id = enriched.pattern_id ?? metadata.draft_pattern ?? null;
    enriched.coach_prompt_id = enriched.coach_prompt_id ?? metadata.coach_prompt_id ?? null;
    enriched.icp_profile_id = enriched.icp_profile_id ?? metadata.icp_profile_id ?? null;
    enriched.icp_hypothesis_id = enriched.icp_hypothesis_id ?? metadata.icp_hypothesis_id ?? null;
  }

  const campaignId = outbound?.campaign_id;
  if (campaignId) {
    const campaignRes = await client
      .from('campaigns')
      .select('segment_id, segment_version')
      .eq('id', campaignId)
      .single();
    if (campaignRes.error) {
      throw campaignRes.error;
    }
    enriched.segment_id = enriched.segment_id ?? campaignRes.data?.segment_id ?? null;
    enriched.segment_version = enriched.segment_version ?? campaignRes.data?.segment_version ?? null;
  }

  if (enriched.segment_id) {
    const segmentRes = await client
      .from('segments')
      .select('icp_profile_id, icp_hypothesis_id')
      .eq('id', enriched.segment_id)
      .single();
    if (!segmentRes.error && segmentRes.data) {
      enriched.icp_profile_id = enriched.icp_profile_id ?? segmentRes.data.icp_profile_id ?? null;
      enriched.icp_hypothesis_id =
        enriched.icp_hypothesis_id ?? segmentRes.data.icp_hypothesis_id ?? null;
    }
  }

  return enriched;
}

async function maybeMaterializeEmailDeliverability(
  client: SupabaseClient,
  evt: ReturnType<typeof mapProviderEvent>
) {
  if (evt.event_type !== 'bounced') {
    return;
  }

  const context = await resolveBouncedRecipientContext(client, evt);
  if (!context.employeeId || !context.recipientEmail) {
    return;
  }

  const { data: employee, error } = await client
    .from('employees')
    .select('id,work_email,generic_email')
    .eq('id', context.employeeId)
    .single();

  if (error || !employee) {
    throw error ?? new Error('Employee not found for bounced event materialization');
  }

  const normalizedRecipient = normalizeEmailAddress(context.recipientEmail);
  if (!normalizedRecipient) {
    return;
  }

  const patch: Record<string, string | boolean> = {
    reply_bounce: true,
  };
  if (normalizeEmailAddress(employee.work_email) === normalizedRecipient) {
    patch.work_email_status = 'bounced';
  }
  if (normalizeEmailAddress(employee.generic_email) === normalizedRecipient) {
    patch.generic_email_status = 'bounced';
  }

  if (!('work_email_status' in patch) && !('generic_email_status' in patch)) {
    return;
  }

  const { error: updateError } = await client.from('employees').update(patch).eq('id', context.employeeId);
  if (updateError) {
    throw updateError;
  }
}

async function maybeMaterializeEmployeeSuppressionFlags(
  client: SupabaseClient,
  evt: ReturnType<typeof mapProviderEvent>
) {
  if (evt.event_type !== 'unsubscribed' && evt.event_type !== 'complaint') {
    return;
  }

  const context = await resolveEventEmployeeContext(client, evt);
  if (!context.employeeId) {
    return;
  }

  const { error } = await client
    .from('employees')
    .update({ reply_unsubscribe: true })
    .eq('id', context.employeeId);
  if (error) {
    throw error;
  }
}

async function resolveBouncedRecipientContext(
  client: SupabaseClient,
  evt: ReturnType<typeof mapProviderEvent>
) {
  const context = await resolveEventEmployeeContext(client, evt);
  return {
    employeeId: context.employeeId,
    recipientEmail: getRecipientEmailFromPayload(evt.payload) ?? context.recipientEmail,
  };
}

async function resolveEventEmployeeContext(
  client: SupabaseClient,
  evt: ReturnType<typeof mapProviderEvent>
) {
  let employeeId = evt.employee_id ?? null;
  let recipientEmail: string | null = null;

  if (evt.outbound_id) {
    const { data: outbound, error } = await client
      .from('email_outbound')
      .select('contact_id,metadata')
      .eq('id', evt.outbound_id)
      .single();

    if (error) {
      throw error;
    }

    employeeId = employeeId ?? (typeof outbound?.contact_id === 'string' ? outbound.contact_id : null);
    const metadata =
      outbound?.metadata && typeof outbound.metadata === 'object'
        ? (outbound.metadata as Record<string, unknown>)
        : null;
    recipientEmail = getRecipientEmailFromPayload(metadata);
  }

  return { employeeId, recipientEmail };
}

function getRecipientEmailFromPayload(payload: Record<string, unknown> | null | undefined) {
  if (!payload) {
    return null;
  }

  const candidate = payload.recipient_email;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate.trim() : null;
}

export async function getReplyPatterns(
  client: SupabaseClient,
  options: { since?: string; topN?: number } = {}
) {
  let query = client
    .from('email_events')
    .select('reply_label, count')
    .not('reply_label', 'is', null);

  if (options.since) {
    query = query.gte('occurred_at', options.since);
  }

  const { data, error } = await (query as any).group('reply_label');
  if (error) throw error;

  let patterns: Array<{ reply_label: string; count: number }> = (data ?? []).map((row: any) => ({
    reply_label: row.reply_label,
    count: Number(row.count ?? 0),
  }));

  if (options.topN && options.topN > 0) {
    patterns = patterns
      .sort((a, b) => b.count - a.count)
      .slice(0, options.topN);
  }

  return patterns;
}
