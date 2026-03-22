/* eslint-disable security-node/detect-crlf */
import type { SupabaseClient } from '@supabase/supabase-js';

import { createIcpHypothesis } from '../services/icp';

interface IcpHypothesisCreateOptions {
  icpProfileId: string;
  hypothesisLabel: string;
  offerId?: string;
  searchConfig?: string;
  targetingDefaults?: string;
  messagingAngle?: string;
  patternDefaults?: string;
  notes?: string;
  status?: string;
  segmentId?: string;
}

export async function icpHypothesisCreateCommand(
  client: SupabaseClient,
  options: IcpHypothesisCreateOptions
) {
  const searchConfig = options.searchConfig ? JSON.parse(options.searchConfig) : undefined;
  const targetingDefaults = options.targetingDefaults ? JSON.parse(options.targetingDefaults) : undefined;
  const patternDefaults = options.patternDefaults ? JSON.parse(options.patternDefaults) : undefined;
  const status =
    options.status && ['draft', 'active', 'deprecated'].includes(options.status)
      ? (options.status as 'draft' | 'active' | 'deprecated')
      : undefined;

  const hypothesis = await createIcpHypothesis(client, {
    icpProfileId: options.icpProfileId,
    hypothesisLabel: options.hypothesisLabel,
    offerId: options.offerId,
    searchConfig,
    targetingDefaults,
    messagingAngle: options.messagingAngle,
    patternDefaults,
    notes: options.notes,
    status,
    segmentId: options.segmentId,
  });

  console.log(JSON.stringify({ id: hypothesis.id }));
}
