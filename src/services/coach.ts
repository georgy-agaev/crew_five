import type { SupabaseClient } from '@supabase/supabase-js';

import type { AiClient } from './aiClient.js';
import type { ChatClient } from './chatClient.js';
import { createIcpHypothesis, createIcpProfile } from './icp.js';
import { generateDrafts } from './drafts.js';
import type {
  IcpCoachHypothesisInput,
  IcpCoachHypothesisPayload,
  IcpCoachProfileInput,
  IcpCoachProfilePayload,
  IcpCoachProfilePhases,
} from './icpCoach.js';
import { runIcpCoachHypothesisLlm, runIcpCoachProfileLlm } from './icpCoach.js';
import { createJob, updateJobStatus } from './jobs.js';

export interface IcpBrief {
  name: string;
  description?: string;
  companyCriteria?: Record<string, unknown>;
  personaCriteria?: Record<string, unknown>;
  createdBy?: string;
}

interface PromptTextRow {
  prompt_text: string;
}

function isPromptTextRow(obj: unknown): obj is PromptTextRow {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    'prompt_text' in obj &&
    typeof (obj as PromptTextRow).prompt_text === 'string'
  );
}

export async function resolveCoachPromptText(client: SupabaseClient, promptId: string): Promise<string> {
  const { data, error } = await client
    .from('prompt_registry')
    .select('prompt_text')
    .eq('coach_prompt_id', promptId)
    .limit(1);

  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('prompt_text') && msg.includes('column')) {
      const friendly = new Error('prompt_registry.prompt_text column is missing; cannot resolve coach prompts') as Error & { code: string };
      friendly.code = 'PROMPT_TEXT_COLUMN_MISSING';
      throw friendly;
    }
    throw error;
  }

  const rows = Array.isArray(data) ? data : [];
  if (!rows.length) {
    throw new Error(`Coach prompt ${promptId} not found in prompt_registry`);
  }

  const row = rows[0];
  if (!isPromptTextRow(row)) {
    throw new Error(`Coach prompt ${promptId} has invalid structure`);
  }

  if (!row.prompt_text.trim()) {
    throw new Error(`Coach prompt ${promptId} has no prompt_text content`);
  }
  return row.prompt_text;
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
  return { id: profile.id };
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
  return { id: hypothesis.id };
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

function buildProfileCriteriaFromPhases(
  payload: IcpCoachProfilePayload
): {
  companyCriteria: Record<string, unknown>;
  personaCriteria: Record<string, unknown>;
  phaseOutputs?: IcpCoachProfilePhases;
} {
  const baseCompany: Record<string, unknown> = { ...(payload.companyCriteria ?? {}) };
  const basePersona: Record<string, unknown> = { ...(payload.personaCriteria ?? {}) };
  const phases = payload.phases;

  if (!phases) {
    return {
      companyCriteria: baseCompany,
      personaCriteria: basePersona,
      phaseOutputs: undefined,
    };
  }

  if (phases.phase1?.valueProp) {
    baseCompany.valueProp = phases.phase1.valueProp;
  }

  if (phases.phase2) {
    const p2 = phases.phase2;
    if (p2.industryAndSize) {
      const ind = p2.industryAndSize;
      if (ind.industries) baseCompany.industries = ind.industries;
      if (ind.companySizes) baseCompany.companySizes = ind.companySizes;
      if (ind.exampleCompanies) baseCompany.exampleCompanies = ind.exampleCompanies;
    }
    if (p2.pains) {
      baseCompany.pains = p2.pains;
    }
    if (p2.successFactors) {
      baseCompany.successFactors = p2.successFactors;
    }
    if (p2.disqualifiers) {
      baseCompany.disqualifiers = p2.disqualifiers;
    }
    if (p2.caseStudies) {
      baseCompany.caseStudies = p2.caseStudies;
    }
    if (p2.decisionMakers) {
      basePersona.decisionMakers = p2.decisionMakers;
    }
  }

  if (phases.phase3) {
    const p3 = phases.phase3;
    if (p3.triggers) {
      baseCompany.triggers = p3.triggers;
    }
    if (p3.dataSources) {
      baseCompany.dataSources = p3.dataSources;
    }
  }

  return {
    companyCriteria: baseCompany,
    personaCriteria: basePersona,
    phaseOutputs: phases,
  };
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
    let promptTextOverride: string | undefined;
    if (input.promptId) {
      promptTextOverride = await resolveCoachPromptText(client, input.promptId);
    }
    const userPrompt =
      input.userPrompt && input.userPrompt.trim().length > 0
        ? input.userPrompt
        : input.description ?? input.name;
    const llmInput: IcpCoachProfileInput = {
      ...input,
      userPrompt,
      ...(promptTextOverride ? { promptTextOverride } : {}),
    };
    payload = await runIcpCoachProfileLlm(chatClient, llmInput);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'ICP coach profile generation failed';
    await updateJobStatus(client, job.id, 'failed', {
      error: errorMessage,
    });
    throw error;
  }

  const { companyCriteria, personaCriteria, phaseOutputs } = buildProfileCriteriaFromPhases(payload);

  const triggers = payload.triggers;
  const dataSources = payload.dataSources;

  const mergedCompanyCriteria: Record<string, unknown> = {
    ...companyCriteria,
    ...(triggers ? { triggers } : {}),
    ...(dataSources ? { dataSources } : {}),
  };

  const profile = await createIcpProfile(client, {
    name: payload.name,
    description: payload.description ?? input.description,
    companyCriteria: mergedCompanyCriteria,
    personaCriteria,
    offeringDomain: input.offeringDomain,
    createdBy: undefined,
    phaseOutputs: phaseOutputs as unknown as Record<string, unknown>,
  });

  await updateJobStatus(client, job.id, 'completed', {
    profileId: profile.id,
  });

  return {
    jobId: job.id,
    profile: profile as unknown as { id: string } & Record<string, unknown>,
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
    let promptTextOverride: string | undefined;
    if (input.promptId) {
      promptTextOverride = await resolveCoachPromptText(client, input.promptId);
    }
    const userPrompt =
      input.userPrompt && input.userPrompt.trim().length > 0
        ? input.userPrompt
        : input.icpDescription ?? `ICP profile id: ${input.icpProfileId}`;
    const llmInput: IcpCoachHypothesisInput = {
      ...input,
      userPrompt,
      ...(promptTextOverride ? { promptTextOverride } : {}),
    };
    payload = await runIcpCoachHypothesisLlm(chatClient, llmInput);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'ICP coach hypothesis generation failed';
    await updateJobStatus(client, job.id, 'failed', {
      error: errorMessage,
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
    hypothesis: hypothesis as unknown as { id: string } & Record<string, unknown>,
  };
}
