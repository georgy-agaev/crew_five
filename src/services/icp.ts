/* eslint-disable security-node/detect-unhandled-async-errors */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface IcpProfile {
  id: string;
  project_id?: string | null;
  name: string;
  description: string | null;
  company_criteria: Record<string, unknown>;
  persona_criteria: Record<string, unknown>;
  offering_domain: string | null;
  phase_outputs: Record<string, unknown> | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  learnings?: unknown;
}

export interface IcpHypothesis {
  id: string;
  icp_id: string;
  hypothesis_label: string;
  offer_id: string | null;
  search_config: Record<string, unknown>;
  targeting_defaults: Record<string, unknown> | null;
  messaging_angle: string | null;
  pattern_defaults: Record<string, unknown> | null;
  notes: string | null;
  status: 'draft' | 'active' | 'deprecated';
  created_at: string;
}

export interface IcpProfileInput {
  projectId?: string;
  name: string;
  description?: string;
  companyCriteria?: Record<string, unknown>;
  personaCriteria?: Record<string, unknown>;
  offeringDomain?: string;
  createdBy?: string;
  phaseOutputs?: Record<string, unknown>;
}

export interface IcpHypothesisInput {
  icpProfileId: string;
  hypothesisLabel: string;
  offerId?: string;
  searchConfig?: Record<string, unknown>;
  targetingDefaults?: Record<string, unknown>;
  messagingAngle?: string;
  patternDefaults?: Record<string, unknown>;
  notes?: string;
  status?: 'draft' | 'active' | 'deprecated';
  segmentId?: string;
}

export interface IcpProfileLearningsView {
  profileId: string;
  profileName: string;
  offeringDomain: string | null;
  learnings: string[];
  updatedAt: string | null;
}

export interface IcpOfferingMapping {
  profileId: string;
  profileName: string;
  offeringDomain: string | null;
  learningsCount: number;
}

export async function getIcpHypothesis(
  client: SupabaseClient,
  hypothesisId: string
): Promise<IcpHypothesis> {
  const { data, error } = await client
    .from('icp_hypotheses')
    .select(
      'id,icp_id,hypothesis_label,offer_id,search_config,targeting_defaults,messaging_angle,pattern_defaults,notes,status,created_at'
    )
    .eq('id', hypothesisId)
    .single();

  if (error || !data) {
    throw error ?? new Error('ICP hypothesis not found');
  }

  return data as IcpHypothesis;
}

let icpProfilesSupportsPhaseOutputs = true;
let icpProfilesSupportsOfferingDomain = true;

function normalizeLearnings(learnings: unknown): string[] {
  if (!Array.isArray(learnings)) return [];
  const normalized: string[] = [];
  const seen = new Set<string>();
  for (const learning of learnings) {
    if (typeof learning !== 'string') continue;
    const trimmed = learning.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }
  return normalized;
}

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

  async function attemptInsert(includePhaseOutputs: boolean, includeOfferingDomain: boolean) {
    const row: Record<string, unknown> = { ...baseRow };
    row.project_id = input.projectId ?? null;
    if (includePhaseOutputs) {
      row.phase_outputs = input.phaseOutputs ?? null;
    }
    if (includeOfferingDomain) {
      row.offering_domain = input.offeringDomain ?? null;
    }

    const { data, error } = await client
      .from('icp_profiles')
      .insert([row])
      .select()
      .single();

    return { data, error };
  }

  let { data, error } = await attemptInsert(icpProfilesSupportsPhaseOutputs, icpProfilesSupportsOfferingDomain);

  const message = String((error as any)?.message ?? '').toLowerCase();
  const columnMissing = (columnName: string) =>
    message.includes(columnName) && (message.includes('does not exist') || message.includes('could not find'));
  const isPhaseOutputsMissing = columnMissing('phase_outputs');
  const isOfferingDomainMissing = columnMissing('offering_domain');

  if (error && (isPhaseOutputsMissing || isOfferingDomainMissing)) {
    if (isPhaseOutputsMissing) {
      icpProfilesSupportsPhaseOutputs = false;
    }
    if (isOfferingDomainMissing) {
      icpProfilesSupportsOfferingDomain = false;
    }
    ({ data, error } = await attemptInsert(icpProfilesSupportsPhaseOutputs, icpProfilesSupportsOfferingDomain));
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
  if (input.offerId) {
    const [{ data: profile, error: profileError }, { data: offer, error: offerError }] = await Promise.all([
      client.from('icp_profiles').select('id,project_id').eq('id', input.icpProfileId).single(),
      client.from('offers').select('id,project_id').eq('id', input.offerId).single(),
    ]);

    if (profileError || !profile) {
      throw profileError ?? new Error('ICP profile not found');
    }
    if (offerError || !offer) {
      throw offerError ?? new Error('Offer not found');
    }

    const profileProjectId = typeof (profile as any).project_id === 'string' ? (profile as any).project_id : null;
    const offerProjectId = typeof (offer as any).project_id === 'string' ? (offer as any).project_id : null;

    if (profileProjectId && offerProjectId && profileProjectId !== offerProjectId) {
      const error = new Error('ICP_HYPOTHESIS_OFFER_PROJECT_MISMATCH');
      (error as Error & { code?: string }).code = 'ICP_HYPOTHESIS_OFFER_PROJECT_MISMATCH';
      throw error;
    }
  }

  const { data, error } = await client
    .from('icp_hypotheses')
    .insert([
      {
        icp_id: input.icpProfileId,
        hypothesis_label: input.hypothesisLabel,
        offer_id: input.offerId ?? null,
        search_config: input.searchConfig ?? {},
        targeting_defaults: input.targetingDefaults ?? null,
        messaging_angle: input.messagingAngle ?? null,
        pattern_defaults: input.patternDefaults ?? null,
        notes: input.notes ?? null,
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

export async function getIcpProfileLearnings(
  client: SupabaseClient,
  profileId: string
): Promise<IcpProfileLearningsView> {
  const { data, error } = await client
    .from('icp_profiles')
    .select('id,name,offering_domain,learnings,updated_at')
    .eq('id', profileId)
    .single();

  if (error || !data) {
    throw error ?? new Error('ICP profile not found');
  }

  const row = data as Record<string, unknown>;
  return {
    profileId: String(row.id),
    profileName: typeof row.name === 'string' ? row.name : 'Unknown ICP',
    offeringDomain: typeof row.offering_domain === 'string' ? row.offering_domain : null,
    learnings: normalizeLearnings(row.learnings),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

export async function updateIcpProfileLearnings(
  client: SupabaseClient,
  input: { profileId: string; learnings: string[] }
): Promise<IcpProfileLearningsView> {
  const learnings = normalizeLearnings(input.learnings);
  const { data, error } = await client
    .from('icp_profiles')
    .update({ learnings })
    .eq('id', input.profileId)
    .select('id,name,offering_domain,learnings,updated_at')
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update ICP profile learnings');
  }

  const row = data as Record<string, unknown>;
  return {
    profileId: String(row.id),
    profileName: typeof row.name === 'string' ? row.name : 'Unknown ICP',
    offeringDomain: typeof row.offering_domain === 'string' ? row.offering_domain : null,
    learnings: normalizeLearnings(row.learnings),
    updatedAt: typeof row.updated_at === 'string' ? row.updated_at : null,
  };
}

export async function listIcpOfferingMappings(
  client: SupabaseClient
): Promise<IcpOfferingMapping[]> {
  const { data, error } = await client
    .from('icp_profiles')
    .select('id,name,offering_domain,learnings')
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    profileId: String(row.id),
    profileName: typeof row.name === 'string' ? row.name : 'Unknown ICP',
    offeringDomain: typeof row.offering_domain === 'string' ? row.offering_domain : null,
    learningsCount: normalizeLearnings(row.learnings).length,
  }));
}
