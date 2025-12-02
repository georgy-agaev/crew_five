import type { SupabaseClient } from '@supabase/supabase-js';

export type JobType = 'send' | 'enrich' | 'sim';

export type JobStatus = 'created' | 'running' | 'completed' | 'failed' | 'not_implemented';

export interface JobRow {
  id: string;
  type: JobType;
  status: JobStatus;
  segment_id: string | null;
  segment_version: number | null;
  payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface CreateJobInput {
  type: JobType;
  status?: JobStatus;
  segmentId?: string;
  segmentVersion?: number;
  payload?: Record<string, unknown>;
}

export async function createJob(client: SupabaseClient, input: CreateJobInput): Promise<JobRow> {
  const { data, error } = await client
    .from('jobs')
    .insert({
      type: input.type,
      status: input.status ?? 'created',
      segment_id: input.segmentId ?? null,
      segment_version: input.segmentVersion ?? null,
      payload: input.payload ?? {},
    })
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to create job');
  }

  return data as JobRow;
}

export async function updateJobStatus(
  client: SupabaseClient,
  jobId: string,
  status: JobStatus,
  result?: Record<string, unknown>
): Promise<JobRow> {
  const { data, error } = await client
    .from('jobs')
    .update({
      status,
      result: result ?? {},
    })
    .eq('id', jobId)
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error('Failed to update job');
  }

  return data as JobRow;
}

