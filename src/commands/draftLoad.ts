import type { SupabaseClient } from '@supabase/supabase-js';

import { loadDrafts, type DraftStatus } from '../services/draftStore';

interface DraftLoadOptions {
  campaignId: string;
  status?: DraftStatus;
  limit?: number;
  includeRecipientContext?: boolean;
}

export async function draftLoadHandler(client: SupabaseClient, options: DraftLoadOptions) {
  return loadDrafts(client, options);
}
