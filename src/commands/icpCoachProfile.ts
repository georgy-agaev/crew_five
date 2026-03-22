import type { SupabaseClient } from '@supabase/supabase-js';

import type { ChatClient } from '../services/chatClient';
import { createIcpProfileViaCoach } from '../services/coach';

export interface IcpCoachProfileOptions {
  name: string;
  description?: string;
  websiteUrl?: string;
  valueProp?: string;
  offeringDomain?: string;
}

export async function icpCoachProfileCommand(
  client: SupabaseClient,
  chatClient: ChatClient,
  options: IcpCoachProfileOptions
) {
  const { jobId, profile } = await createIcpProfileViaCoach(client, chatClient, {
    name: options.name,
    description: options.description,
    websiteUrl: options.websiteUrl,
    valueProp: options.valueProp,
    offeringDomain: options.offeringDomain,
  });

  // JSON-first output for scripting.
  process.stdout.write(`${JSON.stringify({ jobId, profileId: profile.id })}\n`);
}
