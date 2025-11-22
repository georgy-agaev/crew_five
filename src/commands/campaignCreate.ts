import type { SupabaseClient } from '@supabase/supabase-js';

import { createCampaign } from '../services/campaigns';
import { ensureSegmentSnapshot } from '../services/segmentSnapshotWorkflow';

interface CampaignCreateOptions {
  name: string;
  segmentId: string;
  segmentVersion?: number;
  senderProfileId?: string;
  promptPackId?: string;
  schedule?: string;
  throttle?: string;
  createdBy?: string;
  interactionMode?: 'express' | 'coach';
  dataQualityMode?: 'strict' | 'graceful';
  snapshotMode?: 'reuse' | 'refresh';
  bumpSegmentVersion?: boolean;
}

export async function campaignCreateHandler(
  client: SupabaseClient,
  options: CampaignCreateOptions
) {
  const schedule = options.schedule ? JSON.parse(options.schedule) : undefined;
  const throttle = options.throttle ? JSON.parse(options.throttle) : undefined;
  const snapshotMode = options.snapshotMode ?? 'reuse';
  if (snapshotMode !== 'reuse' && snapshotMode !== 'refresh') {
    throw new Error(`Unsupported snapshot mode: ${snapshotMode}`);
  }

  const snapshot = await ensureSegmentSnapshot(client, {
    segmentId: options.segmentId,
    segmentVersion: options.segmentVersion,
    mode: snapshotMode,
    bumpVersion: options.bumpSegmentVersion,
  });

  return createCampaign(client, {
    name: options.name,
    segmentId: options.segmentId,
    segmentVersion: snapshot.version,
    senderProfileId: options.senderProfileId,
    promptPackId: options.promptPackId,
    schedule,
    throttle,
    createdBy: options.createdBy,
    interactionMode: options.interactionMode,
    dataQualityMode: options.dataQualityMode,
    metadata: {
      snapshot,
    },
  });
}
