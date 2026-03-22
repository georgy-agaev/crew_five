import type { LlmModelInfo } from '../services/providers/llmModels.js';
import type { CampaignEventsView } from './campaignEventTypes.js';
import type { CampaignStatus } from '../status.js';
import type { InboxRepliesView } from '../services/campaignEventReadModels.js';
import type {
  DirectoryCompaniesView,
  DirectoryContactsView,
} from '../services/directoryReadModels.js';
import type { EmployeeNameRepairResult } from '../services/employeeNameRepair.js';
import type {
  CampaignMailboxSummary,
  MailboxInventoryItem,
} from '../services/mailboxReadModels.js';
import type {
  CampaignMailboxAssignmentInput,
  CampaignMailboxAssignmentView,
} from '../services/campaignMailboxAssignments.js';
import type {
  CompanyImportProcessRequest,
  CompanyImportProcessStartResult,
  CompanyImportProcessStatusView,
} from '../services/companyImportProcessing.js';
import type { CompanyImportInput, CompanyImportResult } from '../services/companyStore.js';
import type { CampaignLaunchPreviewResult, CampaignLaunchPreviewInput } from '../services/campaignLaunchPreview.js';
import type { CampaignLaunchInput, CampaignLaunchResult } from '../services/campaignLaunch.js';
import type {
  CampaignNextWaveCreateInput,
  CampaignNextWaveCreateResult,
  CampaignNextWavePreviewInput,
  CampaignNextWavePreviewResult,
} from '../services/campaignNextWave.js';
import type {
  CampaignRotationPreviewInput,
  CampaignRotationPreviewResult,
} from '../services/campaignRotation.js';
import type { CampaignAutoSendSweepResult } from '../services/campaignAutoSend.js';
import type {
  CampaignAutoSendSettingsView,
  UpdateCampaignAutoSendSettingsInput,
} from '../services/campaignAutoSendSettings.js';
import type {
  CampaignSendPolicyView,
  CampaignSendPolicyInput,
} from '../services/campaignSendPolicy.js';
import type { CampaignAttachCompaniesResult } from '../services/campaignAttachCompanies.js';
import type { CampaignReadModel } from '../services/campaignDetailReadModel.js';
import type {
  OfferInput,
  OfferRecord,
  OfferStatus,
  OfferUpdateInput,
} from '../services/offers.js';
import type {
  ProjectInput,
  ProjectRecord,
  ProjectStatus,
  ProjectUpdateInput,
} from '../services/projects.js';

export type Campaign = {
  id: string;
  name: string;
  status?: string;
  project_id?: string | null;
  offer_id?: string | null;
  icp_hypothesis_id?: string | null;
  segment_id?: string | null;
  segment_version?: number | null;
};

export type CampaignCompaniesView = {
  campaign: {
    id: string;
    name: string;
    status?: string;
    segment_id: string;
    segment_version: number;
    created_at?: string | null;
    updated_at?: string | null;
  };
  companies: Array<{
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
  }>;
};

export type CampaignOutboundsView = {
  campaign: {
    id: string;
    name: string;
    status?: string;
    segment_id: string;
    segment_version: number;
    created_at?: string | null;
    updated_at?: string | null;
  };
  outbounds: Array<{
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
  }>;
};

export type CampaignAuditView = {
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
};

export type CampaignSendPreflightView = {
  campaign: {
    id: string;
    name: string;
    status?: string;
    segment_id: string;
    segment_version: number;
    created_at?: string | null;
    updated_at?: string | null;
  };
  readyToSend: boolean;
  blockers: Array<{
    code:
      | 'no_sender_assignment'
      | 'draft_not_approved'
      | 'missing_recipient_email'
      | 'suppressed_contact'
      | 'no_sendable_drafts'
      | 'campaign_paused';
    message: string;
  }>;
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
    mailboxAccountCount: number;
    senderIdentityCount: number;
    domainCount: number;
    domains: string[];
  };
};

export type DraftRow = {
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
};

export type DraftSummary = {
  generated: number;
  dryRun: boolean;
  gracefulUsed?: number;
  failed?: number;
  skipped?: number;
  skippedNoEmail?: number;
  error?: string;
};

export type SendSummary = {
  dryRun: boolean;
  campaignId: string;
  smartleadCampaignId: string;
  leadsPrepared: number;
  leadsPushed: number;
  sequencesPrepared: number;
  sequencesSynced: number;
  skippedContactsNoEmail: number;
  timestamp?: string;
};

export type EventRow = { id: string; event_type: string; occurred_at: string };
export type PatternRow = { reply_label: string; count: number };
export type InboxPollRequest = {
  mailboxAccountId?: string;
  lookbackHours?: number;
};
export type InboxPollResult = {
  source: 'outreacher-process-replies';
  requestedAt: string;
  upstreamStatus: number;
  accepted?: boolean;
  processed?: number;
  queued?: boolean;
  mailboxAccountId?: string | null;
  [key: string]: unknown;
};
export type InboxReplyHandledState = {
  id: string;
  handled: boolean;
  handled_at: string | null;
  handled_by: string | null;
};

export type AdapterDeps = {
  listCampaigns: () => Promise<Campaign[]>;
  listProjects?: (options?: { status?: ProjectStatus }) => Promise<ProjectRecord[]>;
  createProject?: (input: ProjectInput) => Promise<ProjectRecord>;
  updateProject?: (projectId: string, input: ProjectUpdateInput) => Promise<ProjectRecord>;
  listOffers?: (options?: { status?: OfferStatus }) => Promise<OfferRecord[]>;
  createOffer?: (input: OfferInput) => Promise<OfferRecord>;
  updateOffer?: (offerId: string, input: OfferUpdateInput) => Promise<OfferRecord>;
  getCampaignStatusTransitions?: (campaignId: string) => Promise<{
    campaignId: string;
    currentStatus: CampaignStatus;
    allowedTransitions: CampaignStatus[];
  }>;
  updateCampaignStatus?: (params: {
    campaignId: string;
    status: CampaignStatus;
  }) => Promise<Record<string, unknown>>;
  listCampaignFollowupCandidates?: (campaignId: string) => Promise<
    Array<{
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
    }>
  >;
  listInboxReplies?: (filters: {
    limit?: number;
    campaignId?: string;
    replyLabel?: string;
    handled?: boolean;
  }) => Promise<InboxRepliesView>;
  markInboxReplyHandled?: (params: {
    replyId: string;
    handledBy?: string;
  }) => Promise<InboxReplyHandledState>;
  markInboxReplyUnhandled?: (replyId: string) => Promise<InboxReplyHandledState>;
  triggerInboxPoll?: (request: InboxPollRequest) => Promise<InboxPollResult>;
  listMailboxes?: () => Promise<MailboxInventoryItem[]>;
  getCampaignMailboxSummary?: (campaignId: string) => Promise<CampaignMailboxSummary>;
  getCampaignMailboxAssignment?: (campaignId: string) => Promise<CampaignMailboxAssignmentView>;
  replaceCampaignMailboxAssignment?: (params: {
    campaignId: string;
    assignments: CampaignMailboxAssignmentInput[];
    source?: string | null;
  }) => Promise<CampaignMailboxAssignmentView>;
  attachCompaniesToCampaign?: (params: {
    campaignId: string;
    companyIds: string[];
    attachedBy?: string | null;
    source?: string | null;
  }) => Promise<CampaignAttachCompaniesResult>;
  getCampaignAutoSendSettings?: (campaignId: string) => Promise<CampaignAutoSendSettingsView>;
  updateCampaignAutoSendSettings?: (
    params: UpdateCampaignAutoSendSettingsInput
  ) => Promise<CampaignAutoSendSettingsView>;
  getCampaignSendPolicy?: (campaignId: string) => Promise<CampaignSendPolicyView>;
  updateCampaignSendPolicy?: (
    params: { campaignId: string } & CampaignSendPolicyInput
  ) => Promise<CampaignSendPolicyView>;
  listCampaignCompanies?: (campaignId: string) => Promise<CampaignCompaniesView>;
  getCampaignReadModel?: (campaignId: string) => Promise<CampaignReadModel>;
  getCampaignAudit?: (campaignId: string) => Promise<CampaignAuditView>;
  getCampaignSendPreflight?: (campaignId: string) => Promise<CampaignSendPreflightView>;
  getCampaignLaunchPreview?: (input: CampaignLaunchPreviewInput) => Promise<CampaignLaunchPreviewResult>;
  launchCampaign?: (input: CampaignLaunchInput) => Promise<CampaignLaunchResult>;
  getCampaignNextWavePreview?: (input: CampaignNextWavePreviewInput) => Promise<CampaignNextWavePreviewResult>;
  createCampaignNextWave?: (input: CampaignNextWaveCreateInput) => Promise<CampaignNextWaveCreateResult>;
  getCampaignRotationPreview?: (input: CampaignRotationPreviewInput) => Promise<CampaignRotationPreviewResult>;
  runCampaignAutoSendSweep?: (params: {
    batchLimit?: number;
  }) => Promise<CampaignAutoSendSweepResult>;
  listCampaignOutbounds?: (campaignId: string) => Promise<CampaignOutboundsView>;
  listCampaignEvents?: (campaignId: string) => Promise<CampaignEventsView>;
  createCampaign?: (input: {
    name: string;
    segmentId: string;
    segmentVersion: number;
    projectId?: string;
    offerId?: string;
    icpHypothesisId?: string;
    createdBy?: string;
  }) => Promise<any>;
  listDrafts: (params: {
    campaignId?: string;
    status?: string;
    includeRecipientContext?: boolean;
  }) => Promise<DraftRow[]>;
  updateDraftStatus?: (params: {
    draftId: string;
    status: string;
    reviewer?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<DraftRow>;
  updateDraftStatuses?: (params: {
    draftIds: string[];
    status: string;
    reviewer?: string;
    metadata?: Record<string, unknown>;
  }) => Promise<{
    updated: DraftRow[];
    summary: {
      totalRequested: number;
      updatedCount: number;
      status: string;
    };
  }>;
  updateDraftContent?: (params: {
    draftId: string;
    subject: string;
    body: string;
  }) => Promise<DraftRow>;
  getEnrichmentSettings?: () => Promise<any>;
  setEnrichmentSettings?: (payload: any) => Promise<any>;
  listSegments?: () => Promise<any[]>;
  createSegment?: (input: {
    name: string;
    locale: string;
    filterDefinition: Record<string, unknown>;
    description?: string;
    createdBy?: string;
  }) => Promise<Record<string, any>>;
  snapshotSegment?: (params: {
    segmentId: string;
    finalize?: boolean;
    allowEmpty?: boolean;
    maxContacts?: number;
  }) => Promise<any>;
  enqueueSegmentEnrichment?: (params: {
    segmentId: string;
    adapter?: string;
    limit?: number;
    dryRun?: boolean;
  }) => Promise<any>;
  runSegmentEnrichmentOnce?: (job: any, options: { dryRun?: boolean }) => Promise<any>;
  getSegmentEnrichmentStatus?: (segmentId: string) => Promise<any>;
  listCompanies?: (params: { segment?: string; limit?: number }) => Promise<any[]>;
  listContacts?: (params: { companyIds?: string[]; limit?: number }) => Promise<any[]>;
  listDirectoryCompanies?: (params: {
    segment?: string;
    enrichmentStatus?: 'fresh' | 'stale' | 'missing';
    query?: string;
    limit?: number;
  }) => Promise<DirectoryCompaniesView>;
  listDirectoryContacts?: (params: {
    companyIds?: string[];
    segment?: string;
    emailStatus?: 'work' | 'generic' | 'missing';
    enrichmentStatus?: 'fresh' | 'stale' | 'missing';
    query?: string;
    limit?: number;
  }) => Promise<DirectoryContactsView>;
  previewEmployeeNameRepairs?: (params: {
    confidence?: 'high' | 'low' | 'all';
  }) => Promise<EmployeeNameRepairResult>;
  applyEmployeeNameRepairs?: (params: {
    confidence?: 'high' | 'low' | 'all';
  }) => Promise<EmployeeNameRepairResult>;
  previewCompanyImport?: (records: CompanyImportInput[]) => Promise<CompanyImportResult>;
  applyCompanyImport?: (records: CompanyImportInput[]) => Promise<CompanyImportResult>;
  startCompanyImportProcess?: (
    request: CompanyImportProcessRequest
  ) => Promise<CompanyImportProcessStartResult>;
  getCompanyImportProcessStatus?: (jobId: string) => Promise<CompanyImportProcessStatusView | null>;
  markDirectoryContactInvalid?: (contactId: string) => Promise<{
    contactId: string;
    processingStatus: string;
    updatedAt: string | null;
  }>;
  deleteDirectoryContact?: (contactId: string) => Promise<{
    contactId: string;
    deleted: true;
  }>;
  markDirectoryCompanyInvalid?: (companyId: string) => Promise<{
    companyId: string;
    processingStatus: string;
    updatedAt: string | null;
  }>;
  deleteDirectoryCompany?: (companyId: string) => Promise<{
    companyId: string;
    deleted: true;
  }>;
  updateDirectoryContact?: (
    contactId: string,
    patch: Record<string, unknown>
  ) => Promise<{
    contactId: string;
    fullName: string | null;
    position: string | null;
    workEmail: string | null;
    genericEmail: string | null;
    processingStatus: string | null;
    updatedAt: string | null;
  }>;
  updateDirectoryCompany?: (
    companyId: string,
    patch: Record<string, unknown>
  ) => Promise<{
    companyId: string;
    companyName: string | null;
    website: string | null;
    segment: string | null;
    status: string | null;
    officeQualification: string | null;
    employeeCount: number | null;
    primaryEmail: string | null;
    companyDescription: string | null;
    region: string | null;
    processingStatus: string | null;
    updatedAt: string | null;
  }>;
  listSmartleadCampaigns?: () => Promise<any[]>;
  smartleadCreateCampaign?: (payload: {
    name: string;
  }) => Promise<{ id: string; name: string; status?: string }>;
  listIcpProfiles?: () => Promise<any[]>;
  createIcpProfile?: (payload: { name: string; projectId?: string; description?: string }) => Promise<any>;
  getIcpProfileLearnings?: (profileId: string) => Promise<{
    profileId: string;
    profileName: string;
    offeringDomain: string | null;
    learnings: string[];
    updatedAt: string | null;
  }>;
  updateIcpProfileLearnings?: (payload: {
    profileId: string;
    learnings: string[];
  }) => Promise<{
    profileId: string;
    profileName: string;
    offeringDomain: string | null;
    learnings: string[];
    updatedAt: string | null;
  }>;
  listIcpOfferingMappings?: () => Promise<Array<{
    profileId: string;
    profileName: string;
    offeringDomain: string | null;
    learningsCount: number;
  }>>;
  listIcpHypotheses?: (params: { icpProfileId?: string; segmentId?: string }) => Promise<any[]>;
  createIcpHypothesis?: (payload: {
    icpProfileId: string;
    hypothesisLabel: string;
    offerId?: string;
    segmentId?: string;
    searchConfig?: Record<string, unknown>;
    targetingDefaults?: Record<string, unknown>;
    messagingAngle?: string;
    patternDefaults?: Record<string, unknown>;
    notes?: string;
  }) => Promise<any>;
  generateDrafts: (payload: {
    campaignId: string;
    dryRun?: boolean;
    limit?: number;
    interactionMode?: 'coach' | 'express';
    dataQualityMode?: 'strict' | 'graceful';
    icpProfileId?: string;
    icpHypothesisId?: string;
    coachPromptStep?: string;
    explicitCoachPromptId?: string;
    provider?: string;
    model?: string;
  }) => Promise<DraftSummary>;
  listLlmModels?: (provider: string) => Promise<LlmModelInfo[]>;
  sendSmartlead: (payload: {
    dryRun?: boolean;
    batchSize?: number;
    campaignId: string;
    smartleadCampaignId: string;
    step?: number;
    variantLabel?: string;
  }) => Promise<SendSummary>;
  listEvents: (params: { since?: string; limit?: number }) => Promise<EventRow[]>;
  listReplyPatterns: (params: { since?: string; topN?: number }) => Promise<PatternRow[]>;
  dashboardOverview?: () => Promise<any>;
  analyticsSummary?: (params: { groupBy?: string; since?: string }) => Promise<any>;
  analyticsRejectionReasons?: (params: { since?: string }) => Promise<any>;
  analyticsOptimize?: (params: { since?: string }) => Promise<any>;
  listPromptRegistry?: () => Promise<any[]>;
  createPromptRegistryEntry?: (payload: Record<string, unknown>) => Promise<any>;
  getActivePromptForStep?: (step: string) => Promise<string | null>;
  setActivePromptForStep?: (step: string, coachPromptId: string) => Promise<void>;
  createSimJobStub?: (payload: {
    mode?: string;
    segmentId?: string | null;
    segmentVersion?: number | null;
    draftIds?: string[];
  }) => Promise<any>;
  generateIcpProfile?: (payload: Record<string, unknown>) => Promise<any>;
  generateIcpHypothesis?: (payload: Record<string, unknown>) => Promise<any>;
  runIcpDiscovery?: (payload: {
    icpProfileId: string;
    icpHypothesisId?: string;
    limit?: number;
  }) => Promise<any>;
  listIcpDiscoveryCandidates?: (filters: {
    runId?: string;
    icpProfileId?: string;
    icpHypothesisId?: string;
  }) => Promise<any[]>;
  promoteIcpDiscoveryCandidates?: (payload: {
    runId: string;
    candidateIds: string[];
    segmentId: string;
  }) => Promise<{ promotedCount: number }>;
  getFilterPreview?: (filterDefinition: unknown) => Promise<{
    companyCount: number;
    employeeCount: number;
    totalCount: number;
  }>;
  aiSuggestFilters?: (request: {
    userDescription: string;
    icpProfileId?: string;
    icpContext?: string;
    maxSuggestions?: number;
  }) => Promise<Array<{ filters: any[]; rationale?: string; targetAudience?: string }>>;
  searchExaWebset?: (request: { description: string; maxResults?: number }) => Promise<{
    companies: any[];
    employees: any[];
    totalResults: number;
    query: string;
  }>;
  saveExaSegment?: (payload: {
    name: string;
    locale: string;
    companies: any[];
    employees: any[];
    query: string;
    description?: string;
  }) => Promise<{
    id: string;
    name: string;
    stats: {
      companiesProcessed: number;
      employeesProcessed: number;
      segmentMembersCreated: number;
    };
  }>;
};

export type DispatchRequest = {
  method: string;
  pathname: string;
  searchParams?: URLSearchParams;
  body?: any;
};

export type MetaStatus = {
  mode: 'live' | 'mock';
  apiBase: string;
  smartleadReady: boolean;
  supabaseReady: boolean;
};

export type DispatchResponse = { status: number; body: unknown };
