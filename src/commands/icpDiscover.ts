import type { SupabaseClient } from '@supabase/supabase-js';

import { buildExaClientFromEnv } from '../integrations/exa';
import { promoteIcpDiscoveryCandidatesToSegment, runIcpDiscoveryWithExa } from '../services/icpDiscovery';

export interface IcpDiscoverOptions {
  icpProfileId: string;
  icpHypothesisId?: string;
  limit?: number;
  promote?: boolean;
  segmentId?: string;
  candidateIds?: string[];
}

export async function icpDiscoverCommand(client: SupabaseClient, options: IcpDiscoverOptions) {
  if (!options.icpProfileId) {
    const err: any = new Error('icpProfileId is required');
    err.code = 'ICP_PROFILE_ID_REQUIRED';
    throw err;
  }

  const exa = buildExaClientFromEnv();
  const result = await runIcpDiscoveryWithExa(client, exa, {
    icpProfileId: options.icpProfileId,
    icpHypothesisId: options.icpHypothesisId,
    limit: options.limit,
  });

  let promotedCount: number | undefined;

  if (options.promote) {
    if (!options.segmentId) {
      const err: any = new Error('segmentId is required when --promote is used');
      err.code = 'SEGMENT_ID_REQUIRED';
      throw err;
    }
    const candidateIds = Array.isArray(options.candidateIds) ? options.candidateIds.filter(Boolean) : [];
    const promotion = await promoteIcpDiscoveryCandidatesToSegment(client, {
      runId: result.runId,
      candidateIds,
      segmentId: options.segmentId,
    });
    promotedCount = promotion.promotedCount;
  }

  process.stdout.write(
    `${JSON.stringify({
      jobId: result.jobId,
      runId: result.runId,
      provider: result.provider,
      status: result.status,
      ...(promotedCount !== undefined ? { promotedCount } : {}),
    })}\n`
  );
}
