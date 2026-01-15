/* eslint-disable security-node/detect-unhandled-async-errors */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IcpProfile {
  id: string;
  name: string;
  description: string | null;
  company_criteria: Record<string, unknown>;
  persona_criteria: Record<string, unknown>;
  phase_outputs: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface IcpHypothesis {
  id: string;
  icp_id: string;
  hypothesis_label: string;
  search_config: Record<string, unknown>;
  status: 'draft' | 'active' | 'deprecated';
  created_at: string;
  updated_at: string;
}

export interface IcpProfileInput {
  name: string;
  description?: string;
  companyCriteria?: Record<string, unknown>;
  personaCriteria?: Record<string, unknown>;
  createdBy?: string;
  phaseOutputs?: Record<string, unknown>;
}

export interface IcpHypothesisInput {
  icpProfileId: string;
  hypothesisLabel: string;
  searchConfig?: Record<string, unknown>;
  status?: 'draft' | 'active' | 'deprecated';
  segmentId?: string;
}

let icpProfilesSupportsPhaseOutputs = true;

export async function createIcpProfile(
  client: SupabaseClient,
  input: IcpProfileInput
): Promise<IcpProfile> {
  const baseRow: Record<string, unknown> = {
    name: input.name,
    description: input.description ?? null,
    company_criteria: input.companyCriteria ?? {},
    persona_criteria: input.personaCriteria ?? {},
    created_by: input.createdBy ?? null,
  };

  async function attemptInsert(includePhaseOutputs: boolean) {
    const row = includePhaseOutputs
      ? { ...baseRow, phase_outputs: input.phaseOutputs ?? null }
      : baseRow;

    const { data, error } = await client
      .from('icp_profiles')
      .insert([row])
      .select()
      .single();

    return { data, error };
  }

  let { data, error } = await attemptInsert(icpProfilesSupportsPhaseOutputs);

  // Some environments have not yet applied the phase_outputs column migration.
  // When we detect that column is missing, retry once without it and remember
  // that future inserts should omit the field.
  const message = String((error as any)?.message ?? '').toLowerCase();
  const code = (error as any)?.code as string | undefined;
  const isPhaseOutputsMissing =
    message.includes('phase_outputs') &&
    (message.includes('does not exist') || message.includes('could not find'));

  if (error && isPhaseOutputsMissing) {
    icpProfilesSupportsPhaseOutputs = false;
    ({ data, error } = await attemptInsert(false));
  }

  if (error || !data) {
    throw error ?? new Error('Failed to create ICP profile');
  }

  return data as IcpProfile;
}

export async function createIcpHypothesis(
  client: SupabaseClient,
  input: IcpHypothesisInput
): Promise<IcpHypothesis> {
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
    await attachIcpToSegment(client, input.segmentId, data.id, input.icpProfileId);
  }

  return data as IcpHypothesis;
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
