import type { SupabaseClient } from '@supabase/supabase-js';

import { ingestEmailEvent, type ProviderEventPayload } from './services/emailEvents';

export async function eventIngestHandler(
  client: SupabaseClient,
  payloadJson: string,
  options: { dryRun?: boolean }
) {
  const payload = JSON.parse(payloadJson) as ProviderEventPayload;
  return ingestEmailEvent(client, payload, { dryRun: options.dryRun });
}
