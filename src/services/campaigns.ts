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

const statusTransitions: Record<string, string[]> = {
  draft: ['ready', 'review'],
  ready: ['generating'],
  generating: ['review', 'sending'],
  review: ['ready', 'generating'],
  sending: ['paused', 'complete'],
  paused: ['sending', 'complete'],
  complete: [],
};

export function assertCampaignStatusTransition(current: string, next: string) {
  const allowed = statusTransitions[current] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`Invalid status transition from ${current} to ${next}. Allowed: ${allowed.join(', ') || 'none'}`);
  }
}

export interface CampaignUpdateInput {
  promptPackId?: string;
  schedule?: Record<string, unknown>;
  throttle?: Record<string, unknown>;
}

export async function updateCampaign(
  client: SupabaseClient,
  campaignId: string,
  input: CampaignUpdateInput
) {
  const { data: statusRow, error: statusError } = await client
    .from('campaigns')
    .select('status')
    .eq('id', campaignId)
    .single();

  if (statusError || !statusRow) {
    throw statusError ?? new Error('Campaign not found');
  }

  const allowedStatuses = ['draft', 'ready', 'review'];
  if (!allowedStatuses.includes(statusRow.status)) {
    throw new Error(`Cannot update campaign in status ${statusRow.status}`);
  }

  const patch: Record<string, unknown> = {};

  if (input.promptPackId !== undefined) {
    patch.prompt_pack_id = input.promptPackId;
  }
  if (input.schedule !== undefined) {
    patch.schedule = input.schedule;
  }
  if (input.throttle !== undefined) {
    patch.throttle = input.throttle;
  }

  if (Object.keys(patch).length === 0) {
    throw new Error('No updatable fields provided');
  }

  const { data, error } = await client
    .from('campaigns')
    .update(patch)
    .eq('id', campaignId)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update campaign');
  }

  return data;
}
