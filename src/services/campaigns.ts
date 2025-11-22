import type { SupabaseClient } from '@supabase/supabase-js';

export interface CampaignInput {
  name: string;
  segmentId: string;
  segmentVersion: number;
  senderProfileId?: string;
  promptPackId?: string;
  schedule?: Record<string, unknown>;
  throttle?: Record<string, unknown>;
  createdBy?: string;
  interactionMode?: 'express' | 'coach';
  dataQualityMode?: 'strict' | 'graceful';
  metadata?: Record<string, unknown>;
}

export async function createCampaign(
  client: SupabaseClient,
  input: CampaignInput
): Promise<Record<string, any>> {
  const interactionMode = input.interactionMode ?? 'express';
  const dataQualityMode = input.dataQualityMode ?? 'strict';

  const { data, error } = await client
    .from('campaigns')
    .insert([
      {
        name: input.name,
        segment_id: input.segmentId,
        segment_version: input.segmentVersion,
        sender_profile_id: input.senderProfileId,
        prompt_pack_id: input.promptPackId,
        schedule: input.schedule,
        throttle: input.throttle,
        created_by: input.createdBy,
        interaction_mode: interactionMode,
        data_quality_mode: dataQualityMode,
        status: 'draft',
        metadata: input.metadata,
      },
    ])
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Record<string, any>;
}
