import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient } from '../services/aiClient';
import { generateDrafts } from '../services/drafts';

interface DraftGenerateOptions {
  campaignId: string;
}

export function draftGenerateHandler(
  client: SupabaseClient,
  aiClient: AiClient,
  options: DraftGenerateOptions
) {
  return generateDrafts(client, aiClient, { campaignId: options.campaignId });
}
