import type { SupabaseClient } from '@supabase/supabase-js';

import { listCampaigns } from '../services/campaigns';

interface CampaignListOptions {
  status?: string;
  segmentId?: string;
  icpProfileId?: string;
}

export async function campaignListHandler(client: SupabaseClient, options: CampaignListOptions) {
  return listCampaigns(client, options);
}
