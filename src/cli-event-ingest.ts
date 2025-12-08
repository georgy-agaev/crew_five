import type { SupabaseClient } from '@supabase/supabase-js';

import { ingestEmailEvent, type ProviderEventPayload } from './services/emailEvents';

export async function eventIngestHandler(
  client: SupabaseClient,
  payloadJson: string,
  options: { dryRun?: boolean }
) {
  let payload: ProviderEventPayload;
  try {
    payload = JSON.parse(payloadJson) as ProviderEventPayload;
  } catch {
    const err: any = new Error('payload is not valid JSON');
    err.code = 'INVALID_JSON';
    throw err;
  }
  return ingestEmailEvent(client, payload, { dryRun: options.dryRun });
}
