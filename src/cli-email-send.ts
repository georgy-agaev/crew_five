import type { SupabaseClient } from '@supabase/supabase-js';

import { sendQueuedDrafts } from './services/emailOutbound';

interface EmailSendOptions {
  provider?: string;
  senderIdentity?: string;
  throttlePerMinute?: number;
}

export async function emailSendHandler(
  client: SupabaseClient,
  smtpClient: { send: (payload: any) => Promise<{ providerId: string }> },
  options: EmailSendOptions
) {
  return sendQueuedDrafts(client, smtpClient, {
    provider: options.provider,
    senderIdentity: options.senderIdentity,
    throttlePerMinute: options.throttlePerMinute,
  });
}
