import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient } from './aiClient';
import type { ChatClient } from './chatClient';
import { createIcpHypothesis, createIcpProfile } from './icp';
import { generateDrafts } from './drafts';
import type {
  IcpCoachHypothesisInput,
  IcpCoachHypothesisPayload,
  IcpCoachProfileInput,
  IcpCoachProfilePayload,
} from './icpCoach';
import { runIcpCoachHypothesisLlm, runIcpCoachProfileLlm } from './icpCoach';
import { createJob, updateJobStatus } from './jobs';

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
    provider?: string;
    model?: string;
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
    provider: options.provider,
    model: options.model,
  });
}

export async function createIcpProfileViaCoach(
  client: SupabaseClient,
  chatClient: ChatClient,
  input: IcpCoachProfileInput
): Promise<{ jobId: string; profile: { id: string } & Record<string, unknown> }> {
  const job = await createJob(client, {
    type: 'icp',
    payload: {
      mode: 'profile',
      input,
    } as Record<string, unknown>,
  });

  let payload: IcpCoachProfilePayload;
  try {
    payload = await runIcpCoachProfileLlm(chatClient, input);
  } catch (error: any) {
    await updateJobStatus(client, job.id, 'failed', {
      error: error?.message ?? 'ICP coach profile generation failed',
    });
    throw error;
  }

  const profile = await createIcpProfile(client, {
    name: payload.name,
    description: payload.description ?? input.description,
    companyCriteria: {
      ...(payload.companyCriteria ?? {}),
      ...(payload.triggers ? { triggers: payload.triggers } : {}),
      ...(payload.dataSources ? { dataSources: payload.dataSources } : {}),
    },
    personaCriteria: payload.personaCriteria ?? {},
    createdBy: undefined,
  });

  await updateJobStatus(client, job.id, 'completed', {
    profileId: profile.id,
  });

  return {
    jobId: job.id,
    profile: profile as { id: string } & Record<string, unknown>,
  };
}

export async function createIcpHypothesisViaCoach(
  client: SupabaseClient,
  chatClient: ChatClient,
  input: IcpCoachHypothesisInput
): Promise<{ jobId: string; hypothesis: { id: string } & Record<string, unknown> }> {
  const job = await createJob(client, {
    type: 'icp',
    payload: {
      mode: 'hypothesis',
      input,
    } as Record<string, unknown>,
  });

  let payload: IcpCoachHypothesisPayload;
  try {
    payload = await runIcpCoachHypothesisLlm(chatClient, input);
  } catch (error: any) {
    await updateJobStatus(client, job.id, 'failed', {
      error: error?.message ?? 'ICP coach hypothesis generation failed',
    });
    throw error;
  }

  const hypothesis = await createIcpHypothesis(client, {
    icpProfileId: input.icpProfileId,
    hypothesisLabel: payload.hypothesisLabel,
    searchConfig: payload.searchConfig,
  });

  await updateJobStatus(client, job.id, 'completed', {
    hypothesisId: hypothesis.id,
  });

  return {
    jobId: job.id,
    hypothesis: hypothesis as { id: string } & Record<string, unknown>,
  };
}
