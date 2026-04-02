import { loadEnv } from '../config/env.js';
import { AiClient } from '../services/aiClient.js';
import type { ChatClient } from '../services/chatClient.js';
import { resolveModelConfig } from '../config/modelCatalog.js';
import { createIcpHypothesisViaCoach, createIcpProfileViaCoach } from '../services/coach.js';
import {
  createCampaign as createCampaignService,
  getCampaignStatusTransitions as getCampaignStatusTransitionsService,
  listCampaignCompanies as listCampaignCompaniesService,
  listCampaignOutbounds as listCampaignOutboundsService,
} from '../services/campaigns.js';
import { getCampaignAudit as getCampaignAuditService } from '../services/campaignAudit.js';
import { getCampaignReadModel as getCampaignReadModelService } from '../services/campaignDetailReadModel.js';
import { getCampaignSendPreflight as getCampaignSendPreflightService } from '../services/campaignSendPreflight.js';
import { getCampaignLaunchPreview as getCampaignLaunchPreviewService } from '../services/campaignLaunchPreview.js';
import { launchCampaign as launchCampaignService } from '../services/campaignLaunch.js';
import {
  createCampaignNextWave as createCampaignNextWaveService,
  getCampaignNextWavePreview as getCampaignNextWavePreviewService,
} from '../services/campaignNextWave.js';
import { getCampaignRotationPreview as getCampaignRotationPreviewService } from '../services/campaignRotation.js';
import {
  listDirectoryCompanies as listDirectoryCompaniesService,
  listDirectoryContacts as listDirectoryContactsService,
} from '../services/directoryReadModels.js';
import {
  getCampaignMailboxAssignment as getCampaignMailboxAssignmentService,
  replaceCampaignMailboxAssignment as replaceCampaignMailboxAssignmentService,
} from '../services/campaignMailboxAssignments.js';
import {
  getCampaignAutoSendSettings as getCampaignAutoSendSettingsService,
  updateCampaignAutoSendSettings as updateCampaignAutoSendSettingsService,
} from '../services/campaignAutoSendSettings.js';
import {
  getCampaignSendPolicy as getCampaignSendPolicyService,
  updateCampaignSendPolicy as updateCampaignSendPolicyService,
} from '../services/campaignSendPolicy.js';
import {
  createOffer as createOfferService,
  listOffers as listOffersService,
  updateOffer as updateOfferService,
} from '../services/offers.js';
import {
  createProject as createProjectService,
  listProjects as listProjectsService,
  updateProject as updateProjectService,
} from '../services/projects.js';
import {
  applyCompanyImport as applyCompanyImportService,
  previewCompanyImport as previewCompanyImportService,
} from '../services/companyStore.js';
import { attachCompaniesToCampaign as attachCompaniesToCampaignService } from '../services/campaignAttachCompanies.js';
import {
  getCompanyImportProcessStatus as getCompanyImportProcessStatusService,
  startCompanyImportProcess as startCompanyImportProcessService,
} from '../services/companyImportProcessing.js';
import {
  deleteDirectoryContact as deleteDirectoryContactService,
  markDirectoryContactInvalid as markDirectoryContactInvalidService,
} from '../services/directoryContactMutations.js';
import {
  deleteDirectoryCompany as deleteDirectoryCompanyService,
  markDirectoryCompanyInvalid as markDirectoryCompanyInvalidService,
} from '../services/directoryCompanyMutations.js';
import {
  updateDirectoryCompany as updateDirectoryCompanyService,
  updateDirectoryContact as updateDirectoryContactService,
} from '../services/directoryEntityUpdates.js';
import {
  applyEmployeeNameRepairs as applyEmployeeNameRepairsService,
  previewEmployeeNameRepairs as previewEmployeeNameRepairsService,
} from '../services/employeeNameRepair.js';
import {
  loadDrafts as loadDraftsService,
  updateDraftStatus as updateDraftStatusService,
  updateDraftStatuses as updateDraftStatusesService,
  updateDraftContent as updateDraftContentService,
} from '../services/draftStore.js';
import { getReplyPatterns } from '../services/emailEvents.js';
import { processReplies as processRepliesService } from '../services/processReplies.js';
import {
  markInboxReplyHandled as markInboxReplyHandledService,
  markInboxReplyUnhandled as markInboxReplyUnhandledService,
} from '../services/inboxReplyHandling.js';
import { enqueueSegmentEnrichment, getSegmentEnrichmentStatus, runSegmentEnrichmentOnce } from '../services/enrichSegment.js';
import { getEnrichmentSettings as getEnrichmentSettingsService, setEnrichmentSettings as setEnrichmentSettingsService, type EnrichmentProviderId } from '../services/enrichmentSettings.js';
import { getFilterPreviewCounts } from '../services/filterPreview.js';
import { createIcpHypothesis, createIcpProfile } from '../services/icp.js';
import {
  getIcpProfileLearnings as getIcpProfileLearningsService,
  listIcpOfferingMappings as listIcpOfferingMappingsService,
  updateIcpProfileLearnings as updateIcpProfileLearningsService,
} from '../services/icp.js';
import { listIcpDiscoveryCandidates, promoteIcpDiscoveryCandidatesToSegment, runIcpDiscoveryWithExa } from '../services/icpDiscovery.js';
import { generateSegmentFiltersViaCoach } from '../services/icpCoach.js';
import {
  getAnalyticsByIcpAndHypothesis,
  getAnalyticsByOffer,
  getAnalyticsByOffering,
  getAnalyticsByPatternAndUserEdit,
  getAnalyticsByRejectionReason,
  getAnalyticsBySegmentAndRole,
  getDraftRejectionAnalyticsBreakdown,
  getSimJobSummaryForAnalytics,
  suggestPromptPatternAdjustments,
} from '../services/analytics.js';
import { runCampaignAutoSendSweep as runCampaignAutoSendSweepService } from '../services/campaignAutoSend.js';
import { executeCampaignSendRun as executeCampaignSendRunService } from '../services/campaignSendExecution.js';
import { getDashboardOverview as getDashboardOverviewService } from '../services/dashboardOverview.js';
import {
  listCampaignEvents as listCampaignEventsService,
  listInboxReplies as listInboxRepliesService,
} from '../services/campaignEventReadModels.js';
import { listCampaignFollowupCandidates as listCampaignFollowupCandidatesService } from '../services/campaignFollowupCandidates.js';
import {
  getCampaignMailboxSummary as getCampaignMailboxSummaryService,
  listMailboxes as listMailboxesService,
} from '../services/mailboxReadModels.js';
import { getActivePromptForStep as getActivePromptForStepService, setActivePromptForStep as setActivePromptForStepService } from '../services/promptRegistry.js';
import { listLlmModels as listLlmModelsService } from '../services/providers/llmModels.js';
import { buildChatClientForModel } from '../services/providers/buildChatClient.js';
import { completeSimAsNotImplemented, createSimRequest } from '../services/sim.js';
import { getSegmentById, listSegmentsWithCounts, createSegment } from '../services/segments.js';
import { ensureSegmentSnapshot } from '../services/segmentSnapshotWorkflow.js';
import { buildExaClientFromEnv } from '../integrations/exa.js';
import type { SmartleadMcpClient } from '../integrations/smartleadMcp.js';
import { smartleadSendCommand } from '../commands/smartleadSend.js';
import { campaignStatusHandler } from '../commands/campaignStatus.js';
import { initSupabaseClient } from '../services/supabaseClient.js';
import { toDraftView } from './draftView.js';
import { createAiClient } from './liveDeps/chatClient.js';
import {
  isProcessCompaniesTriggerConfigured,
  triggerProcessCompanies,
} from './liveDeps/processCompaniesTrigger.js';
import {
  isGenerateDraftsTriggerConfigured,
  triggerGenerateDrafts,
} from './liveDeps/generateDraftsTrigger.js';
import {
  isGenerateBumpsTriggerConfigured,
  triggerGenerateBumps,
} from './liveDeps/generateBumpsTrigger.js';
import {
  isProcessRepliesTriggerConfigured,
  triggerProcessReplies,
} from './liveDeps/processRepliesTrigger.js';
import {
  isSendCampaignTriggerConfigured,
  triggerSendCampaign,
} from './liveDeps/sendCampaignTrigger.js';
import {
  closeSharedImapMcpSendTransport,
  getSharedImapMcpSendTransport,
  isImapMcpSendConfigured,
} from './liveDeps/imapMcpSendTransport.js';
import {
  getSharedImapMcpInboxTransport,
  isImapMcpInboxConfigured,
} from './liveDeps/imapMcpInboxTransport.js';
import { probeEnrichmentProvider } from './liveDeps/providerProbe.js';
import { ensurePromptRegistryColumns, getPromptRegistryColumnSupport } from './liveDeps/promptRegistrySupport.js';
import { saveExaSegmentToSupabase } from './liveDeps/saveExaSegment.js';
import { buildSmartleadClientFromEnv } from './smartlead.js';
import type { AdapterDeps, Campaign, EventRow } from './types.js';

// Direct transport operational logs are intentional; without them send-path diagnosis is too opaque in live mode.
/* eslint-disable-next-line security-node/detect-crlf */
const logSendExecution = (message: string) => console.log(message);

export function createLiveDeps(
  opts: { supabase?: any; aiClient?: AiClient; smartlead?: SmartleadMcpClient; chatClient?: ChatClient } = {}
): AdapterDeps {
  const env = loadEnv();
  const supabase = opts.supabase ?? initSupabaseClient(env);
  const { chatClient } = createAiClient(opts.chatClient, opts.aiClient);
  const exaClient = process.env.EXA_API_KEY ? (() => { try { return buildExaClientFromEnv(); } catch { return null; } })() : null;
  const smartlead = opts.smartlead ?? buildSmartleadClientFromEnv();
  const readyProviders = new Set<EnrichmentProviderId>(['mock']);
  if (process.env.EXA_API_KEY) readyProviders.add('exa');
  if (process.env.PARALLEL_API_KEY) readyProviders.add('parallel');
  if (process.env.FIRECRAWL_API_KEY) readyProviders.add('firecrawl');
  if (process.env.ANYSITE_API_KEY) readyProviders.add('anysite');
  const sendCampaignTriggerConfigured = isSendCampaignTriggerConfigured();
  const generateDraftsTriggerConfigured = isGenerateDraftsTriggerConfigured();
  const generateBumpsTriggerConfigured = isGenerateBumpsTriggerConfigured();
  const directImapMcpSendConfigured = isImapMcpSendConfigured();
  const processRepliesTriggerConfigured = isProcessRepliesTriggerConfigured();
  const directImapMcpInboxConfigured = isImapMcpInboxConfigured();
  const executeCampaignSend = async (request: {
    campaignId: string;
    reason?: 'auto_send_intro' | 'auto_send_bump' | 'auto_send_mixed';
    batchLimit?: number;
  }) => {
    if (directImapMcpSendConfigured) {
      const transport = await getSharedImapMcpSendTransport();
      const result = (await executeCampaignSendRunService(supabase, transport, {
          campaignId: request.campaignId,
          reason: request.reason ?? 'auto_send_mixed',
          batchLimit: request.batchLimit,
        })) as unknown as Record<string, unknown>;
      const sentCount =
        typeof result.sentCount === 'number'
          ? result.sentCount
          : typeof result.triggered === 'number'
            ? result.triggered
            : 0;
      const selectedCount = typeof result.selectedCount === 'number' ? result.selectedCount : sentCount;
      const failedCount = typeof result.failedCount === 'number' ? result.failedCount : 0;
      const skippedCount = typeof result.skippedCount === 'number' ? result.skippedCount : 0;
      logSendExecution(
        `[web adapter] direct send execution completed (campaign=${request.campaignId}, reason=${request.reason ?? 'auto_send_mixed'}, selected=${selectedCount}, sent=${sentCount}, failed=${failedCount}, skipped=${skippedCount})`
      );
      return result;
    }

    logSendExecution(
      `[web adapter] falling back to Outreach send bridge (campaign=${request.campaignId}, reason=${request.reason ?? 'auto_send_mixed'})`
    );
    return triggerSendCampaign({
      campaignId: request.campaignId,
      reason: request.reason ?? 'auto_send_mixed',
      batchLimit: request.batchLimit,
    });
  };
  const executeInboxPoll = async (request: {
    mailboxAccountId?: string;
    lookbackHours?: number;
  }) => {
    if (directImapMcpInboxConfigured) {
      const transport = await getSharedImapMcpInboxTransport();
      const result = await processRepliesService(supabase, transport, request);
      logSendExecution(
        `[web adapter] direct process-replies completed (accounts=${result.polledAccounts}, processed=${result.processed}, ingested=${result.ingested}, skipped=${result.skipped}, failed=${result.failed})`
      );
      if (result.failed > 0 && Array.isArray(result.errors) && result.errors.length > 0) {
        const sample = result.errors.slice(0, 3).join('; ');
        logSendExecution(
          `[web adapter] direct process-replies errors (showing ${Math.min(3, result.errors.length)}/${result.errors.length}): ${sample}`
        );
      }
      return result;
    }

    logSendExecution('[web adapter] falling back to Outreach process-replies bridge');
    return triggerProcessReplies(request);
  };

  return {
    listProjects: async (options) => listProjectsService(supabase, options),
    createProject: async (input) => createProjectService(supabase, input),
    updateProject: async (projectId, input) => updateProjectService(supabase, projectId, input),
    listOffers: async (options) => listOffersService(supabase, options),
    createOffer: async (input) => createOfferService(supabase, input),
    updateOffer: async (offerId, input) => updateOfferService(supabase, offerId, input),
    getEnrichmentSettings: async () => getEnrichmentSettingsService(supabase, readyProviders),
    setEnrichmentSettings: async (payload) => setEnrichmentSettingsService(supabase, payload, readyProviders, probeEnrichmentProvider),
    listCampaigns: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('id,name,status,project_id,offer_id,icp_hypothesis_id,segment_id,segment_version');
      if (error) throw error;
      return data as Campaign[];
    },
    getCampaignStatusTransitions: async (campaignId) => getCampaignStatusTransitionsService(supabase, campaignId),
    updateCampaignStatus: async ({ campaignId, status }) => campaignStatusHandler(supabase, { campaignId, status }),
    listCampaignFollowupCandidates: async (campaignId) =>
      listCampaignFollowupCandidatesService(supabase, campaignId),
    listMailboxes: async () => listMailboxesService(supabase),
    getCampaignMailboxSummary: async (campaignId) =>
      getCampaignMailboxSummaryService(supabase, campaignId),
    getCampaignMailboxAssignment: async (campaignId) =>
      getCampaignMailboxAssignmentService(supabase, campaignId),
    replaceCampaignMailboxAssignment: async ({ campaignId, assignments, source }) =>
      replaceCampaignMailboxAssignmentService(supabase, { campaignId, assignments, source }),
    attachCompaniesToCampaign: async ({ campaignId, companyIds, attachedBy, source }) =>
      attachCompaniesToCampaignService(supabase, { campaignId, companyIds, attachedBy, source }),
    getCampaignAutoSendSettings: async (campaignId) =>
      getCampaignAutoSendSettingsService(supabase, campaignId),
    updateCampaignAutoSendSettings: async (params) =>
      updateCampaignAutoSendSettingsService(supabase, params),
    getCampaignSendPolicy: async (campaignId) =>
      getCampaignSendPolicyService(supabase, campaignId),
    updateCampaignSendPolicy: async (params) =>
      updateCampaignSendPolicyService(supabase, params),
    listCampaignCompanies: async (campaignId) => listCampaignCompaniesService(supabase, campaignId),
    getCampaignReadModel: async (campaignId) => getCampaignReadModelService(supabase, campaignId),
    getCampaignAudit: async (campaignId) => getCampaignAuditService(supabase, campaignId),
    getCampaignSendPreflight: async (campaignId) => getCampaignSendPreflightService(supabase, campaignId),
    ...(directImapMcpSendConfigured || sendCampaignTriggerConfigured
      ? {
          executeCampaignSend,
        }
      : {}),
    getCampaignLaunchPreview: async (input) => getCampaignLaunchPreviewService(supabase, input),
    launchCampaign: async (input) => launchCampaignService(supabase, input),
    getCampaignNextWavePreview: async (input) => getCampaignNextWavePreviewService(supabase, input),
    createCampaignNextWave: async (input) => createCampaignNextWaveService(supabase, input),
    getCampaignRotationPreview: async (input) => getCampaignRotationPreviewService(supabase, input),
    ...(directImapMcpSendConfigured || sendCampaignTriggerConfigured
      ? {
          runCampaignAutoSendSweep: async ({ batchLimit }: { batchLimit?: number }) =>
            runCampaignAutoSendSweepService(supabase, {
              batchLimit,
              ...(generateBumpsTriggerConfigured
                ? {
                    triggerGenerateBumps,
                  }
                : {}),
              ...(directImapMcpSendConfigured
                ? {
                  executeSendCampaign: async (request) => {
                      return executeCampaignSend(request);
                    },
                  }
                : {
                    triggerSendCampaign,
                  }),
            }),
        }
      : {}),
    listCampaignOutbounds: async (campaignId) => listCampaignOutboundsService(supabase, campaignId),
    listCampaignEvents: async (campaignId) => listCampaignEventsService(supabase, campaignId),
    createCampaign: async ({ name, segmentId, segmentVersion, projectId, offerId, icpHypothesisId, createdBy }) =>
      createCampaignService(supabase, {
        name,
        segmentId,
        segmentVersion,
        projectId,
        offerId,
        icpHypothesisId,
        createdBy,
      }),
    listDrafts: async ({ campaignId, status, includeRecipientContext }) => {
      if (!campaignId) return [];
      const rows = await loadDraftsService(supabase, { campaignId, status: status as any, includeRecipientContext });
      return rows.map((row: any) => toDraftView(row));
    },
    updateDraftStatus: async ({ draftId, status, reviewer, metadata }) => toDraftView(await updateDraftStatusService(supabase, { draftId, status: status as any, reviewer, metadata })),
    updateDraftStatuses: async ({ draftIds, status, reviewer, metadata }) => {
      const result = await updateDraftStatusesService(supabase, {
        draftIds,
        status: status as any,
        reviewer,
        metadata,
      });
      return {
        updated: result.updated.map((row: any) => toDraftView(row)),
        summary: result.summary,
      };
    },
    updateDraftContent: async ({ draftId, subject, body }) => toDraftView(await updateDraftContentService(supabase, { draftId, subject, body })),
    listSegments: async () => listSegmentsWithCounts(supabase),
    createSegment: async (input) => createSegment(supabase, input),
    snapshotSegment: async ({ segmentId, finalize = true, allowEmpty, maxContacts }) => {
      const segment = await getSegmentById(supabase, segmentId);
      return ensureSegmentSnapshot(supabase, { segmentId, mode: 'refresh', bumpVersion: finalize && ((segment.version ?? 0) < 1), allowEmpty, maxContacts, forceVersion: finalize });
    },
    enqueueSegmentEnrichment: async ({ segmentId, adapter, limit, dryRun }) => enqueueSegmentEnrichment(supabase, { segmentId, adapter: adapter ?? 'mock', limit, dryRun }),
    runSegmentEnrichmentOnce: async (job, { dryRun }) => runSegmentEnrichmentOnce(supabase, job, { dryRun }),
    getSegmentEnrichmentStatus: async (segmentId) => getSegmentEnrichmentStatus(supabase, segmentId),
    listIcpProfiles: async () => {
      const { data, error } = await supabase.from('icp_profiles').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    createIcpProfile: async ({ name, projectId, description }) =>
      createIcpProfile(supabase, { name, projectId, description }),
    getIcpProfileLearnings: async (profileId) => getIcpProfileLearningsService(supabase, profileId),
    updateIcpProfileLearnings: async ({ profileId, learnings }) =>
      updateIcpProfileLearningsService(supabase, { profileId, learnings }),
    listIcpOfferingMappings: async () => listIcpOfferingMappingsService(supabase),
    listIcpHypotheses: async ({ icpProfileId }) => {
      let query = supabase.from('icp_hypotheses').select('*').order('created_at', { ascending: false });
      if (icpProfileId) query = query.eq('icp_id', icpProfileId);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    createIcpHypothesis: async ({
      icpProfileId,
      hypothesisLabel,
      offerId,
      segmentId,
      searchConfig,
      targetingDefaults,
      messagingAngle,
      patternDefaults,
      notes,
    }) =>
      createIcpHypothesis(supabase, {
        icpProfileId,
        hypothesisLabel,
        offerId,
        segmentId,
        searchConfig,
        targetingDefaults,
        messagingAngle,
        patternDefaults,
        notes,
      }),
    generateDrafts: async ({ campaignId, dryRun, limit, interactionMode, dataQualityMode, icpProfileId, icpHypothesisId, coachPromptStep, explicitCoachPromptId, provider, model }) => {
      if (!generateDraftsTriggerConfigured) {
        throw new Error('Outreach generate-drafts command is not configured (set OUTREACH_GENERATE_DRAFTS_CMD)');
      }
      return triggerGenerateDrafts({
        campaignId,
        dryRun,
        limit,
        interactionMode,
        dataQualityMode,
        icpProfileId,
        icpHypothesisId,
        coachPromptStep,
        explicitCoachPromptId,
        provider,
        model,
      });
    },
    sendSmartlead: async ({ dryRun, batchSize, campaignId, smartleadCampaignId, step, variantLabel }) => smartleadSendCommand(smartlead, supabase, { dryRun, batchSize, campaignId, smartleadCampaignId, step, variantLabel }),
    listEvents: async ({ since, limit }) => {
      let query = supabase.from('email_events').select('id,event_type,occurred_at').order('occurred_at', { ascending: false });
      if (since) query = query.gte('occurred_at', since);
      if (limit) query = query.limit(limit);
      const { data, error } = await query;
      if (error) throw error;
      return data as EventRow[];
    },
    listReplyPatterns: async ({ since, topN }) => getReplyPatterns(supabase, { since, topN }),
    listInboxReplies: async ({ campaignId, replyLabel, category, handled, limit, linkage }) =>
      listInboxRepliesService(supabase, { campaignId, replyLabel, category, handled, limit, linkage }),
    markInboxReplyHandled: async ({ replyId, handledBy }) =>
      markInboxReplyHandledService(supabase, { replyId, handledBy }),
    markInboxReplyUnhandled: async (replyId) =>
      markInboxReplyUnhandledService(supabase, replyId),
    triggerInboxPoll: directImapMcpInboxConfigured || processRepliesTriggerConfigured
      ? async (request) => executeInboxPoll(request)
      : undefined,
    dashboardOverview: async () => getDashboardOverviewService(supabase),
    analyticsSummary: async ({ groupBy, since }) =>
      groupBy === 'segment'
        ? getAnalyticsBySegmentAndRole(supabase, { since })
        : groupBy === 'pattern'
          ? getAnalyticsByPatternAndUserEdit(supabase, { since })
          : groupBy === 'rejection_reason'
            ? getAnalyticsByRejectionReason(supabase, { since })
            : groupBy === 'offer'
              ? getAnalyticsByOffer(supabase, { since })
            : groupBy === 'offering'
              ? getAnalyticsByOffering(supabase, { since })
              : getAnalyticsByIcpAndHypothesis(supabase, { since }),
    analyticsRejectionReasons: async ({ since }) => getDraftRejectionAnalyticsBreakdown(supabase, { since }),
    analyticsOptimize: async ({ since }) => ({ suggestions: await suggestPromptPatternAdjustments(supabase, { since }), simSummary: await getSimJobSummaryForAnalytics(supabase) }),
    listLlmModels: async (provider) => {
      if (provider !== 'openai' && provider !== 'anthropic') throw new Error(`Unsupported LLM provider: ${provider}`);
      return listLlmModelsService(provider as 'openai' | 'anthropic');
    },
    listPromptRegistry: async () => {
      const { data, error } = await supabase.from('prompt_registry').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
    getActivePromptForStep: async (step) => getActivePromptForStepService(supabase, step),
    setActivePromptForStep: async (step, coachPromptId) => setActivePromptForStepService(supabase, step, coachPromptId),
    createPromptRegistryEntry: async (payload) => {
      await ensurePromptRegistryColumns(supabase);
      const support = getPromptRegistryColumnSupport();
      const attemptInsert = async (overrideRolloutStatus?: string) => {
        const entryPayload: Record<string, unknown> = {
          coach_prompt_id: payload.coach_prompt_id ?? payload.id ?? undefined,
          description: payload.description ?? null,
          version: payload.version ?? null,
          rollout_status: overrideRolloutStatus ?? ((payload.rollout_status as string | undefined) ?? null),
          ...(support.hasStep ? { step: payload.step ?? null } : {}),
          ...(support.hasPromptText ? { prompt_text: payload.prompt_text ?? null } : {}),
        };
        const { data, error } = await supabase.from('prompt_registry').insert([entryPayload]).select().single();
        if (error) throw error;
        if (!data) throw new Error('Failed to insert prompt registry entry');
        return data;
      };
      try {
        return await attemptInsert();
      } catch (err: unknown) {
        const msg = String(err instanceof Error ? err.message : '').toLowerCase();
        let retried = false;
        let overrideRolloutStatus: string | undefined;
        if (support.hasStep && msg.includes("'step' column")) { support.hasStep = false; retried = true; }
        if (support.hasPromptText && msg.includes("'prompt_text' column")) { support.hasPromptText = false; retried = true; }
        if (msg.includes('prompt_registry_rollout_status_check')) {
          const requested = (payload.rollout_status as string | undefined) ?? undefined;
          overrideRolloutStatus = requested === 'retired' ? 'deprecated' : requested === 'pilot' || !requested ? 'active' : 'active';
          retried = true;
        }
        if (retried) return attemptInsert(overrideRolloutStatus);
        throw err;
      }
    },
    createSimJobStub: async (payload) => {
      if (!payload.segmentId && !(Array.isArray(payload.draftIds) && payload.draftIds.length > 0)) {
        throw new Error('segmentId or draftIds is required');
      }
      const job = await createSimRequest(supabase, { mode: (payload.mode as any) ?? 'light_roast', segmentId: payload.segmentId ?? null, segmentVersion: payload.segmentVersion ?? null, draftIds: payload.draftIds ?? [] } as any);
      await completeSimAsNotImplemented(supabase, job.jobId, 'SIM not implemented (coming soon)');
      return { status: 'coming_soon', jobId: job.jobId };
    },
    generateIcpProfile: async (payload) => {
      if (!payload.name) throw new Error('name is required');
      let coachClient: ChatClient = chatClient;
      if (payload.provider || payload.model) {
        coachClient = buildChatClientForModel(resolveModelConfig({ provider: payload.provider as string | undefined, model: payload.model as string | undefined, task: 'icp' }) as any);
      }
      const { jobId, profile } = await createIcpProfileViaCoach(supabase, coachClient, { name: payload.name as string, description: payload.description as string | undefined, websiteUrl: payload.websiteUrl as string | undefined, valueProp: payload.valueProp as string | undefined, ...(payload.promptId ? { promptId: payload.promptId as string } : {}) });
      return { jobId, profile };
    },
    generateIcpHypothesis: async (payload) => {
      if (!payload.icpProfileId) throw new Error('icpProfileId is required');
      let coachClient: ChatClient = chatClient;
      if (payload.provider || payload.model) {
        coachClient = buildChatClientForModel(resolveModelConfig({ provider: payload.provider as string | undefined, model: payload.model as string | undefined, task: 'hypothesis' }) as any);
      }
      const { jobId, hypothesis } = await createIcpHypothesisViaCoach(supabase, coachClient, { icpProfileId: payload.icpProfileId as string, icpDescription: payload.icpDescription as string | undefined, ...(payload.promptId ? { promptId: payload.promptId as string } : {}) });
      return { jobId, hypothesis };
    },
    listSmartleadCampaigns: async () => {
      const campaigns = (await smartlead.listCampaigns({ dryRun: false })).campaigns;
      const allowed = new Set(['active', 'ready', 'paused', 'stopped', 'completed']);
      return campaigns.filter((campaign: any) => {
        const status = (campaign.status ?? '').toLowerCase();
        return !status || (status !== 'archived' && allowed.has(status));
      }).slice(0, 50).map((campaign: any) => ({ id: String(campaign.id), name: campaign.name ?? `Campaign ${campaign.id}`, status: campaign.status ?? 'active' }));
    },
    smartleadCreateCampaign: async ({ name }) => {
      if (!smartlead.createCampaign) throw new Error('Smartlead create not supported');
      return smartlead.createCampaign({ name });
    },
    listCompanies: async ({ segment, limit }) => {
      let query = supabase.from('companies').select('id,company_name,segment,office_qualification,registration_date,status,created_at').order('created_at', { ascending: false }).limit(limit ?? 5000);
      if (segment) query = query.eq('segment', segment);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    listContacts: async ({ companyIds, limit }) => {
      let query = supabase.from('employees').select('id,company_id,full_name,position,work_email,generic_email,company_name').limit(limit ?? 5000);
      if (companyIds?.length) query = query.in('company_id', companyIds);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    listDirectoryCompanies: async ({ segment, enrichmentStatus, query, limit }) =>
      listDirectoryCompaniesService(supabase, {
        segment,
        enrichmentStatus,
        query,
        limit,
      }),
    listDirectoryContacts: async ({ companyIds, segment, emailStatus, enrichmentStatus, query, limit }) =>
      listDirectoryContactsService(supabase, {
        companyIds,
        segment,
        emailStatus,
        enrichmentStatus,
        query,
        limit,
      }),
    previewEmployeeNameRepairs: async ({ confidence }) =>
      previewEmployeeNameRepairsService(supabase, { confidence }),
    applyEmployeeNameRepairs: async ({ confidence }) =>
      applyEmployeeNameRepairsService(supabase, { confidence }),
    previewCompanyImport: async (records) => previewCompanyImportService(supabase, records),
    applyCompanyImport: async (records) => applyCompanyImportService(supabase, records),
    startCompanyImportProcess: isProcessCompaniesTriggerConfigured()
      ? async (request) =>
          startCompanyImportProcessService(supabase, request, triggerProcessCompanies)
      : undefined,
    getCompanyImportProcessStatus: async (jobId) =>
      getCompanyImportProcessStatusService(supabase, jobId),
    markDirectoryContactInvalid: async (contactId) =>
      markDirectoryContactInvalidService(supabase, contactId),
    deleteDirectoryContact: async (contactId) =>
      deleteDirectoryContactService(supabase, contactId),
    markDirectoryCompanyInvalid: async (companyId) =>
      markDirectoryCompanyInvalidService(supabase, companyId),
    deleteDirectoryCompany: async (companyId) =>
      deleteDirectoryCompanyService(supabase, companyId),
    updateDirectoryContact: async (contactId, patch) =>
      updateDirectoryContactService(supabase, contactId, patch),
    updateDirectoryCompany: async (companyId, patch) =>
      updateDirectoryCompanyService(supabase, companyId, patch),
    runIcpDiscovery: exaClient ? async ({ icpProfileId, icpHypothesisId, limit }) => runIcpDiscoveryWithExa(supabase, exaClient, { icpProfileId, icpHypothesisId, limit }) : undefined,
    listIcpDiscoveryCandidates: exaClient ? async ({ runId }) => {
      if (!runId) throw new Error('runId is required');
      return listIcpDiscoveryCandidates(supabase, { runId });
    } : undefined,
    promoteIcpDiscoveryCandidates: exaClient ? async ({ runId, candidateIds, segmentId }) => promoteIcpDiscoveryCandidatesToSegment(supabase, { runId, candidateIds, segmentId }) : undefined,
    getFilterPreview: async (filterDefinition) => getFilterPreviewCounts(supabase, filterDefinition),
    aiSuggestFilters: async (request) => generateSegmentFiltersViaCoach(chatClient, request),
    searchExaWebset: async (request) => {
      console.warn('[EXA] Using mock data - real API integration pending');
      return {
        companies: [
          { name: 'Яндекс', domain: 'yandex.ru', confidenceScore: 0.95, sourceUrl: 'https://yandex.ru' },
          { name: 'Kaspersky', domain: 'kaspersky.com', confidenceScore: 0.92, sourceUrl: 'https://kaspersky.com' },
          { name: 'JetBrains', domain: 'jetbrains.com', confidenceScore: 0.9, sourceUrl: 'https://jetbrains.com' },
        ],
        employees: [
          { name: 'Иван Петров', role: 'CTO', companyName: 'Яндекс', confidenceScore: 0.88, sourceUrl: 'https://linkedin.com/in/example1' },
          { name: 'Мария Иванова', role: 'VP Engineering', companyName: 'Kaspersky', confidenceScore: 0.85, sourceUrl: 'https://linkedin.com/in/example2' },
          { name: 'Алексей Сидоров', role: 'Head of Development', companyName: 'JetBrains', confidenceScore: 0.82, sourceUrl: 'https://linkedin.com/in/example3' },
        ],
        totalResults: 6,
        query: request.description,
      };
    },
    saveExaSegment: async (payload) => saveExaSegmentToSupabase(supabase, payload),
  };
}

export { closeSharedImapMcpSendTransport };
