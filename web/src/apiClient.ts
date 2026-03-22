export interface Campaign {
  id: string;
  name: string;
  status?: string;
  project_id?: string | null;
  offer_id?: string | null;
  icp_hypothesis_id?: string | null;
  segment_id?: string;
  segment_version?: number;
}

export interface CampaignStatusTransitionsView {
  campaignId: string;
  currentStatus: string;
  allowedTransitions: string[];
}

export interface CampaignFollowupCandidate {
  contact_id: string;
  company_id: string | null;
  intro_sent: boolean;
  intro_sent_at: string | null;
  intro_sender_identity: string | null;
  reply_received: boolean;
  bounce: boolean;
  unsubscribed: boolean;
  bump_draft_exists: boolean;
  bump_sent: boolean;
  eligible: boolean;
  days_since_intro: number | null;
  auto_reply: string | null;
}

export interface CampaignFollowupCandidatesView {
  candidates: CampaignFollowupCandidate[];
  summary: {
    total: number;
    eligible: number;
    ineligible: number;
  };
}

export interface CampaignCompany {
  company_id: string;
  company_name: string | null;
  website?: string | null;
  employee_count?: number | null;
  region?: string | null;
  office_qualification?: string | null;
  company_description?: string | null;
  company_research?: unknown;
  contact_count: number;
  enrichment: {
    status: 'fresh' | 'stale' | 'missing';
    last_updated_at: string | null;
    provider_hint: string | null;
  };
}

export interface CampaignCompaniesView {
  campaign: {
    id: string;
    name: string;
    status?: string;
    segment_id: string;
    segment_version: number;
    created_at?: string | null;
    updated_at?: string | null;
  };
  companies: CampaignCompany[];
}

export interface CampaignDetailEmployee {
  contact_id: string;
  full_name: string | null;
  position: string | null;
  work_email: string | null;
  generic_email: string | null;
  recipient_email: string | null;
  recipient_email_source: 'work' | 'generic' | 'missing';
  sendable: boolean;
  block_reasons: Array<'no_sendable_email' | 'bounced' | 'unsubscribed' | 'already_used'>;
  eligible_for_new_intro: boolean;
  draft_counts: {
    total: number;
    intro: number;
    bump: number;
    generated: number;
    approved: number;
    rejected: number;
    sent: number;
  };
  outbound_count: number;
  sent_count: number;
  replied: boolean;
  reply_count: number;
  exposure_summary: {
    total_exposures: number;
    last_icp_hypothesis_id: string | null;
    last_offer_id: string | null;
    last_offer_title: string | null;
    last_sent_at: string | null;
  };
  execution_exposures: Array<{
    contact_id: string;
    campaign_id: string;
    icp_profile_id: string | null;
    icp_hypothesis_id: string | null;
    offer_id: string | null;
    offer_title: string | null;
    project_name: string | null;
    offering_domain: string | null;
    offering_hash: string | null;
    offering_summary: string | null;
    first_sent_at: string;
    last_sent_at: string;
    sent_count: number;
    replied: boolean;
    bounced: boolean;
    unsubscribed: boolean;
  }>;
}

export interface CampaignDetailCompany extends CampaignCompany {
  composition_summary: {
    total_contacts: number;
    sendable_contacts: number;
    eligible_for_new_intro_contacts: number;
    blocked_no_sendable_email_contacts: number;
    blocked_bounced_contacts: number;
    blocked_unsubscribed_contacts: number;
    blocked_already_used_contacts: number;
    contacts_with_drafts: number;
    contacts_with_sent_outbound: number;
  };
  employees: CampaignDetailEmployee[];
}

export interface CampaignDetailView {
  campaign: {
    id: string;
    name: string;
    status?: string;
    segment_id: string;
    segment_version: number;
    created_at?: string | null;
    updated_at?: string | null;
  };
  segment: {
    id: string;
    name: string | null;
    icp_profile_id: string | null;
    icp_hypothesis_id: string | null;
  } | null;
  icp_profile: {
    id: string;
    name: string | null;
    offering_domain: string | null;
  } | null;
  icp_hypothesis: {
    id: string;
    name: string | null;
    offer_id: string | null;
    status: string | null;
    messaging_angle: string | null;
  } | null;
  offer: OfferRecord | null;
  project: ProjectRecord | null;
  companies: CampaignDetailCompany[];
}

export interface CampaignOutbound {
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

export interface CampaignOutboundsView {
  campaign: {
    id: string;
    name: string;
    status?: string;
    segment_id: string;
    segment_version: number;
    created_at?: string | null;
    updated_at?: string | null;
  };
  outbounds: CampaignOutbound[];
}

export interface CampaignAuditView {
  campaign: {
    id: string;
    name: string;
    status?: string;
    segment_id: string;
    segment_version: number;
    created_at?: string | null;
    updated_at?: string | null;
  };
  summary: {
    company_count: number;
    snapshot_contact_count: number;
    contacts_with_any_draft: number;
    contacts_with_intro_draft: number;
    contacts_with_bump_draft: number;
    contacts_with_sent_outbound: number;
    contacts_with_events: number;
    draft_count: number;
    generated_draft_count: number;
    approved_draft_count: number;
    rejected_draft_count: number;
    sent_draft_count: number;
    sendable_draft_count: number;
    unsendable_draft_count: number;
    outbound_count: number;
    outbound_sent_count: number;
    outbound_failed_count: number;
    outbound_missing_recipient_email_count: number;
    event_count: number;
    replied_event_count: number;
    bounced_event_count: number;
    unsubscribed_event_count: number;
    snapshot_contacts_without_draft_count: number;
    drafts_missing_recipient_email_count: number;
    duplicate_draft_pair_count: number;
    draft_company_mismatch_count: number;
    sent_drafts_without_outbound_count: number;
    outbounds_without_draft_count: number;
  };
  issues: {
    snapshot_contacts_without_draft: Array<Record<string, unknown>>;
    drafts_missing_recipient_email: Array<Record<string, unknown>>;
    duplicate_drafts: Array<Record<string, unknown>>;
    draft_company_mismatches: Array<Record<string, unknown>>;
    sent_drafts_without_outbound: Array<Record<string, unknown>>;
    outbounds_without_draft: Array<Record<string, unknown>>;
    outbounds_missing_recipient_email: Array<Record<string, unknown>>;
  };
}

export interface CampaignEvent {
  id: string;
  outbound_id: string;
  event_type: string;
  outcome_classification: string | null;
  provider_event_id: string | null;
  occurred_at: string | null;
  created_at: string | null;
  pattern_id: string | null;
  coach_prompt_id: string | null;
  payload: Record<string, unknown> | null;
  draft_id: string | null;
  draft_email_type: string | null;
  draft_status: string | null;
  subject: string | null;
  provider: string | null;
  provider_message_id: string | null;
  sender_identity: string | null;
  sent_at: string | null;
  recipient_email: string | null;
  recipient_email_source: string | null;
  recipient_email_kind: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_position: string | null;
  company_id: string | null;
  company_name: string | null;
  company_website: string | null;
}

export interface CampaignEventsView {
  campaign: {
    id: string;
    name: string;
    status?: string;
    segment_id: string;
    segment_version: number;
    created_at?: string | null;
    updated_at?: string | null;
  };
  events: CampaignEvent[];
}

export interface DraftRow {
  id: string;
  status?: string;
  email_type?: string | null;
  subject?: string | null;
  body?: string | null;
  pattern_mode?: string | null;
  variant_label?: string | null;
  reviewer?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  contact_position?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  recipient_email?: string | null;
  recipient_email_source?: string | null;
  recipient_email_kind?: string | null;
  sendable?: boolean;
  metadata?: Record<string, unknown> | null;
}

export interface DraftSummary {
  generated: number;
  dryRun: boolean;
  gracefulUsed?: number;
  failed?: number;
  skipped?: number;
  skippedNoEmail?: number;
  error?: string;
}

export interface SendSummary {
  dryRun: boolean;
  campaignId: string;
  smartleadCampaignId: string;
  leadsPrepared: number;
  leadsPushed: number;
  sequencesPrepared: number;
  sequencesSynced: number;
  skippedContactsNoEmail: number;
  timestamp?: string;
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

export interface InboxReply {
  id: string;
  campaign_id: string | null;
  campaign_name: string | null;
  reply_label: string | null;
  event_type: string;
  occurred_at: string | null;
  outcome_classification?: string | null;
  reply_text: string | null;
  draft_id?: string | null;
  draft_email_type?: string | null;
  draft_status?: string | null;
  subject?: string | null;
  sender_identity?: string | null;
  recipient_email?: string | null;
  contact_id?: string | null;
  contact_name?: string | null;
  contact_position?: string | null;
  company_id?: string | null;
  company_name?: string | null;
  handled?: boolean;
  handled_at?: string | null;
  handled_by?: string | null;
}

export interface InboxRepliesView {
  replies: InboxReply[];
  total: number;
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
  const normalized = errorMessage.toLowerCase();

  if (
    normalized.includes('campaign rotation preview requires a sent source wave') ||
    normalized.includes('campaign rotation preview requires source icp profile')
  ) {
    return errorMessage.replace(/^API error \d+:\s*/i, '');
  }

  // Rate limit errors
  if (statusCode === 429 || normalized.includes('rate limit')) {
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
  if (statusCode === 400 || normalized.includes('invalid')) {
    return 'Invalid request. Please check your input and try again.';
  }

  // Server errors
  if (statusCode >= 500) {
    return 'Server error. Please try again later.';
  }

  // Network errors
  if (normalized.includes('network') || normalized.includes('fetch')) {
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

export async function fetchCampaignCompanies(campaignId: string): Promise<CampaignCompaniesView> {
  return fetchJson<CampaignCompaniesView>(`/campaigns/${campaignId}/companies`);
}

export async function fetchCampaignDetail(campaignId: string): Promise<CampaignDetailView> {
  return fetchJson<CampaignDetailView>(`/campaigns/${campaignId}/detail`);
}

export async function fetchCampaignAudit(campaignId: string): Promise<CampaignAuditView> {
  return fetchJson<CampaignAuditView>(`/campaigns/${campaignId}/audit`);
}

export async function fetchCampaignOutbounds(campaignId: string): Promise<CampaignOutboundsView> {
  return fetchJson<CampaignOutboundsView>(`/campaigns/${campaignId}/outbounds`);
}

export async function fetchCampaignEvents(campaignId: string): Promise<CampaignEventsView> {
  return fetchJson<CampaignEventsView>(`/campaigns/${campaignId}/events`);
}

export async function fetchCampaignStatusTransitions(
  campaignId: string
): Promise<CampaignStatusTransitionsView> {
  return fetchJson<CampaignStatusTransitionsView>(`/campaigns/${campaignId}/status-transitions`);
}

export async function updateCampaignStatus(campaignId: string, status: string): Promise<Campaign> {
  return fetchJson<Campaign>(`/campaigns/${campaignId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status }),
  });
}

export async function fetchCampaignFollowupCandidates(
  campaignId: string
): Promise<CampaignFollowupCandidatesView> {
  return fetchJson<CampaignFollowupCandidatesView>(`/campaigns/${campaignId}/followup-candidates`);
}

export async function createCampaign(payload: {
  name: string;
  segmentId: string;
  segmentVersion: number;
  offerId?: string;
  icpHypothesisId?: string;
}): Promise<Campaign> {
  return fetchJson<Campaign>('/campaigns', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function fetchDrafts(
  campaignId?: string,
  status?: string,
  includeRecipientContext = false
): Promise<DraftRow[]> {
  const params = new URLSearchParams();
  if (campaignId) params.set('campaignId', campaignId);
  if (status) params.set('status', status);
  if (includeRecipientContext) params.set('includeRecipientContext', 'true');
  const qs = params.toString();
  return fetchJson<DraftRow[]>(`/drafts${qs ? `?${qs}` : ''}`);
}

export async function reviewDraftStatus(
  draftId: string,
  payload: {
    status: string;
    reviewer?: string;
    metadata?: Record<string, unknown>;
  }
): Promise<DraftRow> {
  return fetchJson<DraftRow>(`/drafts/${draftId}/status`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateDraftContent(
  draftId: string,
  payload: { subject: string; body: string }
): Promise<DraftRow> {
  return fetchJson<DraftRow>(`/drafts/${draftId}/content`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export interface BatchDraftStatusResult {
  updated: DraftRow[];
  summary: {
    totalRequested: number;
    updatedCount: number;
    status: string;
  };
}

export async function batchReviewDrafts(payload: {
  draftIds: string[];
  status: string;
  reviewer?: string;
  metadata?: Record<string, unknown>;
}): Promise<BatchDraftStatusResult> {
  return fetchJson<BatchDraftStatusResult>('/drafts/batch-status', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
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
  opts: { campaignId: string; smartleadCampaignId: string; dryRun?: boolean; batchSize?: number } 
): Promise<SendSummary> {
  const body = {
    dryRun: opts.dryRun ?? true,
    batchSize: opts.batchSize ?? 10,
    campaignId: opts.campaignId,
    smartleadCampaignId: opts.smartleadCampaignId,
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

export async function fetchInboxReplies(opts: {
  campaignId?: string;
  replyLabel?: string;
  handled?: boolean;
  limit?: number;
} = {}): Promise<InboxRepliesView> {
  const params = new URLSearchParams();
  if (opts.campaignId) params.set('campaignId', opts.campaignId);
  if (opts.replyLabel) params.set('replyLabel', opts.replyLabel);
  if (typeof opts.handled === 'boolean') params.set('handled', String(opts.handled));
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return fetchJson<InboxRepliesView>(`/inbox/replies${qs ? `?${qs}` : ''}`);
}

export interface InboxReplyHandledResult {
  id: string;
  handled: boolean;
  handled_at: string | null;
  handled_by: string | null;
}

export async function markInboxReplyHandled(replyId: string, handledBy?: string): Promise<InboxReplyHandledResult> {
  return fetchJson<InboxReplyHandledResult>(`/inbox/replies/${replyId}/handled`, {
    method: 'POST',
    body: JSON.stringify(handledBy ? { handledBy } : {}),
  });
}

export async function markInboxReplyUnhandled(replyId: string): Promise<InboxReplyHandledResult> {
  return fetchJson<InboxReplyHandledResult>(`/inbox/replies/${replyId}/unhandled`, {
    method: 'POST',
  });
}

export interface InboxPollResult {
  source: 'outreacher-process-replies';
  requestedAt: string;
  upstreamStatus: number;
  accepted?: boolean;
  processed?: number;
  queued?: boolean;
  mailboxAccountId?: string | null;
  [key: string]: unknown;
}

export async function triggerInboxPoll(opts: {
  mailboxAccountId?: string;
  lookbackHours?: number;
} = {}): Promise<InboxPollResult> {
  return fetchJson<InboxPollResult>('/inbox/poll', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

// ---- Directory ----

export interface DirectoryCompany {
  companyId: string;
  companyName: string | null;
  segment: string | null;
  status: string | null;
  website: string | null;
  employeeCount: number | null;
  officeQualification: string | null;
  registrationDate: string | null;
  updatedAt: string | null;
  enrichment: { status: 'fresh' | 'stale' | 'missing'; lastUpdatedAt: string | null; providerHint: string | null };
  contacts: { total: number; withWorkEmail: number; withAnyEmail: number; missingEmail: number };
  flags: { hasWebsite: boolean; hasResearch: boolean };
}

export interface DirectoryCompaniesView {
  items: DirectoryCompany[];
  summary: {
    total: number;
    enrichment: { fresh: number; stale: number; missing: number };
    segments: { segment: string; count: number }[];
  };
}

export interface DirectoryContact {
  contactId: string;
  companyId: string | null;
  companyName: string | null;
  companySegment: string | null;
  companyStatus: string | null;
  fullName: string | null;
  position: string | null;
  workEmail: string | null;
  genericEmail: string | null;
  emailStatus: 'work' | 'generic' | 'missing';
  workEmailStatus: 'unknown' | 'valid' | 'invalid' | 'bounced';
  genericEmailStatus: 'unknown' | 'valid' | 'invalid' | 'bounced';
  processingStatus: string | null;
  updatedAt: string | null;
  enrichment: { status: 'fresh' | 'stale' | 'missing'; lastUpdatedAt: string | null; providerHint: string | null };
}

export interface DirectoryContactsView {
  items: DirectoryContact[];
  summary: {
    total: number;
    emailStatus: { work: number; generic: number; missing: number };
    enrichment: { fresh: number; stale: number; missing: number };
  };
}

export async function fetchDirectoryCompanies(opts: {
  segment?: string;
  enrichmentStatus?: 'fresh' | 'stale' | 'missing';
  q?: string;
  limit?: number;
} = {}): Promise<DirectoryCompaniesView> {
  const params = new URLSearchParams();
  if (opts.segment) params.set('segment', opts.segment);
  if (opts.enrichmentStatus) params.set('enrichmentStatus', opts.enrichmentStatus);
  if (opts.q) params.set('q', opts.q);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return fetchJson<DirectoryCompaniesView>(`/directory/companies${qs ? `?${qs}` : ''}`);
}

export async function fetchDirectoryContacts(opts: {
  companyIds?: string[];
  segment?: string;
  emailStatus?: 'work' | 'generic' | 'missing';
  enrichmentStatus?: 'fresh' | 'stale' | 'missing';
  q?: string;
  limit?: number;
} = {}): Promise<DirectoryContactsView> {
  const params = new URLSearchParams();
  if (opts.companyIds?.length) params.set('companyIds', opts.companyIds.join(','));
  if (opts.segment) params.set('segment', opts.segment);
  if (opts.emailStatus) params.set('emailStatus', opts.emailStatus);
  if (opts.enrichmentStatus) params.set('enrichmentStatus', opts.enrichmentStatus);
  if (opts.q) params.set('q', opts.q);
  if (opts.limit) params.set('limit', String(opts.limit));
  const qs = params.toString();
  return fetchJson<DirectoryContactsView>(`/directory/contacts${qs ? `?${qs}` : ''}`);
}

export interface ContactMarkInvalidResult {
  contactId: string;
  processingStatus: string;
  updatedAt: string;
}

export interface ContactDeleteResult {
  contactId: string;
  deleted: boolean;
}

export async function markDirectoryContactInvalid(contactId: string): Promise<ContactMarkInvalidResult> {
  return fetchJson<ContactMarkInvalidResult>(`/directory/contacts/${contactId}/mark-invalid`, {
    method: 'POST',
  });
}

export async function deleteDirectoryContact(contactId: string): Promise<ContactDeleteResult> {
  return fetchJson<ContactDeleteResult>(`/directory/contacts/${contactId}/delete`, {
    method: 'POST',
  });
}

// ---- Mailboxes ----

export interface MailboxRow {
  mailboxAccountId: string;
  senderIdentity: string;
  user: string;
  domain: string;
  provider: string;
  campaignCount: number;
  outboundCount: number;
  lastSentAt: string | null;
}

export interface CampaignMailboxSummary {
  campaignId: string;
  mailboxes: MailboxRow[];
  consistency: {
    consistent: boolean;
    mailboxAccountCount: number;
    senderIdentityCount: number;
    recommendedMailboxAccountId: string | null;
    recommendedSenderIdentity: string | null;
  };
}

export async function fetchMailboxes(): Promise<MailboxRow[]> {
  return fetchJson<MailboxRow[]>('/mailboxes');
}

export async function fetchCampaignMailboxSummary(campaignId: string): Promise<CampaignMailboxSummary> {
  return fetchJson<CampaignMailboxSummary>(`/campaigns/${campaignId}/mailbox-summary`);
}

// ---- Mailbox Assignment (planned sender set) ----

export interface MailboxAssignmentRow {
  id: string;
  mailboxAccountId: string;
  senderIdentity: string;
  user: string;
  domain: string;
  provider: string;
  source: string | null;
  assignedAt: string;
  metadata: unknown;
}

export interface CampaignMailboxAssignment {
  campaignId: string;
  assignments: MailboxAssignmentRow[];
  summary: {
    assignmentCount: number;
    mailboxAccountCount: number;
    senderIdentityCount: number;
    domainCount: number;
    domains: string[];
  };
}

export async function fetchCampaignMailboxAssignment(campaignId: string): Promise<CampaignMailboxAssignment> {
  return fetchJson<CampaignMailboxAssignment>(`/campaigns/${campaignId}/mailbox-assignment`);
}

// ---- Campaign Send Preflight ----

export interface CampaignSendPreflightBlocker {
  code: string;
  message: string;
}

export interface CampaignSendPreflightView {
  campaign: { id: string; name: string; status: string };
  readyToSend: boolean;
  blockers: CampaignSendPreflightBlocker[];
  summary: {
    mailboxAssignmentCount: number;
    draftCount: number;
    approvedDraftCount: number;
    generatedDraftCount: number;
    rejectedDraftCount: number;
    sentDraftCount: number;
    sendableApprovedDraftCount: number;
    approvedMissingRecipientEmailCount: number;
    approvedSuppressedContactCount: number;
  };
  senderPlan: {
    assignmentCount: number;
    domains: string[];
  };
}

export async function fetchCampaignSendPreflight(campaignId: string): Promise<CampaignSendPreflightView> {
  return fetchJson<CampaignSendPreflightView>(`/campaigns/${campaignId}/send-preflight`);
}

// ---- Campaign Auto-Send Settings ----

export interface CampaignAutoSendSettingsView {
  campaignId: string;
  campaignName: string;
  campaignStatus: string | null;
  autoSendIntro: boolean;
  autoSendBump: boolean;
  bumpMinDaysSinceIntro: number;
  updatedAt: string | null;
}

export async function fetchCampaignAutoSendSettings(campaignId: string): Promise<CampaignAutoSendSettingsView> {
  return fetchJson<CampaignAutoSendSettingsView>(`/campaigns/${campaignId}/auto-send`);
}

export async function updateCampaignAutoSendSettings(
  campaignId: string,
  settings: {
    autoSendIntro?: boolean;
    autoSendBump?: boolean;
    bumpMinDaysSinceIntro?: number;
  }
): Promise<CampaignAutoSendSettingsView> {
  return fetchJson<CampaignAutoSendSettingsView>(`/campaigns/${campaignId}/auto-send`, {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

// ---- Campaign Attach Companies ----

export interface CampaignAttachCompanyItem {
  companyId: string;
  companyName: string | null;
  status: 'attached' | 'already_present' | 'blocked' | 'invalid';
  insertedContactCount: number;
  alreadyPresentContactCount: number;
  reason: string | null;
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
  items: CampaignAttachCompanyItem[];
}

export async function attachCompaniesToCampaign(
  campaignId: string,
  companyIds: string[],
  source = 'web-ui'
): Promise<CampaignAttachCompaniesResult> {
  return fetchJson<CampaignAttachCompaniesResult>(`/campaigns/${campaignId}/companies/attach`, {
    method: 'POST',
    body: JSON.stringify({ companyIds, attachedBy: 'web-ui', source }),
  });
}

// ---- Campaign Next Wave ----

export interface CampaignNextWavePreviewResult {
  sourceCampaign: { id: string; name: string };
  defaults: {
    targetSegmentId: string;
    targetSegmentVersion: number;
    offerId: string | null;
    icpHypothesisId: string | null;
    sendPolicy: CampaignSendPolicy;
    senderPlanSummary: {
      assignmentCount: number;
      mailboxAccountCount: number;
      senderIdentityCount: number;
      domainCount: number;
      domains: string[];
    };
  };
  summary: {
    candidateContactCount: number;
    eligibleContactCount: number;
    blockedContactCount: number;
  };
  blockedBreakdown: Record<string, number>;
  items: Array<{
    contactId: string;
    companyId: string | null;
    source: 'target_segment' | 'source_manual_attach';
    eligible: boolean;
    blockedReason:
      | 'suppressed_contact'
      | 'already_contacted_recently'
      | 'no_sendable_email'
      | 'already_in_target_wave'
      | 'already_used_in_source_wave'
      | null;
    recipientEmail: string | null;
    recipientEmailSource: 'work' | 'generic' | 'missing';
    exposure_summary: {
      total_exposures: number;
      last_icp_hypothesis_id: string | null;
      last_offer_id: string | null;
      last_offer_title: string | null;
      last_sent_at: string | null;
    };
  }>;
}

export interface CampaignNextWaveCreateResult extends CampaignNextWavePreviewResult {
  campaign: Record<string, any>;
  senderPlan: {
    assignments: MailboxAssignmentRow[];
    summary: CampaignMailboxAssignment['summary'];
  };
  sendPolicy: CampaignSendPolicy;
}

export async function fetchNextWavePreview(campaignId: string): Promise<CampaignNextWavePreviewResult> {
  return fetchJson<CampaignNextWavePreviewResult>(`/campaigns/${campaignId}/next-wave-preview`);
}

export async function createNextWave(input: {
  sourceCampaignId: string;
  name: string;
  createdBy?: string;
  offerId?: string;
  icpHypothesisId?: string;
}): Promise<CampaignNextWaveCreateResult> {
  return fetchJson<CampaignNextWaveCreateResult>('/campaigns/next-wave', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---- Campaign Rotation Preview ----

export interface RotationPreviewCandidate {
  icpHypothesisId: string;
  hypothesisLabel: string | null;
  messagingAngle: string | null;
  offerId: string | null;
  offerTitle: string | null;
  projectName: string | null;
  eligibleContactCount: number;
  blockedContactCount: number;
  blockedBreakdown: Record<string, number>;
}

export interface RotationPreviewResult {
  sourceCampaign: {
    campaignId: string;
    campaignName: string;
    offerId: string | null;
    offerTitle: string | null;
    icpHypothesisId: string | null;
    icpHypothesisLabel: string | null;
    icpProfileId: string | null;
    icpProfileName: string | null;
  };
  summary: {
    sourceContactCount: number;
    candidateCount: number;
    eligibleCandidateContactCount: number;
    blockedCandidateContactCount: number;
  };
  candidates: RotationPreviewCandidate[];
}

export async function fetchRotationPreview(campaignId: string): Promise<RotationPreviewResult> {
  return fetchJson<RotationPreviewResult>(`/campaigns/${campaignId}/rotation-preview`);
}

// ---- Offers ----

export type OfferStatus = 'active' | 'inactive';

export interface OfferRecord {
  id: string;
  title: string;
  project_name: string | null;
  description: string | null;
  status: OfferStatus;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchOffers(opts: { status?: OfferStatus } = {}): Promise<OfferRecord[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  const qs = params.toString();
  return fetchJson<OfferRecord[]>(`/offers${qs ? `?${qs}` : ''}`);
}

export async function createOffer(input: {
  title: string;
  projectName?: string | null;
  description?: string | null;
}): Promise<OfferRecord> {
  return fetchJson<OfferRecord>('/offers', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---- Projects ----

export type ProjectStatus = 'active' | 'inactive';

export interface ProjectRecord {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_at?: string | null;
  updated_at?: string | null;
}

export async function fetchProjects(opts: { status?: ProjectStatus } = {}): Promise<ProjectRecord[]> {
  const params = new URLSearchParams();
  if (opts.status) params.set('status', opts.status);
  const qs = params.toString();
  return fetchJson<ProjectRecord[]>(`/projects${qs ? `?${qs}` : ''}`);
}

export async function createProject(input: {
  key: string;
  name: string;
  description?: string | null;
}): Promise<ProjectRecord> {
  return fetchJson<ProjectRecord>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---- Campaign Send Policy ----

export interface CampaignSendPolicy {
  sendTimezone: string;
  sendWindowStartHour: number;
  sendWindowEndHour: number;
  sendWeekdaysOnly: boolean;
}

export interface CampaignSendPolicyView extends CampaignSendPolicy {
  campaignId: string;
  campaignName: string;
  campaignStatus: string | null;
  updatedAt: string | null;
}

export async function fetchCampaignSendPolicy(campaignId: string): Promise<CampaignSendPolicyView> {
  return fetchJson<CampaignSendPolicyView>(`/campaigns/${campaignId}/send-policy`);
}

export async function updateCampaignSendPolicy(
  campaignId: string,
  policy: Partial<CampaignSendPolicy>
): Promise<CampaignSendPolicyView> {
  return fetchJson<CampaignSendPolicyView>(`/campaigns/${campaignId}/send-policy`, {
    method: 'PUT',
    body: JSON.stringify(policy),
  });
}

// ---- Campaign Launch ----

export interface CampaignLaunchSenderAssignment {
  mailboxAccountId?: string | null;
  senderIdentity: string;
  provider?: string | null;
}

export interface CampaignLaunchPreviewInput {
  name: string;
  segmentId: string;
  segmentVersion?: number;
  snapshotMode?: 'reuse' | 'refresh';
  offerId?: string;
  icpHypothesisId?: string;
  senderPlan?: {
    assignments?: CampaignLaunchSenderAssignment[];
  };
  sendTimezone?: string;
  sendWindowStartHour?: number;
  sendWindowEndHour?: number;
  sendWeekdaysOnly?: boolean;
}

export interface CampaignLaunchPreviewWarning {
  code: string;
  message: string;
}

export interface CampaignLaunchPreviewResult {
  ok: boolean;
  campaign: {
    name: string;
    status: string;
    offerId?: string;
    icpHypothesisId?: string;
  };
  segment: {
    id: string;
    version: number;
    snapshotStatus: 'existing' | 'missing';
  };
  summary: {
    companyCount: number;
    contactCount: number;
    sendableContactCount: number;
    freshCompanyCount: number;
    staleCompanyCount: number;
    missingCompanyCount: number;
    senderAssignmentCount: number;
  };
  senderPlan: {
    assignmentCount: number;
    mailboxAccountCount: number;
    senderIdentityCount: number;
    domainCount: number;
    domains: string[];
  };
  sendPolicy: CampaignSendPolicy;
  warnings: CampaignLaunchPreviewWarning[];
}

export interface CampaignLaunchInput {
  name: string;
  segmentId: string;
  segmentVersion?: number;
  snapshotMode?: 'reuse' | 'refresh';
  projectId?: string;
  offerId?: string;
  icpHypothesisId?: string;
  createdBy?: string;
  senderPlan?: {
    source?: string | null;
    assignments?: CampaignLaunchSenderAssignment[];
  };
  sendTimezone?: string;
  sendWindowStartHour?: number;
  sendWindowEndHour?: number;
  sendWeekdaysOnly?: boolean;
}

export interface CampaignLaunchResult {
  campaign: Record<string, any>;
  segment: {
    id: string;
    version: number;
    snapshot: Record<string, unknown>;
  };
  senderPlan: {
    assignments: MailboxAssignmentRow[];
    summary: CampaignMailboxAssignment['summary'];
  };
  sendPolicy: CampaignSendPolicy;
}

export async function campaignLaunchPreview(input: CampaignLaunchPreviewInput): Promise<CampaignLaunchPreviewResult> {
  return fetchJson<CampaignLaunchPreviewResult>('/campaigns/launch-preview', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function campaignLaunch(input: CampaignLaunchInput): Promise<CampaignLaunchResult> {
  return fetchJson<CampaignLaunchResult>('/campaigns/launch', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function updateCampaignMailboxAssignment(
  campaignId: string,
  payload: {
    assignments: Array<{
      mailboxAccountId: string;
      senderIdentity: string;
      provider?: string;
    }>;
    source?: string;
  }
): Promise<CampaignMailboxAssignment> {
  return fetchJson<CampaignMailboxAssignment>(`/campaigns/${campaignId}/mailbox-assignment`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

// ---- Dashboard ----

export interface DashboardOverview {
  campaigns: {
    total: number;
    active: number;
    byStatus: Array<{ status: string; count: number }>;
  };
  pending: {
    draftsOnReview: number;
    inboxReplies: number;
    staleEnrichment: number;
    missingEnrichment: number;
  };
  recentActivity: Array<{
    kind: string;
    id: string;
    timestamp: string;
    title: string;
    subtitle: string | null;
    campaignId: string | null;
  }>;
}

export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  return fetchJson<DashboardOverview>('/dashboard/overview');
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
  payload: { campaignId: string; smartleadCampaignId: string; batchSize?: number; dryRun?: boolean }
): Promise<any> {
  const body = {
    batchSize: payload.batchSize ?? 10,
    dryRun: payload.dryRun ?? true,
    campaignId: payload.campaignId,
    smartleadCampaignId: payload.smartleadCampaignId,
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

export interface BatchEnrichSegmentResult {
  segmentId: string;
  status: 'completed' | 'queued' | 'error';
  jobId?: string;
  summary?: { processed?: number; dryRun?: boolean; jobId?: string };
  error?: string;
}

export interface BatchEnrichResponse {
  results: BatchEnrichSegmentResult[];
}

export async function batchEnrichSegments(payload: {
  segmentIds: string[];
  adapter?: string;
  runNow?: boolean;
  dryRun?: boolean;
  limit?: number;
}): Promise<BatchEnrichResponse> {
  const res = await fetch(`${baseUrl}/enrich/segments/batch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  // Backend returns 400 when all segments fail but still includes per-segment results
  if (body?.results && Array.isArray(body.results)) {
    return body as BatchEnrichResponse;
  }
  if (!res.ok) {
    throw new Error(body?.error ?? `Batch enrichment failed (${res.status})`);
  }
  return body as BatchEnrichResponse;
}

// ---- Company Import ----

export interface CompanyImportEmployee {
  full_name: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  position?: string | null;
  work_email?: string | null;
  generic_email?: string | null;
  source_service?: string | null;
  processing_status?: string | null;
}

export interface CompanyImportRecord {
  company_name: string;
  tin?: string | null;
  registration_number?: string | null;
  registration_date?: string | null;
  region?: string | null;
  status?: string | null;
  website?: string | null;
  ceo_name?: string | null;
  ceo_position?: string | null;
  primary_email?: string | null;
  employee_count?: number | null;
  source?: string | null;
  segment?: string | null;
  company_description?: string | null;
  office_qualification?: string | null;
  all_company_emails?: string[] | null;
  company_research?: unknown;
  batch_id?: string | null;
  processing_status?: string | null;
  workflow_execution_id?: string | null;
  revenue?: number | null;
  balance?: number | null;
  net_profit_loss?: number | null;
  sme_registry?: string | null;
  employees?: CompanyImportEmployee[];
}

export interface CompanyImportPreviewItem {
  company_name: string;
  tin: string | null;
  action: 'create' | 'update' | 'skip';
  match_field?: 'tin' | 'registration_number' | null;
  office_qualification: string | null;
  warnings: string[];
}

export interface CompanyImportAppliedEntry {
  index: number;
  company_id: string;
  action: 'create' | 'update';
}

export interface CompanyImportResult {
  mode: 'dry-run' | 'apply';
  summary: {
    total_count: number;
    created_count: number;
    updated_count: number;
    skipped_count: number;
    employee_created_count: number;
    employee_updated_count: number;
  };
  items: CompanyImportPreviewItem[];
  applied?: CompanyImportAppliedEntry[];
}

export interface CompanyImportProcessStartResponse {
  jobId: string;
  status: string;
  mode: string;
  totalCompanies: number;
  batchSize: number;
  source: string;
}

export interface CompanyImportProcessCompanyResult {
  companyId: string;
  status: string;
  company_name?: string;
}

export interface CompanyImportProcessStatusResponse {
  jobId: string;
  status: 'created' | 'running' | 'completed' | 'failed';
  mode: string;
  totalCompanies: number;
  batchSize: number;
  source: string;
  processedCompanies?: number;
  completedCompanies?: number;
  failedCompanies?: number;
  skippedCompanies?: number;
  results?: CompanyImportProcessCompanyResult[];
  errors?: Array<{ companyId: string; error: string }>;
}

export async function previewCompanyImport(records: CompanyImportRecord[]): Promise<CompanyImportResult> {
  return fetchJson<CompanyImportResult>('/company-import/preview', {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}

export async function applyCompanyImport(records: CompanyImportRecord[]): Promise<CompanyImportResult> {
  return fetchJson<CompanyImportResult>('/company-import/apply', {
    method: 'POST',
    body: JSON.stringify({ records }),
  });
}

export async function startCompanyImportProcess(
  companyIds: string[],
  mode: string = 'full',
  source: string = 'xlsx-import',
): Promise<CompanyImportProcessStartResponse> {
  return fetchJson<CompanyImportProcessStartResponse>('/company-import/process', {
    method: 'POST',
    body: JSON.stringify({ companyIds, mode, source }),
  });
}

export async function fetchCompanyImportProcessStatus(
  jobId: string,
): Promise<CompanyImportProcessStatusResponse> {
  return fetchJson<CompanyImportProcessStatusResponse>(`/company-import/process/${jobId}`);
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
  offerId?: string;
  segmentId?: string;
  searchConfig?: Record<string, unknown>;
  targetingDefaults?: Record<string, unknown>;
  messagingAngle?: string;
  patternDefaults?: Record<string, unknown>;
  notes?: string;
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
