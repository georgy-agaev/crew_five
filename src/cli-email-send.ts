import type { SupabaseClient } from '@supabase/supabase-js';

import { sendQueuedDrafts } from './services/emailOutbound';

interface EmailSendOptions {
  provider?: string;
  senderIdentity?: string;
  throttlePerMinute?: number;
  summaryFormat?: 'json' | 'text';
  dryRun?: boolean;
  logJson?: boolean;
}

export async function emailSendHandler(
  client: SupabaseClient,
  smtpClient: { send: (payload: any) => Promise<{ providerId: string }> },
  options: EmailSendOptions
) {
  const summary = await sendQueuedDrafts(client, smtpClient, {
    provider: options.provider,
    senderIdentity: options.senderIdentity,
    throttlePerMinute: options.throttlePerMinute,
    dryRun: options.dryRun,
    logJson: options.logJson,
  });

  if (options.summaryFormat === 'text') {
    console.log(`send summary: sent=${summary.sent} failed=${summary.failed} skipped=${summary.skipped} batch=${summary.batchId}`);
  } else if (options.logJson) {
    console.log(JSON.stringify({ level: 'info', summary }));
  }

  return summary;
}
