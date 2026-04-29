import type { SupabaseClient } from '@supabase/supabase-js';

import { createJob, updateJobStatus, type JobRow, type JobStatus } from './jobs.js';

const DEFAULT_STALE_TIMEOUT_MINUTES = 30;

export interface DraftGenerationJobRequest {
  campaignId: string;
  dryRun?: boolean;
  limit?: number;
  companyIds?: string[];
  contactIds?: string[];
  draftsModel?: 'sonnet' | 'opus';
  interactionMode?: 'coach' | 'express';
  dataQualityMode?: 'strict' | 'graceful';
  icpProfileId?: string;
  icpHypothesisId?: string;
  coachPromptStep?: string;
  explicitCoachPromptId?: string;
  provider?: string;
  model?: string;
}

export interface DraftGenerationCommandResult extends Record<string, unknown> {
  generated?: number;
  failed?: number;
  skipped?: number;
  requested_contact_count?: number;
  skipped_by_reason?: Record<string, number>;
  skipped_details?: unknown[];
  errors?: unknown[];
}

export interface DraftGenerationProgressEvent extends Record<string, unknown> {
  event: string;
}

export interface DraftGenerationJobStartResult {
  jobId: string;
  status: JobStatus;
  campaignId: string;
  dryRun: boolean;
}

export interface DraftGenerationJobStatusView extends DraftGenerationJobStartResult {
  generated: number;
  failed: number;
  skipped: number;
  requestedContactCount: number | null;
  totalRecipients: number | null;
  lastEvent: string | null;
  skippedByReason: Record<string, number>;
  skippedDetails: unknown[];
  errors: unknown[];
  result: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

function toNumber(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function toPayload(job: JobRow) {
  return (job.payload ?? {}) as Record<string, unknown>;
}

function toResult(job: JobRow) {
  return (job.result ?? {}) as Record<string, unknown>;
}

function parseNonNegativeNumber(value: string | undefined): number | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function getStaleTimeoutMs(): number {
  const minutes =
    parseNonNegativeNumber(process.env.DRAFT_GENERATION_JOB_STALE_MINUTES) ??
    DEFAULT_STALE_TIMEOUT_MINUTES;
  return minutes * 60 * 1000;
}

function parseTimestampMs(value: unknown): number | null {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isDraftGenerationJobStale(job: JobRow, nowMs = Date.now()): boolean {
  if (job.status !== 'created' && job.status !== 'running') {
    return false;
  }
  const staleTimeoutMs = getStaleTimeoutMs();
  if (staleTimeoutMs <= 0) {
    return false;
  }
  const updatedMs = parseTimestampMs(job.updated_at) ?? parseTimestampMs(job.created_at);
  if (updatedMs === null) {
    return false;
  }
  return nowMs - updatedMs > staleTimeoutMs;
}

function buildStaleFailureResult(job: JobRow): Record<string, unknown> {
  const result = toResult(job);
  const staleTimeoutMinutes = getStaleTimeoutMs() / (60 * 1000);
  const message =
    `Draft generation job did not receive progress for ${staleTimeoutMinutes} minute(s) ` +
    'and was marked failed. The Outreach process may have stopped or hit provider limits.';
  const errors = Array.isArray(result.errors) ? result.errors : [];
  return {
    ...result,
    generated: toNumber(result.generated),
    failed: Math.max(1, toNumber(result.failed)),
    skipped: toNumber(result.skipped),
    errors: [...errors, message],
    error: message,
    error_code: 'draft_generation_stale_timeout',
    lastEvent: 'failed',
    completedAt: new Date().toISOString(),
  };
}

async function markDraftGenerationJobFailedIfStale(
  client: SupabaseClient,
  job: JobRow,
  options: { returnFailedJob?: boolean } = {}
): Promise<JobRow | null> {
  if (!isDraftGenerationJobStale(job)) {
    return job;
  }
  const failed = await updateJobStatus(client, job.id, 'failed', buildStaleFailureResult(job));
  return options.returnFailedJob ? failed : null;
}

function appendLimited<T>(current: unknown, item: T, maxItems: number): T[] {
  const list = Array.isArray(current) ? current : [];
  return [...list, item].slice(-maxItems) as T[];
}

function incrementReasonMap(current: unknown, reason: string): Record<string, number> {
  const map = current && typeof current === 'object' ? { ...(current as Record<string, number>) } : {};
  map[reason] = toNumber(map[reason]) + 1;
  return map;
}

function mergeProgressEvent(result: Record<string, unknown>, event: DraftGenerationProgressEvent) {
  const next: Record<string, unknown> = {
    ...result,
    lastEvent: event.event,
    progress_events: appendLimited(result.progress_events, event, 50),
  };

  if (event.event === 'started') {
    if (typeof event.total_recipients === 'number') {
      next.total_recipients = event.total_recipients;
      next.requested_contact_count = event.total_recipients;
    }
    if (typeof event.total_companies === 'number') {
      next.total_companies = event.total_companies;
    }
    if (typeof event.dry_run === 'boolean') {
      next.dryRun = event.dry_run;
    }
    return next;
  }

  if (event.event === 'skipped') {
    const reason = typeof event.reason === 'string' ? event.reason : 'unknown';
    next.skipped = toNumber(next.skipped) + 1;
    next.skipped_by_reason = incrementReasonMap(next.skipped_by_reason, reason);
    next.skipped_details = appendLimited(next.skipped_details, event, 500);
    return next;
  }

  if (event.event === 'failed') {
    const message = typeof event.error === 'string' ? event.error : 'Draft generation step failed';
    next.failed = toNumber(next.failed) + 1;
    next.errors = appendLimited(next.errors, message, 100);
    next.failed_details = appendLimited(next.failed_details, event, 100);
    return next;
  }

  if (event.event === 'draft_created') {
    next.generated = toNumber(next.generated) + 1;
    next.draft_created_details = appendLimited(next.draft_created_details, event, 100);
    return next;
  }

  if (event.event === 'completed') {
    if (typeof event.generated === 'number') next.generated = event.generated;
    if (typeof event.failed === 'number') next.failed = event.failed;
    if (typeof event.skipped === 'number') next.skipped = event.skipped;
    if (typeof event.preview_recipients === 'number') next.preview_recipients = event.preview_recipients;
    if (typeof event.preview_companies === 'number') next.preview_companies = event.preview_companies;
    return next;
  }

  return next;
}

export function toDraftGenerationJobStatusView(job: JobRow): DraftGenerationJobStatusView {
  const payload = toPayload(job);
  const result = toResult(job);
  const requestedContactCount =
    typeof result.requested_contact_count === 'number'
      ? result.requested_contact_count
      : typeof result.requestedContactCount === 'number'
        ? result.requestedContactCount
        : null;
  const skippedByReason =
    result.skipped_by_reason && typeof result.skipped_by_reason === 'object'
      ? (result.skipped_by_reason as Record<string, number>)
      : {};
  const skippedDetails = Array.isArray(result.skipped_details) ? result.skipped_details : [];
  const totalRecipients =
    typeof result.total_recipients === 'number'
      ? result.total_recipients
      : requestedContactCount;
  const errors = Array.isArray(result.errors)
    ? result.errors
    : typeof result.error === 'string'
      ? [result.error]
      : [];

  return {
    jobId: job.id,
    status: job.status,
    campaignId: String(payload.campaignId ?? payload.campaign_id ?? ''),
    dryRun: Boolean(payload.dryRun),
    generated: toNumber(result.generated),
    failed: toNumber(result.failed),
    skipped: toNumber(result.skipped),
    requestedContactCount,
    totalRecipients,
    lastEvent: typeof result.lastEvent === 'string' ? result.lastEvent : null,
    skippedByReason,
    skippedDetails,
    errors,
    result,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
  };
}

async function findRunningDraftGenerationJob(
  client: SupabaseClient,
  campaignId: string
): Promise<JobRow | null> {
  const { data, error } = await client
    .from('jobs')
    .select('*')
    .eq('type', 'draft_generation')
    .in('status', ['created', 'running'])
    .contains('payload', { campaignId })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const job = (data as JobRow | null) ?? null;
  return job ? markDraftGenerationJobFailedIfStale(client, job) : null;
}

export async function startDraftGenerationJob(
  client: SupabaseClient,
  request: DraftGenerationJobRequest,
  runGeneration: (
    request: DraftGenerationJobRequest,
    reportProgress: (event: DraftGenerationProgressEvent) => Promise<void>
  ) => Promise<DraftGenerationCommandResult>
): Promise<DraftGenerationJobStartResult> {
  const active = await findRunningDraftGenerationJob(client, request.campaignId);
  if (active) {
    return {
      jobId: active.id,
      status: active.status,
      campaignId: request.campaignId,
      dryRun: Boolean(toPayload(active).dryRun),
    };
  }

  const job = await createJob(client, {
    type: 'draft_generation',
    status: 'running',
    payload: {
      ...request,
      dryRun: Boolean(request.dryRun),
      startedAt: new Date().toISOString(),
    },
  });

  await updateJobStatus(client, job.id, 'running', {
    generated: 0,
    failed: 0,
    skipped: 0,
    requested_contact_count: Array.isArray(request.contactIds) ? request.contactIds.length : null,
    skipped_by_reason: {},
    skipped_details: [],
    errors: [],
    lastEvent: 'started',
  });

  queueMicrotask(() => {
    void (async () => {
      try {
        const reportProgress = async (event: DraftGenerationProgressEvent) => {
          await updateDraftGenerationJobProgress(client, job.id, event);
        };
        const result = await runGeneration(request, reportProgress);
        const progressResult = await getDraftGenerationProgressResult(client, job);
        await updateJobStatus(client, job.id, 'completed', {
          ...progressResult,
          ...result,
          generated: toNumber(result.generated),
          failed: toNumber(result.failed),
          skipped: toNumber(result.skipped),
          errors: Array.isArray(result.errors) ? result.errors : [],
          lastEvent: 'completed',
          completedAt: new Date().toISOString(),
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const progressResult = await getDraftGenerationProgressResult(client, job);
        const progressErrors = Array.isArray(progressResult.errors) ? progressResult.errors : [];
        await updateJobStatus(client, job.id, 'failed', {
          ...progressResult,
          generated: toNumber(progressResult.generated),
          failed: Math.max(1, toNumber(progressResult.failed)),
          skipped: toNumber(progressResult.skipped),
          errors: [...progressErrors, message],
          error: message,
          lastEvent: 'failed',
          completedAt: new Date().toISOString(),
        });
      }
    })();
  });

  return {
    jobId: job.id,
    status: 'running',
    campaignId: request.campaignId,
    dryRun: Boolean(request.dryRun),
  };
}

async function getDraftGenerationProgressResult(
  client: SupabaseClient,
  fallbackJob: JobRow
): Promise<Record<string, unknown>> {
  try {
    return toResult((await getDraftGenerationJobRow(client, fallbackJob.id)) ?? fallbackJob);
  } catch {
    return toResult(fallbackJob);
  }
}

export async function updateDraftGenerationJobProgress(
  client: SupabaseClient,
  jobId: string,
  event: DraftGenerationProgressEvent
): Promise<DraftGenerationJobStatusView | null> {
  const current = await getDraftGenerationJobRow(client, jobId);
  if (!current) return null;
  const result = mergeProgressEvent(toResult(current), event);
  const updated = await updateJobStatus(client, jobId, 'running', result);
  return toDraftGenerationJobStatusView(updated);
}

async function getDraftGenerationJobRow(
  client: SupabaseClient,
  jobId: string
): Promise<JobRow | null> {
  const { data, error } = await client
    .from('jobs')
    .select('*')
    .eq('id', jobId)
    .eq('type', 'draft_generation')
    .maybeSingle();
  if (error) throw error;
  return (data as JobRow | null) ?? null;
}

export async function getDraftGenerationJobStatus(
  client: SupabaseClient,
  jobId: string
): Promise<DraftGenerationJobStatusView | null> {
  const job = await getDraftGenerationJobRow(client, jobId);
  const refreshed = job
    ? await markDraftGenerationJobFailedIfStale(client, job, { returnFailedJob: true })
    : null;
  return refreshed ? toDraftGenerationJobStatusView(refreshed) : null;
}

export async function findActiveDraftGenerationJob(
  client: SupabaseClient,
  campaignId: string
): Promise<DraftGenerationJobStatusView | null> {
  const job = await findRunningDraftGenerationJob(client, campaignId);
  return job ? toDraftGenerationJobStatusView(job) : null;
}
