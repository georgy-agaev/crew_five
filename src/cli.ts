import { Command } from 'commander';

import { loadEnv } from './config/env';
import { campaignCreateHandler } from './commands/campaignCreate';
import { campaignUpdateHandler } from './commands/campaignUpdate';
import { draftGenerateHandler } from './commands/draftGenerate';
import { segmentCreateHandler } from './commands/segmentCreate';
import { segmentSnapshotHandler } from './commands/segmentSnapshot';
import { validateFilters } from './filters';
import { emailSendHandler } from './cli-email-send';
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
    .action(async (options) => {
      await handlers.draftGenerate(deps.supabaseClient, deps.aiClient, {
        campaignId: options.campaignId,
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
      });
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
