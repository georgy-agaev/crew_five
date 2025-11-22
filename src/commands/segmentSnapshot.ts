import type { SupabaseClient } from '@supabase/supabase-js';

import { ensureSegmentSnapshot } from '../services/segmentSnapshotWorkflow';

interface SegmentSnapshotOptions {
  segmentId: string;
  segmentVersion?: number;
}

export async function segmentSnapshotHandler(
  client: SupabaseClient,
  options: SegmentSnapshotOptions
) {
  return ensureSegmentSnapshot(client, {
    segmentId: options.segmentId,
    segmentVersion: options.segmentVersion,
    mode: 'refresh',
  });
}
