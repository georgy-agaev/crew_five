import type { SupabaseClient } from '@supabase/supabase-js';

import { saveDrafts, type DraftSaveInput } from '../services/draftStore';

interface DraftSaveOptions {
  payload: string;
}

export async function draftSaveHandler(client: SupabaseClient, options: DraftSaveOptions) {
  const payload = JSON.parse(options.payload) as DraftSaveInput | DraftSaveInput[];
  return saveDrafts(client, payload);
}
