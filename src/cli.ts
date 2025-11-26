import { Command } from 'commander';
import { fileURLToPath } from 'node:url';

import { loadEnv } from './config/env';
import { campaignCreateHandler } from './commands/campaignCreate';
import { campaignUpdateHandler } from './commands/campaignUpdate';
import { campaignStatusHandler } from './commands/campaignStatus';
import { draftGenerateHandler } from './commands/draftGenerate';
import { smartleadCampaignsListCommand } from './commands/smartleadCampaignsList';
import { smartleadEventsPullCommand } from './commands/smartleadEventsPull';
import { smartleadSendCommand } from './commands/smartleadSend';
import { enrichCommand } from './commands/enrich';
import { judgeDraftsCommand } from './commands/judgeDrafts';
import { emitTelemetry } from './services/telemetry';
import { segmentCreateHandler } from './commands/segmentCreate';
import { segmentSnapshotHandler } from './commands/segmentSnapshot';
import { validateFilters } from './filters';
import { emailSendHandler } from './cli-email-send';
import { eventIngestHandler } from './cli-event-ingest';
import { buildSmartleadMcpClient, type SmartleadMcpClient } from './integrations/smartleadMcp';
import { AiClient } from './services/aiClient';
import { initSupabaseClient } from './services/supabaseClient';

interface CliHandlers {
  segmentCreate: typeof segmentCreateHandler;
  campaignCreate: typeof campaignCreateHandler;
  campaignUpdate: typeof campaignUpdateHandler;
  draftGenerate: typeof draftGenerateHandler;
  segmentSnapshot: typeof segmentSnapshotHandler;
}

interface CliDependencies {
  supabaseClient: any;
  aiClient: AiClient;
  handlers?: Partial<CliHandlers>;
  smartleadClient?: SmartleadMcpClient;
}

const defaultHandlers: CliHandlers = {
  segmentCreate: segmentCreateHandler,
  campaignCreate: campaignCreateHandler,
  campaignUpdate: campaignUpdateHandler,
  draftGenerate: draftGenerateHandler,
  segmentSnapshot: segmentSnapshotHandler,
};

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
    const url = process.env.SMARTLEAD_MCP_URL;
    const token = process.env.SMARTLEAD_MCP_TOKEN;
    const workspaceId = process.env.SMARTLEAD_MCP_WORKSPACE_ID;
    if (!url || !token) {
      throw new Error('SMARTLEAD_MCP_URL and SMARTLEAD_MCP_TOKEN are required for smartlead:* commands');
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
    .command('campaign:create')
    .requiredOption('--name <name>')
    .requiredOption('--segment-id <segmentId>')
    .option('--segment-version <segmentVersion>', undefined)
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
    .action(async (options) => {
      await handlers.campaignCreate(deps.supabaseClient, {
        name: options.name,
        segmentId: options.segmentId,
        segmentVersion: options.segmentVersion ? Number(options.segmentVersion) : undefined,
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
      });
    });

  program
    .command('draft:generate')
    .requiredOption('--campaign-id <campaignId>')
    .option('--dry-run', 'Validate only, do not insert drafts')
    .option('--fail-fast', 'Abort on first AI error')
    .option('--graceful', 'Enable graceful mode (requires catalog)')
    .option('--preview-graceful', 'Preview how many drafts would use fallbacks')
    .option('--variant <variant>', 'Assign prompt variant label')
    .option('--trace-file <path>', 'Enable tracing and write traces to file')
    .action(async (options) => {
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
        variant: options.variant,
      });
    });

  program
    .command('segment:snapshot')
    .requiredOption('--segment-id <segmentId>')
    .option('--segment-version <segmentVersion>')
    .option('--allow-empty', 'Allow zero-contact snapshots')
    .option('--max-contacts <maxContacts>', 'Maximum contacts allowed in a snapshot')
    .option('--force-version', 'Force segment version override when mismatched')
    .action(async (options) => {
      await handlers.segmentSnapshot(deps.supabaseClient, {
        segmentId: options.segmentId,
        segmentVersion: options.segmentVersion ? Number(options.segmentVersion) : undefined,
        allowEmpty: Boolean(options.allowEmpty),
        maxContacts: options.maxContacts ? Number(options.maxContacts) : undefined,
        forceVersion: Boolean(options.forceVersion),
      });
    });

  program
    .command('campaign:status')
    .requiredOption('--campaign-id <campaignId>')
    .requiredOption('--status <status>', 'Next status')
    .option('--dry-run', 'Validate only, do not update')
    .action(async (options) => {
      try {
        await campaignStatusHandler(deps.supabaseClient, {
          campaignId: options.campaignId,
          status: options.status,
          dryRun: Boolean(options.dryRun),
        } as any);
      } catch (err: any) {
        console.error(err?.message ?? 'Failed to update status');
        process.exitCode = 1;
      }
    });

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
        send: async (payload: any) => ({
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
    .command('event:ingest')
    .requiredOption('--payload <json>', 'Event payload JSON')
    .option('--dry-run', 'Validate only, do not insert')
    .action(async (options) => {
      await eventIngestHandler(deps.supabaseClient, options.payload, { dryRun: Boolean(options.dryRun) });
    });

  program
    .command('smartlead:campaigns:list')
    .option('--dry-run', 'Skip remote call and print summary only')
    .option('--format <format>', 'Output format: json|text', 'json')
    .option('--telemetry', 'Emit telemetry event')
    .action(async (options) => {
      const client = getSmartleadClient();
      const result = await smartleadCampaignsListCommand(client, {
        dryRun: Boolean(options.dryRun),
        format: options.format ?? 'json',
      });
      emitTelemetry('smartlead:campaigns:list', { dryRun: Boolean(options.dryRun) }, { enabled: Boolean(options.telemetry) });
      return result;
    });

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
    .action(async (options) => {
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
      emitTelemetry('smartlead:events:pull', { dryRun: Boolean(options.dryRun), since: options.since }, { enabled: Boolean(options.telemetry) });
      return summary;
    });

  program
    .command('smartlead:send')
    .option('--dry-run', 'Skip remote send, print summary')
    .option('--batch-size <batchSize>', 'Max drafts to send', '50')
    .option('--telemetry', 'Emit telemetry event')
    .option('--trace-file <path>', 'Enable tracing and write traces to file')
    .action(async (options) => {
      const client = getSmartleadClient();
      if (options.traceFile) {
        process.env.TRACE_ENABLED = 'true';
        process.env.TRACE_FILE = options.traceFile;
      }
      const summary = await smartleadSendCommand(client, deps.supabaseClient, {
        dryRun: Boolean(options.dryRun),
        batchSize: options.batchSize ? Number(options.batchSize) : undefined,
        dedupe: true,
      });
      console.log(JSON.stringify(summary));
      emitTelemetry('smartlead:send', { dryRun: Boolean(options.dryRun), batchSize: options.batchSize ? Number(options.batchSize) : undefined }, { enabled: Boolean(options.telemetry) });
    });

  program
    .command('enrich:run')
    .requiredOption('--segment-id <segmentId>')
    .option('--adapter <adapter>', 'Enrichment adapter', 'mock')
    .option('--dry-run', 'Skip enrichment, print summary')
    .option('--limit <limit>', 'Max members to enrich', '10')
    .action(async (options) => {
      const summary = await enrichCommand(deps.supabaseClient, {
        segmentId: options.segmentId,
        adapter: options.adapter,
        dryRun: Boolean(options.dryRun),
        limit: options.limit ? Number(options.limit) : undefined,
      });
      console.log(JSON.stringify(summary));
    });

  return program;
}

export async function runCli(argv = process.argv) {
  const env = loadEnv();
  const supabaseClient = initSupabaseClient(env);
  const aiClient = new AiClient(async (request) => ({
    subject: `${request.brief.offer.product_name} for ${request.brief.prospect.company_name}`,
    body: `Hi ${request.brief.prospect.full_name},\n\n${request.brief.offer.one_liner}\n`,
    metadata: {
      model: 'pipeline-express-stub',
      language: request.language,
      pattern_mode: request.pattern_mode,
      email_type: request.email_type,
      coach_prompt_id: 'express_stub',
    },
  }));

  const program = createProgram({ supabaseClient, aiClient });
  await program.parseAsync(argv);
}

// When executed directly (e.g. via `pnpm cli`), run the CLI.
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  // eslint-disable-next-line no-floating-promises
  runCli();
}
