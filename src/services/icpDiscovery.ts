import type { SupabaseClient } from '@supabase/supabase-js';

import type { ExaClient } from '../integrations/exa.js';
import { createJob, updateJobStatus } from './jobs.js';

export interface RunIcpDiscoveryInput {
  icpProfileId: string;
  icpHypothesisId?: string;
  limit?: number;
  provider?: 'exa';
}

export interface RunIcpDiscoveryResult {
  jobId: string;
  runId: string;
  provider: 'exa';
  status: 'created' | 'running' | 'failed';
}

export async function runIcpDiscoveryWithExa(
  client: SupabaseClient,
  exa: ExaClient,
  input: RunIcpDiscoveryInput
): Promise<RunIcpDiscoveryResult> {
  const job = await createJob(client, {
    type: 'icp',
    status: 'created',
    payload: {
      icp_profile_id: input.icpProfileId,
      icp_hypothesis_id: input.icpHypothesisId ?? null,
      limit: input.limit ?? null,
      provider: 'exa',
    },
  });

  const { data: runRow, error: runError } = await client
    .from('icp_discovery_runs')
    .insert({
      job_id: job.id,
      icp_profile_id: input.icpProfileId,
      icp_hypothesis_id: input.icpHypothesisId ?? null,
      provider: 'exa',
      status: 'created',
      metadata: {},
    })
    .select()
    .single();

  if (runError || !runRow) {
    await updateJobStatus(client, job.id, 'failed', {
      error: 'Failed to create discovery run',
    });
    throw runError ?? new Error('Failed to create discovery run');
  }

  // For this initial slice we do not yet create candidates; we only
  // create a Webset and mark the run as running with provider metadata.
  let websetId: string | null = null;
  try {
    const webset = await exa.createWebset({
      name: `ICP discovery for ${input.icpProfileId}`,
      queries: [],
    });
    websetId = webset.id;
  } catch (err: any) {
    await updateJobStatus(client, job.id, 'failed', {
      error: err?.message ?? 'Exa Webset creation failed',
    });
    throw err;
  }

  const { data: updatedRun, error: updateError } = await client
    .from('icp_discovery_runs')
    .update({
      status: 'running',
      metadata: {
        ...(runRow.metadata ?? {}),
        provider_run_id: websetId,
      },
    })
    .eq('id', runRow.id)
    .select()
    .single();

  if (updateError || !updatedRun) {
    await updateJobStatus(client, job.id, 'failed', {
      error: 'Failed to update discovery run',
    });
    throw updateError ?? new Error('Failed to update discovery run');
  }

  await updateJobStatus(client, job.id, 'running', {
    run_id: updatedRun.id,
    provider: 'exa',
  });

  return {
    jobId: job.id,
    runId: updatedRun.id as string,
    provider: 'exa',
    status: 'running',
  };
}

export interface IngestCandidatesInput {
  runId: string;
  limit?: number;
}

export async function ingestIcpDiscoveryCandidatesFromExa(
  client: SupabaseClient,
  exa: ExaClient,
  input: IngestCandidatesInput
): Promise<number> {
  const { data: runRow, error: runError } = await client
    .from('icp_discovery_runs')
    .select('id, metadata')
    .eq('id', input.runId)
    .single();

  if (runError || !runRow) {
    throw runError ?? new Error('Discovery run not found');
  }

  const providerRunId = (runRow.metadata as any)?.provider_run_id as string | undefined;
  if (!providerRunId) {
    throw new Error('Discovery run is missing provider_run_id');
  }

  const { items } = await exa.getWebsetItems({
    websetId: providerRunId,
    limit: input.limit,
  });

  if (!items || items.length === 0) {
    return 0;
  }

  const rows = items.map((item: any) => ({
    run_id: runRow.id,
    candidate_name: typeof item.title === 'string' ? item.title : null,
    domain: (() => {
      try {
        return new URL(String(item.url ?? '')).hostname;
      } catch {
        return null;
      }
    })(),
    url: String(item.url ?? ''),
    country: null,
    size_hint: null,
    confidence: null,
    raw: item,
  }));

  const { error: insertError } = await client.from('icp_discovery_candidates').insert(rows);
  if (insertError) {
    throw insertError;
  }

  return rows.length;
}

export interface IcpDiscoveryCandidateDto {
  id: string;
  name: string | null;
  domain: string | null;
  url: string | null;
  country: string | null;
  size: string | null;
  confidence: number | null;
}

export async function listIcpDiscoveryCandidates(
  client: SupabaseClient,
  filters: { runId: string }
): Promise<IcpDiscoveryCandidateDto[]> {
  const { data, error } = await client
    .from('icp_discovery_candidates')
    .select('id, run_id, candidate_name, domain, url, country, size_hint, confidence')
    .eq('run_id', filters.runId);

  if (error || !data) {
    throw error ?? new Error('Failed to list discovery candidates');
  }

  return (data as any[]).map((row) => ({
    id: row.id as string,
    name: row.candidate_name ?? null,
    domain: row.domain ?? null,
    url: row.url ?? null,
    country: row.country ?? null,
    size: row.size_hint ?? null,
    confidence: typeof row.confidence === 'number' ? row.confidence : null,
  }));
}

export interface PromoteIcpDiscoveryCandidatesInput {
  runId: string;
  candidateIds: string[];
  segmentId: string;
}

export interface PromoteIcpDiscoveryCandidatesResult {
  promotedCount: number;
}

export async function promoteIcpDiscoveryCandidatesToSegment(
  client: SupabaseClient,
  input: PromoteIcpDiscoveryCandidatesInput
): Promise<PromoteIcpDiscoveryCandidatesResult> {
  if (!input.runId) {
    throw new Error('runId is required');
  }
  if (!input.segmentId) {
    throw new Error('segmentId is required');
  }
  const candidateIds = Array.isArray(input.candidateIds) ? input.candidateIds.filter(Boolean) : [];
  if (candidateIds.length === 0) {
    return { promotedCount: 0 };
  }

  const { data: runRow, error: runError } = await client
    .from('icp_discovery_runs')
    .select('id, icp_profile_id, icp_hypothesis_id')
    .eq('id', input.runId)
    .single();

  if (runError || !runRow) {
    throw runError ?? new Error('Discovery run not found');
  }

  const icpProfileId = (runRow as any).icp_profile_id as string | null;
  const icpHypothesisId = (runRow as any).icp_hypothesis_id as string | null;

  const { data: candidates, error: candidatesError } = await client
    .from('icp_discovery_candidates')
    .select('id, candidate_name, domain, url')
    .in('id', candidateIds);

  if (candidatesError || !candidates) {
    throw candidatesError ?? new Error('Failed to load discovery candidates');
  }

  let promotedCount = 0;

  for (const candidate of candidates as any[]) {
    const domain = candidate.domain as string | null;
    const name = candidate.candidate_name as string | null;
    const url = candidate.url as string | null;

    let companyId: string | null = null;

    if (domain) {
      const { data: existing, error: existingError } = await client
        .from('companies')
        .select('id')
        .eq('website', url ?? null)
        .limit(1)
        .single();

      if (!existingError && existing) {
        companyId = existing.id as string;
      }
    }

    if (!companyId) {
      const { data: created, error: insertError } = await client
        .from('companies')
        .insert({
          company_name: name ?? domain ?? url ?? 'Unknown company',
          website: url ?? null,
          segment: null,
          status: 'Active',
        })
        .select('id')
        .single();

      if (insertError || !created) {
        continue;
      }
      companyId = created.id as string;
    }

    if (!companyId) {
      continue;
    }

    const { data: existingMember, error: existingMemberError } = await client
      .from('segment_members')
      .select('id')
      .eq('segment_id', input.segmentId)
      .eq('company_id', companyId)
      .single();

    if (!existingMemberError && existingMember) {
      continue;
    }

    const { error: insertMemberError } = await client.from('segment_members').insert({
      segment_id: input.segmentId,
      company_id: companyId,
      icp_profile_id: icpProfileId,
      icp_hypothesis_id: icpHypothesisId,
    });

    if (!insertMemberError) {
      promotedCount += 1;
    }
  }

  return { promotedCount };
}
