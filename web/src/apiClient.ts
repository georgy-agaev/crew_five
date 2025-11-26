export interface Campaign {
  id: string;
  name: string;
  status?: string;
}

export interface DraftRow {
  id: string;
  status?: string;
  contact?: string;
}

export interface DraftSummary {
  generated: number;
  dryRun: boolean;
  gracefulUsed?: number;
}

export interface SendSummary {
  sent: number;
  failed: number;
  skipped: number;
  fetched: number;
}

export interface EventRow {
  id: string;
  event_type: string;
  occurred_at: string;
}

export interface PatternRow {
  reply_label: string;
  count: number;
}

export interface MetaStatus {
  mode: 'live' | 'mock' | 'unknown';
  apiBase: string;
  smartleadReady: boolean;
  supabaseReady: boolean;
}

const baseUrl = import.meta.env.VITE_API_BASE ?? '/api';

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function fetchCampaigns(): Promise<Campaign[]> {
  return fetchJson<Campaign[]>('/campaigns');
}

export async function fetchDrafts(campaignId?: string, status?: string): Promise<DraftRow[]> {
  const params = new URLSearchParams();
  if (campaignId) params.set('campaignId', campaignId);
  if (status) params.set('status', status);
  const qs = params.toString();
  return fetchJson<DraftRow[]>(`/drafts${qs ? `?${qs}` : ''}`);
}

export async function triggerDraftGenerate(
  campaignId: string,
  opts: {
    dryRun?: boolean;
    limit?: number;
    dataQualityMode?: 'strict' | 'graceful';
    interactionMode?: 'express' | 'coach';
  } = {}
): Promise<DraftSummary> {
  const body = {
    campaignId,
    dryRun: opts.dryRun ?? true,
    limit: opts.limit,
    dataQualityMode: opts.dataQualityMode,
    interactionMode: opts.interactionMode,
  };
  return fetchJson<DraftSummary>('/drafts/generate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function triggerSmartleadSend(
  opts: { dryRun?: boolean; batchSize?: number } = {}
): Promise<SendSummary> {
  const body = {
    dryRun: opts.dryRun ?? true,
    batchSize: opts.batchSize ?? 10,
  };
  return fetchJson<SendSummary>('/smartlead/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchEvents(opts: { since?: string; limit?: number } = {}): Promise<EventRow[]> {
  const params = new URLSearchParams();
  if (opts.since) params.set('since', opts.since);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return fetchJson<EventRow[]>(`/events${qs ? `?${qs}` : ''}`);
}

export async function fetchReplyPatterns(opts: { since?: string; topN?: number } = {}): Promise<PatternRow[]> {
  const params = new URLSearchParams();
  if (opts.since) params.set('since', opts.since);
  if (opts.topN) params.set('topN', String(opts.topN));
  const qs = params.toString();
  return fetchJson<PatternRow[]>(`/reply-patterns${qs ? `?${qs}` : ''}`);
}

export async function fetchMeta(): Promise<MetaStatus> {
  return fetchJson<MetaStatus>('/meta');
}
