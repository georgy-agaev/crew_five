import type { SupabaseClient } from '@supabase/supabase-js';

import { createJob, type JobRow, type JobStatus } from './jobs';

export type SimMode = 'light_roast' | 'persona_sim' | 'reply_assist';

export interface SimRequest {
  mode: SimMode;
  segmentId?: string;
  segmentVersion?: number;
  sampleEmployeeIds?: string[];
  icpProfileId?: string;
  icpHypothesisId?: string;
  draftIds?: string[];
  reason?: string;
}

export interface SimResult {
  jobId: string;
  mode: SimMode;
  status: JobStatus;
  reason: string;
}

const NOT_IMPLEMENTED_STATUS: JobStatus = 'not_implemented';

export async function createSimRequest(client: SupabaseClient, request: SimRequest): Promise<SimResult> {
  if (!request.mode) {
    throw new Error('SimRequest.mode is required');
  }

  if (!request.segmentId && !request.draftIds?.length) {
    throw new Error('SimRequest must include segmentId or draftIds');
  }

  const job = await createJob(client, {
    type: 'sim',
    status: 'created',
    segmentId: request.segmentId,
    segmentVersion: request.segmentVersion,
    payload: {
      mode: request.mode,
      segmentId: request.segmentId ?? null,
      segmentVersion: request.segmentVersion ?? null,
      sampleEmployeeIds: request.sampleEmployeeIds ?? [],
      icpProfileId: request.icpProfileId ?? null,
      icpHypothesisId: request.icpHypothesisId ?? null,
      draftIds: request.draftIds ?? [],
      reason: request.reason ?? null,
    },
  });

  const completed = await completeSimAsNotImplemented(client, job.id, request.reason);

  return {
    jobId: completed.id,
    mode: request.mode,
    status: completed.status,
    reason: (completed.result?.reason as string | undefined) ?? 'SIM not implemented yet',
  };
}

export async function completeSimAsNotImplemented(
  client: SupabaseClient,
  jobId: string,
  reason?: string
): Promise<JobRow> {
  const resolvedReason = reason ?? 'SIM not implemented yet';
  return updateSimStatus(client, jobId, NOT_IMPLEMENTED_STATUS, { reason: resolvedReason });
}

async function updateSimStatus(
  client: SupabaseClient,
  jobId: string,
  status: JobStatus,
  result: Record<string, unknown>
): Promise<JobRow> {
  const updated = await import('./jobs').then(({ updateJobStatus }) =>
    updateJobStatus(client, jobId, status, result)
  );
  return updated;
}

