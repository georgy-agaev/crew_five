/* eslint-disable security-node/detect-crlf */
import type { SupabaseClient } from '@supabase/supabase-js';

import { createIcpProfile } from '../services/icp';

interface IcpCreateOptions {
  name: string;
  description?: string;
  companyCriteria?: string;
  personaCriteria?: string;
  createdBy?: string;
}

export async function icpCreateCommand(client: SupabaseClient, options: IcpCreateOptions) {
  const companyCriteria = options.companyCriteria ? JSON.parse(options.companyCriteria) : undefined;
  const personaCriteria = options.personaCriteria ? JSON.parse(options.personaCriteria) : undefined;

  const profile = await createIcpProfile(client, {
    name: options.name,
    description: options.description,
    companyCriteria,
    personaCriteria,
    createdBy: options.createdBy,
  });

  console.log(JSON.stringify({ id: profile.id }));
}
