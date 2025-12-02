import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient } from '../services/aiClient';
import { resolveModelConfig } from '../config/modelCatalog';
import { getCampaignSpineContext } from '../services/campaigns';
import { generateDrafts } from '../services/drafts';
import { generateDraftsForSegmentWithIcp } from '../services/coach';
import { ensureFinalSegmentSnapshot } from '../services/segmentSnapshotWorkflow';

interface DraftGenerateOptions {
  campaignId: string;
  dryRun?: boolean;
  failFast?: boolean;
  graceful?: boolean;
  previewGraceful?: boolean;
   limit?: number;
  variant?: string;
  icpProfileId?: string;
  icpHypothesisId?: string;
  forceVersion?: boolean;
  provider?: string;
  model?: string;
  task?: 'assistant' | 'icp' | 'hypothesis' | 'draft';
}

export function draftGenerateHandler(
  client: SupabaseClient,
  aiClient: AiClient,
  options: DraftGenerateOptions
) {
  const run = async () => {
    const campaign = await getCampaignSpineContext(client, options.campaignId);
    await ensureFinalSegmentSnapshot(client, campaign.segment_id, {
      expectedVersion: campaign.segment_version,
      forceVersion: options.forceVersion,
    });
    const modelConfig = resolveModelConfig({
      provider: options.provider,
      model: options.model,
      task: options.task ?? 'draft',
    });

    if (options.icpProfileId || options.icpHypothesisId) {
      return generateDraftsForSegmentWithIcp(client, aiClient, {
        campaignId: options.campaignId,
        segmentId: campaign.segment_id,
        icpProfileId: options.icpProfileId,
        icpHypothesisId: options.icpHypothesisId,
        dryRun: options.dryRun,
        failFast: options.failFast,
        graceful: options.graceful,
        previewGraceful: options.previewGraceful,
        limit: options.limit,
        variant: options.variant,
        provider: modelConfig.provider,
        model: modelConfig.model,
      });
    }

    return generateDrafts(client, aiClient, {
      campaignId: options.campaignId,
      dryRun: options.dryRun,
      failFast: options.failFast,
      graceful: options.graceful,
      previewGraceful: options.previewGraceful,
      limit: options.limit,
      variant: options.variant,
      provider: modelConfig.provider,
      model: modelConfig.model,
    });
  };

  return run();
}
