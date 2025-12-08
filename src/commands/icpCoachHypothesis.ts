import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChatClient } from '../services/chatClient';
import { createIcpHypothesisViaCoach } from '../services/coach';

export interface IcpCoachHypothesisOptions {
  icpProfileId: string;
  label?: string;
  icpDescription?: string;
}

export async function icpCoachHypothesisCommand(
  client: SupabaseClient,
  chatClient: ChatClient,
  options: IcpCoachHypothesisOptions
) {
  const { jobId, hypothesis } = await createIcpHypothesisViaCoach(client, chatClient, {
    icpProfileId: options.icpProfileId,
    icpDescription: options.icpDescription,
  });

  // JSON-first output for scripting.
  process.stdout.write(`${JSON.stringify({ jobId, hypothesisId: hypothesis.id })}\n`);
}
