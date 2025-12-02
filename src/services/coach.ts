import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient } from './aiClient';
import { createIcpHypothesis, createIcpProfile } from './icp';
import { generateDrafts } from './drafts';

export interface IcpBrief {
  name: string;
  description?: string;
  companyCriteria?: Record<string, unknown>;
  personaCriteria?: Record<string, unknown>;
  createdBy?: string;
}

export async function generateIcpProfileFromBrief(
  client: SupabaseClient,
  brief: IcpBrief
): Promise<{ id: string }> {
  const profile = await createIcpProfile(client, {
    name: brief.name,
    description: brief.description,
    companyCriteria: brief.companyCriteria,
    personaCriteria: brief.personaCriteria,
    createdBy: brief.createdBy,
  });
  return { id: profile.id as string };
}

export async function generateIcpHypothesisForSegment(
  client: SupabaseClient,
  segmentId: string,
  profileId: string,
  hypothesisLabel: string,
  searchConfig?: Record<string, unknown>
): Promise<{ id: string }> {
  const hypothesis = await createIcpHypothesis(client, {
    icpProfileId: profileId,
    hypothesisLabel,
    searchConfig,
    segmentId,
  });
  return { id: hypothesis.id as string };
}

export async function generateDraftsForSegmentWithIcp(
  client: SupabaseClient,
  aiClient: AiClient,
  options: {
    campaignId: string;
    segmentId: string;
    icpProfileId?: string;
    icpHypothesisId?: string;
    dryRun?: boolean;
    failFast?: boolean;
    limit?: number;
    graceful?: boolean;
    previewGraceful?: boolean;
    variant?: string;
  }
) {
  return generateDrafts(client, aiClient, {
    campaignId: options.campaignId,
    icpProfileId: options.icpProfileId,
    icpHypothesisId: options.icpHypothesisId,
    dryRun: options.dryRun,
    failFast: options.failFast,
    graceful: options.graceful,
    previewGraceful: options.previewGraceful,
    limit: options.limit,
    variant: options.variant,
  });
}
