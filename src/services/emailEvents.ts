import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

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
  const occurred_at = payload.occurred_at ?? new Date().toISOString();
  const normalizedOutcome = normalizeOutcome(payload.outcome_classification);
  const idempotency_key = buildIdempotencyKey(payload, occurred_at);
  const reply_label = classifyReply(payload.event_type, normalizedOutcome);
  return {
    provider: payload.provider,
    provider_event_id: payload.provider_event_id ?? null,
    event_type: payload.event_type,
    outcome_classification: normalizedOutcome,
    reply_label,
    contact_id: payload.contact_id ?? null,
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

function normalizeOutcome(outcome?: string | null) {
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

  if (normalized.provider_event_id) {
    const { data, error } = await client
      .from('email_events')
      .select('id')
      .eq('provider', normalized.provider)
      .eq('provider_event_id', normalized.provider_event_id)
      .limit(1);

    if (error) {
      throw error;
    }

    if (data && data.length > 0) {
      return { inserted: 0, deduped: true };
    }
  }

  const enriched = await maybeEnrichWithOutboundContext(client, normalized);

  const { data, error } = await client.from('email_events').insert(enriched).select().single();

  if (error) {
    throw error;
  }

  return { inserted: 1, event: data };
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
