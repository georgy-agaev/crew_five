import type { SupabaseClient } from '@supabase/supabase-js';

import { listSegmentsWithCounts } from '../services/segments';

interface SegmentListOptions {
  icpProfileId?: string;
  icpHypothesisId?: string;
}

export async function segmentListHandler(client: SupabaseClient, options: SegmentListOptions) {
  return listSegmentsWithCounts(client, options);
}
