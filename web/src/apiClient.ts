export interface Campaign {
  id: string;
  name: string;
  status?: string;
  segment_id?: string;
  segment_version?: number;
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

export interface CompanyRow {
  id: string;
  name: string;
  segment?: string;
  office_quantification?: string;
  registration_date?: string;
  last_outreach_date?: string;
  outreach_status?: string;
}

export interface ContactRow {
  id: string;
  company_id: string;
  name?: string;
  title?: string;
  email?: string;
  email_status?: string;
  persona?: string;
}

export interface MetaStatus {
  mode: 'live' | 'mock' | 'unknown';
  apiBase: string;
  smartleadReady: boolean;
  supabaseReady: boolean;
}

export type PromptStep = 'icp_profile' | 'icp_hypothesis' | 'draft';

export interface PromptEntry {
  id: string;
  step: PromptStep;
  version: string;
  description?: string;
  rollout_status?: 'pilot' | 'active' | 'retired';
  prompt_text?: string;
}

const baseUrl = import.meta.env.VITE_API_BASE ?? '/api';

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let message = `API error ${res.status}`;
    try {
      const errBody = await res.json();
      if (errBody?.error) message = `${message}: ${errBody.error}`;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
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
    icpProfileId?: string;
    icpHypothesisId?: string;
    provider?: string;
    model?: string;
  } = {}
): Promise<DraftSummary> {
  const body = {
    campaignId,
    dryRun: opts.dryRun ?? true,
    limit: opts.limit,
    dataQualityMode: opts.dataQualityMode,
    interactionMode: opts.interactionMode,
    icpProfileId: opts.icpProfileId,
    icpHypothesisId: opts.icpHypothesisId,
    provider: opts.provider,
    model: opts.model,
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

export async function fetchSmartleadCampaigns(): Promise<{ id: string; name: string; status?: string }[]> {
  return fetchJson('/smartlead/campaigns');
}

export async function createSmartleadCampaign(payload: { name: string; dryRun?: boolean }) {
  const body = {
    name: payload.name,
    dryRun: payload.dryRun ?? true,
  };
  return fetchJson('/smartlead/campaigns', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchCompanies(opts: { segment?: string; limit?: number } = {}): Promise<CompanyRow[]> {
  const params = new URLSearchParams();
  if (opts.segment) params.set('segment', opts.segment);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return fetchJson<CompanyRow[]>(`/companies${qs ? `?${qs}` : ''}`);
}

export async function fetchContacts(opts: { companyIds?: string[]; limit?: number } = {}): Promise<ContactRow[]> {
  const params = new URLSearchParams();
  if (opts.companyIds?.length) params.set('companyIds', opts.companyIds.join(','));
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return fetchJson<ContactRow[]>(`/contacts${qs ? `?${qs}` : ''}`);
}

export async function triggerSmartleadPreview(
  payload: { batchSize?: number; leadIds?: string[]; dryRun?: boolean } = {}
): Promise<any> {
  const body = {
    batchSize: payload.batchSize ?? 10,
    leadIds: payload.leadIds ?? [],
    dryRun: payload.dryRun ?? true,
  };
  return fetchJson('/smartlead/send', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function fetchSegments(): Promise<any[]> {
  return fetchJson('/segments');
}

export async function snapshotSegment(payload: { segmentId: string; finalize?: boolean; allowEmpty?: boolean; maxContacts?: number }) {
  return fetchJson('/segments/snapshot', {
    method: 'POST',
    body: JSON.stringify({
      segmentId: payload.segmentId,
      finalize: payload.finalize ?? true,
      allowEmpty: payload.allowEmpty ?? false,
      maxContacts: payload.maxContacts,
    }),
  });
}

export async function enqueueSegmentEnrichment(payload: {
  segmentId: string;
  adapter?: string;
  limit?: number;
  dryRun?: boolean;
  runNow?: boolean;
}) {
  return fetchJson('/enrich/segment', {
    method: 'POST',
    body: JSON.stringify({
      segmentId: payload.segmentId,
      adapter: payload.adapter ?? 'mock',
      limit: payload.limit,
      dryRun: payload.dryRun,
      runNow: payload.runNow,
    }),
  });
}

export async function fetchEnrichmentStatus(segmentId: string) {
  const params = new URLSearchParams({ segmentId });
  return fetchJson(`/enrich/status?${params.toString()}`);
}

export async function fetchIcpProfiles() {
  return fetchJson('/icp/profiles');
}

export async function createIcpProfile(payload: { name: string; description?: string }) {
  return fetchJson('/icp/profiles', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchIcpHypotheses(payload: { icpProfileId?: string; segmentId?: string } = {}) {
  const params = new URLSearchParams();
  if (payload.icpProfileId) params.set('icpProfileId', payload.icpProfileId);
  if (payload.segmentId) params.set('segmentId', payload.segmentId);
  const qs = params.toString();
  return fetchJson(`/icp/hypotheses${qs ? `?${qs}` : ''}`);
}

export async function createIcpHypothesis(payload: {
  icpProfileId: string;
  hypothesisLabel: string;
  segmentId?: string;
  searchConfig?: Record<string, unknown>;
}) {
  return fetchJson('/icp/hypotheses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchAnalyticsSummary(payload: { groupBy?: string; since?: string }) {
  const params = new URLSearchParams();
  if (payload.groupBy) params.set('groupBy', payload.groupBy);
  if (payload.since) params.set('since', payload.since);
  const qs = params.toString();
  return fetchJson(`/analytics/summary${qs ? `?${qs}` : ''}`);
}

export async function fetchAnalyticsOptimize(payload: { since?: string } = {}) {
  const params = new URLSearchParams();
  if (payload.since) params.set('since', payload.since);
  const qs = params.toString();
  return fetchJson(`/analytics/optimize${qs ? `?${qs}` : ''}`);
}

export async function fetchPromptRegistry() {
  return fetchJson<PromptEntry[]>('/prompt-registry');
}

export async function createPromptRegistryEntry(entry: {
  id?: string;
  step: PromptStep;
  version?: string;
  description?: string;
  rollout_status?: 'pilot' | 'active' | 'retired';
  prompt_text?: string;
}) {
  return fetchJson<PromptEntry>('/prompt-registry', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function createSimJob(payload: { segmentId: string; draftIds?: string[]; mode?: string }) {
  return fetchJson('/sim', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateIcpProfileViaCoach(payload: { name: string; description?: string; promptId?: string }) {
  return fetchJson('/coach/icp', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateHypothesisViaCoach(payload: {
  icpProfileId: string;
  hypothesisLabel?: string;
  searchConfig?: Record<string, unknown>;
  promptId?: string;
}) {
  return fetchJson('/coach/hypothesis', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
