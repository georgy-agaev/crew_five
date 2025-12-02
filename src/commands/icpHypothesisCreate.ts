/* eslint-disable security-node/detect-crlf */
import type { SupabaseClient } from '@supabase/supabase-js';

import { createIcpHypothesis } from '../services/icp';

interface IcpHypothesisCreateOptions {
  icpProfileId: string;
  hypothesisLabel: string;
  searchConfig?: string;
  status?: string;
  segmentId?: string;
}

export async function icpHypothesisCreateCommand(
  client: SupabaseClient,
  options: IcpHypothesisCreateOptions
) {
  const searchConfig = options.searchConfig ? JSON.parse(options.searchConfig) : undefined;
  const status =
    options.status && ['draft', 'active', 'deprecated'].includes(options.status)
      ? (options.status as 'draft' | 'active' | 'deprecated')
      : undefined;

  const hypothesis = await createIcpHypothesis(client, {
    icpProfileId: options.icpProfileId,
    hypothesisLabel: options.hypothesisLabel,
    searchConfig,
    status,
    segmentId: options.segmentId,
  });

  console.log(JSON.stringify({ id: hypothesis.id }));
}
