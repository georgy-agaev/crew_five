import type { SupabaseClient } from '@supabase/supabase-js';

import { updateCampaign } from '../services/campaigns';

interface CampaignUpdateOptions {
  campaignId: string;
  promptPackId?: string;
  schedule?: string;
  throttle?: string;
}

export async function campaignUpdateHandler(client: SupabaseClient, options: CampaignUpdateOptions) {
  const schedule = options.schedule ? JSON.parse(options.schedule) : undefined;
  const throttle = options.throttle ? JSON.parse(options.throttle) : undefined;

  return updateCampaign(client, options.campaignId, {
    promptPackId: options.promptPackId,
    schedule,
    throttle,
  });
}
