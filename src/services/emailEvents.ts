import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IngestOptions {
  dryRun?: boolean;
}

export interface ProviderEventPayload {
  provider: string;
  provider_event_id?: string;
  event_type: string;
  outcome_classification?: string;
  reply_text?: string;
  contact_id?: string;
  outbound_id?: string;
  occurred_at?: string;
  payload?: Record<string, unknown>;
}

export function mapProviderEvent(payload: ProviderEventPayload) {
  if (!payload.provider || !payload.event_type) {
    throw new Error('provider and event_type are required');
  }
  const occurred_at = payload.occurred_at ?? new Date().toISOString();
  const normalizedOutcome = normalizeOutcome(payload.outcome_classification);
  const idempotency_key = buildIdempotencyKey(payload.provider, payload.provider_event_id);
  const reply_label = classifyReply(payload.event_type, normalizedOutcome);
  return {
    provider: payload.provider,
    provider_event_id: payload.provider_event_id ?? null,
    event_type: payload.event_type,
    outcome_classification: normalizedOutcome,
    reply_label,
    contact_id: payload.contact_id ?? null,
    outbound_id: payload.outbound_id ?? null,
    occurred_at,
    payload: payload.payload ?? {},
    idempotency_key,
  };
}

function normalizeOutcome(outcome?: string) {
  if (!outcome) return null;
  const allowed = ['meeting', 'soft_interest', 'decline', 'angry', 'neutral'];
  return allowed.includes(outcome) ? outcome : null;
}

function buildIdempotencyKey(provider: string, providerEventId?: string) {
  const base = `${provider}:${providerEventId ?? crypto.randomUUID()}`;
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

  const { data, error } = await client.from('email_events').insert(normalized).select().single();

  if (error) {
    throw error;
  }

  return { inserted: 1, event: data };
}

export async function getReplyPatterns(client: SupabaseClient) {
  const { data, error } = await client
    .from('email_events')
    .select('reply_label, count')
    .not('reply_label', 'is', null)
    .group('reply_label');

  if (error) {
    throw error;
  }
  const patterns = (data ?? []).map((row: any) => ({
    reply_label: row.reply_label,
    count: Number(row.count ?? 0),
  }));
  return patterns;
}
