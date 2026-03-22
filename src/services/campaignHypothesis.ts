import type { SupabaseClient } from '@supabase/supabase-js';

import { getIcpHypothesis, type IcpHypothesis } from './icp.js';

export interface ResolvedCampaignHypothesis {
  hypothesis: IcpHypothesis | null;
  offerId?: string;
  projectId?: string;
}

export async function resolveCampaignHypothesis(
  client: SupabaseClient,
  input: { icpHypothesisId?: string; offerId?: string; projectId?: string }
): Promise<ResolvedCampaignHypothesis> {
  let offerProjectId: string | undefined;
  if (input.offerId) {
    const { data: offer, error: offerError } = await client
      .from('offers')
      .select('id,project_id')
      .eq('id', input.offerId)
      .single();
    if (offerError || !offer) {
      throw offerError ?? new Error('Offer not found');
    }
    offerProjectId = typeof (offer as any).project_id === 'string' ? (offer as any).project_id : undefined;
  }

  if (!input.icpHypothesisId) {
    if (input.projectId && offerProjectId && input.projectId !== offerProjectId) {
      const error = new Error('CAMPAIGN_PROJECT_MISMATCH');
      (error as Error & { code?: string }).code = 'CAMPAIGN_PROJECT_MISMATCH';
      throw error;
    }
    return {
      hypothesis: null,
      offerId: input.offerId,
      projectId: input.projectId ?? offerProjectId,
    };
  }

  const hypothesis = await getIcpHypothesis(client, input.icpHypothesisId);
  const hypothesisOfferId = hypothesis.offer_id ?? undefined;
  const { data: profile, error: profileError } = await client
    .from('icp_profiles')
    .select('id,project_id')
    .eq('id', hypothesis.icp_id)
    .single();

  if (profileError || !profile) {
    throw profileError ?? new Error('ICP profile not found');
  }
  const hypothesisProjectId = typeof (profile as any).project_id === 'string' ? (profile as any).project_id : undefined;

  if (hypothesisOfferId && input.offerId && input.offerId !== hypothesisOfferId) {
    const error = new Error('CAMPAIGN_HYPOTHESIS_OFFER_MISMATCH');
    (error as Error & { code?: string }).code = 'CAMPAIGN_HYPOTHESIS_OFFER_MISMATCH';
    throw error;
  }

  const resolvedOfferId = input.offerId ?? hypothesisOfferId;
  const resolvedProjectId = input.projectId ?? hypothesisProjectId ?? offerProjectId;

  if (input.projectId && hypothesisProjectId && input.projectId !== hypothesisProjectId) {
    const error = new Error('CAMPAIGN_PROJECT_MISMATCH');
    (error as Error & { code?: string }).code = 'CAMPAIGN_PROJECT_MISMATCH';
    throw error;
  }
  if (input.projectId && offerProjectId && input.projectId !== offerProjectId) {
    const error = new Error('CAMPAIGN_PROJECT_MISMATCH');
    (error as Error & { code?: string }).code = 'CAMPAIGN_PROJECT_MISMATCH';
    throw error;
  }
  if (hypothesisProjectId && offerProjectId && hypothesisProjectId !== offerProjectId) {
    const error = new Error('CAMPAIGN_PROJECT_MISMATCH');
    (error as Error & { code?: string }).code = 'CAMPAIGN_PROJECT_MISMATCH';
    throw error;
  }

  return {
    hypothesis,
    offerId: resolvedOfferId,
    projectId: resolvedProjectId,
  };
}
