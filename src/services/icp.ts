/* eslint-disable security-node/detect-unhandled-async-errors */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IcpProfileInput {
  name: string;
  description?: string;
  companyCriteria?: Record<string, unknown>;
  personaCriteria?: Record<string, unknown>;
  createdBy?: string;
}

export interface IcpHypothesisInput {
  icpProfileId: string;
  hypothesisLabel: string;
  searchConfig?: Record<string, unknown>;
  status?: 'draft' | 'active' | 'deprecated';
  segmentId?: string;
}

export async function createIcpProfile(
  client: SupabaseClient,
  input: IcpProfileInput
): Promise<Record<string, any>> {
  const { data, error } = await client
    .from('icp_profiles')
    .insert([
      {
        name: input.name,
        description: input.description ?? null,
        company_criteria: input.companyCriteria ?? {},
        persona_criteria: input.personaCriteria ?? {},
        created_by: input.createdBy ?? null,
      },
    ])
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create ICP profile');
  }

  return data as Record<string, any>;
}

export async function createIcpHypothesis(
  client: SupabaseClient,
  input: IcpHypothesisInput
): Promise<Record<string, any>> {
  const { data, error } = await client
    .from('icp_hypotheses')
    .insert([
      {
        icp_id: input.icpProfileId,
        hypothesis_label: input.hypothesisLabel,
        search_config: input.searchConfig ?? {},
        status: input.status ?? 'draft',
      },
    ])
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create ICP hypothesis');
  }

  if (input.segmentId) {
    await attachIcpToSegment(client, input.segmentId, data.id as string, input.icpProfileId);
  }

  return data as Record<string, any>;
}

export async function attachIcpToSegment(
  client: SupabaseClient,
  segmentId: string,
  hypothesisId: string,
  profileId: string
): Promise<void> {
  const { error } = await client
    .from('segments')
    .update({
      icp_profile_id: profileId,
      icp_hypothesis_id: hypothesisId,
    })
    .eq('id', segmentId);

  if (error) {
    throw error;
  }
}
