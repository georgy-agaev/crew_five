import type { SupabaseClient } from '@supabase/supabase-js';

import { updateDraftStatus, type DraftStatus } from '../services/draftStore';

interface DraftUpdateStatusOptions {
  draftId: string;
  status: DraftStatus;
  reviewer?: string;
  metadata?: string;
}

export async function draftUpdateStatusHandler(
  client: SupabaseClient,
  options: DraftUpdateStatusOptions
) {
  return updateDraftStatus(client, {
    draftId: options.draftId,
    status: options.status,
    reviewer: options.reviewer,
    metadata: options.metadata ? (JSON.parse(options.metadata) as Record<string, unknown>) : undefined,
  });
}
