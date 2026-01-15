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
  metadata?: Record<string, unknown> | null;
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

export interface InboxMessage {
  id: string;
  subject: string;
  body?: string;
  read: boolean;
  category?: string;
  receivedAt: string;
}

export interface MetaStatus {
  mode: 'live' | 'mock' | 'unknown';
  apiBase: string;
  smartleadReady: boolean;
  supabaseReady: boolean;
}

export interface ServiceConfig {
  name: string;
  category: 'database' | 'llm' | 'delivery' | 'enrichment';
  status: 'connected' | 'disconnected' | 'warning';
  hasApiKey: boolean;
  config?: {
    apiKey?: string;
    baseUrl?: string;
  };
  lastChecked?: string;
  errorMessage?: string;
}

export type PromptStep = 'icp_profile' | 'icp_hypothesis' | 'draft';

export interface PromptEntry {
  id: string;
  version: string;
  description?: string;
  rollout_status?: 'pilot' | 'active' | 'retired' | 'deprecated';
  prompt_text?: string;
  is_active?: boolean;
  // Step is optional for web: some environments do not have a step column.
  step?: PromptStep;
}

export interface LlmModelInfo {
  id: string;
  provider: string;
  ownedBy?: string | null;
  contextWindow?: number | null;
}

import type { FilterDefinition, FilterPreviewResult } from './types/filters';
import type { ExaCompanyResult, ExaEmployeeResult } from './types/exaWebset';

const baseUrl = import.meta.env.VITE_API_BASE ?? '/api';

/**
 * Error codes for specific error conditions
 */
export const ErrorCodes = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  RATE_LIMIT: 'RATE_LIMIT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  SERVER_ERROR: 'SERVER_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  UNKNOWN: 'UNKNOWN',
} as const;

/**
 * Structured error object with user-friendly messages
 */
export interface ApiError {
  code: typeof ErrorCodes[keyof typeof ErrorCodes];
  message: string;
  userMessage: string;
  details?: any;
  statusCode?: number;
}

/**
 * Get user-friendly error message based on error type
 */
function getUserFriendlyMessage(statusCode: number, errorMessage: string): string {
  // Rate limit errors
  if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.';
  }

  // Authentication errors
  if (statusCode === 401 || statusCode === 403) {
    return 'Authentication failed. Please check your credentials.';
  }

  // Not found errors
  if (statusCode === 404) {
    return 'The requested resource was not found.';
  }

  // Validation errors
  if (statusCode === 400 || errorMessage.toLowerCase().includes('invalid')) {
    return 'Invalid request. Please check your input and try again.';
  }

  // Server errors
  if (statusCode >= 500) {
    return 'Server error. Please try again later.';
  }

  // Network errors
  if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
    return 'Network error. Please check your connection and try again.';
  }

  // Default message
  return 'An error occurred. Please try again.';
}

/**
 * Create structured API error from response
 */
function createApiError(statusCode: number, errorMessage: string, details?: any): ApiError {
  let code: typeof ErrorCodes[keyof typeof ErrorCodes] = ErrorCodes.UNKNOWN;

  if (statusCode === 429 || errorMessage.toLowerCase().includes('rate limit')) {
    code = ErrorCodes.RATE_LIMIT;
  } else if (statusCode === 401 || statusCode === 403) {
    code = ErrorCodes.UNAUTHORIZED;
  } else if (statusCode === 404) {
    code = ErrorCodes.NOT_FOUND;
  } else if (statusCode === 400) {
    code = ErrorCodes.VALIDATION_ERROR;
  } else if (statusCode >= 500) {
    code = ErrorCodes.SERVER_ERROR;
  } else if (errorMessage.toLowerCase().includes('network') || errorMessage.toLowerCase().includes('fetch')) {
    code = ErrorCodes.NETWORK_ERROR;
  }

  return {
    code,
    message: errorMessage,
    userMessage: getUserFriendlyMessage(statusCode, errorMessage),
    details,
    statusCode,
  };
}

async function fetchJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  try {
    const res = await fetch(`${baseUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });

    if (!res.ok) {
      let message = `API error ${res.status}`;
      let details = undefined;

      try {
        const errBody = await res.json();
        if (errBody?.error) {
          message = `${message}: ${errBody.error}`;
          details = errBody;
        }
      } catch {
        // ignore parse errors
      }

      const apiError = createApiError(res.status, message, details);
      const error = new Error(apiError.userMessage);
      (error as any).apiError = apiError;
      throw error;
    }

    return res.json() as Promise<T>;
  } catch (error) {
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      const apiError = createApiError(0, 'Network request failed', { originalError: error.message });
      const networkError = new Error(apiError.userMessage);
      (networkError as any).apiError = apiError;
      throw networkError;
    }
    throw error;
  }
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
    coachPromptStep?: PromptStep;
    explicitCoachPromptId?: string;
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
    coachPromptStep: opts.coachPromptStep,
    explicitCoachPromptId: opts.explicitCoachPromptId,
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

export async function fetchInboxMessages(opts: { status?: string; limit?: number } = {}) {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return fetchJson<{ messages: InboxMessage[]; total: number }>(
    `/inbox/messages${qs ? `?${qs}` : ''}`
  );
}

export async function fetchMeta(): Promise<MetaStatus> {
  return fetchJson<MetaStatus>('/meta');
}

export async function fetchServices(): Promise<{ services: ServiceConfig[] }> {
  return fetchJson<{ services: ServiceConfig[] }>('/services');
}

export async function fetchLlmModels(provider: 'openai' | 'anthropic'): Promise<LlmModelInfo[]> {
  const params = new URLSearchParams({ provider });
  return fetchJson<LlmModelInfo[]>(`/llm/models?${params.toString()}`);
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

export async function filterPreviewAPI(filterDefinition: FilterDefinition[]): Promise<FilterPreviewResult> {
  return fetchJson<FilterPreviewResult>('/filters/preview', {
    method: 'POST',
    body: JSON.stringify({ filterDefinition }),
  });
}

/**
 * Retry configuration for transient failures
 */
const RETRY_CONFIG = {
  maxRetries: 2,
  retryDelay: 1000, // 1 second
  retryableStatusCodes: [408, 429, 500, 502, 503, 504],
};

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch with retry logic for transient failures
 */
async function fetchWithRetry<T>(
  path: string,
  options: RequestInit = {},
  retries = RETRY_CONFIG.maxRetries
): Promise<T> {
  try {
    return await fetchJson<T>(path, options);
  } catch (error: any) {
    const statusCode = error?.apiError?.statusCode;
    const isRetryable = statusCode && RETRY_CONFIG.retryableStatusCodes.includes(statusCode);

    if (retries > 0 && isRetryable) {
      await sleep(RETRY_CONFIG.retryDelay);
      return fetchWithRetry<T>(path, options, retries - 1);
    }

    throw error;
  }
}

export async function aiSuggestFiltersAPI(params: {
  userDescription: string;
  icpProfileId?: string;
  icpContext?: string;
  maxSuggestions?: number;
}): Promise<{
  suggestions: Array<{
    filters: FilterDefinition[];
    rationale?: string;
    targetAudience?: string;
  }>;
}> {
  try {
    return await fetchWithRetry('/filters/ai-suggest', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  } catch (error: any) {
    // Enhance error message for AI-specific failures
    if (error?.apiError?.statusCode === 429) {
      const enhancedError = new Error('AI service rate limit reached. Please wait a moment and try again.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    if (error?.apiError?.statusCode >= 500) {
      const enhancedError = new Error('AI service is temporarily unavailable. Please try again in a few moments.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    throw error;
  }
}

export async function fetchSegments(): Promise<any[]> {
  return fetchJson('/segments');
}

export async function createSegmentAPI(payload: {
  name: string;
  locale: string;
  filterDefinition: FilterDefinition[];
  description?: string;
}): Promise<Record<string, any>> {
  try {
    return await fetchJson<Record<string, any>>('/segments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  } catch (error: any) {
    // Enhance error messages for segment creation failures
    const errorMessage = error?.message || '';

    if (errorMessage.toLowerCase().includes('column') || errorMessage.toLowerCase().includes('field')) {
      const enhancedError = new Error('Invalid filter: one or more database columns do not exist. Please check your filter fields.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    if (errorMessage.toLowerCase().includes('duplicate') || errorMessage.toLowerCase().includes('already exists')) {
      const enhancedError = new Error(`A segment with the name "${payload.name}" already exists. Please choose a different name.`);
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    if (error?.apiError?.statusCode === 400) {
      const enhancedError = new Error('Invalid segment configuration. Please check your filters and try again.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    throw error;
  }
}

export async function exaWebsetSearchAPI(params: {
  description: string;
  maxResults?: number;
}): Promise<{
  companies: ExaCompanyResult[];
  employees: ExaEmployeeResult[];
  totalResults: number;
  query: string;
}> {
  try {
    return await fetchWithRetry('/exa/webset/search', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  } catch (error: any) {
    // Enhance error message for EXA-specific failures
    if (error?.apiError?.statusCode === 429) {
      const enhancedError = new Error('EXA API rate limit reached. Please wait a moment and try again.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    if (error?.apiError?.statusCode === 400) {
      const enhancedError = new Error('Invalid search query. Please refine your search description and try again.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    if (error?.apiError?.statusCode >= 500) {
      const enhancedError = new Error('EXA search service is temporarily unavailable. Please try again in a few moments.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    throw error;
  }
}

export async function saveExaSegmentAPI(params: {
  name: string;
  locale: string;
  companies: ExaCompanyResult[];
  employees: ExaEmployeeResult[];
  query: string;
  description?: string;
}): Promise<Record<string, any>> {
  try {
    return await fetchJson('/segments/exa', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  } catch (error: any) {
    // Enhance error messages for EXA segment save failures
    const errorMessage = error?.message || '';

    if (errorMessage.toLowerCase().includes('duplicate') || errorMessage.toLowerCase().includes('already exists')) {
      const enhancedError = new Error(`A segment with the name "${params.name}" already exists. Please choose a different name.`);
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    if (errorMessage.toLowerCase().includes('partial')) {
      const enhancedError = new Error('Some data could not be saved. The segment was created but some companies or employees may be missing.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    if (params.companies.length === 0 && params.employees.length === 0) {
      const enhancedError = new Error('Cannot save empty segment. Please perform a search first.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    if (error?.apiError?.statusCode === 400) {
      const enhancedError = new Error('Invalid segment data. Please try searching again.');
      (enhancedError as any).apiError = error.apiError;
      throw enhancedError;
    }
    throw error;
  }
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

export async function enqueueSegmentEnrichmentMulti(payload: {
  segmentId: string;
  providers: string[];
  limit?: number;
  dryRun?: boolean;
  runNow?: boolean;
}) {
  return fetchJson('/enrich/segment/multi', {
    method: 'POST',
    body: JSON.stringify({
      segmentId: payload.segmentId,
      providers: payload.providers,
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

export async function fetchEnrichmentSettings() {
  return fetchJson('/settings/enrichment');
}

export async function saveEnrichmentSettings(payload: {
  defaultProviders: string[];
  primaryCompanyProvider: string;
  primaryEmployeeProvider: string;
}) {
  return fetchJson('/settings/enrichment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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

export async function fetchPromptRegistry(step?: PromptStep) {
  const qs = step ? `?step=${encodeURIComponent(step)}` : '';
  return fetchJson<PromptEntry[]>(`/prompt-registry${qs}`);
}

export async function createPromptRegistryEntry(entry: {
  id?: string;
  version?: string;
  description?: string;
  rollout_status?: 'pilot' | 'active' | 'retired';
  prompt_text?: string;
  step?: PromptStep;
}) {
  return fetchJson<PromptEntry>('/prompt-registry', {
    method: 'POST',
    body: JSON.stringify(entry),
  });
}

export async function fetchActivePrompt(step: PromptStep) {
  const params = new URLSearchParams({ step });
  return fetchJson<{ step: PromptStep; coach_prompt_id: string | null }>(
    `/prompt-registry/active?${params.toString()}`
  );
}

export async function setActivePrompt(step: PromptStep, coachPromptId: string) {
  await fetchJson<{ ok: boolean }>('/prompt-registry/active', {
    method: 'POST',
    body: JSON.stringify({ step, coach_prompt_id: coachPromptId }),
  });
}

export async function createSimJob(payload: { segmentId: string; draftIds?: string[]; mode?: string }) {
  return fetchJson('/sim', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function triggerIcpDiscovery(payload: {
  icpProfileId: string;
  icpHypothesisId?: string;
  limit?: number;
}) {
  return fetchJson<{ jobId?: string; runId: string; provider: string; status: string }>('/icp/discovery', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchIcpDiscoveryCandidates(payload: {
  runId: string;
  icpProfileId?: string;
  icpHypothesisId?: string;
}) {
  const params = new URLSearchParams();
  params.set('runId', payload.runId);
  if (payload.icpProfileId) params.set('icpProfileId', payload.icpProfileId);
  if (payload.icpHypothesisId) params.set('icpHypothesisId', payload.icpHypothesisId);
  const qs = params.toString();
  return fetchJson<
    {
      id: string;
      name: string | null;
      domain: string | null;
      url: string | null;
      country: string | null;
      size: string | null;
      confidence: number | null;
    }[]
  >(`/icp/discovery/candidates?${qs}`);
}

export async function promoteIcpDiscoveryCandidates(payload: {
  runId: string;
  candidateIds: string[];
  segmentId: string;
}) {
  return fetchJson<{ promotedCount: number }>('/icp/discovery/promote', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateIcpProfileViaCoach(payload: {
  name: string;
  description?: string;
  userPrompt?: string;
  promptId?: string;
  provider?: string;
  model?: string;
}) {
  const res = await fetchJson<{ jobId?: string; profile: { id: string; name?: string; description?: string } }>(
    '/coach/icp',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return {
    id: res.profile.id,
    jobId: res.jobId,
    name: res.profile.name,
    description: res.profile.description,
  };
}

export async function generateHypothesisViaCoach(payload: {
  icpProfileId: string;
  hypothesisLabel?: string;
  searchConfig?: Record<string, unknown>;
  userPrompt?: string;
  promptId?: string;
  provider?: string;
  model?: string;
}) {
  const res = await fetchJson<{
    jobId?: string;
    hypothesis: { id: string; icp_id?: string; hypothesis_label?: string };
  }>('/coach/hypothesis', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return {
    id: res.hypothesis.id,
    jobId: res.jobId,
    icp_profile_id: res.hypothesis.icp_id,
    hypothesis_label: res.hypothesis.hypothesis_label,
  };
}
