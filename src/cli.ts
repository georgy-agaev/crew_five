import { Command } from 'commander';

import { loadEnv } from './config/env';
import { campaignCreateHandler } from './commands/campaignCreate';
import { draftGenerateHandler } from './commands/draftGenerate';
import { segmentCreateHandler } from './commands/segmentCreate';
import { segmentSnapshotHandler } from './commands/segmentSnapshot';
import { AiClient } from './services/aiClient';
import { initSupabaseClient } from './services/supabaseClient';

interface CliHandlers {
  segmentCreate: typeof segmentCreateHandler;
  campaignCreate: typeof campaignCreateHandler;
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
  draftGenerate: draftGenerateHandler,
  segmentSnapshot: segmentSnapshotHandler,
};

export function createProgram(deps: CliDependencies) {
  const handlers: CliHandlers = {
    ...defaultHandlers,
    ...deps.handlers,
  } as CliHandlers;

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
    .action(async (options) => {
      await handlers.segmentSnapshot(deps.supabaseClient, {
        segmentId: options.segmentId,
        segmentVersion: options.segmentVersion ? Number(options.segmentVersion) : undefined,
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
