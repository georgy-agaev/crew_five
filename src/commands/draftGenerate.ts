import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient } from '../services/aiClient';
import { generateDrafts } from '../services/drafts';

interface DraftGenerateOptions {
  campaignId: string;
  dryRun?: boolean;
  failFast?: boolean;
  graceful?: boolean;
  previewGraceful?: boolean;
  variant?: string;
}

export function draftGenerateHandler(
  client: SupabaseClient,
  aiClient: AiClient,
  options: DraftGenerateOptions
) {
  return generateDrafts(client, aiClient, {
    campaignId: options.campaignId,
    dryRun: options.dryRun,
    failFast: options.failFast,
    graceful: options.graceful,
    previewGraceful: options.previewGraceful,
    variant: options.variant,
  });
}
