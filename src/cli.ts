/* eslint-disable security-node/detect-crlf */
import { Command } from 'commander';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { loadEnv } from './config/env.js';
import { campaignCreateHandler } from './commands/campaignCreate';
import { campaignUpdateHandler } from './commands/campaignUpdate';
import { campaignStatusHandler } from './commands/campaignStatus';
import { draftGenerateHandler } from './commands/draftGenerate';
import { smartleadCampaignsListCommand } from './commands/smartleadCampaignsList';
import { smartleadEventsPullCommand } from './commands/smartleadEventsPull';
import { smartleadSendCommand } from './commands/smartleadSend';
import { smartleadLeadsPushCommand } from './commands/smartleadLeadsPush';
import { smartleadSequencesSyncCommand } from './commands/smartleadSequencesSync';
import { enrichCommand } from './commands/enrich';
import { icpCreateCommand } from './commands/icpCreate';
import { icpHypothesisCreateCommand } from './commands/icpHypothesisCreate';
import { icpHypothesisListCommand, icpListCommand } from './commands/icpList';
import {
  formatAnalyticsOutput,
  getAnalyticsByOffer,
  getAnalyticsByHypothesis,
  getAnalyticsByOffering,
  getAnalyticsByIcpAndHypothesis,
  getAnalyticsByRecipientType,
  suggestPromptPatternAdjustments,
  getSimJobSummaryForAnalytics,
  getAnalyticsByRejectionReason,
  getAnalyticsBySenderIdentity,
  getCampaignFunnelAnalytics,
} from './services/analytics';
import { judgeDraftsCommand } from './commands/judgeDrafts';
import { segmentCreateHandler } from './commands/segmentCreate';
import { segmentSnapshotHandler } from './commands/segmentSnapshot';
import { segmentListHandler } from './commands/segmentList';
import { campaignListHandler } from './commands/campaignList';
import { validateFilters } from './filters';
import { emailSendHandler } from './cli-email-send';
import { emailRecordOutboundHandler } from './cli-email-record-outbound';
import { eventIngestHandler } from './cli-event-ingest';
import { buildSmartleadMcpClient, type SmartleadMcpClient } from './integrations/smartleadMcp';
import { AiClient, type EmailDraftRequest } from './services/aiClient';
import { resolveModelConfig } from './config/modelCatalog.js';
import { buildChatClientForModel } from './services/providers/buildChatClient';
import { initSupabaseClient } from './services/supabaseClient';
import type { ChatClient } from './services/chatClient';
import { icpCoachProfileCommand } from './commands/icpCoachProfile';
import { icpCoachHypothesisCommand } from './commands/icpCoachHypothesis';
import { icpDiscoverCommand } from './commands/icpDiscover';
import { draftSaveHandler } from './commands/draftSave';
import { draftLoadHandler } from './commands/draftLoad';
import { draftUpdateStatusHandler } from './commands/draftUpdateStatus';
import { getCampaignAudit as getCampaignAuditService } from './services/campaignAudit.js';
import {
  applyEmployeeNameRepairs as applyEmployeeNameRepairsService,
  previewEmployeeNameRepairs as previewEmployeeNameRepairsService,
  type RepairConfidenceFilter,
} from './services/employeeNameRepair.js';
import {
  applyCompanyImport as applyCompanyImportService,
  previewCompanyImport as previewCompanyImportService,
  type CompanyImportInput,
  saveProcessedCompany as saveProcessedCompanyService,
  type CompanySaveProcessedPayload,
} from './services/companyStore.js';
import {
  attachCompaniesToCampaign as attachCompaniesToCampaignService,
  type AttachCompaniesToCampaignInput,
} from './services/campaignAttachCompanies.js';
import { listCampaignFollowupCandidates as listCampaignFollowupCandidatesService } from './services/campaignFollowupCandidates.js';
import { getCampaignReadModel as getCampaignReadModelService } from './services/campaignDetailReadModel.js';
import { getCampaignSendPreflight as getCampaignSendPreflightService } from './services/campaignSendPreflight.js';
import {
  getCampaignLaunchPreview as getCampaignLaunchPreviewService,
  type CampaignLaunchPreviewInput,
} from './services/campaignLaunchPreview.js';
import {
  launchCampaign as launchCampaignService,
  type CampaignLaunchInput,
} from './services/campaignLaunch.js';
import {
  createCampaignNextWave as createCampaignNextWaveService,
  getCampaignNextWavePreview as getCampaignNextWavePreviewService,
  type CampaignNextWaveCreateInput,
} from './services/campaignNextWave.js';
import { getCampaignRotationPreview as getCampaignRotationPreviewService } from './services/campaignRotation.js';
import {
  getCampaignMailboxAssignment as getCampaignMailboxAssignmentService,
  replaceCampaignMailboxAssignment as replaceCampaignMailboxAssignmentService,
  type CampaignMailboxAssignmentInput,
} from './services/campaignMailboxAssignments.js';
import {
  getCampaignAutoSendSettings as getCampaignAutoSendSettingsService,
  updateCampaignAutoSendSettings as updateCampaignAutoSendSettingsService,
} from './services/campaignAutoSendSettings.js';
import {
  getCampaignSendPolicy as getCampaignSendPolicyService,
  updateCampaignSendPolicy as updateCampaignSendPolicyService,
} from './services/campaignSendPolicy.js';
import {
  createOffer as createOfferService,
  listOffers as listOffersService,
  updateOffer as updateOfferService,
  type OfferStatus,
} from './services/offers.js';
import {
  createProject as createProjectService,
  listProjects as listProjectsService,
  updateProject as updateProjectService,
  type ProjectStatus,
} from './services/projects.js';
import { listLlmModels } from './services/providers/llmModels';

interface CliHandlers {
  segmentCreate: typeof segmentCreateHandler;
  campaignCreate: typeof campaignCreateHandler;
  campaignUpdate: typeof campaignUpdateHandler;
  campaignAudit: typeof getCampaignAuditService;
  campaignSendPreflight: typeof getCampaignSendPreflightService;
  campaignLaunchPreview: typeof getCampaignLaunchPreviewService;
  campaignLaunch: typeof launchCampaignService;
  campaignNextWavePreview: typeof getCampaignNextWavePreviewService;
  campaignNextWaveCreate: typeof createCampaignNextWaveService;
  campaignRotationPreview: typeof getCampaignRotationPreviewService;
  campaignFollowupCandidates: typeof listCampaignFollowupCandidatesService;
  campaignDetailReadModel: typeof getCampaignReadModelService;
  getCampaignMailboxAssignment: typeof getCampaignMailboxAssignmentService;
  replaceCampaignMailboxAssignment: typeof replaceCampaignMailboxAssignmentService;
  campaignAutoSendGet: typeof getCampaignAutoSendSettingsService;
  campaignAutoSendPut: typeof updateCampaignAutoSendSettingsService;
  campaignSendPolicyGet: typeof getCampaignSendPolicyService;
  campaignSendPolicyPut: typeof updateCampaignSendPolicyService;
  projectCreate: typeof createProjectService;
  projectList: typeof listProjectsService;
  projectUpdate: typeof updateProjectService;
  offerCreate: typeof createOfferService;
  offerList: typeof listOffersService;
  offerUpdate: typeof updateOfferService;
  repairEmployeeNames: (
    client: any,
    options: { dryRun: boolean; confidence?: RepairConfidenceFilter }
  ) => Promise<any>;
  companyImport: (client: any, options: { dryRun: boolean; records: CompanyImportInput[] }) => Promise<any>;
  companySaveProcessed: (client: any, payload: CompanySaveProcessedPayload) => Promise<any>;
  campaignAttachCompanies: (client: any, payload: AttachCompaniesToCampaignInput) => Promise<any>;
  draftGenerate: typeof draftGenerateHandler;
  segmentSnapshot: typeof segmentSnapshotHandler;
}

interface CliDependencies {
  supabaseClient: any;
  aiClient: AiClient;
  chatClient?: ChatClient;
  handlers?: Partial<CliHandlers>;
  smartleadClient?: SmartleadMcpClient;
}

const defaultHandlers: CliHandlers = {
  segmentCreate: segmentCreateHandler,
  campaignCreate: campaignCreateHandler,
  campaignUpdate: campaignUpdateHandler,
  campaignAudit: getCampaignAuditService,
  campaignSendPreflight: getCampaignSendPreflightService,
  campaignLaunchPreview: getCampaignLaunchPreviewService,
  campaignLaunch: launchCampaignService,
  campaignNextWavePreview: getCampaignNextWavePreviewService,
  campaignNextWaveCreate: createCampaignNextWaveService,
  campaignRotationPreview: getCampaignRotationPreviewService,
  campaignFollowupCandidates: listCampaignFollowupCandidatesService,
  campaignDetailReadModel: getCampaignReadModelService,
  getCampaignMailboxAssignment: getCampaignMailboxAssignmentService,
  replaceCampaignMailboxAssignment: replaceCampaignMailboxAssignmentService,
  campaignAutoSendGet: getCampaignAutoSendSettingsService,
  campaignAutoSendPut: updateCampaignAutoSendSettingsService,
  campaignSendPolicyGet: getCampaignSendPolicyService,
  campaignSendPolicyPut: updateCampaignSendPolicyService,
  projectCreate: createProjectService,
  projectList: listProjectsService,
  projectUpdate: updateProjectService,
  offerCreate: createOfferService,
  offerList: listOffersService,
  offerUpdate: updateOfferService,
  repairEmployeeNames: async (client, options) =>
    options.dryRun
      ? previewEmployeeNameRepairsService(client, { confidence: options.confidence })
      : applyEmployeeNameRepairsService(client, { confidence: options.confidence }),
  companyImport: async (client, options) =>
    options.dryRun
      ? previewCompanyImportService(client, options.records)
      : applyCompanyImportService(client, options.records),
  companySaveProcessed: saveProcessedCompanyService,
  campaignAttachCompanies: attachCompaniesToCampaignService,
  draftGenerate: draftGenerateHandler,
  segmentSnapshot: segmentSnapshotHandler,
};

interface CliErrorPayload {
  code?: string;
  message: string;
  details?: Record<string, unknown>;
}

function formatCliError(error: unknown): CliErrorPayload {
  if (!error) {
    return { message: 'Unknown error' };
  }

  if (error instanceof Error) {
    const anyErr = error as any;
    const code = typeof anyErr.code === 'string' ? anyErr.code : undefined;
    const details =
      anyErr.details && typeof anyErr.details === 'object' ? (anyErr.details as Record<string, unknown>) : undefined;
    return {
      code,
      message: error.message || 'Error',
      ...(details ? { details } : {}),
    };
  }

  if (typeof error === 'string') {
    return { message: error };
  }

  if (typeof error === 'object') {
    const anyErr = error as any;
    const code = typeof anyErr.code === 'string' ? anyErr.code : undefined;
    const details =
      anyErr.details && typeof anyErr.details === 'object' ? (anyErr.details as Record<string, unknown>) : undefined;
    let message: string;
    if (typeof anyErr.message === 'string' && anyErr.message.length > 0) {
      message = anyErr.message;
    } else {
      try {
        message = JSON.stringify(anyErr);
      } catch {
        message = 'Unknown error';
      }
    }
    return {
      code,
      message,
      ...(details ? { details } : {}),
    };
  }

  return { message: String(error) };
}

function wrapCliAction<T extends (...args: any[]) => any>(fn: T) {
  return async (...args: Parameters<T>) => {
    const options = (args[0] ?? {}) as { errorFormat?: string };
    const errorFormat = options.errorFormat === 'json' ? 'json' : 'text';

    try {
      await fn(...args);
    } catch (error) {
      const payload = formatCliError(error);
      if (errorFormat === 'json') {
        console.error(JSON.stringify({ ok: false, error: payload }));
      } else {
        console.error(payload.message);
      }
      process.exitCode = 1;
    }
  };
}

export function createProgram(deps: CliDependencies) {
  const handlers: CliHandlers = {
    ...defaultHandlers,
    ...deps.handlers,
  } as CliHandlers;

  const emitTelemetry = (event: string, payload: Record<string, unknown>) => {
    // Stub for future observability; no-op for now.
    void event;
    void payload;
  };

  const getSmartleadClient = () => {
    if (deps.smartleadClient) return deps.smartleadClient;
    const url = process.env.SMARTLEAD_API_BASE ?? process.env.SMARTLEAD_MCP_URL;
    const token = process.env.SMARTLEAD_API_KEY ?? process.env.SMARTLEAD_MCP_TOKEN;
    const workspaceId = process.env.SMARTLEAD_WORKSPACE_ID ?? process.env.SMARTLEAD_MCP_WORKSPACE_ID;
    if (!url || !token) {
      const err: any = new Error(
        'Smartlead configuration missing: set SMARTLEAD_API_BASE and SMARTLEAD_API_KEY (or SMARTLEAD_MCP_URL and SMARTLEAD_MCP_TOKEN).'
      );
      err.code = 'SMARTLEAD_CONFIG_MISSING';
      throw err;
    }
    return buildSmartleadMcpClient({ url, token, workspaceId });
  };

  const program = new Command();
  program.name('gtm').description('AI SDR GTM system CLI');

  program
    .command('segment:create')
    .requiredOption('--name <name>')
    .requiredOption('--locale <locale>')
    .requiredOption('--filter <json>', 'JSON filter definition for the segment')
    .option('--description <description>')
    .option('--created-by <createdBy>')
    .action(async (options) => {
      await handlers.segmentCreate(deps.supabaseClient, {
        name: options.name,
        locale: options.locale,
        filter: options.filter,
        description: options.description,
        createdBy: options.createdBy,
      });
    });

  program
    .command('segment:list')
    .option('--icp-profile-id <icpProfileId>', 'Filter by linked ICP profile id')
    .option('--icp-hypothesis-id <icpHypothesisId>', 'Filter by linked ICP hypothesis id')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const rows = await segmentListHandler(deps.supabaseClient, {
          icpProfileId: options.icpProfileId,
          icpHypothesisId: options.icpHypothesisId,
        });
        console.log(JSON.stringify(rows));
      })
    );

  program
    .command('judge:drafts')
    .requiredOption('--campaign-id <campaignId>')
    .option('--dry-run', 'Skip writes, print summary only')
    .option('--limit <limit>', 'Max drafts to judge', '10')
    .action(async (options) => {
      const summary = await judgeDraftsCommand(deps.supabaseClient, {
        campaignId: options.campaignId,
        dryRun: Boolean(options.dryRun),
        limit: options.limit ? Number(options.limit) : undefined,
      });
      console.log(JSON.stringify(summary));
    });

  program
    .command('campaign:list')
    .option('--status <status>', 'Filter by campaign status')
    .option('--segment-id <segmentId>', 'Filter by segment id')
    .option('--icp-profile-id <icpProfileId>', 'Filter campaigns by linked segment ICP profile id')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const rows = await campaignListHandler(deps.supabaseClient, {
          status: options.status,
          segmentId: options.segmentId,
          icpProfileId: options.icpProfileId,
        });
        console.log(JSON.stringify(rows));
      })
    );

  program
    .command('campaign:audit')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to audit')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const audit = await handlers.campaignAudit(deps.supabaseClient, options.campaignId);
        console.log(JSON.stringify(audit));
      })
    );

  program
    .command('campaign:send-preflight')
    .requiredOption('--campaign-id <campaignId>')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const payload = await handlers.campaignSendPreflight(deps.supabaseClient, options.campaignId);
        console.log(JSON.stringify(payload));
      })
    );

  program
    .command('campaign:launch:preview')
    .requiredOption('--payload <json>', 'Launch preview JSON payload')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        let payload: unknown;
        try {
          payload = JSON.parse(options.payload);
        } catch {
          const error: any = new Error('campaign launch preview payload is not valid JSON');
          error.code = 'INVALID_JSON';
          throw error;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          const error: any = new Error('campaign launch preview payload must be a JSON object');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }

        const preview = await handlers.campaignLaunchPreview(
          deps.supabaseClient,
          payload as CampaignLaunchPreviewInput
        );
        console.log(JSON.stringify(preview));
      })
    );

  program
    .command('campaign:launch')
    .requiredOption('--payload <json>', 'Launch JSON payload')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        let payload: unknown;
        try {
          payload = JSON.parse(options.payload);
        } catch {
          const error: any = new Error('campaign launch payload is not valid JSON');
          error.code = 'INVALID_JSON';
          throw error;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          const error: any = new Error('campaign launch payload must be a JSON object');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }

        const result = await handlers.campaignLaunch(
          deps.supabaseClient,
          payload as CampaignLaunchInput
        );
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('campaign:next-wave:preview')
    .requiredOption('--campaign-id <campaignId>', 'Source campaign id')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const result = await handlers.campaignNextWavePreview(deps.supabaseClient, {
          sourceCampaignId: options.campaignId,
        });
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('campaign:next-wave:create')
    .requiredOption('--payload <json>', 'Next-wave create JSON payload')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        let payload: unknown;
        try {
          payload = JSON.parse(options.payload);
        } catch {
          const error: any = new Error('campaign next-wave create payload is not valid JSON');
          error.code = 'INVALID_JSON';
          throw error;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          const error: any = new Error('campaign next-wave create payload must be a JSON object');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }

        const result = await handlers.campaignNextWaveCreate(
          deps.supabaseClient,
          payload as CampaignNextWaveCreateInput
        );
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('campaign:rotation:preview')
    .requiredOption('--campaign-id <campaignId>', 'Source campaign id')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const result = await handlers.campaignRotationPreview(deps.supabaseClient, {
          sourceCampaignId: options.campaignId,
        });
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('campaign:followup-candidates')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to inspect')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const rows = await handlers.campaignFollowupCandidates(deps.supabaseClient, options.campaignId);
        console.log(JSON.stringify(rows));
      })
    );

  program
    .command('campaign:detail')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to inspect')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const detail = await handlers.campaignDetailReadModel(deps.supabaseClient, options.campaignId);
        console.log(JSON.stringify(detail));
      })
    );

  program
    .command('campaign:mailbox-assignment:get')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to inspect')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const assignment = await handlers.getCampaignMailboxAssignment(
          deps.supabaseClient,
          options.campaignId
        );
        console.log(JSON.stringify(assignment));
      })
    );

  program
    .command('campaign:mailbox-assignment:put')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to update')
    .requiredOption('--payload <json>', 'JSON object: { assignments: [...], source?: string }')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        let payload: unknown;
        try {
          payload = JSON.parse(options.payload);
        } catch {
          const error: any = new Error('campaign mailbox assignment payload is not valid JSON');
          error.code = 'INVALID_JSON';
          throw error;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          const error: any = new Error('campaign mailbox assignment payload must be a JSON object');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }

        const assignmentPayload = payload as {
          assignments?: CampaignMailboxAssignmentInput[];
          source?: string | null;
        };
        if (!Array.isArray(assignmentPayload.assignments)) {
          const error: any = new Error('campaign mailbox assignment payload must include assignments[]');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }

        const assignment = await handlers.replaceCampaignMailboxAssignment(
          deps.supabaseClient,
          {
            campaignId: options.campaignId,
            assignments: assignmentPayload.assignments,
            source: assignmentPayload.source ?? null,
          }
        );
        console.log(JSON.stringify(assignment));
      })
    );

  program
    .command('campaign:auto-send:get')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to inspect')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const settings = await handlers.campaignAutoSendGet(deps.supabaseClient, options.campaignId);
        console.log(JSON.stringify(settings));
      })
    );

  program
    .command('campaign:auto-send:put')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to update')
    .requiredOption(
      '--payload <json>',
      'JSON object: { autoSendIntro?: boolean, autoSendBump?: boolean, bumpMinDaysSinceIntro?: number }'
    )
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        let payload: unknown;
        try {
          payload = JSON.parse(options.payload);
        } catch {
          const error: any = new Error('campaign auto-send payload is not valid JSON');
          error.code = 'INVALID_JSON';
          throw error;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          const error: any = new Error('campaign auto-send payload must be a JSON object');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }

        const result = await handlers.campaignAutoSendPut(deps.supabaseClient, {
          campaignId: options.campaignId,
          ...(payload as Record<string, unknown>),
        } as any);
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('campaign:send-policy:get')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to inspect')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const policy = await handlers.campaignSendPolicyGet(
          deps.supabaseClient,
          options.campaignId
        );
        console.log(JSON.stringify(policy));
      })
    );

  program
    .command('campaign:send-policy:put')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to update')
    .requiredOption(
      '--payload <json>',
      'JSON object: { sendTimezone?: string, sendWindowStartHour?: number, sendWindowEndHour?: number, sendWeekdaysOnly?: boolean }'
    )
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        let payload: unknown;
        try {
          payload = JSON.parse(options.payload);
        } catch {
          const error: any = new Error('campaign send policy payload is not valid JSON');
          error.code = 'INVALID_JSON';
          throw error;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          const error: any = new Error('campaign send policy payload must be a JSON object');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }

        const result = await handlers.campaignSendPolicyPut(deps.supabaseClient, {
          campaignId: options.campaignId,
          ...(payload as Record<string, unknown>),
        } as any);
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('employee:repair-names')
    .option('--dry-run', 'Preview fixes without writing changes')
    .option('--confidence <confidence>', 'high|low|all', 'high')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const result = await handlers.repairEmployeeNames(deps.supabaseClient, {
          dryRun: Boolean(options.dryRun),
          confidence: options.confidence as RepairConfidenceFilter | undefined,
        });
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('company:import')
    .requiredOption('--file <file>', 'Path to normalized companies JSON file')
    .option('--dry-run', 'Preview import without writing changes')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        // eslint-disable-next-line security/detect-non-literal-fs-filename -- CLI import intentionally reads a user-specified local JSON file.
        const raw = await readFile(options.file, 'utf8');
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          const error: any = new Error('company import file is not valid JSON');
          error.code = 'INVALID_JSON';
          throw error;
        }
        if (!Array.isArray(parsed)) {
          const error: any = new Error('company import file must contain a JSON array');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }
        const result = await handlers.companyImport(deps.supabaseClient, {
          dryRun: Boolean(options.dryRun),
          records: parsed as CompanyImportInput[],
        });
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('company:save-processed')
    .requiredOption('--payload <json>', 'Processed company JSON payload')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        let payload: unknown;
        try {
          payload = JSON.parse(options.payload);
        } catch {
          const error: any = new Error('company save payload is not valid JSON');
          error.code = 'INVALID_JSON';
          throw error;
        }
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          const error: any = new Error('company save payload must be a JSON object');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }
        const result = await handlers.companySaveProcessed(
          deps.supabaseClient,
          payload as CompanySaveProcessedPayload
        );
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('campaign:create')
    .requiredOption('--name <name>')
    .requiredOption('--segment-id <segmentId>')
    .option('--segment-version <segmentVersion>', undefined)
    .option('--project-id <projectId>')
    .option('--offer-id <offerId>')
    .option('--icp-hypothesis-id <icpHypothesisId>')
    .option('--sender-profile-id <senderProfileId>')
    .option('--prompt-pack-id <promptPackId>')
    .option('--schedule <json>')
    .option('--throttle <json>')
    .option('--created-by <createdBy>')
    .option('--interaction-mode <interactionMode>', 'express')
    .option('--data-quality-mode <dataQualityMode>', 'strict')
    .option('--snapshot-mode <snapshotMode>', 'reuse')
    .option('--bump-segment-version', 'Increment segment version before snapshot')
    .option('--allow-empty', 'Allow zero-contact snapshots')
    .option('--max-contacts <maxContacts>', 'Maximum contacts allowed in a snapshot')
    .option('--force-version', 'Force segment version override when mismatched')
    .option('--dry-run', 'Validate only, do not insert campaign')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        await handlers.campaignCreate(deps.supabaseClient, {
          name: options.name,
          segmentId: options.segmentId,
          segmentVersion: options.segmentVersion ? Number(options.segmentVersion) : undefined,
          projectId: options.projectId,
          offerId: options.offerId,
          icpHypothesisId: options.icpHypothesisId,
          senderProfileId: options.senderProfileId,
          promptPackId: options.promptPackId,
          schedule: options.schedule,
          throttle: options.throttle,
          createdBy: options.createdBy,
          interactionMode: options.interactionMode,
          dataQualityMode: options.dataQualityMode,
          snapshotMode: options.snapshotMode,
          bumpSegmentVersion: Boolean(options.bumpSegmentVersion),
          allowEmpty: Boolean(options.allowEmpty),
          maxContacts: options.maxContacts ? Number(options.maxContacts) : undefined,
          forceVersion: Boolean(options.forceVersion),
          dryRun: Boolean(options.dryRun),
        });
      })
    );

  program
    .command('project:list')
    .option('--status <status>', 'Project status: active|inactive')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const status =
          options.status === undefined ? undefined : (String(options.status) as ProjectStatus);
        const rows = await handlers.projectList(deps.supabaseClient, { status });
        console.log(JSON.stringify(rows));
      })
    );

  program
    .command('project:create')
    .requiredOption('--key <key>')
    .requiredOption('--name <name>')
    .option('--description <description>')
    .option('--status <status>', 'Project status: active|inactive')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const row = await handlers.projectCreate(deps.supabaseClient, {
          key: options.key,
          name: options.name,
          description: options.description,
          ...(options.status !== undefined ? { status: String(options.status) as ProjectStatus } : {}),
        });
        console.log(JSON.stringify(row));
      })
    );

  program
    .command('project:update')
    .requiredOption('--project-id <projectId>')
    .option('--name <name>')
    .option('--description <description>')
    .option('--status <status>', 'Project status: active|inactive')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const row = await handlers.projectUpdate(deps.supabaseClient, options.projectId, {
          ...(options.name !== undefined ? { name: options.name } : {}),
          ...(options.description !== undefined ? { description: options.description } : {}),
          ...(options.status !== undefined ? { status: String(options.status) as ProjectStatus } : {}),
        });
        console.log(JSON.stringify(row));
      })
    );

  program
    .command('offer:list')
    .option('--status <status>', 'Offer status: active|inactive')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const status =
          options.status === undefined ? undefined : (String(options.status) as OfferStatus);
        const rows = await handlers.offerList(deps.supabaseClient, { status });
        console.log(JSON.stringify(rows));
      })
    );

  program
    .command('offer:create')
    .requiredOption('--title <title>')
    .option('--project-id <projectId>')
    .option('--project-name <projectName>')
    .option('--description <description>')
    .option('--status <status>', 'Offer status: active|inactive', 'active')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const row = await handlers.offerCreate(deps.supabaseClient, {
          projectId: options.projectId,
          title: options.title,
          projectName: options.projectName,
          description: options.description,
          status: String(options.status) as OfferStatus,
        });
        console.log(JSON.stringify(row));
      })
    );

  program
    .command('offer:update')
    .requiredOption('--offer-id <offerId>')
    .option('--project-id <projectId>')
    .option('--title <title>')
    .option('--project-name <projectName>')
    .option('--description <description>')
    .option('--status <status>', 'Offer status: active|inactive')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const row = await handlers.offerUpdate(deps.supabaseClient, options.offerId, {
          ...(options.projectId !== undefined ? { projectId: options.projectId } : {}),
          ...(options.title !== undefined ? { title: options.title } : {}),
          ...(options.projectName !== undefined ? { projectName: options.projectName } : {}),
          ...(options.description !== undefined ? { description: options.description } : {}),
          ...(options.status !== undefined ? { status: String(options.status) as OfferStatus } : {}),
        });
        console.log(JSON.stringify(row));
      })
    );

  program
    .command('llm:models')
    .requiredOption('--provider <provider>', 'AI provider: openai|anthropic')
    .action(
      wrapCliAction(async (options: { provider: string }) => {
        const provider = String(options.provider ?? '').toLowerCase();
        const models = await listLlmModels(provider as 'openai' | 'anthropic');
        console.log(JSON.stringify(models));
      })
    );

  program
    .command('draft:generate')
    .requiredOption('--campaign-id <campaignId>')
    .option('--dry-run', 'Validate only, do not insert drafts')
    .option('--fail-fast', 'Abort on first AI error')
    .option('--graceful', 'Enable graceful mode (requires catalog)')
    .option('--preview-graceful', 'Preview how many drafts would use fallbacks')
    .option('--variant <variant>', 'Assign prompt variant label')
    .option('--limit <limit>', 'Max drafts to generate per run')
    .option('--icp-profile-id <icpProfileId>', 'ICP profile id to attach')
    .option('--icp-hypothesis-id <icpHypothesisId>', 'ICP hypothesis id to attach')
    .option('--force-version', 'Allow segment version mismatch when snapshot exists')
    .option('--provider <provider>', 'AI provider: openai|anthropic|gemini')
    .option('--model <model>', 'AI model identifier from the curated catalog')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .option('--trace-file <path>', 'Enable tracing and write traces to file')
    .action(
      wrapCliAction(async (options) => {
        if (options.traceFile) {
          process.env.TRACE_ENABLED = 'true';
          process.env.TRACE_FILE = options.traceFile;
        }
        await handlers.draftGenerate(deps.supabaseClient, deps.aiClient, {
          campaignId: options.campaignId,
          dryRun: Boolean(options.dryRun),
          failFast: Boolean(options.failFast),
          graceful: Boolean(options.graceful),
        previewGraceful: Boolean(options.previewGraceful),
        limit: options.limit ? Number(options.limit) : undefined,
        variant: options.variant,
        icpProfileId: options.icpProfileId,
        icpHypothesisId: options.icpHypothesisId,
        forceVersion: Boolean(options.forceVersion),
        provider: options.provider,
        model: options.model,
        task: 'draft',
      });
    })
  );

  program
    .command('draft:save')
    .requiredOption('--payload <json>', 'Draft row JSON object or array')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const rows = await draftSaveHandler(deps.supabaseClient, {
          payload: options.payload,
        });
        console.log(JSON.stringify(rows));
      })
    );

  program
    .command('draft:load')
    .requiredOption('--campaign-id <campaignId>')
    .option('--status <status>', 'Filter by draft status')
    .option('--limit <limit>', 'Max drafts to load')
    .option('--include-recipient-context', 'Include contact/company sendability and resolved recipient fields')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const rows = await draftLoadHandler(deps.supabaseClient, {
          campaignId: options.campaignId,
          status: options.status,
          limit: options.limit ? Number(options.limit) : undefined,
          includeRecipientContext: Boolean(options.includeRecipientContext),
        } as any);
        console.log(JSON.stringify(rows));
      })
    );

  program
    .command('draft:update-status')
    .requiredOption('--draft-id <draftId>')
    .requiredOption('--status <status>', 'generated|approved|rejected|sent')
    .option('--reviewer <reviewer>', 'Reviewer name/id')
    .option('--metadata <json>', 'Metadata patch merged into drafts.metadata')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const row = await draftUpdateStatusHandler(deps.supabaseClient, {
          draftId: options.draftId,
          status: options.status,
          reviewer: options.reviewer,
          metadata: options.metadata,
        } as any);
        console.log(JSON.stringify(row));
      })
    );

  program
    .command('segment:snapshot')
    .requiredOption('--segment-id <segmentId>')
    .option('--segment-version <segmentVersion>')
    .option('--allow-empty', 'Allow zero-contact snapshots')
    .option('--max-contacts <maxContacts>', 'Maximum contacts allowed in a snapshot')
    .option('--force-version', 'Force segment version override when mismatched')
    .action(
      wrapCliAction(async (options) => {
        await handlers.segmentSnapshot(deps.supabaseClient, {
          segmentId: options.segmentId,
          segmentVersion: options.segmentVersion ? Number(options.segmentVersion) : undefined,
          allowEmpty: Boolean(options.allowEmpty),
          maxContacts: options.maxContacts ? Number(options.maxContacts) : undefined,
          forceVersion: Boolean(options.forceVersion),
        });
      })
    );

  program
    .command('campaign:status')
    .requiredOption('--campaign-id <campaignId>')
    .requiredOption('--status <status>', 'Next status')
    .option('--dry-run', 'Validate only, do not update')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        await campaignStatusHandler(deps.supabaseClient, {
          campaignId: options.campaignId,
          status: options.status,
          dryRun: Boolean(options.dryRun),
        } as any);
      })
    );

  program
    .command('campaign:update')
    .requiredOption('--campaign-id <campaignId>')
    .option('--prompt-pack-id <promptPackId>')
    .option('--schedule <json>')
    .option('--throttle <json>')
    .action(async (options) => {
      await handlers.campaignUpdate(deps.supabaseClient, {
        campaignId: options.campaignId,
        promptPackId: options.promptPackId,
        schedule: options.schedule,
        throttle: options.throttle,
      });
    });

  program
    .command('campaign:attach-companies')
    .requiredOption('--campaign-id <campaignId>')
    .requiredOption('--company-ids <json>', 'JSON array of company ids')
    .option('--attached-by <attachedBy>')
    .option('--source <source>', 'Attach source label', 'manual_attach')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const parsed = JSON.parse(options.companyIds);
        if (!Array.isArray(parsed)) {
          const error: any = new Error('company-ids must be a JSON array');
          error.code = 'INVALID_PAYLOAD';
          throw error;
        }
        const result = await handlers.campaignAttachCompanies(deps.supabaseClient, {
          campaignId: options.campaignId,
          companyIds: parsed,
          attachedBy: options.attachedBy,
          source: options.source,
        });
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('filters:validate')
    .requiredOption('--filter <json>', 'Filter definition JSON')
    .option('--format <format>', 'Output format: json|text|terse', 'json')
    .action(async (options) => {
      try {
        const parsed = JSON.parse(options.filter);
        const result = validateFilters(parsed);
        if (options.format === 'terse') {
          if (result.ok) {
            console.log('OK');
          } else {
            console.log(`ERR ${result.error.code ?? 'ERR_FILTER_VALIDATION'}`);
          }
        } else if (options.format === 'text') {
          if (result.ok) {
            console.log('OK');
          } else {
            console.log(`ERR ${result.error.code ?? 'ERR_FILTER_VALIDATION'}: ${result.error.message}`);
          }
        } else {
          console.log(JSON.stringify(result));
        }
        emitTelemetry('filters:validate', { ok: result.ok, format: options.format });
        if (!result.ok) {
          process.exitCode = 1;
        }
      } catch (error: any) {
        const errObj = { ok: false, error: { code: 'ERR_FILTER_VALIDATION', message: error?.message ?? 'Invalid JSON' } };
        if (options.format === 'terse') {
          console.log('ERR ERR_FILTER_VALIDATION');
        } else if (options.format === 'text') {
          console.log(`ERR ERR_FILTER_VALIDATION: ${errObj.error.message}`);
        } else {
          console.log(JSON.stringify(errObj));
        }
        emitTelemetry('filters:validate', { ok: false, format: options.format });
        process.exitCode = 1;
      }
    });

  program
    .command('email:send')
    .option('--provider <provider>', 'Email provider', 'smtp')
    .option('--sender-identity <senderIdentity>', 'Sender identity/email')
    .option('--throttle-per-minute <throttlePerMinute>', 'Throttle sends per minute', '50')
    .option('--summary-format <format>', 'Summary format: json|text', 'json')
    .option('--dry-run', 'Skip sending, just log summary')
    .option('--log-json', 'Emit JSON logs/summary')
    .option('--fail-on-error', 'Exit non-zero when any send fails')
    .option('--batch-id <batchId>', 'Override batch id for tracing')
    .action(async (options) => {
      const supabaseClient = deps.supabaseClient;
      const smtpClient = {
        send: async () => ({
          providerId: `stub-${Date.now()}`,
        }),
      };
      await emailSendHandler(supabaseClient, smtpClient, {
        provider: options.provider,
        senderIdentity: options.senderIdentity,
        throttlePerMinute: options.throttlePerMinute ? Number(options.throttlePerMinute) : undefined,
        dryRun: Boolean(options.dryRun),
        logJson: Boolean(options.logJson),
        summaryFormat: options.summaryFormat,
        failOnError: Boolean(options.failOnError),
        batchId: options.batchId,
      });
    });

  program
    .command('email:record-outbound')
    .requiredOption('--payload <json>', 'Outbound send result JSON')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const result = await emailRecordOutboundHandler(deps.supabaseClient, options.payload);
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('event:ingest')
    .requiredOption('--payload <json>', 'Event payload JSON')
    .option('--dry-run', 'Validate only, do not insert')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        await eventIngestHandler(deps.supabaseClient, options.payload, { dryRun: Boolean(options.dryRun) });
      })
    );

  program
    .command('smartlead:campaigns:list')
    .option('--dry-run', 'Skip remote call and print summary only')
    .option('--format <format>', 'Output format: json|text', 'json')
    .option('--telemetry', 'Emit telemetry event')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const client = getSmartleadClient();
        const result = await smartleadCampaignsListCommand(client, {
          dryRun: Boolean(options.dryRun),
          format: options.format ?? 'json',
        });
        emitTelemetry('smartlead:campaigns:list', {
          dryRun: Boolean(options.dryRun),
          telemetryEnabled: Boolean(options.telemetry),
        });
        return result;
      })
    );

  program
    .command('smartlead:events:pull')
    .option('--dry-run', 'Skip remote call and ingestion, print summary')
    .option('--format <format>', 'Output format: json|text', 'json')
    .option('--since <since>', 'ISO timestamp to pull events since')
    .option('--limit <limit>', 'Max events to pull')
    .option('--retry-after-cap-ms <ms>', 'Cap on Retry-After wait in ms')
    .option('--assume-now-occurred-at', 'If provider omits occurred_at, fill with now (ISO)')
    .option('--telemetry', 'Emit telemetry event')
    .option('--trace-file <path>', 'Enable tracing and write traces to file')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const client = getSmartleadClient();
        if (options.traceFile) {
          process.env.TRACE_ENABLED = 'true';
          process.env.TRACE_FILE = options.traceFile;
        }
        const summary = await smartleadEventsPullCommand(client, deps.supabaseClient, {
          dryRun: Boolean(options.dryRun),
          format: options.format ?? 'json',
          since: options.since,
          limit: options.limit ? Number(options.limit) : undefined,
          retryAfterCapMs: options.retryAfterCapMs ? Number(options.retryAfterCapMs) : undefined,
          assumeNowOccurredAt: Boolean(options.assumeNowOccurredAt),
        });
        emitTelemetry('smartlead:events:pull', {
          dryRun: Boolean(options.dryRun),
          since: options.since,
          telemetryEnabled: Boolean(options.telemetry),
        });
        return summary;
      })
    );

  program
    .command('smartlead:leads:push')
    .requiredOption('--campaign-id <campaignId>')
    .option('--limit <limit>', 'Max leads to push', '100')
    .option('--dry-run', 'Skip remote call and print summary only')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const client = getSmartleadClient();
        const summary = await smartleadLeadsPushCommand(client, deps.supabaseClient, {
          campaignId: options.campaignId,
          limit: options.limit ? Number(options.limit) : undefined,
          dryRun: Boolean(options.dryRun),
        });
        void summary;
      })
    );

  program
    .command('smartlead:sequences:sync')
    .requiredOption('--campaign-id <campaignId>')
    .option('--step <step>', 'Sequence step number', '1')
    .option('--variant-label <variantLabel>', 'Variant label for sequence', 'A')
    .option('--dry-run', 'Skip remote call and print payload only')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const client = getSmartleadClient();
        const payload = await smartleadSequencesSyncCommand(client, deps.supabaseClient, {
          campaignId: options.campaignId,
          step: options.step ? Number(options.step) : undefined,
          variantLabel: options.variantLabel,
          dryRun: Boolean(options.dryRun),
        });
        void payload;
      })
    );

  program
    .command('smartlead:send')
    .requiredOption('--campaign-id <campaignId>', 'Internal campaign UUID (Supabase campaigns.id)')
    .requiredOption('--smartlead-campaign-id <smartleadCampaignId>', 'Smartlead campaign ID (remote)')
    .option('--dry-run', 'Skip remote send, print summary')
    .option('--batch-size <batchSize>', 'Max drafts to send', '50')
    .option('--step <step>', 'Smartlead sequence step number', '1')
    .option('--variant-label <variantLabel>', 'Smartlead sequence variant label', 'A')
    .option('--telemetry', 'Emit telemetry event')
    .option('--trace-file <path>', 'Enable tracing and write traces to file')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const client = getSmartleadClient();
        if (options.traceFile) {
          process.env.TRACE_ENABLED = 'true';
          process.env.TRACE_FILE = options.traceFile;
        }
        const summary = await smartleadSendCommand(client, deps.supabaseClient, {
          dryRun: Boolean(options.dryRun),
          batchSize: options.batchSize ? Number(options.batchSize) : undefined,
          campaignId: options.campaignId,
          smartleadCampaignId: options.smartleadCampaignId,
          step: options.step ? Number(options.step) : undefined,
          variantLabel: options.variantLabel,
        });
        console.log(JSON.stringify(summary));
        emitTelemetry('smartlead:send', {
          dryRun: Boolean(options.dryRun),
          batchSize: options.batchSize ? Number(options.batchSize) : undefined,
          campaignId: options.campaignId,
          smartleadCampaignId: options.smartleadCampaignId,
          telemetryEnabled: Boolean(options.telemetry),
        });
      })
    );

  program
    .command('enrich:run')
    .requiredOption('--segment-id <segmentId>')
    .option('--adapter <adapter>', 'Enrichment adapter', 'mock')
    .option('--provider <provider>', 'Enrichment provider(s): mock|exa|parallel|firecrawl|anysite; comma-separated for combinations')
    .option('--dry-run', 'Skip enrichment, print summary')
    .option('--limit <limit>', 'Max members to enrich', '10')
    .option('--max-age-days <days>', 'Refresh stale enrichment older than N days', '90')
    .option('--force-refresh', 'Refresh even if existing enrichment is still fresh')
    .option('--run-now', 'Execute immediately after enqueueing')
    .option('--legacy-sync', 'Use legacy synchronous enrichment path')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const summary = await enrichCommand(deps.supabaseClient, {
          segmentId: options.segmentId,
          adapter: options.adapter,
          provider: options.provider,
          dryRun: Boolean(options.dryRun),
          limit: options.limit ? Number(options.limit) : undefined,
          maxAgeDays: options.maxAgeDays ? Number(options.maxAgeDays) : undefined,
          forceRefresh: Boolean(options.forceRefresh),
          runNow: Boolean(options.runNow),
          legacySync: Boolean(options.legacySync),
        });
        console.log(JSON.stringify(summary));
      })
    );

  program
    .command('analytics:summary')
    .option('--group-by <groupBy>', 'icp|segment|pattern|rejection_reason|offering|offer|hypothesis|recipient_type|sender_identity', 'icp')
    .option('--since <iso>', 'Filter events by occurred_at >= since')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const groupBy = options.groupBy ?? 'icp';
        const since = options.since as string | undefined;
        const client = deps.supabaseClient;
        let results: unknown[] = [];
        if (groupBy === 'icp') {
          results = await getAnalyticsByIcpAndHypothesis(client, { since });
        } else if (groupBy === 'segment') {
          const { getAnalyticsBySegmentAndRole } = await import('./services/analytics');
          results = await getAnalyticsBySegmentAndRole(client, { since });
        } else if (groupBy === 'pattern') {
          const { getAnalyticsByPatternAndUserEdit } = await import('./services/analytics');
          results = await getAnalyticsByPatternAndUserEdit(client, { since });
        } else if (groupBy === 'rejection_reason') {
          results = await getAnalyticsByRejectionReason(client, { since });
        } else if (groupBy === 'offering') {
          results = await getAnalyticsByOffering(client, { since });
        } else if (groupBy === 'offer') {
          results = await getAnalyticsByOffer(client, { since });
        } else if (groupBy === 'hypothesis') {
          results = await getAnalyticsByHypothesis(client, { since });
        } else if (groupBy === 'recipient_type') {
          results = await getAnalyticsByRecipientType(client, { since });
        } else if (groupBy === 'sender_identity') {
          results = await getAnalyticsBySenderIdentity(client, { since });
        } else {
          console.log(
            JSON.stringify({
              groupBy,
              results: [],
            })
          );
          return;
        }

        console.log(JSON.stringify(formatAnalyticsOutput(groupBy, results)));
      })
    );

  program
    .command('analytics:funnel')
    .requiredOption('--campaign-id <campaignId>', 'Campaign id to summarize')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const result = await getCampaignFunnelAnalytics(deps.supabaseClient, options.campaignId);
        console.log(JSON.stringify(result));
      })
    );

  program
    .command('analytics:optimize')
    .option('--since <iso>', 'Filter events by occurred_at >= since')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const since = options.since as string | undefined;
        const client = deps.supabaseClient;
        const suggestions = await suggestPromptPatternAdjustments(client, { since });
        const simSummary = await getSimJobSummaryForAnalytics(client);
        console.log(
          JSON.stringify({
            suggestions,
            simSummary,
          })
        );
      })
    );

  program
    .command('icp:create')
    .requiredOption('--name <name>')
    .option('--project-id <projectId>')
    .option('--description <description>')
    .option('--offering-domain <offeringDomain>', 'Offering domain used by this ICP, e.g. voicexpert.ru')
    .option('--company-criteria <json>', 'JSON company criteria')
    .option('--persona-criteria <json>', 'JSON persona criteria')
    .option('--created-by <createdBy>')
    .action(async (options) => {
      await icpCreateCommand(deps.supabaseClient, {
        name: options.name,
        projectId: options.projectId,
        description: options.description,
        offeringDomain: options.offeringDomain,
        companyCriteria: options.companyCriteria,
        personaCriteria: options.personaCriteria,
        createdBy: options.createdBy,
      });
    });

  program
    .command('icp:hypothesis:create')
    .requiredOption('--icp-profile-id <icpProfileId>')
    .requiredOption('--label <hypothesisLabel>')
    .option('--offer-id <offerId>')
    .option('--search-config <json>', 'JSON search config')
    .option('--targeting-defaults <json>', 'JSON targeting defaults for execution use')
    .option('--messaging-angle <messagingAngle>')
    .option('--pattern-defaults <json>', 'JSON tone / pattern defaults for execution use')
    .option('--notes <notes>')
    .option('--status <status>', 'draft|active|deprecated')
    .option('--segment-id <segmentId>')
    .action(async (options) => {
      await icpHypothesisCreateCommand(deps.supabaseClient, {
        icpProfileId: options.icpProfileId,
        hypothesisLabel: options.label,
        offerId: options.offerId,
        searchConfig: options.searchConfig,
        targetingDefaults: options.targetingDefaults,
        messagingAngle: options.messagingAngle,
        patternDefaults: options.patternDefaults,
        notes: options.notes,
        status: options.status,
        segmentId: options.segmentId,
      });
    });

  program
    .command('icp:list')
    .option('--columns <columns>', 'Comma-separated columns to include (default: id,name,description,offering_domain)')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const columns = options.columns
          ? String(options.columns)
              .split(',')
              .map((c: string) => c.trim())
              .filter(Boolean)
          : undefined;
        const rows = await icpListCommand(deps.supabaseClient, { columns });
        console.log(JSON.stringify(rows));
      })
    );

  program
    .command('icp:hypothesis:list')
    .option('--columns <columns>', 'Comma-separated columns to include (default: id,icp_profile_id,segment_id,status)')
    .option('--icp-profile-id <icpProfileId>', 'Filter by ICP profile id')
    .option('--segment-id <segmentId>', 'Filter by segment id')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const columns = options.columns
          ? String(options.columns)
              .split(',')
              .map((c: string) => c.trim())
              .filter(Boolean)
          : undefined;
        const rows = await icpHypothesisListCommand(deps.supabaseClient, {
          columns,
          icpProfileId: options.icpProfileId,
          segmentId: options.segmentId,
        });
        console.log(JSON.stringify(rows));
      })
    );

  program
    .command('icp:discover')
    .requiredOption('--icp-profile-id <icpProfileId>')
    .option('--icp-hypothesis-id <icpHypothesisId>')
    .option('--limit <limit>', 'Max candidates to request')
    .option('--promote', 'Promote candidates into a segment after discovery')
    .option('--segment-id <segmentId>', 'Segment id to promote approved candidates into')
    .option(
      '--candidate-ids <candidateIds>',
      'Comma-separated candidate ids to promote (defaults to all approved in UI)'
    )
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        const limit = options.limit ? Number(options.limit) : undefined;
        await icpDiscoverCommand(deps.supabaseClient, {
          icpProfileId: options.icpProfileId,
          icpHypothesisId: options.icpHypothesisId,
          limit,
          promote: Boolean(options.promote),
          segmentId: options.segmentId,
          candidateIds: options.candidateIds
            ? String(options.candidateIds)
                .split(',')
                .map((id: string) => id.trim())
                .filter(Boolean)
            : undefined,
        });
      })
    );

  program
    .command('icp:coach:profile')
    .requiredOption('--name <name>')
    .option('--description <description>')
    .option('--website-url <url>')
    .option('--value-prop <valueProp>')
    .option('--offering-domain <offeringDomain>', 'Offering domain used by this ICP, e.g. voicexpert.ru')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        if (!deps.chatClient) {
          throw new Error('Chat client is required for icp:coach:profile');
        }
        await icpCoachProfileCommand(deps.supabaseClient, deps.chatClient, {
          name: options.name,
          description: options.description,
          websiteUrl: options.websiteUrl,
          valueProp: options.valueProp,
          offeringDomain: options.offeringDomain,
        });
      })
    );

  program
    .command('icp:coach:hypothesis')
    .requiredOption('--icp-profile-id <icpProfileId>')
    .option('--label <label>')
    .option('--icp-description <icpDescription>')
    .option('--error-format <format>', 'Error output format: text|json', 'text')
    .action(
      wrapCliAction(async (options) => {
        if (!deps.chatClient) {
          throw new Error('Chat client is required for icp:coach:hypothesis');
        }
        await icpCoachHypothesisCommand(deps.supabaseClient, deps.chatClient, {
          icpProfileId: options.icpProfileId,
          label: options.label,
          icpDescription: options.icpDescription,
        });
      })
    );

  return program;
}

export function buildCliChatClient(): ChatClient {
  const buildStub = (): ChatClient => ({
    complete: async (messages) => {
      const last = messages[messages.length - 1];
      let request: EmailDraftRequest | null = null;
      try {
        request = JSON.parse(last.content) as EmailDraftRequest;
      } catch {
        request = null;
      }

      const fallback = {
        subject: 'Draft subject',
        body: 'Draft body',
        metadata: {
          model: 'pipeline-express-stub',
          language: 'en',
          pattern_mode: null,
          email_type: 'intro' as const,
          coach_prompt_id: 'express_stub',
        },
      };

      if (!request) {
        const lastUser = [...messages].reverse().find((m) => m.role === 'user');
        const content = lastUser?.content ?? '';
        if (content.includes('ICP profile id:')) {
          return JSON.stringify({
            hypothesisLabel: 'Stub Hypothesis',
            searchConfig: {},
          });
        }
        if (content.includes('ICP profile name:')) {
          return JSON.stringify({
            name: 'Stub ICP Profile',
            description: 'Stub ICP profile generated by CLI',
            companyCriteria: {},
            personaCriteria: {},
          });
        }
        return JSON.stringify(fallback);
      }

      return JSON.stringify({
        subject: `${request.brief.offer.product_name} for ${request.brief.prospect.company_name}`,
        body: `Hi ${request.brief.prospect.full_name},\n\n${request.brief.offer.one_liner}\n`,
        metadata: {
          model: 'pipeline-express-stub',
          language: request.language,
          pattern_mode: request.pattern_mode,
          email_type: request.email_type,
          coach_prompt_id: 'express_stub',
        },
      });
    },
  });

  try {
    const modelConfig = resolveModelConfig({ task: 'draft' });
    return buildChatClientForModel(modelConfig);
  } catch {
    return buildStub();
  }
}

export async function runCli(argv = process.argv) {
  const env = loadEnv();
  const supabaseClient = initSupabaseClient(env);
  const chatClient = buildCliChatClient();
  const aiClient = new AiClient(chatClient);

  const program = createProgram({ supabaseClient, aiClient, chatClient });
  await program.parseAsync(argv);
}

// When executed directly (e.g. via `pnpm cli`), run the CLI.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli();
}
