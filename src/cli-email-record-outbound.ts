import type { SupabaseClient } from '@supabase/supabase-js';

import { recordEmailOutbound, type EmailOutboundRecordInput } from './services/emailOutboundRecorder';

export async function emailRecordOutboundHandler(client: SupabaseClient, payloadJson: string) {
  let payload: EmailOutboundRecordInput;
  try {
    payload = JSON.parse(payloadJson) as EmailOutboundRecordInput;
  } catch {
    const err: any = new Error('payload is not valid JSON');
    err.code = 'INVALID_JSON';
    throw err;
  }

  return recordEmailOutbound(client, payload);
}
